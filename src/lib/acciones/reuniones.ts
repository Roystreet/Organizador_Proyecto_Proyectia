'use server';

/**
 * Reuniones: la serie (`reuniones`), sus ocurrencias (`reunion_instancias`) y
 * la minuta de cada ocurrencia.
 *
 * Sobre la hora: se guarda como RELOJ DE PARED en la zona horaria de la
 * reunión, no como instante UTC. Es decir, «10:00 en America/Caracas» se
 * almacena literalmente como `10:00:00`, y `zona_horaria` dice cómo leerlo. Por
 * eso el literal del `datetime-local` viaja sin convertir y la aritmética de la
 * recurrencia se hace en UTC: sin DST de por medio, «todos los jueves a las
 * 10:00» sigue siendo a las 10:00 todo el año. `reunionesAgenda` lo devuelve
 * con `DATE_FORMAT`, así que el viaje de ida y vuelta es exacto.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fila, filas, pool } from '@/db';
import { registrarEnBitacora } from '@/lib/bitacora';
import { esDuplicado } from './util';
import { modeloPara, razonamientoPara } from '@/lib/ai/modelos';

export interface ResultadoReunion { ok: boolean; mensaje?: string; id?: number }

/* -------------------------------------------------------------------------- */
/*  Reloj de pared                                                             */
/* -------------------------------------------------------------------------- */

const LITERAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?$/;

/** `2026-08-17T10:00` → Date en UTC con esos mismos componentes. */
function aFecha(literal: string): Date {
  const m = LITERAL.exec(literal)!;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0));
}

