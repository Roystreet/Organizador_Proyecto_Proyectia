'use server';

/**
 * Materialización de los perfiles que el proyecto necesita.
 *
 * Como el resto de propuestas de IA: se relee `respuesta_json` del servidor,
 * se revalida con Zod y se escribe SOLO lo que el usuario marcó. Los ids de
 * personas se vuelven a comprobar contra la base en el momento de aceptar,
 * porque entre generar y aceptar alguien pudo desactivarse.
 */
import { revalidatePath } from 'next/cache';
import { pool, fila, filas } from '@/db';
import { normalizarJson } from '@/lib/ai/cliente';
import { zRespuestaPerfilesRequeridos } from '@/lib/ai/validacion';
import { registrarEnBitacora } from '@/lib/bitacora';
import { resolverHabilidad } from './catalogos';

export interface EntradaAceptarPerfiles {
  analisisId: number;
  proyectoId: number;
  /** Índices de `perfiles` cuyas habilidades se registran como requeridas. */
  perfilesIndices: number[];
  /** Pares perfil→persona que además se suman al equipo del proyecto. */
  candidatos: { perfilIndice: number; personaId: number }[];
  crearHabilidadesNuevas: boolean;
}

export interface ResultadoAceptarPerfiles {
  ok: boolean;
  habilidades: number;
  personas: number;
  omitidas: number;
  mensaje?: string;
}

const vacio = (): ResultadoAceptarPerfiles =>
  ({ ok: false, habilidades: 0, personas: 0, omitidas: 0 });

export async function aceptarPerfilesRequeridos(
  entrada: EntradaAceptarPerfiles,
): Promise<ResultadoAceptarPerfiles> {
  const analisis = await fila<{ respuesta_json: unknown }>(
    `SELECT respuesta_json FROM analisis_ia
      WHERE id = ? AND proyecto_id = ? AND tipo_analisis = 'perfiles_requeridos'
        AND estado = 'ok'`,
    [entrada.analisisId, entrada.proyectoId],
  );
  if (!analisis) {
    return { ...vacio(), mensaje: 'El análisis no existe o no corresponde a este proyecto.' };
  }

  const parseo = zRespuestaPerfilesRequeridos.safeParse(normalizarJson(analisis.respuesta_json));
  if (!parseo.success) {
    return { ...vacio(), mensaje: 'La respuesta guardada no cumple el contrato; vuelve a generar los perfiles.' };
  }

  const elegidos = new Set(entrada.perfilesIndices);
  const perfiles = parseo.data.perfiles.filter((_, i) => elegidos.has(i));

  // Revalidación contra la base: los ids pudieron dejar de ser válidos.
  const personasPedidas = [...new Set(entrada.candidatos.map((c) => c.personaId))];
  const personasValidas = new Set<number>();
  if (personasPedidas.length > 0) {
    const vivas = await filas<{ id: number }>(
      'SELECT id FROM personas WHERE id IN (?) AND activo = 1', [personasPedidas],
    );
    for (const p of vivas) personasValidas.add(p.id);
  }

  let nHab = 0;
  let nPer = 0;
  let omitidas = 0;

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    for (const perfil of perfiles) {
      for (const h of perfil.habilidades) {
        const r = await resolverHabilidad(conexion, h, entrada.crearHabilidadesNuevas);
        if (r.id === null) { omitidas += 1; continue; }
        await conexion.query(
          `INSERT INTO proyecto_habilidades_requeridas
             (proyecto_id, habilidad_id, nivel_minimo, criticidad)
           VALUES (?,?,?,?)
           ON DUPLICATE KEY UPDATE
             nivel_minimo = GREATEST(nivel_minimo, VALUES(nivel_minimo)),
             criticidad   = VALUES(criticidad)`,
          [entrada.proyectoId, r.id, h.nivel_minimo, h.criticidad],
        );
        nHab += 1;
      }
    }

    for (const c of entrada.candidatos) {
      if (!elegidos.has(c.perfilIndice)) continue;
      if (!personasValidas.has(c.personaId)) { omitidas += 1; continue; }
      const [res] = await conexion.query(
        `INSERT INTO proyecto_personas (proyecto_id, persona_id, rol_id, activo)
         VALUES (?,?,NULL,1)
         ON DUPLICATE KEY UPDATE activo = 1`,
        [entrada.proyectoId, c.personaId],
      );
      if ((res as { affectedRows: number }).affectedRows > 0) nPer += 1;
    }

    if (nHab > 0 || nPer > 0) {
      await registrarEnBitacora(conexion, {
        entidadTipo: 'proyecto', entidadId: entrada.proyectoId, proyectoId: entrada.proyectoId,
        accion: 'actualizar', campo: 'perfiles_requeridos',
        valorNuevo: `${nHab} habilidad(es) requeridas, ${nPer} persona(s) al equipo`,
      });
    }

    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    throw e;
  } finally {
    conexion.release();
  }

  revalidatePath(`/proyectos/${entrada.proyectoId}`);

  return {
    ok: true,
    habilidades: nHab,
    personas: nPer,
    omitidas,
    mensaje: omitidas > 0
      ? `${omitidas} elemento(s) se omitieron: habilidades fuera del catálogo o personas ya no activas.`
      : undefined,
  };
}
