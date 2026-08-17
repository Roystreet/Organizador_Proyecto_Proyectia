import 'server-only';
import { fila } from '@/db';

/**
 * Generación de identificadores únicos (slug y código de proyecto).
 *
 * La estrategia es determinista + red final: aquí se busca un valor libre con
 * SELECT, y el índice UNIQUE de MySQL atrapa la carrera improbable entre el
 * SELECT y el INSERT (errno 1062, que las acciones traducen a error de campo).
 */

/** kebab-case sin acentos: "Diseño de Marca" → "diseno-de-marca". */
export function generarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quita las tildes ya separadas (la ñ queda como n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140) || 'sin-nombre';
}

const TABLAS_CON_SLUG = ['proyectos', 'empresas'] as const;
type TablaConSlug = (typeof TABLAS_CON_SLUG)[number];

/** Devuelve `base`, o `base-2`, `base-3`… hasta encontrar uno libre. */
export async function asegurarSlugUnico(
  base: string,
  tabla: TablaConSlug,
  ignorarId?: number,
): Promise<string> {
  // El nombre de tabla viene de un union cerrado, nunca del usuario.
  for (let n = 1; n < 100; n++) {
    const candidato = n === 1 ? base : `${base}-${n}`;
    const ocupado = await fila<{ id: number }>(
      `SELECT id FROM ${tabla} WHERE slug = ?${ignorarId ? ' AND id <> ?' : ''} LIMIT 1`,
      ignorarId ? [candidato, ignorarId] : [candidato],
    );
    if (!ocupado) return candidato;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Código corto de proyecto con el formato de las semillas: 'AND-01', 'BLT-02'.
 * Prefijo de 3 letras derivado del nombre + secuencia global.
 */
export async function generarCodigoProyecto(nombre: string): Promise<string> {
  const letras = generarSlug(nombre).replace(/-/g, '').toUpperCase().padEnd(3, 'X').slice(0, 3);
  const ultimo = await fila<{ n: number }>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(codigo, '-', -1) AS UNSIGNED)), 0) AS n
       FROM proyectos WHERE codigo LIKE ?`,
    [`${letras}-%`],
  );
  const siguiente = (ultimo?.n ?? 0) + 1;
  return `${letras}-${String(siguiente).padStart(2, '0')}`;
}