/** Date en UTC → `2026-08-17 10:00:00`, el literal que entiende MySQL. */
function aLiteral(f: Date): string {
  return f.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Fechas de la serie. Topes: un año por delante y 100 ocurrencias, para que una
 * recurrencia mal configurada no llene la tabla.
 */
function ocurrencias(inicio: Date, recurrencia: string, hasta: string | null): Date[] {
  const maximo = new Date(inicio);
  maximo.setUTCFullYear(maximo.getUTCFullYear() + 1);
  const limite = hasta ? aFecha(`${hasta}T23:59`) : inicio;
  const fin = limite < maximo ? limite : maximo;

  const fechas: Date[] = [];
  for (let d = new Date(inicio); d <= fin && fechas.length < 100; ) {
    fechas.push(new Date(d));
    if (recurrencia === 'unica') break;
    if (recurrencia === 'semanal') d.setUTCDate(d.getUTCDate() + 7);
    else if (recurrencia === 'quincenal') d.setUTCDate(d.getUTCDate() + 14);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return fechas;
}

/* -------------------------------------------------------------------------- */
/*  Validación                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Un participante es alguien del sistema (`personaId`) o un invitado externo
 * con nombre. Las columnas `nombre_externo` / `email_externo` existían desde el
 * principio y estaban sin usar.
 */
const zParticipante = z.object({
  personaId: z.number().int().positive().nullable(),
  nombreExterno: z.string().max(160).nullable(),
  emailExterno: z.email('Email inválido').max(255).nullable(),
}).refine(
  (p) => p.personaId !== null || Boolean(p.nombreExterno?.trim()),
  { error: 'Un invitado externo necesita al menos nombre' },
);

const zReunion = z.object({
  titulo: z.string().min(3, 'Mínimo 3 caracteres').max(255),
  objetivo: z.string().max(5000).nullable(),
  agenda: z.string().max(10000).nullable(),
  organizadorId: z.number().int().positive().nullable(),
  modalidad: z.enum(['presencial', 'virtual', 'hibrida']),
  ubicacion: z.string().max(255).nullable(),
  enlace: z.url('Enlace inválido').max(500).nullable(),
  zonaHoraria: z.string().min(3).max(80).default('America/Caracas'),
  inicio: z.string().regex(LITERAL, 'Fecha y hora inválidas'),
  duracionMinutos: z.number().int().min(15, 'Mínimo 15 minutos').max(1440),
  recurrencia: z.enum(['unica', 'semanal', 'quincenal', 'mensual']),
  recurrenciaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  participantes: z.array(zParticipante).max(100).default([]),
});

export type EntradaReunion = z.input<typeof zReunion>;

const CAMPOS_SERIE = [
  'proyecto_id', 'titulo', 'objetivo', 'agenda', 'organizador_id', 'modalidad',
  'ubicacion', 'enlace', 'zona_horaria', 'inicio_base', 'duracion_minutos',
  'recurrencia', 'recurrencia_hasta',
] as const;

function valoresSerie(v: z.output<typeof zReunion>, proyectoId: number) {
  return [
    proyectoId, v.titulo, v.objetivo, v.agenda, v.organizadorId, v.modalidad,
    v.ubicacion, v.enlace, v.zonaHoraria, aLiteral(aFecha(v.inicio)), v.duracionMinutos,
    v.recurrencia, v.recurrenciaHasta,
  ];
}

/** Reemplaza la lista de participantes de una serie. */
async function guardarParticipantes(
  cx: Awaited<ReturnType<typeof pool.getConnection>>,
  reunionId: number,
  participantes: z.output<typeof zParticipante>[],
) {
  await cx.query('DELETE FROM reunion_participantes WHERE reunion_id = ?', [reunionId]);
  const vistos = new Set<string>();
  for (const p of participantes) {
    const clave = p.personaId ? `p${p.personaId}` : `e${p.nombreExterno}|${p.emailExterno ?? ''}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    await cx.query(
      `INSERT INTO reunion_participantes (reunion_id, persona_id, nombre_externo, email_externo)
       VALUES (?,?,?,?)`,
      [reunionId, p.personaId, p.personaId ? null : p.nombreExterno, p.emailExterno],
    );
  }
}

/** Inserta las ocurrencias. El upsert evita chocar con `uq_reunion_instancia`. */
async function generarInstancias(
  cx: Awaited<ReturnType<typeof pool.getConnection>>,
  reunionId: number,
  v: z.output<typeof zReunion>,
) {
  for (const d of ocurrencias(aFecha(v.inicio), v.recurrencia, v.recurrenciaHasta)) {
    const fin = new Date(d.getTime() + v.duracionMinutos * 60_000);
    await cx.query(
      `INSERT INTO reunion_instancias (reunion_id, inicio, fin) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE fin = VALUES(fin)`,
      [reunionId, aLiteral(d), aLiteral(fin)],
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Serie: crear, actualizar, eliminar                                         */
/* -------------------------------------------------------------------------- */

export async function crearReunion(
  proyectoId: number,
  entrada: EntradaReunion,
): Promise<ResultadoReunion> {
  const parseo = zReunion.safeParse(entrada);
  if (!parseo.success) return { ok: false, mensaje: parseo.error.issues[0]?.message ?? 'Datos inválidos.' };
  const v = parseo.data;

  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    const [res] = await cx.query(
      `INSERT INTO reuniones (${CAMPOS_SERIE.join(',')})
       VALUES (${CAMPOS_SERIE.map(() => '?').join(',')})`,
      valoresSerie(v, proyectoId),
    );
    const id = (res as { insertId: number }).insertId;
    await generarInstancias(cx, id, v);
    await guardarParticipantes(cx, id, v.participantes);
    await registrarEnBitacora(cx, {
      entidadTipo: 'proyecto', entidadId: proyectoId, proyectoId,
      accion: 'crear', campo: 'reunion', valorNuevo: v.titulo,
    });
    await cx.commit();
    revalidar(proyectoId);
    return { ok: true, mensaje: 'Reunión pautada.', id };
  } catch (e) {
    await cx.rollback();
    return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo pautar.' };
  } finally {
    cx.release();
  }
}

/**
 * Edita la serie. Si cambió algo que afecta al calendario, regenera las
 * ocurrencias — pero conserva las que ya tienen minuta o están marcadas como
 * realizadas: esas son historia, no planificación.
 */
export async function actualizarReunion(
  reunionId: number,
  entrada: EntradaReunion,
): Promise<ResultadoReunion> {
  const parseo = zReunion.safeParse(entrada);
  if (!parseo.success) return { ok: false, mensaje: parseo.error.issues[0]?.message ?? 'Datos inválidos.' };
  const v = parseo.data;

  const actual = await fila<{
    proyecto_id: number; inicio_base: Date | string; duracion_minutos: number;
    recurrencia: string; recurrencia_hasta: string | null;
  }>(
    `SELECT proyecto_id, inicio_base, duracion_minutos, recurrencia, recurrencia_hasta
       FROM reuniones WHERE id = ?`, [reunionId],
  );
  if (!actual) return { ok: false, mensaje: 'La reunión no existe.' };

  const cambioCalendario =
    aLiteral(aFecha(v.inicio)) !== aLiteral(new Date(actual.inicio_base))
    || v.duracionMinutos !== actual.duracion_minutos
    || v.recurrencia !== actual.recurrencia
    || (v.recurrenciaHasta ?? null) !== (actual.recurrencia_hasta ?? null);

  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    await cx.query(
      `UPDATE reuniones SET ${CAMPOS_SERIE.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...valoresSerie(v, actual.proyecto_id), reunionId],
    );
    await guardarParticipantes(cx, reunionId, v.participantes);

    if (cambioCalendario) {
      await cx.query(
        `DELETE FROM reunion_instancias
          WHERE reunion_id = ? AND estado <> 'realizada'
            AND id NOT IN (SELECT instancia_id FROM reunion_minutas)`,
        [reunionId],
      );
      await generarInstancias(cx, reunionId, v);
    }

    await registrarEnBitacora(cx, {
      entidadTipo: 'proyecto', entidadId: actual.proyecto_id, proyectoId: actual.proyecto_id,
      accion: 'actualizar', campo: 'reunion', valorNuevo: v.titulo,
    });
    await cx.commit();
    revalidar(actual.proyecto_id);
    return { ok: true, mensaje: 'Reunión actualizada.', id: reunionId };
  } catch (e) {
    await cx.rollback();
    return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo actualizar.' };
  } finally {
    cx.release();
  }
}

/** Borra la serie entera. Cascadea instancias, minutas y elementos. */
export async function eliminarReunion(reunionId: number): Promise<ResultadoReunion> {
  const actual = await fila<{ proyecto_id: number; titulo: string }>(
    'SELECT proyecto_id, titulo FROM reuniones WHERE id = ?', [reunionId],
  );
  if (!actual) return { ok: false, mensaje: 'La reunión no existe.' };

  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    // `relaciones_semanticas` no tiene FK: sus aristas quedarían colgando.
    await cx.query(
      `DELETE FROM relaciones_semanticas
        WHERE (origen_tipo = 'reunion' AND origen_id = ?)
           OR (destino_tipo = 'reunion' AND destino_id = ?)`,
      [reunionId, reunionId],
    );
    await cx.query('DELETE FROM reuniones WHERE id = ?', [reunionId]);
    await registrarEnBitacora(cx, {
      entidadTipo: 'proyecto', entidadId: actual.proyecto_id, proyectoId: actual.proyecto_id,
      accion: 'eliminar', campo: 'reunion', valorAnterior: actual.titulo,
    });
    await cx.commit();
    revalidar(actual.proyecto_id);
    return { ok: true, mensaje: 'Reunión eliminada.' };
  } catch (e) {
    await cx.rollback();
    return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo eliminar.' };
  } finally {
    cx.release();
  }
}

