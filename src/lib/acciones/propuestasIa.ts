'use server';

/**
 * Flujo revisar-y-aceptar: la propuesta de la IA vive en `analisis_ia`; aquí
 * se materializa SOLO lo que el usuario marcó, releyendo la respuesta guardada
 * en el servidor (nunca se confía en JSON reenviado por el cliente).
 */
import { revalidatePath } from 'next/cache';
import { pool, fila, filas } from '@/db';
import { normalizarJson } from '@/lib/ai/cliente';
import { zRespuestaPlanteamiento, zRespuestaTareasSugeridas } from '@/lib/ai/validacion';
import { registrarEnBitacora } from '@/lib/bitacora';

export interface ResultadoAceptar {
  ok: boolean;
  hitosCreados: number;
  tareasCreadas: number;
  mensaje?: string;
}

async function analisisGuardado(analisisId: number, proyectoId: number, tipo: string) {
  return fila<{ id: number; respuesta_json: unknown }>(
    `SELECT id, respuesta_json FROM analisis_ia
      WHERE id = ? AND proyecto_id = ? AND tipo_analisis = ? AND estado = 'ok'`,
    [analisisId, proyectoId, tipo],
  );
}

/** Fecha ISO local; `toISOString` correría el día según la zona horaria. */
function aIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const hoyIso = () => aIso(new Date());

/** Suma días a una fecha ISO (AAAA-MM-DD). */
function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return aIso(d);
}

