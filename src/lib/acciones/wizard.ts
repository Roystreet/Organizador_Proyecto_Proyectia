'use server';

/**
 * Asistente de creación de proyecto.
 *
 * El proyecto se persiste como BORRADOR desde el paso 1 (`wizard_paso` no
 * nulo). El motor de IA exige un id real —construye el payload a partir de él,
 * cachea por él y lo referencia en `analisis_ia`—, así que un asistente sin
 * persistencia obligaría a duplicar el motor. Además, perder una salida de IA
 * ya pagada al recargar el navegador no es aceptable.
 *
 * El paso vive en la URL, no en estado de cliente: atrás, adelante y recargar
 * funcionan solos.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { pool, fila } from '@/db';
import { PRIORIDADES } from '@/db/schema';
import { generarSlug, asegurarSlugUnico, generarCodigoProyecto } from '@/lib/identificadores';
import { registrarEnBitacora } from '@/lib/bitacora';
import { texto, entero, erroresDeZod, esDuplicado } from './util';
import type { EstadoFormulario } from './tipos';
import { PASOS_TOTAL } from '@/lib/wizard';

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');

const zBorrador = z.object({
  nombre: z.string({ error: 'El nombre es obligatorio' })
    .min(3, 'Mínimo 3 caracteres').max(200, 'Máximo 200 caracteres'),
  descripcion: z.string().max(5000, 'Máximo 5000 caracteres').nullable(),
  categoriaId: z.number().int().positive().nullable(),
  empresaId: z.number().int().positive().nullable(),
  responsableId: z.number().int().positive().nullable(),
  prioridad: z.enum(PRIORIDADES),
  fechaInicio: FECHA.nullable(),
  fechaFinEstimada: FECHA.nullable(),
  sectorIds: z.array(z.number().int().positive()).max(5, 'Máximo 5 sectores'),
}).refine(
  (p) => !p.fechaInicio || !p.fechaFinEstimada || p.fechaFinEstimada >= p.fechaInicio,
  { path: ['fechaFinEstimada'], error: 'La fecha de fin no puede ser anterior al inicio' },
);

function leer(datos: FormData) {
  return zBorrador.safeParse({
    nombre: texto(datos, 'nombre') ?? '',
    descripcion: texto(datos, 'descripcion'),
    categoriaId: entero(datos, 'categoriaId'),
    empresaId: entero(datos, 'empresaId'),
    responsableId: entero(datos, 'responsableId'),
    prioridad: texto(datos, 'prioridad') ?? 'media',
    fechaInicio: texto(datos, 'fechaInicio'),
    fechaFinEstimada: texto(datos, 'fechaFinEstimada'),
    sectorIds: datos.getAll('sectorIds')
      .map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0),
  });
}

async function sincronizarSectoresProyecto(
  conexion: Awaited<ReturnType<typeof pool.getConnection>>,
  proyectoId: number,
  sectorIds: number[],
) {
  await conexion.query('DELETE FROM proyecto_sectores WHERE proyecto_id = ?', [proyectoId]);
  for (const [i, sectorId] of sectorIds.entries()) {
    await conexion.query(
      `INSERT INTO proyecto_sectores (proyecto_id, sector_id, es_principal)
       VALUES (?,?,?) ON DUPLICATE KEY UPDATE es_principal = VALUES(es_principal)`,
      [proyectoId, sectorId, i === 0 ? 1 : 0],
    );
  }
}

/** Paso 1: crea el borrador y manda al paso 2. */
export async function crearBorradorProyecto(
  _prev: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseo = leer(datos);
  if (!parseo.success) return erroresDeZod(parseo.error);
  const p = parseo.data;

  let proyectoId = 0;
  for (let intento = 1; intento <= 2; intento++) {
    const codigo = await generarCodigoProyecto(p.nombre);
    const slug = await asegurarSlugUnico(generarSlug(p.nombre), 'proyectos');

    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      const [res] = await conexion.query(
        `INSERT INTO proyectos
           (codigo, nombre, slug, descripcion, categoria_id, empresa_id, responsable_id,
            estado, prioridad, fecha_inicio, fecha_fin_estimada,
            wizard_paso, ultimo_movimiento_en)
         VALUES (?,?,?,?,?,?,?, 'idea', ?,?,?, 2, NOW())`,
        [codigo, p.nombre, slug, p.descripcion, p.categoriaId, p.empresaId,
         p.responsableId, p.prioridad, p.fechaInicio, p.fechaFinEstimada],
      );
      proyectoId = (res as { insertId: number }).insertId;
      await sincronizarSectoresProyecto(conexion, proyectoId, p.sectorIds);
      await registrarEnBitacora(conexion, {
        entidadTipo: 'proyecto', entidadId: proyectoId, proyectoId,
        accion: 'crear', valorNuevo: `${codigo} · ${p.nombre} (borrador)`,
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
  redirect(`/proyectos/nuevo?id=${proyectoId}&paso=2`);
}

/** Guarda cambios del paso 1 sobre un borrador existente. */
export async function actualizarBorradorProyecto(
  proyectoId: number,
  _prev: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseo = leer(datos);
  if (!parseo.success) return erroresDeZod(parseo.error);
  const p = parseo.data;

  const actual = await fila<{ id: number }>('SELECT id FROM proyectos WHERE id = ?', [proyectoId]);
  if (!actual) return { ok: false, mensaje: `No existe el proyecto ${proyectoId}.` };

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query(
      `UPDATE proyectos SET nombre = ?, descripcion = ?, categoria_id = ?, empresa_id = ?,
              responsable_id = ?, prioridad = ?, fecha_inicio = ?, fecha_fin_estimada = ?,
              ultimo_movimiento_en = NOW()
       WHERE id = ?`,
      [p.nombre, p.descripcion, p.categoriaId, p.empresaId, p.responsableId,
       p.prioridad, p.fechaInicio, p.fechaFinEstimada, proyectoId],
    );
    await sincronizarSectoresProyecto(conexion, proyectoId, p.sectorIds);
    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    throw e;
  } finally {
    conexion.release();
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  redirect(`/proyectos/nuevo?id=${proyectoId}&paso=2`);
}

/** Deja constancia de hasta dónde llegó el asistente. */
export async function avanzarPaso(proyectoId: number, paso: number): Promise<void> {
  await pool.query(
    'UPDATE proyectos SET wizard_paso = ? WHERE id = ? AND wizard_paso IS NOT NULL',
    [Math.max(1, Math.min(PASOS_TOTAL, paso)), proyectoId],
  );
  revalidatePath('/proyectos');
}

/** Cierra el asistente: el borrador pasa a proyecto de verdad. */
export async function publicarProyecto(proyectoId: number): Promise<void> {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query(
      `UPDATE proyectos
          SET wizard_paso = NULL,
              estado = IF(estado = 'idea', 'planificacion', estado),
              ultimo_movimiento_en = NOW()
        WHERE id = ?`,
      [proyectoId],
    );
    await registrarEnBitacora(conexion, {
      entidadTipo: 'proyecto', entidadId: proyectoId, proyectoId,
      accion: 'actualizar', campo: 'wizard_paso', valorNuevo: 'proyecto publicado',
    });
    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    throw e;
  } finally {
    conexion.release();
  }

  revalidatePath('/proyectos');
  revalidatePath(`/proyectos/${proyectoId}`);
  redirect(`/proyectos/${proyectoId}`);
}

/**
 * Descarta un borrador abandonado.
 *
 * El `wizard_paso IS NOT NULL` impide borrar por error un proyecto ya
 * publicado; las cascadas se llevan análisis, preguntas, hitos y tareas.
 */
export async function descartarBorrador(proyectoId: number): Promise<void> {
  await pool.query(
    'DELETE FROM proyectos WHERE id = ? AND wizard_paso IS NOT NULL', [proyectoId],
  );
  revalidatePath('/proyectos');
  redirect('/proyectos');
}
