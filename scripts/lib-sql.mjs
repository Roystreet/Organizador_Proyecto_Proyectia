/**
 * Partidor de archivos .sql.
 *
 * mysql2 ejecuta una sentencia a la vez y no entiende `DELIMITER`, que es una
 * directiva del cliente de línea de comandos, no de SQL. Este partidor sí la
 * entiende, que es lo que permite que los triggers de 01_schema.sql se creen
 * desde Node igual que desde la terminal.
 */

/** @returns {string[]} sentencias listas para ejecutar, en orden */
export function partirSql(contenido) {
  const sentencias = [];
  let delimitador = ';';
  let buffer = '';

  for (const lineaCruda of contenido.split(/\r?\n/)) {
    const linea = lineaCruda.trim();

    // Comentarios de línea completa: se descartan.
    if (linea === '' || linea.startsWith('--')) continue;

    // Cambio de delimitador (DELIMITER $$ … DELIMITER ;)
    const cambio = /^DELIMITER\s+(\S+)$/i.exec(linea);
    if (cambio) {
      delimitador = cambio[1];
      continue;
    }

    buffer += (buffer ? '\n' : '') + lineaCruda;

    if (linea.endsWith(delimitador)) {
      const sentencia = buffer.slice(0, buffer.lastIndexOf(delimitador)).trim();
      if (sentencia) sentencias.push(sentencia);
      buffer = '';
    }
  }

  const resto = buffer.trim();
  if (resto) sentencias.push(resto);
  return sentencias;
}

/**
 * `CREATE DATABASE` y `USE` traen el nombre de la base escrito a mano en el
 * archivo. El script ya se conecta a la base configurada en DB_NAME, así que
 * esas sentencias se omiten: si no, ejecutar contra una base con otro nombre
 * crearía silenciosamente la equivocada.
 */
export function omitirSentenciasDeBase(sentencias) {
  return sentencias.filter((s) => !/^\s*(CREATE\s+DATABASE|USE)\b/i.test(s));
}
