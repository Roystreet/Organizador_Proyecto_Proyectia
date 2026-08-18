'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fila, pool } from '@/db';
import { ESTADOS_TAREA, PRIORIDADES } from '@/db/schema';
import { registrarEnBitacora } from '@/lib/bitacora';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const entradaTarea = z.object({
  proyectoId: z.number().int().positive(), id: z.number().int().positive().optional(),
  version: z.number().int().positive().optional(), titulo: z.string().min(3).max(255),
  descripcion: z.string().max(5000).nullable().default(null),
  tipo: z.enum(['feature', 'mejora', 'correccion', 'investigacion', 'documentacion', 'reunion', 'administrativa']).default('feature'),
  estado: z.enum(ESTADOS_TAREA).default('pendiente'), prioridad: z.enum(PRIORIDADES).default('media'),
  responsableId: z.number().int().positive().nullable().default(null), hitoId: z.number().int().positive().nullable().default(null),
  sprintId: z.number().int().positive().nullable().default(null), tareaPadreId: z.number().int().positive().nullable().default(null),
  fechaInicio: fecha.default(null), fechaVencimiento: fecha.default(null), estimacionHoras: z.number().min(0).max(9999).nullable().default(null),
  progresoPct: z.number().int().min(0).max(100).default(0), motivoBloqueo: z.string().max(500).nullable().default(null),
  dependeDeIds: z.array(z.number().int().positive()).max(50).default([]),
}).superRefine((v, ctx) => {
  if (v.estado === 'bloqueada' && !v.motivoBloqueo?.trim()) ctx.addIssue({ code: 'custom', path: ['motivoBloqueo'], message: 'Explica por qué está bloqueada.' });
  if (v.fechaInicio && v.fechaVencimiento && v.fechaVencimiento < v.fechaInicio) ctx.addIssue({ code: 'custom', path: ['fechaVencimiento'], message: 'No puede ser anterior al inicio.' });
});

export type EntradaTarea = z.input<typeof entradaTarea>;
export interface ResultadoTarea { ok: boolean; mensaje: string; errores?: Record<string, string>; version?: number; conflicto?: unknown }

const errores = (e: z.ZodError): ResultadoTarea => ({ ok: false, mensaje: 'Revisa los campos.', errores: Object.fromEntries(e.issues.map((x) => [String(x.path[0]), x.message])) });

async function creaCiclo(tareaId: number, dependeDeId: number): Promise<boolean> {
  const r = await fila<{ ciclo: number }>(`WITH RECURSIVE cadena AS (
    SELECT depende_de_id FROM tarea_dependencias WHERE tarea_id = ? AND tipo = 'bloquea'
    UNION DISTINCT SELECT td.depende_de_id FROM tarea_dependencias td JOIN cadena c ON td.tarea_id = c.depende_de_id WHERE td.tipo = 'bloquea'
  ) SELECT EXISTS(SELECT 1 FROM cadena WHERE depende_de_id = ?) AS ciclo`, [dependeDeId, tareaId]);
  return Boolean(r?.ciclo);
}

