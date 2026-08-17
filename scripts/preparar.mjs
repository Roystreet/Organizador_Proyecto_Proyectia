#!/usr/bin/env node
/**
 * Preparación automática del entorno.
 *
 * Corre antes de `next dev` y deja todo listo sin intervención:
 *   1. Crea .env.local a partir de .env.example si no existe.
 *   2. Comprueba que MySQL responda, con un mensaje útil si no.
 *   3. Crea la base indicada en DB_NAME si falta.
 *   4. Aplica el esquema solo si las tablas no están.
 *   5. Aplica las migraciones pendientes (ver scripts/migraciones.mjs).
 *   6. Carga los catálogos solo si están vacíos, y amplía el vocabulario.
 *   7. Carga los datos de demostración solo en la primera vez.
 *
 * Es idempotente: correrlo diez veces seguidas no rompe ni duplica nada.
 *
 * Ojo: `pnpm dev:rapido` se salta este script. Tras traer cambios que incluyan
 * migraciones, hay que correr `pnpm setup` una vez.
 */
import { readFile, writeFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { partirSql, omitirSentenciasDeBase } from './lib-sql.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ── Colores sin dependencias ─────────────────────────────────────────────── */
const c = {
  verde: (t) => `\x1b[32m${t}\x1b[0m`,
  rojo: (t) => `\x1b[31m${t}\x1b[0m`,
  ambar: (t) => `\x1b[33m${t}\x1b[0m`,
  gris: (t) => `\x1b[90m${t}\x1b[0m`,
  negrita: (t) => `\x1b[1m${t}\x1b[0m`,
};
const ok = (t) => console.log(`  ${c.verde('✓')} ${t}`);
const info = (t) => console.log(`  ${c.gris('·')} ${c.gris(t)}`);
const aviso = (t) => console.log(`  ${c.ambar('!')} ${t}`);

/* ── 1 · .env.local ───────────────────────────────────────────────────────── */

async function asegurarEnv() {
  const destino = path.join(RAIZ, '.env.local');
  if (existsSync(destino)) {
    info('.env.local encontrado');
  } else {
    const ejemplo = await readFile(path.join(RAIZ, '.env.example'), 'utf8');
    await writeFile(destino, ejemplo);
    ok('.env.local creado a partir de .env.example');
    aviso('Revisa DB_PASSWORD y OPENAI_API_KEY cuando puedas.');
  }
  return cargarEnv(destino);
}

/** Lector de .env mínimo: evita traer dotenv solo para esto. */
async function cargarEnv(archivo) {
  const texto = await readFile(archivo, 'utf8');
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (!m) continue;
    const [, clave, bruto] = m;
    if (process.env[clave] !== undefined) continue;   // el entorno real manda
    process.env[clave] = bruto.replace(/^["']|["']$/g, '');
  }
  return {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    base: process.env.DB_NAME ?? 'proyectos',
    demo: (process.env.SEED_DEMO ?? 'true') !== 'false',
  };
}

/* ── 2 · Conexión ─────────────────────────────────────────────────────────── */

/**
 * Espera a que MySQL acepte conexiones.
 *
 * Recién levantado con Docker, MySQL tarda decenas de segundos en inicializar
 * y rechaza conexiones mientras tanto. Sin reintentos, `pnpm db:up && pnpm dev`
 * fallaría casi siempre en la primera corrida.
 *
 * Solo se reintenta lo que se resuelve esperando (puerto cerrado, servidor
 * arrancando). Una contraseña incorrecta no mejora con el tiempo: eso falla ya.
 */
const REINTENTABLES = new Set([
  'ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_SERVER_SHUTDOWN',
]);

async function conectarConEspera(cfg, segundos = 40) {
  const limite = Date.now() + segundos * 1000;
  let anunciado = false;

  for (;;) {
    try {
      const conexion = await conectar(cfg, false);
      if (anunciado) process.stdout.write('\n');
      return conexion;
    } catch (e) {
      const reintentable = REINTENTABLES.has(e.code) || /starting up/i.test(e.message ?? '');
      if (!reintentable || Date.now() > limite) {
        if (anunciado) process.stdout.write('\n');
        throw e;
      }

      if (!anunciado) {
        process.stdout.write(`  ${c.gris('·')} ${c.gris('esperando a que MySQL acepte conexiones')}`);
        anunciado = true;
      }
      process.stdout.write(c.gris('.'));
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

async function conectar(cfg, conBase = false) {
  return mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    ...(conBase ? { database: cfg.base } : {}),
    charset: 'UTF8MB4_GENERAL_CI',
    multipleStatements: false,
    connectTimeout: 8000,
  });
}

function explicarFallo(e, cfg) {
  console.log(`\n${c.rojo('No se pudo conectar a MySQL.')}\n`);
  if (e.code === 'ECONNREFUSED') {
    console.log(`  MySQL no responde en ${c.negrita(`${cfg.host}:${cfg.port}`)}.`);
    console.log('  Arráncalo y vuelve a intentar:\n');
    console.log(c.gris('    macOS (Homebrew) : brew services start mysql'));
    console.log(c.gris('    Linux            : sudo systemctl start mysql'));
    console.log(c.gris('    Docker Compose   : pnpm db:up   (usa el docker-compose.yml del proyecto)\n'));
  } else if (e.code === 'ER_ACCESS_DENIED_ERROR') {
    console.log(`  Usuario o contraseña incorrectos para ${c.negrita(cfg.user)}.`);
    console.log(`  Ajusta ${c.negrita('DB_USER')} y ${c.negrita('DB_PASSWORD')} en .env.local\n`);
  } else {
    console.log(`  ${e.message}\n`);
  }
  process.exit(1);
}

/* ── 3 · Ejecutar un archivo .sql ─────────────────────────────────────────── */

async function ejecutarArchivo(conexion, archivo) {
  const contenido = await readFile(path.join(RAIZ, 'db', archivo), 'utf8');
  const sentencias = omitirSentenciasDeBase(partirSql(contenido));
  for (const [i, sentencia] of sentencias.entries()) {
    try {
      await conexion.query(sentencia);
    } catch (e) {
      console.log(`\n${c.rojo(`Error en ${archivo}, sentencia ${i + 1}:`)}`);
      console.log(c.gris(sentencia.slice(0, 240)));
      throw e;
    }
  }
  return sentencias.length;
}

const contar = async (conexion, sql) => {
  const [filas] = await conexion.query(sql);
  return Number(Object.values(filas[0])[0]);
};

/* ── Principal ────────────────────────────────────────────────────────────── */

async function principal() {
  console.log(`\n${c.negrita('Organizador de Proyectos')} ${c.gris('· preparando el entorno')}\n`);

  const cfg = await asegurarEnv();

  let conexion;
  try {
    conexion = await conectarConEspera(cfg);
  } catch (e) {
    explicarFallo(e, cfg);
  }
  ok(`MySQL responde en ${cfg.host}:${cfg.port}`);

  // Base de datos
  const [bases] = await conexion.query(
    'SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?',
    [cfg.base],
  );
  if (bases.length === 0) {
    await conexion.query(
      `CREATE DATABASE \`${cfg.base.replace(/\`/g, '')}\`
         DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_0900_ai_ci`,
    );
    ok(`Base \`${cfg.base}\` creada`);
  } else {
    info(`Base \`${cfg.base}\` ya existía`);
  }
  await conexion.end();

  conexion = await conectar(cfg, true);
  await conexion.query('SET NAMES utf8mb4');

  // Esquema
  const tablas = await contar(
    conexion,
    `SELECT COUNT(*) FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`,
  );
  if (tablas === 0) {
    const n = await ejecutarArchivo(conexion, '01_schema.sql');
    ok(`Esquema aplicado (${n} sentencias)`);
  } else {
    info(`Esquema presente (${tablas} tablas)`);
  }

  // Migraciones: los cambios de esquema posteriores a la instalación.
  // 01_schema.sql solo corre con la base vacía, así que sin esto una base con
  // datos dentro nunca recibiría una columna nueva. Son idempotentes.
  const { aplicarMigraciones } = await import('./migraciones.mjs');
  const { aplicadas } = await aplicarMigraciones(conexion);
  if (aplicadas.length > 0) {
    ok(`Migraciones aplicadas (${aplicadas.length}): ${aplicadas.join(', ')}`);
  } else {
    info('Esquema al día');
  }

  // Catálogos
  const categorias = await contar(conexion, 'SELECT COUNT(*) FROM categorias');
  if (categorias === 0) {
    await ejecutarArchivo(conexion, '02_seed.sql');
    ok('Catálogos cargados');
  } else {
    info(`Catálogos presentes (${categorias} categorías)`);
  }

  // Catálogos incrementales: solo INSERT … ON DUPLICATE KEY UPDATE, así que
  // corre siempre. Es donde se amplía el vocabulario sin tocar datos.
  const habilidadesAntes = await contar(conexion, 'SELECT COUNT(*) FROM habilidades');
  await ejecutarArchivo(conexion, '04_catalogos.sql');
  const habilidadesDespues = await contar(conexion, 'SELECT COUNT(*) FROM habilidades');
  if (habilidadesDespues > habilidadesAntes) {
    ok(`Vocabulario ampliado (+${habilidadesDespues - habilidadesAntes} habilidades)`);
  }

  // Demostración
  const proyectos = await contar(conexion, 'SELECT COUNT(*) FROM proyectos');
  if (proyectos === 0 && cfg.demo) {
    await ejecutarArchivo(conexion, '03_demo.sql');
    const n = await contar(conexion, 'SELECT COUNT(*) FROM proyectos');
    ok(`Datos de demostración cargados (${n} proyectos)`);
    info('Para arrancar vacío: SEED_DEMO=false en .env.local');
  } else if (proyectos === 0) {
    info('Sin datos (SEED_DEMO=false)');
  } else {
    info(`${proyectos} proyectos en la base`);
  }

  // Resumen
  const vistas = await contar(
    conexion,
    `SELECT COUNT(*) FROM information_schema.views WHERE table_schema = DATABASE()`,
  );
  const modo = process.env.IA_MODO === 'simulado' || !process.env.OPENAI_API_KEY?.startsWith('sk-')
    ? `${c.ambar('simulado')} ${c.gris('(reglas locales, sin llamar a OpenAI)')}`
    : `${c.verde('real')} ${c.gris(`(${process.env.OPENAI_MODEL ?? 'gpt-4.1'})`)}`;

  await conexion.end();

  console.log(`\n  ${c.gris('base')}    ${cfg.base} ${c.gris(`· ${tablas || 30} tablas · ${vistas} vistas`)}`);
  console.log(`  ${c.gris('motor')}   ${modo}\n`);
}

principal().catch((e) => {
  console.log(`\n${c.rojo('Falló la preparación:')} ${e.message}\n`);
  process.exit(1);
});
