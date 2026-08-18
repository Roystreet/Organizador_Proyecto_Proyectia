'use server';

/**
 * Edición de proyectos. El alta vive en `acciones/wizard.ts`: crear pasa por el
 * asistente, que persiste un borrador para poder correr los análisis de IA.
 *
 * Patrón de toda la capa de acciones:
 * Zod (enums importados del schema) → identificadores únicos → transacción →
 * bitácora → revalidatePath → redirect.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { pool, fila } from '@/db';
import { ESTADOS_PROYECTO, PRIORIDADES } from '@/db/schema';
import { registrarEnBitacora } from '@/lib/bitacora';
import { texto, entero, erroresDeZod } from './util';
import type { EstadoFormulario } from './tipos';

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');

const zProyecto = z.object({
  nombre: z.string({ error: 'El nombre es obligatorio' })
    .min(3, 'Mínimo 3 caracteres').max(200, 'Máximo 200 caracteres'),
  descripcion: z.string().max(5000, 'Máximo 5000 caracteres').nullable(),
  objetivo: z.string().max(2000, 'Máximo 2000 caracteres').nullable(),
  categoriaId: z.number().int().positive().nullable(),
  empresaId: z.number().int().positive().nullable(),
  responsableId: z.number().int().positive().nullable(),
  estado: z.enum(ESTADOS_PROYECTO),
  prioridad: z.enum(PRIORIDADES),
  fechaInicio: FECHA.nullable(),
  fechaFinEstimada: FECHA.nullable(),
  sectorIds: z.array(z.number().int().positive()).max(5, 'Máximo 5 sectores'),
}).refine(
  (p) => !p.fechaInicio || !p.fechaFinEstimada || p.fechaFinEstimada >= p.fechaInicio,
  { path: ['fechaFinEstimada'], error: 'La fecha de fin no puede ser anterior al inicio' },
);

function leerFormulario(datos: FormData) {
  return zProyecto.safeParse({
    nombre: texto(datos, 'nombre') ?? '',
    descripcion: texto(datos, 'descripcion'),
    objetivo: texto(datos, 'objetivo'),
    categoriaId: entero(datos, 'categoriaId'),
    empresaId: entero(datos, 'empresaId'),
    responsableId: entero(datos, 'responsableId'),
    estado: texto(datos, 'estado') ?? 'planificacion',
    prioridad: texto(datos, 'prioridad') ?? 'media',
    fechaInicio: texto(datos, 'fechaInicio'),
    fechaFinEstimada: texto(datos, 'fechaFinEstimada'),
    sectorIds: datos.getAll('sectorIds')
      .map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0),
  });
}

export async function actualizarProyecto(
  id: number,
  _prev: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseo = leerFormulario(datos);
  if (!parseo.success) return erroresDeZod(parseo.error);
  const p = parseo.data;

  const actual = await fila<{ id: number; estado: string; nombre: string }>(
    `SELECT id, estado, nombre FROM proyectos WHERE id = ?`, [id],
  );
  if (!actual) return { ok: false, mensaje: `No existe el proyecto ${id}.` };

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query(
      `UPDATE proyectos SET
         nombre = ?, descripcion = ?, objetivo = ?, categoria_id = ?, empresa_id = ?,
         responsable_id = ?, estado = ?, prioridad = ?, fecha_inicio = ?,
         fecha_fin_estimada = ?, ultimo_movimiento_en = NOW()
       WHERE id = ?`,
      [
        p.nombre, p.descripcion, p.objetivo, p.categoriaId, p.empresaId,
        p.responsableId, p.estado, p.prioridad, p.fechaInicio, p.fechaFinEstimada, id,
      ],
    );
    // El primero marcado cuenta como principal.
    await conexion.query('DELETE FROM proyecto_sectores WHERE proyecto_id = ?', [id]);
    for (const [i, sectorId] of p.sectorIds.entries()) {
      await conexion.query(
        `INSERT INTO proyecto_sectores (proyecto_id, sector_id, es_principal)
         VALUES (?,?,?) ON DUPLICATE KEY UPDATE es_principal = VALUES(es_principal)`,
        [id, sectorId, i === 0 ? 1 : 0],
      );
    }

    if (actual.estado !== p.estado) {
      await registrarEnBitacora(conexion, {
        entidadTipo: 'proyecto', entidadId: id, proyectoId: id,
        accion: 'cambio_estado', campo: 'estado',
        valorAnterior: actual.estado, valorNuevo: p.estado,
      });
    }
    await registrarEnBitacora(conexion, {
      entidadTipo: 'proyecto', entidadId: id, proyectoId: id,
      accion: 'actualizar', valorNuevo: p.nombre,
    });
    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    throw e;
  } finally {
    conexion.release();
  }

  revalidatePath('/proyectos');
  revalidatePath(`/proyectos/${id}`);
  revalidatePath('/');
  redirect(`/proyectos/${id}`);
}

/* -------------------------------------------------------------------------- */
/*  Baja de un proyecto: archivar (reversible) o eliminar (definitivo)         */
/* -------------------------------------------------------------------------- */

export interface ResultadoBaja { ok: boolean; mensaje?: string }

/**
 * Archiva o restaura. `archivado` existía en el esquema desde el principio pero
 * nadie lo escribía; las lecturas del portafolio ya lo filtran, así que un
 * proyecto archivado desaparece de los listados sin perder nada.
 */
