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
const MIGRACIONES = [
  /* ── Fase 1 · «De qué trata» separado de la descripción ─────────────────── */
  {
    clave: 'proyectos_resumen_ia',
    descripcion: 'proyectos.resumen_ia',
    aplicar: (cx) => asegurarColumna(cx, 'proyectos', 'resumen_ia',
      "ALTER TABLE `proyectos` ADD COLUMN `resumen_ia` TEXT NULL" +
      " COMMENT 'De qué trata, redactado por la IA. NUNCA pisa descripcion'" +
      ' AFTER `descripcion`'),
  },
  {
    clave: 'proyectos_resumen_ia_fecha',
    descripcion: 'proyectos.resumen_ia_actualizado_en',
    aplicar: (cx) => asegurarColumna(cx, 'proyectos', 'resumen_ia_actualizado_en',
      'ALTER TABLE `proyectos` ADD COLUMN `resumen_ia_actualizado_en` DATETIME NULL'
      + ' AFTER `resumen_ia`'),
  },
  {
    clave: 'backfill_resumen_ia',
    descripcion: 'rescatar «de qué trata» de los análisis ya guardados',
    // `analisis_ia.resumen` de un planteamiento ES `de_que_trata` (lo pone
    // `resumenDe` en cliente.ts). Los proyectos que ya generaron planteamiento
    // tienen el texto ahí: se recupera sin volver a llamar al modelo.
    aplicar: (cx) => unaVez(cx, 'backfill_resumen_ia', async (t) => {
      await t.query(`
        UPDATE proyectos p
          JOIN (
            SELECT a.proyecto_id, a.resumen
              FROM analisis_ia a
              JOIN (SELECT proyecto_id, MAX(id) AS id
                      FROM analisis_ia
                     WHERE tipo_analisis = 'planteamiento_proyecto' AND estado = 'ok'
                       AND proyecto_id IS NOT NULL
                     GROUP BY proyecto_id) u ON u.id = a.id
          ) x ON x.proyecto_id = p.id
           SET p.resumen_ia = x.resumen,
               p.resumen_ia_actualizado_en = NOW()
         WHERE p.resumen_ia IS NULL AND x.resumen IS NOT NULL`);
    }),
  },

  /* ── Fase 3 · Sectores multi-industria + perfil de persona ──────────────── */
  {
    clave: 'tabla_sectores',
    descripcion: 'catálogo de sectores',
    aplicar: (cx) => asegurarTabla(cx, 'sectores', `
      CREATE TABLE \`sectores\` (
        \`id\`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`nombre\`      VARCHAR(80)  NOT NULL,
        \`slug\`        VARCHAR(80)  NOT NULL,
        \`descripcion\` VARCHAR(255) NULL,
        \`color_hex\`   CHAR(7)      NOT NULL DEFAULT '#2E7D32',
        \`orden\`       SMALLINT     NOT NULL DEFAULT 0,
        \`activo\`      TINYINT(1)   NOT NULL DEFAULT 1,
        \`creado_en\`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_sectores_slug\` (\`slug\`)
      ) ENGINE=InnoDB`),
  },
  {
    clave: 'tabla_persona_sectores',
    descripcion: 'sectores que cubre una persona',
    aplicar: (cx) => asegurarTabla(cx, 'persona_sectores', `
      CREATE TABLE \`persona_sectores\` (
        \`persona_id\`        INT UNSIGNED NOT NULL,
        \`sector_id\`         INT UNSIGNED NOT NULL,
        \`nivel\`             TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '1=roce puntual … 5=especialista',
        \`anios_experiencia\` DECIMAL(4,1) NULL,
        \`es_principal\`      TINYINT(1) NOT NULL DEFAULT 0,
        \`evidencia\`         VARCHAR(500) NULL,
        \`origen\`            ENUM('manual','ia_cv') NOT NULL DEFAULT 'manual',
        \`confianza\`         DECIMAL(3,2) NULL,
        \`validado\`          TINYINT(1) NOT NULL DEFAULT 0,
        \`creado_en\`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`actualizado_en\`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`persona_id\`,\`sector_id\`),
        KEY \`ix_persona_sectores_sector\` (\`sector_id\`),
        CONSTRAINT \`fk_pse_persona\` FOREIGN KEY (\`persona_id\`)
          REFERENCES \`personas\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`fk_pse_sector\` FOREIGN KEY (\`sector_id\`)
          REFERENCES \`sectores\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`ck_pse_nivel\` CHECK (\`nivel\` BETWEEN 1 AND 5)
      ) ENGINE=InnoDB`),
  },
  {
    clave: 'tabla_proyecto_sectores',
    descripcion: 'sector del proyecto',
    aplicar: (cx) => asegurarTabla(cx, 'proyecto_sectores', `
      CREATE TABLE \`proyecto_sectores\` (
        \`proyecto_id\`  INT UNSIGNED NOT NULL,
        \`sector_id\`    INT UNSIGNED NOT NULL,
        \`es_principal\` TINYINT(1) NOT NULL DEFAULT 0,
        PRIMARY KEY (\`proyecto_id\`,\`sector_id\`),
        KEY \`ix_proyecto_sectores_sector\` (\`sector_id\`),
        CONSTRAINT \`fk_prs_proyecto\` FOREIGN KEY (\`proyecto_id\`)
          REFERENCES \`proyectos\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`fk_prs_sector\` FOREIGN KEY (\`sector_id\`)
          REFERENCES \`sectores\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB`),
  },
  {
    clave: 'persona_documentos_ruta_nulable',
    descripcion: 'persona_documentos.ruta_archivo admite NULL (texto pegado)',
    // El insumo del perfil es texto pegado, sin archivo detrás. Un centinela
    // como '' o 'inline' mentiría sobre la existencia de un archivo.
    aplicar: (cx) => asegurarNulable(cx, 'persona_documentos', 'ruta_archivo',
      'ALTER TABLE `persona_documentos` MODIFY `ruta_archivo` VARCHAR(500) NULL'
      + " COMMENT 'NULL cuando el insumo es texto pegado, sin archivo'"),
  },

  /* ── Fase 4 · Roadmap con fases de extensión real ───────────────────────── */
  {
    clave: 'hitos_fecha_inicio',
    descripcion: 'hitos.fecha_inicio (arranque de la fase)',
    aplicar: (cx) => asegurarColumna(cx, 'hitos', 'fecha_inicio',
      'ALTER TABLE `hitos` ADD COLUMN `fecha_inicio` DATE NULL'
      + " COMMENT 'Arranque de la fase. NULL = se deriva de la fase anterior'"
      + ' AFTER `descripcion`'),
  },
  {
    clave: 'hitos_ix_fecha_inicio',
    descripcion: 'índice de hitos.fecha_inicio',
    aplicar: (cx) => asegurarIndice(cx, 'hitos', 'ix_hitos_fecha_inicio',
      'ALTER TABLE `hitos` ADD INDEX `ix_hitos_fecha_inicio` (`fecha_inicio`)'),
  },
  {
    clave: 'limpiar_hitos_duplicados',
    descripcion: 'quitar fases y tareas duplicadas por aceptar la propuesta dos veces',
    /*
     * Antes no había guard de idempotencia: aceptar dos veces el planteamiento
     * de la IA insertaba las mismas fases y tareas otra vez. Se conserva el
     * hito de menor id de cada (proyecto, nombre, orden) y se borran sus
     * gemelos; las tareas duplicadas se identifican por título dentro del hito
     * sobrante. Imprime lo que va a borrar antes de hacerlo.
     */
    aplicar: (cx) => unaVez(cx, 'limpiar_hitos_duplicados', async (t) => {
      const [dups] = await t.query(`
        SELECT h.id, h.proyecto_id, h.nombre, h.orden,
               (SELECT COUNT(*) FROM tareas x WHERE x.hito_id = h.id) AS tareas
          FROM hitos h
          JOIN (SELECT proyecto_id, nombre, orden, MIN(id) AS conservar, COUNT(*) AS n
                  FROM hitos
                 GROUP BY proyecto_id, nombre, orden
                HAVING n > 1) d
            ON d.proyecto_id = h.proyecto_id AND d.nombre = h.nombre
           AND d.orden = h.orden AND h.id <> d.conservar`);

      if (dups.length === 0) return;

      console.log(`  · limpiando ${dups.length} fase(s) duplicada(s):`);
      for (const d of dups) {
        console.log(`      proyecto ${d.proyecto_id} · hito ${d.id} «${d.nombre}» (${d.tareas} tarea(s))`);
      }

      const ids = dups.map((d) => d.id);
      // Las tareas del hito duplicado se borran con él: son las copias que se
      // insertaron en la segunda aceptación, no trabajo real.
      const [tareasBorradas] = await t.query(
        `DELETE FROM tareas WHERE hito_id IN (?)`, [ids],
      );
      const [hitosBorrados] = await t.query(
        `DELETE FROM hitos WHERE id IN (?)`, [ids],
      );
      console.log(`  · borradas ${hitosBorrados.affectedRows} fase(s) y ${tareasBorradas.affectedRows} tarea(s)`);
    }),
  },

  /* ── Fase 5 · Asistente de creación de proyecto ─────────────────────────── */
  {
    clave: 'proyectos_wizard_paso',
    descripcion: 'proyectos.wizard_paso (marca de borrador)',
    aplicar: (cx) => asegurarColumna(cx, 'proyectos', 'wizard_paso',
      'ALTER TABLE `proyectos` ADD COLUMN `wizard_paso` TINYINT UNSIGNED NULL'
      + " COMMENT 'Paso del asistente de creación. NULL = proyecto publicado'"
      + ' AFTER `archivado`'),
  },
  {
    clave: 'tabla_proyecto_preguntas',
    descripcion: 'preguntas de encuadre y sus respuestas',
    aplicar: (cx) => asegurarTabla(cx, 'proyecto_preguntas', `
      CREATE TABLE \`proyecto_preguntas\` (
        \`id\`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`proyecto_id\`    INT UNSIGNED NOT NULL,
        \`analisis_id\`    INT UNSIGNED NULL COMMENT 'Análisis que la generó; NULL si la escribió el usuario',
        \`pregunta\`       VARCHAR(500) NOT NULL,
        \`motivo\`         VARCHAR(500) NULL,
        \`tema\`           VARCHAR(80)  NULL,
        \`importancia\`    ENUM('baja','media','alta','critica') NOT NULL DEFAULT 'media',
        \`respuesta\`      TEXT NULL,
        \`estado\`         ENUM('pendiente','respondida','omitida') NOT NULL DEFAULT 'pendiente',
        \`orden\`          SMALLINT NOT NULL DEFAULT 0,
        \`creado_en\`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`actualizado_en\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_proyecto_pregunta\` (\`proyecto_id\`,\`pregunta\`(180)),
        KEY \`ix_ppr_proyecto_estado\` (\`proyecto_id\`,\`estado\`),
        CONSTRAINT \`fk_ppr_proyecto\` FOREIGN KEY (\`proyecto_id\`)
          REFERENCES \`proyectos\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`fk_ppr_analisis\` FOREIGN KEY (\`analisis_id\`)
          REFERENCES \`analisis_ia\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB`),
  },
  {
    clave: 'analisis_ia_tipos_wizard',
    descripcion: 'tipos de análisis preguntas_encuadre y perfiles_requeridos',
    // Añadir valores AL FINAL de un ENUM es un cambio de metadatos en MySQL 8:
    // no reescribe la tabla. Esto cierra la limitación de docs/PRODUCTO.md §13.
    aplicar: (cx) => asegurarValoresEnum(cx, 'analisis_ia', 'tipo_analisis',
      ['preguntas_encuadre', 'perfiles_requeridos'],
      "ALTER TABLE `analisis_ia` MODIFY `tipo_analisis` ENUM("
      + "'salud_proyecto','cuellos_botella','match_persona_tarea',"
      + "'patrones_globales','priorizacion_diaria','perfil_cv',"
      + "'planteamiento_proyecto','tareas_sugeridas',"
      + "'preguntas_encuadre','perfiles_requeridos') NOT NULL"),
  },
];

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