/* -------------------------------------------------------------------------- */
/*  Ocurrencias sueltas                                                        */
/* -------------------------------------------------------------------------- */

async function proyectoDeInstancia(instanciaId: number) {
  return fila<{ proyecto_id: number; duracion_minutos: number }>(
    `SELECT r.proyecto_id, r.duracion_minutos
       FROM reunion_instancias i JOIN reuniones r ON r.id = i.reunion_id
      WHERE i.id = ?`, [instanciaId],
  );
}

/** Mueve una sola ocurrencia sin tocar el resto de la serie. */
export async function reprogramarInstancia(
  instanciaId: number,
  nuevoInicio: string,
): Promise<ResultadoReunion> {
  if (!LITERAL.test(nuevoInicio)) return { ok: false, mensaje: 'Fecha y hora inválidas.' };
  const ctx = await proyectoDeInstancia(instanciaId);
  if (!ctx) return { ok: false, mensaje: 'La ocurrencia no existe.' };

  const inicio = aFecha(nuevoInicio);
  const fin = new Date(inicio.getTime() + ctx.duracion_minutos * 60_000);
  try {
    await pool.query(
      `UPDATE reunion_instancias SET inicio = ?, fin = ?, estado = 'reprogramada' WHERE id = ?`,
      [aLiteral(inicio), aLiteral(fin), instanciaId],
    );
  } catch (e) {
    // uq_reunion_instancia (reunion_id, inicio): ya hay otra ocurrencia ahí.
    if (esDuplicado(e)) return { ok: false, mensaje: 'Ya hay otra ocurrencia de esta reunión a esa hora.' };
    return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo reprogramar.' };
  }
  revalidar(ctx.proyecto_id);
  return { ok: true, mensaje: 'Ocurrencia reprogramada.' };
}

