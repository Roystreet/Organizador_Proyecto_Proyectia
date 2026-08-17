import 'server-only';
import type { PoolConnection } from 'mysql2/promise';
import { pool } from '@/db';

export interface EntradaBitacora {
  entidadTipo: 'proyecto' | 'tarea' | 'asunto' | 'persona' | 'hito' | 'sprint' | 'empresa';
  entidadId: number;
  /** Desnormalizado para filtrar rápido por proyecto. Null si no aplica. */
  proyectoId?: number | null;
  accion: 'crear' | 'actualizar' | 'cambio_estado' | 'asignar' | 'comentar' | 'eliminar';
  campo?: string | null;
  valorAnterior?: string | null;
  valorNuevo?: string | null;
}

/**
 * Registro en la bitácora desde la capa de aplicación.
 *
 * Con `conexion` participa en la transacción del que llama (lo correcto para
 * mutaciones); con null usa el pool directo. Los valores se truncan a los 500
 * caracteres de la columna.
 */
export async function registrarEnBitacora(
  conexion: PoolConnection | null,
  entrada: EntradaBitacora,
): Promise<void> {
  const corto = (v: string | null | undefined) => (v == null ? null : String(v).slice(0, 500));
  const ejecutor = conexion ?? pool;
  await ejecutor.query(
    `INSERT INTO bitacora
       (entidad_tipo, entidad_id, proyecto_id, accion, campo, valor_anterior, valor_nuevo)
     VALUES (?,?,?,?,?,?,?)`,
    [
      entrada.entidadTipo, entrada.entidadId, entrada.proyectoId ?? null, entrada.accion,
      entrada.campo ?? null, corto(entrada.valorAnterior), corto(entrada.valorNuevo),
    ],
  );
}
