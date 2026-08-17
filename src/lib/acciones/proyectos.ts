'use server';

/**
 * Mutaciones de proyectos. Patrón de toda la capa de acciones:
 * Zod (enums importados del schema) → identificadores únicos → transacción →
 * bitácora → revalidatePath → redirect.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { pool, fila } from '@/db';
import { ESTADOS_PROYECTO, PRIORIDADES } from '@/db/schema';
import { generarSlug, asegurarSlugUnico, generarCodigoProyecto } from '@/lib/identificadores';
import { registrarEnBitacora } from '@/lib/bitacora';
import { texto, entero, erroresDeZod, esDuplicado } from './util';
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
  });
}

export async function crearProyecto(
  _prev: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseo = leerFormulario(datos);
  if (!parseo.success) return erroresDeZod(parseo.error);
  const p = parseo.data;

  let proyectoId = 0;

  // Dos intentos: si el código o el slug chocan (carrera), se regeneran.
  for (let intento = 1; intento <= 2; intento++) {
    const codigo = await generarCodigoProyecto(p.nombre);
    const slug = await asegurarSlugUnico(generarSlug(p.nombre), 'proyectos');

    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      const [res] = await conexion.query(
        `INSERT INTO proyectos
           (codigo, nombre, slug, descripcion, objetivo, categoria_id, empresa_id,
            responsable_id, estado, prioridad, fecha_inicio, fecha_fin_estimada,
            ultimo_movimiento_en)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
        [
          codigo, p.nombre, slug, p.descripcion, p.objetivo, p.categoriaId, p.empresaId,
          p.responsableId, p.estado, p.prioridad, p.fechaInicio, p.fechaFinEstimada,
        ],
      );
      proyectoId = (res as { insertId: number }).insertId;
      await registrarEnBitacora(conexion, {
        entidadTipo: 'proyecto', entidadId: proyectoId, proyectoId,
        accion: 'crear', valorNuevo: `${codigo} · ${p.nombre}`,
      });
      await conexion.commit();
      break;
    } catch (e) {
      await conexion.rollback();
      if (esDuplicado(e) && intento === 1) continue;
      if (esDuplicado(e)) return { ok: false, mensaje: 'El código o el slug ya existen. Intenta de nuevo.' };
      throw e;
    } finally {
      conexion.release();
    }
  }

  revalidatePath('/proyectos');
  revalidatePath('/');
  // `?planteamiento=auto` dispara el análisis de planteamiento al llegar al detalle.
  redirect(`/proyectos/${proyectoId}?planteamiento=auto`);
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