/** Cancela una ocurrencia. El ICS ya filtra las canceladas. */
export async function cancelarInstancia(instanciaId: number): Promise<ResultadoReunion> {
  const ctx = await proyectoDeInstancia(instanciaId);
  if (!ctx) return { ok: false, mensaje: 'La ocurrencia no existe.' };
  await pool.query(`UPDATE reunion_instancias SET estado = 'cancelada' WHERE id = ?`, [instanciaId]);
  revalidar(ctx.proyecto_id);
  return { ok: true, mensaje: 'Ocurrencia cancelada.' };
}

function revalidar(proyectoId: number) {
  revalidatePath(`/proyectos/${proyectoId}`);
  revalidatePath('/agenda');
  revalidatePath('/grafo');
}

/* -------------------------------------------------------------------------- */
/*  Minutas                                                                    */
/* -------------------------------------------------------------------------- */

const zElemento = z.object({
  tipo: z.enum(['decision', 'aprendizaje', 'resultado', 'bloqueo', 'proximo_paso']),
  titulo: z.string().min(2).max(255),
  detalle: z.string().max(5000).nullable(),
  polaridad: z.enum(['positiva', 'neutral', 'negativa']),
  responsableId: z.number().int().positive().nullable(),
  fechaObjetivo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export type EntradaElemento = z.input<typeof zElemento>;

export async function guardarMinuta(entrada: {
  instanciaId: number;
  notas: string;
  resumen: string;
  publicada: boolean;
  elementos: EntradaElemento[];
}): Promise<ResultadoReunion> {
  const elementos = z.array(zElemento).max(100).safeParse(entrada.elementos);
  if (!elementos.success) return { ok: false, mensaje: 'Revisa los elementos de la minuta.' };

  const contexto = await fila<{ proyecto_id: number }>(
    `SELECT r.proyecto_id FROM reunion_instancias i
       JOIN reuniones r ON r.id = i.reunion_id WHERE i.id = ?`,
    [entrada.instanciaId],
  );
  if (!contexto) return { ok: false, mensaje: 'La reunión no existe.' };

  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    await cx.query(
      `INSERT INTO reunion_minutas (instancia_id, notas, resumen, estado) VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE notas = VALUES(notas), resumen = VALUES(resumen), estado = VALUES(estado)`,
      [entrada.instanciaId, entrada.notas, entrada.resumen, entrada.publicada ? 'publicada' : 'borrador'],
    );
    const [minutas] = await cx.query('SELECT id FROM reunion_minutas WHERE instancia_id = ?', [entrada.instanciaId]);
    const minutaId = (minutas as { id: number }[])[0].id;

    // Los elementos ya vinculados a una tarea sobreviven: son parte del grafo.
    await cx.query('DELETE FROM reunion_elementos WHERE minuta_id = ? AND tarea_id IS NULL', [minutaId]);
    for (const x of elementos.data) {
      await cx.query(
        `INSERT INTO reunion_elementos
           (minuta_id, tipo, titulo, detalle, polaridad, responsable_id, fecha_objetivo, estado)
         VALUES (?,?,?,?,?,?,?,'validado')`,
        [minutaId, x.tipo, x.titulo, x.detalle, x.polaridad, x.responsableId, x.fechaObjetivo],
      );
    }
    if (entrada.publicada) {
      await cx.query(`UPDATE reunion_instancias SET estado = 'realizada' WHERE id = ?`, [entrada.instanciaId]);
    }
    await cx.commit();
    revalidar(contexto.proyecto_id);
    revalidatePath('/aprendizajes');
    return { ok: true, mensaje: 'Minuta guardada.' };
  } catch (e) {
    await cx.rollback();
    return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo guardar.' };
  } finally {
    cx.release();
  }
}

/* -------------------------------------------------------------------------- */
/*  Enlazar la minuta con tareas pendientes                                    */
/* -------------------------------------------------------------------------- */

export async function sugerirTareasDesdeMinuta(instanciaId: number) {
  const m = await fila<{ proyecto_id: number; texto: string }>(
    `SELECT r.proyecto_id, CONCAT_WS(' ', r.titulo, r.objetivo, r.agenda, m.notas, m.resumen) texto
       FROM reunion_instancias i
       JOIN reuniones r ON r.id = i.reunion_id
       LEFT JOIN reunion_minutas m ON m.instancia_id = i.id
      WHERE i.id = ?`,
    [instanciaId],
  );
  if (!m) return [];

  const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const palabras = new Set(normalizar(m.texto).split(/\W+/).filter((x) => x.length > 4));

  const candidatas = await filas<{
    id: number; proyecto_id: number; proyecto: string; titulo: string; descripcion: string | null;
  }>(
    `SELECT t.id, t.proyecto_id, p.nombre proyecto, t.titulo, t.descripcion
       FROM tareas t JOIN proyectos p ON p.id = t.proyecto_id
      WHERE t.estado NOT IN ('completada','cancelada')
      ORDER BY t.prioridad = 'critica' DESC, t.actualizado_en DESC LIMIT 40`,
  );

  const base = candidatas.map((t) => {
    const texto = normalizar(`${t.titulo} ${t.descripcion ?? ''}`);
    const coincidencias = [...palabras].filter((p) => texto.includes(p));
    return {
      ...t,
      puntaje: Math.min(95, 35 + coincidencias.length * 12 + (t.proyecto_id === m.proyecto_id ? 15 : 0)),
      evidencia: coincidencias.slice(0, 5).join(', ') || 'Contexto operativo relacionado',
    };
  }).filter((x) => x.puntaje >= 47).sort((a, b) => b.puntaje - a.puntaje).slice(0, 10);

  if (process.env.IA_MODO === 'simulado' || !process.env.OPENAI_API_KEY || candidatas.length === 0) return base;

  try {
    const modelo = modeloPara('salud_proyecto');
    const esfuerzo = razonamientoPara('salud_proyecto', modelo);
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await openai.responses.create({
      model: modelo,
      instructions: 'Relaciona una minuta con tareas pendientes. Solo devuelve IDs de la lista y explica la evidencia operativa.',
      input: JSON.stringify({ minuta: m.texto, tareas: candidatas }),
      reasoning: esfuerzo ? { effort: esfuerzo } : undefined,
      text: {
        format: {
          type: 'json_schema', name: 'match_minuta_tareas', strict: true,
          schema: {
            type: 'object', additionalProperties: false,
            properties: {
              matches: {
                type: 'array',
                items: {
                  type: 'object', additionalProperties: false,
                  properties: {
                    tarea_id: { type: 'integer' },
                    puntaje: { type: 'integer', description: '0 a 100' },
                    evidencia: { type: 'string' },
                  },
                  required: ['tarea_id', 'puntaje', 'evidencia'],
                },
              },
            },
            required: ['matches'],
          },
        },
      },
    });
    const parsed = JSON.parse(r.output_text) as {
      matches: { tarea_id: number; puntaje: number; evidencia: string }[];
    };
    const mapa = new Map(candidatas.map((x) => [x.id, x]));
    return parsed.matches
      .filter((x) => mapa.has(x.tarea_id) && x.puntaje >= 45)
      .slice(0, 10)
      .map((x) => ({
        ...mapa.get(x.tarea_id)!,
        puntaje: Math.max(0, Math.min(100, x.puntaje)),
        evidencia: x.evidencia,
      }));
  } catch {
    return base;
  }
}

export async function aprobarMatchTarea(
  instanciaId: number,
  tareaId: number,
  evidencia: string,
): Promise<ResultadoReunion> {
  const x = await fila<{ reunion_id: number; proyecto_id: number }>(
    `SELECT i.reunion_id, r.proyecto_id FROM reunion_instancias i
       JOIN reuniones r ON r.id = i.reunion_id WHERE i.id = ?`,
    [instanciaId],
  );
  const t = await fila<{ id: number }>(
    `SELECT id FROM tareas WHERE id = ? AND estado NOT IN ('completada','cancelada')`, [tareaId],
  );
  if (!x || !t) return { ok: false, mensaje: 'La reunión o la tarea ya no está disponible.' };

  await pool.query(
    `INSERT INTO relaciones_semanticas
       (origen_tipo, origen_id, destino_tipo, destino_id, tipo, peso, evidencia, origen, estado)
     VALUES ('reunion',?,'tarea',?,'relaciona',1,?,'ia','validada')
       ON DUPLICATE KEY UPDATE evidencia = VALUES(evidencia), estado = 'validada'`,
    [x.reunion_id, tareaId, evidencia],
  );
  revalidar(x.proyecto_id);
  return { ok: true, mensaje: 'Tarea vinculada.' };
}
