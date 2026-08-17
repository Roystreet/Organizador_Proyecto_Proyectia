/**
 * Cliente de base de datos · Drizzle + mysql2
 *
 * En desarrollo, el hot reload de Next.js reevalúa los módulos en cada cambio.
 * Sin el cache en globalThis se abriría un pool nuevo cada vez y MySQL
 * terminaría rechazando conexiones.
 */
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { pool: mysql.Pool | undefined };

export const pool =
  globalForDb.pool ??
  mysql.createPool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'proyectos',
    connectionLimit: 10,
    waitForConnections: true,
    timezone: 'Z',
    charset: 'UTF8MB4_GENERAL_CI',
    decimalNumbers: true,
    dateStrings: ['DATE'],
  });

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

export const db = drizzle(pool, { schema, mode: 'default' });

/**
 * Consulta cruda tipada. Se usa para el dashboard y para armar el payload de
 * IA, donde las vistas y los agregados de SQL hacen el trabajo pesado y
 * traducirlos al query builder solo añadiría ruido.
 */
export async function filas<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function fila<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const r = await filas<T>(sql, params);
  return r[0] ?? null;
}

export { schema };
