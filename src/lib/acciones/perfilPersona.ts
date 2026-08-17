'use server';

/**
 * Perfilado de personas con IA.
 *
 * Mismo principio que `propuestasIa.ts`: la propuesta vive en `analisis_ia` y
 * aquí solo se materializa lo que el usuario marcó, releyendo la respuesta
 * guardada en el servidor. Nunca se confía en JSON reenviado por el cliente.
 */
import { revalidatePath } from 'next/cache';
import { pool, fila } from '@/db';
import { analizarPerfilPersona as ejecutar, normalizarJson, type ResultadoIa } from '@/lib/ai/cliente';
import { zRespuestaPerfilCv, type RespuestaPerfilCvValidada } from '@/lib/ai/validacion';
import { registrarEnBitacora } from '@/lib/bitacora';
import { resolverHabilidad, resolverSector } from './catalogos';

const TOPE_TEXTO = 25_000;

export interface ResultadoPerfil {
  ok: boolean;
  mensaje?: string;
  datos?: RespuestaPerfilCvValidada;
  analisis_id?: number;
  modelo?: string;
  desde_cache?: boolean;
}

/**
 * Guarda el texto aportado como documento y ejecuta el análisis.
 *
 * El texto se persiste antes de analizar para que quede claro de qué insumo
 * salió cada perfil: sin eso, un perfil guardado no es auditable.
 */
export async function generarPerfilPersona(entrada: {
  personaId: number;
  texto: string;
  notas: string | null;
  forzar?: boolean;
}): Promise<ResultadoPerfil> {
  const texto = entrada.texto?.trim() ?? '';
  if (texto.length < 40) {
    return { ok: false, mensaje: 'Pega al menos un párrafo: con menos texto el perfil no dice nada.' };
  }
  if (texto.length > TOPE_TEXTO * 2) {
    return { ok: false, mensaje: `El texto no puede pasar de ${TOPE_TEXTO * 2} caracteres.` };
  }

  const persona = await fila<{ id: number }>(
    'SELECT id FROM personas WHERE id = ?', [entrada.personaId],
  );
  if (!persona) return { ok: false, mensaje: `No existe la persona ${entrada.personaId}.` };

  const notas = entrada.notas?.trim() || null;

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query(
      // `ruta_archivo` queda NULL: es texto pegado, no hay archivo detrás.
      `INSERT INTO persona_documentos
         (persona_id, tipo, nombre_archivo, ruta_archivo, mime_type, tamano_bytes,
          texto_extraido, estado_extraccion, procesado_en)
       VALUES (?, 'notas', ?, NULL, 'text/plain', ?, ?, 'procesado', NOW())`,
      [
        entrada.personaId,
        `Texto pegado · ${new Date().toISOString().slice(0, 10)}`,
        Buffer.byteLength(texto, 'utf8'),
        [texto, notas].filter(Boolean).join('\n\n---\nNotas:\n'),
      ],
    );
    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    throw e;
  } finally {
    conexion.release();
  }

  let r: ResultadoIa<RespuestaPerfilCvValidada>;
  try {
    r = await ejecutar(entrada.personaId, { texto, notas }, { forzar: entrada.forzar });
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : 'Falló el análisis del perfil.' };
  }

  return {
    ok: true,
    datos: r.datos,
    analisis_id: r.analisis_id,
    modelo: r.modelo,
    desde_cache: r.desde_cache,
  };
}

/* -------------------------------------------------------------------------- */
/*  Aceptación: solo lo que el usuario marcó                                   */
/* -------------------------------------------------------------------------- */

export interface EntradaAceptarPerfil {
  analisisId: number;
  personaId: number;
  aplicarResumen: boolean;
  /** Rol, seniority, años y ubicación. Solo rellena lo que hoy está vacío. */
  aplicarDatosBasicos: boolean;
  habilidadesIndices: number[];
  sectoresIndices: number[];
  experienciasIndices: number[];
  fortalezasIndices: number[];
  aportesIndices: number[];
  preguntasIndices: number[];
  mejorasIndices: number[];
  crearHabilidadesNuevas: boolean;
  crearSectoresNuevos: boolean;
}

export interface ResultadoAceptarPerfil {
  ok: boolean;
  mensaje?: string;
  habilidades: number;
  sectores: number;
  experiencias: number;
  insumos: number;
  omitidas: number;
}

