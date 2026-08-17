#!/usr/bin/env node
/**
 * Borra la base y la vuelve a crear desde cero.
 * Útil cuando los datos de prueba quedaron inservibles.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import mysql from 'mysql2/promise';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const texto = await readFile(path.join(RAIZ, '.env.local'), 'utf8').catch(() => '');
for (const linea of texto.split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const base = process.env.DB_NAME ?? 'proyectos';
const conexion = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
});

await conexion.query(`DROP DATABASE IF EXISTS \`${base.replace(/\`/g, '')}\``);
await conexion.end();
console.log(`\x1b[33m✗\x1b[0m Base \`${base}\` eliminada`);

spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'preparar.mjs')], { stdio: 'inherit' });
