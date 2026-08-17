import 'server-only';
import type { PoolConnection } from 'mysql2/promise';
import { generarSlug } from '@/lib/identificadores';

/**
 * Resolución de catálogos para lo que propone la IA.
 *
 * El modelo devuelve o bien un `slug_existente` del catálogo, o bien una
 * entrada nueva. Aquí se traduce eso a un id real, con una regla firme: crear
 * es opt-in. Un catálogo que crece solo acaba con «Excel» y «Microsoft Excel»
 * como habilidades distintas, y a partir de ahí el emparejamiento persona ↔
 * proyecto deja de funcionar.
 *
 * No lleva 'use server': son helpers de servidor, no acciones de formulario.
 */

/** Busca por slug dentro de la transacción del llamador. */
async function idPorSlug(
  cx: PoolConnection, tabla: 'habilidades' | 'sectores', slug: string,
): Promise<number | null> {
  // El nombre de tabla viene de un union cerrado, nunca del usuario.
  const [f] = await cx.query(`SELECT id FROM ${tabla} WHERE slug = ? LIMIT 1`, [slug]);
  const filas = f as { id: number }[];
  return filas[0]?.id ?? null;
}

/** Slug libre en la tabla, probando `base`, `base-2`, … dentro de la transacción. */
async function slugLibre(
  cx: PoolConnection, tabla: 'habilidades' | 'sectores', base: string,
): Promise<string> {
  for (let n = 1; n < 100; n++) {
    const candidato = n === 1 ? base : `${base}-${n}`;
    if ((await idPorSlug(cx, tabla, candidato)) === null) return candidato;
  }
  return `${base}-${Date.now()}`;
}

export type Resolucion =
  | { id: number; creado: boolean }
  | { id: null; creado: false; motivo: 'no_existe_y_no_se_permite_crear' };

/**
 * Habilidad propuesta → id.
 *
 * Si el slug citado existe, se usa. Si no, se busca por nombre normalizado
 * antes de crear: el modelo escribe «Química Analítica» y el catálogo dice
 * «Química analítica», y son la misma cosa.
 */
export async function resolverHabilidad(
  cx: PoolConnection,
  propuesta: { slug_existente: string | null; nombre: string; tipo: string },
  permitirCrear: boolean,
): Promise<Resolucion> {
  if (propuesta.slug_existente) {
    const id = await idPorSlug(cx, 'habilidades', propuesta.slug_existente);
    if (id !== null) return { id, creado: false };
  }

  const base = generarSlug(propuesta.nombre);
  const porNombre = await idPorSlug(cx, 'habilidades', base);
  if (porNombre !== null) return { id: porNombre, creado: false };

  if (!permitirCrear) {
    return { id: null, creado: false, motivo: 'no_existe_y_no_se_permite_crear' };
  }

  const slug = await slugLibre(cx, 'habilidades', base);
  const [res] = await cx.query(
    `INSERT INTO habilidades (nombre, slug, tipo) VALUES (?,?,?)`,
    [propuesta.nombre.slice(0, 80), slug, propuesta.tipo],
  );
  return { id: (res as { insertId: number }).insertId, creado: true };
}

/** Igual que la anterior, para sectores. La taxonomía es más cerrada a propósito. */
export async function resolverSector(
  cx: PoolConnection,
  propuesta: { slug_existente: string | null; nombre: string },
  permitirCrear: boolean,
): Promise<Resolucion> {
  if (propuesta.slug_existente) {
    const id = await idPorSlug(cx, 'sectores', propuesta.slug_existente);
    if (id !== null) return { id, creado: false };
  }

  const base = generarSlug(propuesta.nombre);
  const porNombre = await idPorSlug(cx, 'sectores', base);
  if (porNombre !== null) return { id: porNombre, creado: false };

  if (!permitirCrear) {
    return { id: null, creado: false, motivo: 'no_existe_y_no_se_permite_crear' };
  }

  const [max] = await cx.query('SELECT COALESCE(MAX(orden),0) + 10 AS orden FROM sectores');
  const orden = (max as { orden: number }[])[0]?.orden ?? 999;
  const slug = await slugLibre(cx, 'sectores', base);
  const [res] = await cx.query(
    `INSERT INTO sectores (nombre, slug, orden) VALUES (?,?,?)`,
    [propuesta.nombre.slice(0, 80), slug, orden],
  );
  return { id: (res as { insertId: number }).insertId, creado: true };
}