export async function archivarProyecto(id: number, archivar: boolean): Promise<ResultadoBaja> {
  const actual = await fila<{ id: number; nombre: string; archivado: number }>(
    'SELECT id, nombre, archivado FROM proyectos WHERE id = ?', [id],
  );
  if (!actual) return { ok: false, mensaje: `No existe el proyecto ${id}.` };
  if (Boolean(actual.archivado) === archivar) return { ok: true };

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query('UPDATE proyectos SET archivado = ? WHERE id = ?', [archivar ? 1 : 0, id]);
    await registrarEnBitacora(conexion, {
      entidadTipo: 'proyecto', entidadId: id, proyectoId: id,
      accion: 'actualizar', campo: 'archivado',
      valorAnterior: actual.archivado ? '1' : '0',
      valorNuevo: archivar ? '1' : '0',
    });
    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo archivar.' };
  } finally {
    conexion.release();
  }

  revalidatePath('/proyectos');
  revalidatePath(`/proyectos/${id}`);
  revalidatePath('/');
  return { ok: true };
}

/**
 * Borrado definitivo. Exige teclear el código del proyecto: es irreversible.
 *
 * Las FK hacia `proyectos` son todas ON DELETE CASCADE, así que un solo DELETE
 * arrastra tareas, hitos, sprints, asuntos, reuniones (→ instancias → minutas →
 * elementos), impactos, análisis, recomendaciones, métricas y bitácora.
 *
 * Lo que NO cascadea son las tres tablas polimórficas —`comentarios`,
 * `adjuntos` y `relaciones_semanticas` no tienen FK— y hay que limpiarlas a
 * mano, antes del DELETE y dentro de la misma transacción.
 */
export async function eliminarProyecto(
  id: number,
  codigoConfirmacion: string,
): Promise<ResultadoBaja> {
  const actual = await fila<{ id: number; codigo: string; nombre: string }>(
    'SELECT id, codigo, nombre FROM proyectos WHERE id = ?', [id],
  );
  if (!actual) return { ok: false, mensaje: `No existe el proyecto ${id}.` };
  if (codigoConfirmacion.trim() !== actual.codigo) {
    return { ok: false, mensaje: `Escribe «${actual.codigo}» para confirmar el borrado.` };
  }

  // Subconsultas por tipo de entidad hija, para las tablas sin FK.
  const HIJAS = {
    tarea:   'SELECT id FROM tareas WHERE proyecto_id = ?',
    asunto:  'SELECT id FROM asuntos WHERE proyecto_id = ?',
    hito:    'SELECT id FROM hitos WHERE proyecto_id = ?',
    reunion: 'SELECT id FROM reuniones WHERE proyecto_id = ?',
    impacto: 'SELECT id FROM impactos_proyecto WHERE proyecto_id = ?',
  } as const;

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    // 1 · Polimórficas sin FK: comentarios y adjuntos. Ambas usan
    //     (entidad_tipo, entidad_id) y comparten los mismos tipos.
    for (const tabla of ['comentarios', 'adjuntos'] as const) {
      await conexion.query(
        `DELETE FROM ${tabla} WHERE (entidad_tipo = 'proyecto' AND entidad_id = ?)
            OR (entidad_tipo = 'tarea'  AND entidad_id IN (${HIJAS.tarea}))
            OR (entidad_tipo = 'asunto' AND entidad_id IN (${HIJAS.asunto}))
            OR (entidad_tipo = 'hito'   AND entidad_id IN (${HIJAS.hito}))`,
        [id, id, id, id],
      );
    }

    // 2 · Aristas del grafo semántico, por los dos extremos.
    for (const lado of ['origen', 'destino'] as const) {
      await conexion.query(
        `DELETE FROM relaciones_semanticas
          WHERE (${lado}_tipo = 'proyecto' AND ${lado}_id = ?)
             OR (${lado}_tipo = 'tarea'    AND ${lado}_id IN (${HIJAS.tarea}))
             OR (${lado}_tipo = 'hito'     AND ${lado}_id IN (${HIJAS.hito}))
             OR (${lado}_tipo = 'reunion'  AND ${lado}_id IN (${HIJAS.reunion}))
             OR (${lado}_tipo = 'impacto'  AND ${lado}_id IN (${HIJAS.impacto}))`,
        [id, id, id, id, id],
      );
    }

    // 3 · La bitácora va ANTES del DELETE y SIN proyectoId: `bitacora.proyecto_id`
    //     es CASCADE, así que un registro que apuntara al proyecto borrado se
    //     borraría a sí mismo y no quedaría rastro de la eliminación.
    await registrarEnBitacora(conexion, {
      entidadTipo: 'proyecto', entidadId: id, proyectoId: null,
      accion: 'eliminar', valorAnterior: `${actual.codigo} · ${actual.nombre}`,
    });

    await conexion.query('DELETE FROM proyectos WHERE id = ?', [id]);
    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo eliminar.' };
  } finally {
    conexion.release();
  }

  for (const ruta of ['/proyectos', '/', '/agenda', '/aprendizajes', '/grafo']) revalidatePath(ruta);
  revalidatePath(`/proyectos/${id}`);
  return { ok: true };
}