const vacio = (): ResultadoAceptarPerfil =>
  ({ ok: false, habilidades: 0, sectores: 0, experiencias: 0, insumos: 0, omitidas: 0 });

export async function aceptarPerfilPersona(
  entrada: EntradaAceptarPerfil,
): Promise<ResultadoAceptarPerfil> {
  const analisis = await fila<{ respuesta_json: unknown }>(
    `SELECT respuesta_json FROM analisis_ia
      WHERE id = ? AND persona_id = ? AND tipo_analisis = 'perfil_cv' AND estado = 'ok'`,
    [entrada.analisisId, entrada.personaId],
  );
  if (!analisis) {
    return { ...vacio(), mensaje: 'El análisis no existe o no corresponde a esta persona.' };
  }

  const parseo = zRespuestaPerfilCv.safeParse(normalizarJson(analisis.respuesta_json));
  if (!parseo.success) {
    return { ...vacio(), mensaje: 'La respuesta guardada no cumple el contrato; vuelve a generar el perfil.' };
  }
  const p = parseo.data;

  const elegir = <T>(lista: T[], indices: number[]): T[] => {
    const set = new Set(indices);
    return lista.filter((_, i) => set.has(i));
  };

  const habilidades = elegir(p.habilidades, entrada.habilidadesIndices);
  const sectores = elegir(p.sectores, entrada.sectoresIndices);
  const experiencias = elegir(p.experiencias, entrada.experienciasIndices);
  const fortalezas = elegir(p.fortalezas, entrada.fortalezasIndices);
  const aportes = elegir(p.aportes, entrada.aportesIndices);
  const preguntas = elegir(p.preguntas_sugeridas, entrada.preguntasIndices);
  const mejoras = elegir(p.areas_mejora, entrada.mejorasIndices);

  let nHab = 0; let nSec = 0; let nExp = 0; let nIns = 0; let omitidas = 0;

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    /* Habilidades. `validado = 1` significa que una persona lo confirmó a mano:
       la IA no lo pisa nunca. */
    for (const h of habilidades) {
      const r = await resolverHabilidad(conexion, h, entrada.crearHabilidadesNuevas);
      if (r.id === null) { omitidas += 1; continue; }
      await conexion.query(
        `INSERT INTO persona_habilidades
           (persona_id, habilidad_id, nivel, anios_experiencia, es_fortaleza,
            evidencia, origen, confianza, validado)
         VALUES (?,?,?,?,?,?, 'ia_cv', ?, 0)
         ON DUPLICATE KEY UPDATE
           nivel             = IF(validado = 1, nivel, VALUES(nivel)),
           anios_experiencia = IF(validado = 1, anios_experiencia, VALUES(anios_experiencia)),
           es_fortaleza      = IF(validado = 1, es_fortaleza, VALUES(es_fortaleza)),
           evidencia         = IF(validado = 1, evidencia, VALUES(evidencia)),
           confianza         = IF(validado = 1, confianza, VALUES(confianza))`,
        [entrada.personaId, r.id, h.nivel, h.anios_experiencia, h.es_fortaleza ? 1 : 0,
         h.evidencia, h.confianza],
      );
      nHab += 1;
    }

    for (const s of sectores) {
      const r = await resolverSector(conexion, s, entrada.crearSectoresNuevos);
      if (r.id === null) { omitidas += 1; continue; }
      await conexion.query(
        `INSERT INTO persona_sectores
           (persona_id, sector_id, nivel, anios_experiencia, es_principal,
            evidencia, origen, confianza, validado)
         VALUES (?,?,?,?,?,?, 'ia_cv', ?, 0)
         ON DUPLICATE KEY UPDATE
           nivel        = IF(validado = 1, nivel, VALUES(nivel)),
           es_principal = IF(validado = 1, es_principal, VALUES(es_principal)),
           evidencia    = IF(validado = 1, evidencia, VALUES(evidencia)),
           confianza    = IF(validado = 1, confianza, VALUES(confianza))`,
        [entrada.personaId, r.id, s.nivel, s.anios_experiencia, s.es_principal ? 1 : 0,
         s.evidencia, s.confianza],
      );
      nSec += 1;
    }

    /* `persona_experiencias` no tiene UNIQUE, así que la guarda va por consulta.
       Se prefiere esto a añadir el índice: si ya hubiera duplicados en la base,
       el ALTER fallaría y bloquearía la migración. */
    for (const e of experiencias) {
      const [dup] = await conexion.query(
        `SELECT id FROM persona_experiencias
          WHERE persona_id = ? AND empresa_nombre = ? AND cargo = ? LIMIT 1`,
        [entrada.personaId, e.empresa, e.cargo],
      );
      if ((dup as unknown[]).length > 0) continue;
      await conexion.query(
        `INSERT INTO persona_experiencias
           (persona_id, empresa_nombre, cargo, industria, fecha_inicio, fecha_fin,
            es_actual, logros, origen)
         VALUES (?,?,?,?,?,?,?,?, 'ia_cv')`,
        [entrada.personaId, e.empresa, e.cargo, e.industria, e.fecha_inicio,
         e.fecha_fin, e.es_actual ? 1 : 0, e.logros.join('\n')],
      );
      nExp += 1;
    }

    /* Insumos: fortalezas, aportes, preguntas y áreas de mejora comparten tabla. */
    const insumos: { tipo: string; titulo: string; detalle: string | null; contexto: string | null; confianza: number | null }[] = [
      ...fortalezas.map((f) => ({ tipo: 'fortaleza', titulo: f.titulo, detalle: f.detalle, contexto: f.contexto, confianza: f.confianza })),
      ...aportes.map((a) => ({ tipo: 'aporte', titulo: a.titulo, detalle: a.detalle, contexto: a.contexto, confianza: a.confianza })),
      ...preguntas.map((q) => ({ tipo: 'pregunta_sugerida', titulo: q.pregunta, detalle: q.motivo, contexto: q.tema, confianza: null })),
      ...mejoras.map((m) => ({ tipo: 'area_mejora', titulo: m.titulo, detalle: m.detalle, contexto: null, confianza: null })),
    ];
    for (const i of insumos) {
      const [dup] = await conexion.query(
        `SELECT id FROM persona_insumos
          WHERE persona_id = ? AND tipo = ? AND titulo = ? LIMIT 1`,
        [entrada.personaId, i.tipo, i.titulo],
      );
      if ((dup as unknown[]).length > 0) continue;
      await conexion.query(
        `INSERT INTO persona_insumos
           (persona_id, tipo, titulo, detalle, contexto, origen, confianza, validado)
         VALUES (?,?,?,?,?, 'ia_cv', ?, 0)`,
        [entrada.personaId, i.tipo, i.titulo.slice(0, 200), i.detalle, i.contexto, i.confianza],
      );
      nIns += 1;
    }

    /* Cabecera de la persona. Los básicos solo rellenan huecos: si ya hay un
       rol escrito a mano, la IA no lo cambia. */
    const campos: string[] = [];
    const valores: unknown[] = [];
    if (entrada.aplicarResumen) {
      campos.push('resumen_ia = ?', 'perfil_actualizado_en = NOW()');
      valores.push(p.perfil.resumen);
    }
    if (entrada.aplicarDatosBasicos) {
      campos.push('rol_principal = COALESCE(rol_principal, ?)');    valores.push(p.perfil.rol_principal);
      campos.push('seniority = COALESCE(seniority, ?)');            valores.push(p.perfil.seniority);
      campos.push('anios_experiencia = COALESCE(anios_experiencia, ?)'); valores.push(p.perfil.anios_experiencia);
      campos.push('ubicacion = COALESCE(ubicacion, ?)');            valores.push(p.perfil.ubicacion);
    }
    if (campos.length > 0) {
      await conexion.query(
        `UPDATE personas SET ${campos.join(', ')} WHERE id = ?`,
        [...valores, entrada.personaId],
      );
    }

    await registrarEnBitacora(conexion, {
      entidadTipo: 'persona',
      entidadId: entrada.personaId,
      accion: 'actualizar',
      campo: 'perfil_ia',
      valorNuevo: `${nHab} habilidad(es), ${nSec} sector(es), ${nExp} experiencia(s), ${nIns} insumo(s)`,
    });

    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    throw e;
  } finally {
    conexion.release();
  }

  revalidatePath('/personas');
  revalidatePath(`/personas/${entrada.personaId}`);

  return {
    ok: true,
    habilidades: nHab,
    sectores: nSec,
    experiencias: nExp,
    insumos: nIns,
    omitidas,
    mensaje: omitidas > 0
      ? `${omitidas} entrada(s) no estaban en el catálogo y se omitieron. Marca «crear nuevas» si quieres añadirlas.`
      : undefined,
  };
}
