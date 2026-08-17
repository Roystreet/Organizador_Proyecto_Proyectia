'use server';

/**
 * Respuestas a las preguntas de encuadre.
 *
 * Responder no es cosmético: las respuestas viajan en el payload de
 * `planteamiento_proyecto` y de `perfiles_requeridos`, así que contestar una
 * pregunta cambia el hash y hace que el siguiente análisis sea mejor en vez de
 * servirse de caché. Es el mismo mecanismo que ya usa el feedback de
 * recomendaciones.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { pool } from '@/db';
import { registrarEnBitacora } from '@/lib/bitacora';

const zRespuestas = z.array(z.object({
  id: z.number().int().positive(),
  respuesta: z.string().max(4000).nullable(),
  omitir: z.boolean(),
})).max(30);

export async function responderPreguntas(entrada: {
  proyectoId: number;
  respuestas: { id: number; respuesta: string | null; omitir: boolean }[];
}): Promise<{ ok: boolean; respondidas: number; omitidas: number; mensaje?: string }> {
  const parseo = zRespuestas.safeParse(entrada.respuestas);
  if (!parseo.success) {
    return { ok: false, respondidas: 0, omitidas: 0, mensaje: 'Respuestas inválidas.' };
  }

  let respondidas = 0;
  let omitidas = 0;

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    for (const r of parseo.data) {
      const texto = r.respuesta?.trim() || null;
      // Tres estados posibles: respondida, omitida a propósito, o de vuelta a
      // pendiente si el usuario borra lo que había escrito.
      const estado = r.omitir ? 'omitida' : texto ? 'respondida' : 'pendiente';
      const [res] = await conexion.query(
        `UPDATE proyecto_preguntas
            SET respuesta = ?, estado = ?
          WHERE id = ? AND proyecto_id = ?`,
        [texto, estado, r.id, entrada.proyectoId],
      );
      if ((res as { affectedRows: number }).affectedRows > 0) {
        if (estado === 'respondida') respondidas += 1;
        else if (estado === 'omitida') omitidas += 1;
      }
    }

    if (respondidas > 0 || omitidas > 0) {
      await registrarEnBitacora(conexion, {
        entidadTipo: 'proyecto', entidadId: entrada.proyectoId, proyectoId: entrada.proyectoId,
        accion: 'actualizar', campo: 'preguntas_encuadre',
        valorNuevo: `${respondidas} respondida(s), ${omitidas} omitida(s)`,
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
  return { ok: true, respondidas, omitidas };
}