export async function guardarTarea(entrada: EntradaTarea): Promise<ResultadoTarea> {
  const p = entradaTarea.safeParse(entrada); if (!p.success) return errores(p.error);
  const v = p.data;
  if (v.id && v.dependeDeIds.includes(v.id)) return { ok: false, mensaje: 'Una tarea no puede depender de sí misma.' };
  if (v.id) for (const dep of v.dependeDeIds) if (await creaCiclo(v.id, dep)) return { ok: false, mensaje: 'La dependencia crearía un ciclo.' };

  const actual = v.id ? await fila<{ estado: string; version: number }>('SELECT estado, version FROM tareas WHERE id = ? AND proyecto_id = ?', [v.id, v.proyectoId]) : null;
  if (v.id && !actual) return { ok: false, mensaje: 'La tarea no existe.' };
  if (actual && actual.version !== v.version) {
    const conflicto = await fila('SELECT * FROM tareas WHERE id = ?', [v.id]);
    return { ok: false, mensaje: 'La tarea cambió en otra vista. Recarga antes de guardar.', version: actual.version, conflicto };
  }

  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    const completada = v.estado === 'completada'; const bloqueada = v.estado === 'bloqueada';
    let id = v.id;
    if (id) {
      await cx.query(`UPDATE tareas SET titulo=?, descripcion=?, tipo=?, estado=?, prioridad=?, responsable_id=?, hito_id=?, sprint_id=?, tarea_padre_id=?,
        fecha_inicio=?, fecha_vencimiento=?, estimacion_horas=?, progreso_pct=?, motivo_bloqueo=?,
        bloqueada_desde=CASE WHEN ? AND bloqueada_desde IS NULL THEN NOW() WHEN NOT ? THEN NULL ELSE bloqueada_desde END,
        fecha_completada=CASE WHEN ? THEN COALESCE(fecha_completada,NOW()) ELSE NULL END, version=version+1
        WHERE id=? AND proyecto_id=? AND version=?`, [v.titulo, v.descripcion, v.tipo, v.estado, v.prioridad, v.responsableId, v.hitoId, v.sprintId, v.tareaPadreId,
        v.fechaInicio, v.fechaVencimiento, v.estimacionHoras, completada ? 100 : v.progresoPct, bloqueada ? v.motivoBloqueo : null,
        bloqueada, bloqueada, completada, id, v.proyectoId, v.version]);
      await cx.query('DELETE FROM tarea_dependencias WHERE tarea_id = ?', [id]);
    } else {
      const [res] = await cx.query(`INSERT INTO tareas (proyecto_id,titulo,descripcion,tipo,estado,prioridad,responsable_id,hito_id,sprint_id,tarea_padre_id,
        fecha_inicio,fecha_vencimiento,estimacion_horas,progreso_pct,motivo_bloqueo,bloqueada_desde,fecha_completada)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [v.proyectoId, v.titulo, v.descripcion, v.tipo, v.estado, v.prioridad, v.responsableId, v.hitoId, v.sprintId, v.tareaPadreId,
        v.fechaInicio, v.fechaVencimiento, v.estimacionHoras, completada ? 100 : v.progresoPct, bloqueada ? v.motivoBloqueo : null, bloqueada ? new Date() : null, completada ? new Date() : null]);
      id = (res as { insertId: number }).insertId;
    }
    for (const dep of v.dependeDeIds) await cx.query('INSERT INTO tarea_dependencias (tarea_id,depende_de_id,tipo) VALUES (?,?,\'bloquea\')', [id, dep]);
    await cx.query('UPDATE proyectos SET ultimo_movimiento_en=NOW() WHERE id=?', [v.proyectoId]);
    await registrarEnBitacora(cx, { entidadTipo: 'tarea', entidadId: id!, proyectoId: v.proyectoId, accion: actual?.estado !== v.estado ? 'cambio_estado' : v.id ? 'actualizar' : 'crear', campo: actual?.estado !== v.estado ? 'estado' : null, valorAnterior: actual?.estado, valorNuevo: v.estado });
    await cx.commit();
    revalidatePath(`/proyectos/${v.proyectoId}`); revalidatePath('/');
    return { ok: true, mensaje: v.id ? 'Tarea actualizada.' : 'Tarea creada.', version: (v.version ?? 0) + 1 };
  } catch (e) { await cx.rollback(); return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo guardar.' }; }
  finally { cx.release(); }
}

export async function cambiarEstadoTarea(id: number, proyectoId: number, version: number, estado: typeof ESTADOS_TAREA[number], motivo?: string): Promise<ResultadoTarea> {
  const t = await fila<any>('SELECT * FROM tareas WHERE id=? AND proyecto_id=?', [id, proyectoId]);
  if (!t) return { ok: false, mensaje: 'La tarea no existe.' };
  return guardarTarea({ proyectoId, id, version, titulo: t.titulo, descripcion: t.descripcion, tipo: t.tipo, estado, prioridad: t.prioridad,
    responsableId: t.responsable_id, hitoId: t.hito_id, sprintId: t.sprint_id, tareaPadreId: t.tarea_padre_id, fechaInicio: t.fecha_inicio,
    fechaVencimiento: t.fecha_vencimiento, estimacionHoras: t.estimacion_horas, progresoPct: t.progreso_pct,
    motivoBloqueo: estado === 'bloqueada' ? motivo ?? t.motivo_bloqueo : null,
    dependeDeIds: String((await fila<{ ids: string | null }>('SELECT GROUP_CONCAT(depende_de_id) ids FROM tarea_dependencias WHERE tarea_id=?', [id]))?.ids ?? '').split(',').filter(Boolean).map(Number) });
}
