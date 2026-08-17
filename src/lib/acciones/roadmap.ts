'use server';

/**
 * Mutaciones del roadmap: fases (hitos) y fechas de tareas.
 *
 * Son las primeras acciones de hitos y tareas de la aplicación; siguen el mismo
 * patrón que el resto: Zod → transacción → bitácora → revalidatePath.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { pool, fila } from '@/db';
import { registrarEnBitacora } from '@/lib/bitacora';
import { texto, entero, erroresDeZod } from './util';
import type { EstadoFormulario } from './tipos';

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');

const ESTADOS_HITO = ['pendiente', 'en_progreso', 'completado', 'atrasado', 'cancelado'] as const;

const zHito = z.object({
  nombre: z.string({ error: 'El nombre es obligatorio' })
    .min(3, 'Mínimo 3 caracteres').max(200, 'Máximo 200 caracteres'),
  descripcion: z.string().max(2000, 'Máximo 2000 caracteres').nullable(),
  fechaInicio: FECHA.nullable(),
  fechaObjetivo: FECHA.nullable(),
  estado: z.enum(ESTADOS_HITO),
  orden: z.number().int().min(0).max(999).nullable(),
}).refine(
  (h) => !h.fechaInicio || !h.fechaObjetivo || h.fechaObjetivo >= h.fechaInicio,
  { path: ['fechaObjetivo'], error: 'El objetivo no puede ser anterior al inicio' },
);

function leerHito(datos: FormData) {
  return zHito.safeParse({
    nombre: texto(datos, 'nombre') ?? '',
    descripcion: texto(datos, 'descripcion'),
    fechaInicio: texto(datos, 'fechaInicio'),
    fechaObjetivo: texto(datos, 'fechaObjetivo'),
    estado: texto(datos, 'estado') ?? 'pendiente',
    orden: entero(datos, 'orden'),
  });
}

export async function crearHito(
  proyectoId: number,
  _prev: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseo = leerHito(datos);
  if (!parseo.success) return erroresDeZod(parseo.error);
  const h = parseo.data;

  const proyecto = await fila<{ id: number }>('SELECT id FROM proyectos WHERE id = ?', [proyectoId]);
  if (!proyecto) return { ok: false, mensaje: `No existe el proyecto ${proyectoId}.` };

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    let orden = h.orden;
    if (orden === null) {
      const [max] = await conexion.query(
        'SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM hitos WHERE proyecto_id = ?',
        [proyectoId],
      );
      orden = (max as { siguiente: number }[])[0]?.siguiente ?? 1;
    }

    const [res] = await conexion.query(
      `INSERT INTO hitos (proyecto_id, nombre, descripcion, fecha_inicio, fecha_objetivo, estado, orden)
       VALUES (?,?,?,?,?,?,?)`,
      [proyectoId, h.nombre, h.descripcion, h.fechaInicio, h.fechaObjetivo, h.estado, orden],
    );
    const hitoId = (res as { insertId: number }).insertId;

    await registrarEnBitacora(conexion, {
      entidadTipo: 'hito', entidadId: hitoId, proyectoId,
      accion: 'crear', valorNuevo: h.nombre,
    });
    await conexion.query('UPDATE proyectos SET ultimo_movimiento_en = NOW() WHERE id = ?', [proyectoId]);
    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    throw e;
  } finally {
    conexion.release();
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  return { ok: true };
}

export async function actualizarHito(
  hitoId: number,
  _prev: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseo = leerHito(datos);
  if (!parseo.success) return erroresDeZod(parseo.error);
  const h = parseo.data;

  const actual = await fila<{ id: number; proyecto_id: number; estado: string; nombre: string }>(
    'SELECT id, proyecto_id, estado, nombre FROM hitos WHERE id = ?', [hitoId],
  );
  if (!actual) return { ok: false, mensaje: `No existe la fase ${hitoId}.` };

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query(
      `UPDATE hitos SET nombre = ?, descripcion = ?, fecha_inicio = ?,
              fecha_objetivo = ?, estado = ?${h.orden !== null ? ', orden = ?' : ''}
       WHERE id = ?`,
      h.orden !== null
        ? [h.nombre, h.descripcion, h.fechaInicio, h.fechaObjetivo, h.estado, h.orden, hitoId]
        : [h.nombre, h.descripcion, h.fechaInicio, h.fechaObjetivo, h.estado, hitoId],
    );
    if (actual.estado !== h.estado) {
      await registrarEnBitacora(conexion, {
        entidadTipo: 'hito', entidadId: hitoId, proyectoId: actual.proyecto_id,
        accion: 'cambio_estado', campo: 'estado',
        valorAnterior: actual.estado, valorNuevo: h.estado,
      });
    }
    await registrarEnBitacora(conexion, {
      entidadTipo: 'hito', entidadId: hitoId, proyectoId: actual.proyecto_id,
      accion: 'actualizar', valorNuevo: h.nombre,
    });
    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    throw e;
  } finally {
    conexion.release();
  }

  revalidatePath(`/proyectos/${actual.proyecto_id}`);
  return { ok: true };
}

/**
 * Borra una fase. Las tareas NO se borran: `tareas.hito_id` es ON DELETE SET
 * NULL, así que sobreviven sueltas y aparecen en «sin fecha». El diálogo avisa
 * cuántas van a quedar sin fase antes de confirmar.
 */
