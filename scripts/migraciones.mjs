/**
 * Migraciones idempotentes sobre una base que ya tiene datos.
 *
 * `preparar.mjs` aplica `01_schema.sql` solo cuando la base está vacía, así que
 * un `ALTER TABLE` nuevo nunca llegaría a una instalación existente. Y `db:reset`
 * no es opción: borra la base entera.
 *
 * Dos mecanismos, porque resuelven problemas distintos:
 *
 *   1. Cambios ESTRUCTURALES → se autodetectan contra `information_schema`.
 *      Idempotentes por construcción, no necesitan libro mayor. MySQL 8 no
 *      soporta `ADD COLUMN IF NOT EXISTS` (eso es MariaDB); de ahí las sondas.
 *
 *   2. Backfills de DATOS → registrados en `esquema_migraciones`, porque
 *      "esto ya se hizo" no es observable mirando el esquema.
 *
 * REGLA DE ORO: todo cambio DDL se escribe en TRES sitios, o la instalación
 * limpia y la base existente divergen:
 *   · db/01_schema.sql     (DDL canónico, instalación limpia)
 *   · scripts/migraciones.mjs (la misma forma, aplicada a una base viva)
 *   · src/db/schema.ts     (espejo Drizzle, solo tipos)
 * En una instalación limpia las migraciones quedan en no-op porque el schema
 * ya lo trae todo. Esa es la prueba de que están bien escritas.
 */

/* ── Sondas ───────────────────────────────────────────────────────────────── */

const uno = async (cx, sql, params) => {
  const [filas] = await cx.query(sql, params);
  return filas[0] ? Object.values(filas[0])[0] : null;
};

export async function existeTabla(cx, tabla) {
  return Number(await uno(cx,
    `SELECT COUNT(*) FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`, [tabla])) > 0;
}

export async function existeColumna(cx, tabla, columna) {
  return Number(await uno(cx,
    `SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tabla, columna])) > 0;
}

export async function existeIndice(cx, tabla, indice) {
  return Number(await uno(cx,
    `SELECT COUNT(*) FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [tabla, indice])) > 0;
}

export async function esNulable(cx, tabla, columna) {
  const v = await uno(cx,
    `SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tabla, columna]);
  return v === 'YES';
}

/** Parsea COLUMN_TYPE "enum('a','b')" → ['a','b']. [] si la columna no existe. */
export async function valoresEnum(cx, tabla, columna) {
  const tipo = await uno(cx,
    `SELECT column_type FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tabla, columna]);
  if (!tipo) return [];
  const m = /^enum\((.*)\)$/is.exec(String(tipo));
  if (!m) return [];
  return [...m[1].matchAll(/'((?:[^']|'')*)'/g)].map((x) => x[1].replace(/''/g, "'"));
}

/* ── Aseguradores (no-op si ya está) ──────────────────────────────────────── */

export async function asegurarTabla(cx, tabla, ddl) {
  if (await existeTabla(cx, tabla)) return false;
  await cx.query(ddl);
  return true;
}

export async function asegurarColumna(cx, tabla, columna, ddl) {
  if (!(await existeTabla(cx, tabla))) return false;
  if (await existeColumna(cx, tabla, columna)) return false;
  await cx.query(ddl);
  return true;
}

export async function asegurarIndice(cx, tabla, indice, ddl) {
  if (!(await existeTabla(cx, tabla))) return false;
  if (await existeIndice(cx, tabla, indice)) return false;
  await cx.query(ddl);
  return true;
}

export async function asegurarNulable(cx, tabla, columna, ddl) {
  if (!(await existeColumna(cx, tabla, columna))) return false;
  if (await esNulable(cx, tabla, columna)) return false;
  await cx.query(ddl);
  return true;
}

/**
 * Amplía un ENUM solo si le falta algún valor.
 *
 * Añadir valores AL FINAL de un ENUM en MySQL 8 es un cambio de metadatos: no
 * reescribe la tabla. Reordenarlos o quitarlos sí la reescribe, así que el DDL
 * que se pase debe conservar el orden existente y añadir al final.
 */
export async function asegurarValoresEnum(cx, tabla, columna, requeridos, ddl) {
  const actuales = await valoresEnum(cx, tabla, columna);
  if (actuales.length === 0) return false;                 // la tabla aún no existe
  if (requeridos.every((v) => actuales.includes(v))) return false;
  await cx.query(ddl);
  return true;
}

/* ── Libro mayor, solo para backfills de datos ────────────────────────────── */

const DDL_LIBRO = `
  CREATE TABLE IF NOT EXISTS \`esquema_migraciones\` (
    \`clave\`       VARCHAR(80) NOT NULL,
    \`aplicado_en\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`clave\`)
  ) ENGINE=InnoDB`;

async function asegurarLibro(cx) {
  await cx.query(DDL_LIBRO);
}

async function yaAplicada(cx, clave) {
  return Number(await uno(cx,
    'SELECT COUNT(*) FROM `esquema_migraciones` WHERE `clave` = ?', [clave])) > 0;
}

/**
 * Ejecuta `fn` una sola vez en la vida de la base y lo anota.
 *
 * El backfill va en transacción con su propia anotación: o pasan las dos cosas
 * o ninguna. (Un ALTER no puede ir aquí: el DDL hace commit implícito en MySQL,
 * lo que rompería la atomicidad sin avisar.)
 */
export async function unaVez(cx, clave, fn) {
  if (await yaAplicada(cx, clave)) return false;
  await cx.beginTransaction();
  try {
    await fn(cx);
    await cx.query('INSERT INTO `esquema_migraciones` (`clave`) VALUES (?)', [clave]);
    await cx.commit();
    return true;
  } catch (e) {
    await cx.rollback();
    throw e;
  }
}

/* ── Registro de migraciones, en orden ────────────────────────────────────── */

/**
 * Cada entrada aplica UN cambio y devuelve true si hizo algo.
 * Las estructurales son de un solo ALTER/CREATE: atómicas por sí mismas.
 */
const MIGRACIONES = [];

/* ── Ejecutor ─────────────────────────────────────────────────────────────── */

export async function aplicarMigraciones(conexion) {
  await asegurarLibro(conexion);

  const aplicadas = [];
  for (const m of MIGRACIONES) {
    let hizo;
    try {
      hizo = await m.aplicar(conexion);
    } catch (e) {
      e.message = `migración «${m.clave}» (${m.descripcion}): ${e.message}`;
      throw e;
    }
    if (hizo) aplicadas.push(m.clave);
  }
  return { aplicadas };
}

export { MIGRACIONES };