/** Días entre dos fechas ISO. Negativo si la segunda es anterior. */
function diasEntre(desdeISO: string, hastaISO: string): number {
  const a = new Date(`${desdeISO}T00:00:00`).getTime();
  const b = new Date(`${hastaISO}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export async function aceptarPropuestaPlanteamiento(entrada: {
  analisisId: number;
  proyectoId: number;
  aplicarObjetivo: boolean;
  aplicarResumen: boolean;
  /** refs de hitos_propuestos seleccionados. */
  hitosRef: number[];
  /** Índices (posición) de tareas_propuestas seleccionadas. */
  tareasIndices: number[];
}): Promise<ResultadoAceptar> {
  const { analisisId, proyectoId } = entrada;

  const analisis = await analisisGuardado(analisisId, proyectoId, 'planteamiento_proyecto');
  if (!analisis) {
    return { ok: false, hitosCreados: 0, tareasCreadas: 0, mensaje: 'El análisis no existe o no corresponde a este proyecto.' };
  }
  const parseo = zRespuestaPlanteamiento.safeParse(normalizarJson(analisis.respuesta_json));
  if (!parseo.success) {
    return { ok: false, hitosCreados: 0, tareasCreadas: 0, mensaje: 'La respuesta guardada no cumple el contrato; vuelve a generar el planteamiento.' };
  }
  const propuesta = parseo.data;

  const proyecto = await fila<{ fecha_inicio: string | null; fecha_fin_estimada: string | null }>(
    `SELECT fecha_inicio, fecha_fin_estimada FROM proyectos WHERE id = ?`, [proyectoId],
  );
  if (!proyecto) {
    return { ok: false, hitosCreados: 0, tareasCreadas: 0, mensaje: `No existe el proyecto ${proyectoId}.` };
  }

  const refsElegidos = new Set(entrada.hitosRef);
  const hitosElegidos = propuesta.hitos_propuestos
    .filter((h) => refsElegidos.has(h.ref))
    .sort((a, b) => a.orden - b.orden);
  const indicesElegidos = new Set(entrada.tareasIndices);
  const tareasElegidas = propuesta.tareas_propuestas
    .map((t, i) => ({ t, i }))
    .filter(({ i }) => indicesElegidos.has(i));

  /*
   * Arranque del calendario. Si el proyecto no declara inicio se usa hoy: una
   * fase sin fechas no se puede dibujar, y dejarlas todas en NULL era lo que
   * hacía que el roadmap saliera vacío.
   */
  const arranque = proyecto.fecha_inicio ?? hoyIso();
  const totalDias = hitosElegidos.reduce((n, h) => n + (h.duracion_dias_estimada ?? 0), 0);

  /*
   * Si las duraciones propuestas se pasan de la fecha de cierre comprometida,
   * se comprimen proporcionalmente. Sin esto, un proyecto que cierra en agosto
   * termina con fases que llegan a octubre, que es exactamente lo que no debe
   * verse en el roadmap.
   */
  const margen = proyecto.fecha_fin_estimada
    ? Math.max(1, diasEntre(arranque, proyecto.fecha_fin_estimada))
    : null;
  const factor = margen !== null && totalDias > margen ? margen / totalDias : 1;

  let sinHito = 0;
  let omitidos = 0;
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    /*
     * Guard de idempotencia: aceptar dos veces la misma propuesta duplicaba
     * fases y tareas. Se comprueba contra lo que ya existe en el proyecto.
     */
    const [hitosYa] = await conexion.query(
      'SELECT id, nombre FROM hitos WHERE proyecto_id = ?', [proyectoId],
    );
    const hitosPorNombre = new Map(
      (hitosYa as { id: number; nombre: string }[]).map((h) => [h.nombre.trim().toLowerCase(), h.id]),
    );
    const [tareasYa] = await conexion.query(
      'SELECT titulo FROM tareas WHERE proyecto_id = ?', [proyectoId],
    );
    const titulosYa = new Set(
      (tareasYa as { titulo: string }[]).map((t) => t.titulo.trim().toLowerCase()),
    );

    // Hitos: ref local → id real. Cada fase ocupa una ventana contigua.
    const mapaRef = new Map<number, number>();
    let acumulado = 0;
    for (const h of hitosElegidos) {
      const yaExiste = hitosPorNombre.get(h.nombre.trim().toLowerCase());
      if (yaExiste !== undefined) {
        // Ya está: se reutiliza para que sus tareas queden bien colgadas.
        mapaRef.set(h.ref, yaExiste);
        omitidos += 1;
        acumulado += Math.round((h.duracion_dias_estimada ?? 0) * factor);
        continue;
      }

      const inicioFase = sumarDias(arranque, acumulado);
      acumulado += Math.round((h.duracion_dias_estimada ?? 0) * factor);
      const fechaObjetivo = h.duracion_dias_estimada !== null
        ? sumarDias(arranque, Math.max(acumulado, 1))
        : null;

      const [res] = await conexion.query(
        `INSERT INTO hitos
           (proyecto_id, nombre, descripcion, fecha_inicio, fecha_objetivo, estado, orden)
         VALUES (?,?,?,?,?,'pendiente',?)`,
        [proyectoId, h.nombre, h.descripcion,
         fechaObjetivo ? inicioFase : null, fechaObjetivo, h.orden],
      );
      const hitoId = (res as { insertId: number }).insertId;
      mapaRef.set(h.ref, hitoId);
      hitosPorNombre.set(h.nombre.trim().toLowerCase(), hitoId);
      await registrarEnBitacora(conexion, {
        entidadTipo: 'hito', entidadId: hitoId, proyectoId,
        accion: 'crear', valorNuevo: h.nombre,
      });
    }

    for (const { t } of tareasElegidas) {
      if (titulosYa.has(t.titulo.trim().toLowerCase())) { omitidos += 1; continue; }
      // Tarea cuyo hito no se aceptó: se crea suelta y se avisa.
      const hitoId = t.hito_ref !== null ? mapaRef.get(t.hito_ref) ?? null : null;
      if (t.hito_ref !== null && hitoId === null) sinHito++;
      const [res] = await conexion.query(
        `INSERT INTO tareas
           (proyecto_id, hito_id, titulo, descripcion, tipo, prioridad, estimacion_horas, orden)
         VALUES (?,?,?,?,?,?,?,?)`,
        [proyectoId, hitoId, t.titulo, t.descripcion, t.tipo, t.prioridad,
         t.estimacion_horas, t.orden],
      );
      titulosYa.add(t.titulo.trim().toLowerCase());
      await registrarEnBitacora(conexion, {
        entidadTipo: 'tarea', entidadId: (res as { insertId: number }).insertId, proyectoId,
        accion: 'crear', valorNuevo: t.titulo,
      });
    }

    const camposProyecto: string[] = [];
    const valores: unknown[] = [];
    if (entrada.aplicarObjetivo) {
      camposProyecto.push('objetivo = ?');
      valores.push(propuesta.objetivo_sugerido);
    }
    // El resumen de la IA vive en su propia columna. Pisar `descripcion`
    // destruiría el insumo del usuario y, al regenerar, el modelo acabaría
    // reprocesando su propio texto en vez de mejorar el original.
    if (entrada.aplicarResumen) {
      camposProyecto.push('resumen_ia = ?', 'resumen_ia_actualizado_en = NOW()');
      valores.push(propuesta.de_que_trata);
    }
    camposProyecto.push('ultimo_movimiento_en = NOW()');
    await conexion.query(
      `UPDATE proyectos SET ${camposProyecto.join(', ')} WHERE id = ?`,
      [...valores, proyectoId],
    );
    if (entrada.aplicarObjetivo || entrada.aplicarResumen) {
      await registrarEnBitacora(conexion, {
        entidadTipo: 'proyecto', entidadId: proyectoId, proyectoId,
        accion: 'actualizar', campo: entrada.aplicarObjetivo ? 'objetivo' : 'resumen_ia',
        valorNuevo: 'Aplicado desde el planteamiento de la IA',
      });
    }

    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    throw e;
  } finally {
    conexion.release();
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  revalidatePath('/proyectos');

  const avisos: string[] = [];
  if (omitidos > 0) {
    avisos.push(`${omitidos} elemento(s) ya existían en el proyecto y no se duplicaron.`);
  }
  if (sinHito > 0) {
    avisos.push(`${sinHito} tarea(s) apuntaban a fases no seleccionadas y se crearon sin fase.`);
  }
  if (factor < 1) {
    avisos.push('Las duraciones se ajustaron para no pasarse de la fecha de cierre estimada.');
  }
  if (!proyecto.fecha_inicio) {
    avisos.push('El proyecto no tenía fecha de inicio: las fases arrancan hoy.');
  }

  return {
    ok: true,
    hitosCreados: hitosElegidos.length,
    tareasCreadas: tareasElegidas.length,
    mensaje: avisos.length > 0 ? avisos.join(' ') : undefined,
  };
}

export async function aceptarTareasSugeridas(entrada: {
  analisisId: number;
  proyectoId: number;
  /** Índices (posición) de las tareas seleccionadas. */
  indices: number[];
}): Promise<ResultadoAceptar> {
  const { analisisId, proyectoId } = entrada;

  const analisis = await analisisGuardado(analisisId, proyectoId, 'tareas_sugeridas');
  if (!analisis) {
    return { ok: false, hitosCreados: 0, tareasCreadas: 0, mensaje: 'El análisis no existe o no corresponde a este proyecto.' };
  }
  const parseo = zRespuestaTareasSugeridas.safeParse(normalizarJson(analisis.respuesta_json));
  if (!parseo.success) {
    return { ok: false, hitosCreados: 0, tareasCreadas: 0, mensaje: 'La respuesta guardada no cumple el contrato; vuelve a generar las sugerencias.' };
  }

  // Los ids del análisis se re-validan contra la BD actual: pudieron borrarse
  // hitos o personas entre la generación y la aceptación.
  const hitosValidos = new Set(
    (await filas<{ id: number }>(`SELECT id FROM hitos WHERE proyecto_id = ?`, [proyectoId]))
      .map((h) => h.id),
  );
  const personasValidas = new Set(
    (await filas<{ id: number }>(`SELECT id FROM personas WHERE activo = 1`)).map((p) => p.id),
  );

  const indices = new Set(entrada.indices);
  const elegidas = parseo.data.tareas
    .map((t, i) => ({ t, i }))
    .filter(({ i }) => indices.has(i));

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    for (const { t } of elegidas) {
      const hitoId = t.hito_id !== null && hitosValidos.has(t.hito_id) ? t.hito_id : null;
      const responsableId = t.responsable_sugerido_id !== null
        && personasValidas.has(t.responsable_sugerido_id)
        ? t.responsable_sugerido_id : null;
      const [res] = await conexion.query(
        `INSERT INTO tareas
           (proyecto_id, hito_id, titulo, descripcion, tipo, prioridad,
            responsable_id, estimacion_horas)
         VALUES (?,?,?,?,?,?,?,?)`,
        [proyectoId, hitoId, t.titulo, t.descripcion, t.tipo, t.prioridad,
         responsableId, t.estimacion_horas],
      );
      await registrarEnBitacora(conexion, {
        entidadTipo: 'tarea', entidadId: (res as { insertId: number }).insertId, proyectoId,
        accion: 'crear', valorNuevo: t.titulo,
      });
    }
    await conexion.query(
      `UPDATE proyectos SET ultimo_movimiento_en = NOW() WHERE id = ?`, [proyectoId],
    );
    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    throw e;
  } finally {
    conexion.release();
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  revalidatePath('/proyectos');

  return { ok: true, hitosCreados: 0, tareasCreadas: elegidas.length };
}