export async function eliminarHito(hitoId: number): Promise<{ ok: boolean; mensaje?: string }> {
  const actual = await fila<{ id: number; proyecto_id: number; nombre: string }>(
    'SELECT id, proyecto_id, nombre FROM hitos WHERE id = ?', [hitoId],
  );
  if (!actual) return { ok: false, mensaje: `No existe la fase ${hitoId}.` };

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query('DELETE FROM hitos WHERE id = ?', [hitoId]);
    await registrarEnBitacora(conexion, {
      entidadTipo: 'hito', entidadId: hitoId, proyectoId: actual.proyecto_id,
      accion: 'eliminar', valorAnterior: actual.nombre,
    });
    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    throw e;
  } finally {
    conexion.release();
  }

  revalidatePath(`/proyectos/${actual.proyecto_id}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Aplicar fechas a las tareas sin planificar                                 */
/* -------------------------------------------------------------------------- */

export interface ResultadoPlanificar {
  ok: boolean;
  aplicadas: number;
  omitidas: number;
  mensaje?: string;
}

/**
 * Escribe las fechas propuestas.
 *
 * El `AND fecha_inicio IS NULL AND fecha_vencimiento IS NULL` hace la operación
 * NO DESTRUCTIVA por construcción: aunque el cliente reenvíe una lista vieja,
 * jamás pisa una fecha que alguien ya puso. Las que no cumplen se cuentan como
 * omitidas y se informan.
 */
export async function aplicarFechasTareas(entrada: {
  proyectoId: number;
  asignaciones: { tareaId: number; fechaInicio: string; fechaVencimiento: string }[];
}): Promise<ResultadoPlanificar> {
  const zAsignacion = z.object({
    tareaId: z.number().int().positive(),
    fechaInicio: FECHA,
    fechaVencimiento: FECHA,
  });
  const parseo = z.array(zAsignacion).max(500).safeParse(entrada.asignaciones);
  if (!parseo.success) {
    return { ok: false, aplicadas: 0, omitidas: 0, mensaje: 'Las fechas propuestas no son válidas.' };
  }

  let aplicadas = 0;
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    for (const a of parseo.data) {
      const [res] = await conexion.query(
        `UPDATE tareas
            SET fecha_inicio = ?, fecha_vencimiento = ?
          WHERE id = ? AND proyecto_id = ?
            AND fecha_inicio IS NULL AND fecha_vencimiento IS NULL`,
        [a.fechaInicio, a.fechaVencimiento, a.tareaId, entrada.proyectoId],
      );
      aplicadas += (res as { affectedRows: number }).affectedRows;
    }
    if (aplicadas > 0) {
      await registrarEnBitacora(conexion, {
        entidadTipo: 'proyecto', entidadId: entrada.proyectoId, proyectoId: entrada.proyectoId,
        accion: 'actualizar', campo: 'fechas_tareas',
        valorNuevo: `${aplicadas} tarea(s) planificadas desde el roadmap`,
      });
      await conexion.query(
        'UPDATE proyectos SET ultimo_movimiento_en = NOW() WHERE id = ?', [entrada.proyectoId],
      );
    }
    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    throw e;
  } finally {
    conexion.release();
  }

  revalidatePath(`/proyectos/${entrada.proyectoId}`);

  const omitidas = parseo.data.length - aplicadas;
  return {
    ok: true,
    aplicadas,
    omitidas,
    mensaje: omitidas > 0
      ? `${omitidas} tarea(s) ya tenían fecha y no se tocaron.`
      : undefined,
  };
}
