import 'server-only';
import { fila } from '@/db';
import {
  proyectoPorId, tareasDeProyecto, asuntosDeProyecto, equipoDeProyecto,
  tendenciaDeProyecto, eventosDeProyecto, decisionesDeProyecto,
  habilidadesRequeridas, patronesActivos, filasRecomendacionesPrevias,
} from './consultasIa';
import {
  listaSectores, sectoresDePersona, sectoresDemandados, habilidadesDemandadas,
  personaParaPerfil, habilidadesRegistradas, experienciasDePersona, listaHabilidades,
  sectoresDeProyecto, preguntasDeProyecto, personasParaAsignar,
} from '@/lib/consultas';
import { ProyectoNoEncontrado, PersonaNoEncontrada } from './errores';
import type {
  PayloadSaludProyecto, PayloadPlanteamientoProyecto, PayloadTareasSugeridas,
  PayloadPerfilCv, PayloadPreguntasEncuadre, PayloadPerfilesRequeridos,
  MetaPayload, ContextoOrganizacion, TareaResumen,
  MetricasTareas, MetricasAsuntos, MetricasActividad, EstadoTarea, Prioridad,
} from './tipos';
import type { FilaTarea, FilaMiembro } from '@/lib/consultas';

export const CONTRATO = 'v1';

/** Topes por sección. Ver docs/03-contrato-ia.md § presupuesto de tamaño. */
const TOPES = {
  tareas: 15, asuntos: 15, eventos: 30, decisiones: 10, tendencia: 12,
  /** Texto del CV o descripción. Ver docs/03-contrato-ia.md § presupuesto. */
  textoInsumo: 25_000,
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

const meta = (tipo: MetaPayload['tipo_analisis'], ventana = 30): MetaPayload => ({
  contrato: CONTRATO,
  tipo_analisis: tipo,
  fecha_referencia: hoyISO(),
  zona_horaria: 'America/Caracas',
  ventana_dias: ventana,
  idioma_respuesta: 'es',
});

async function contextoOrganizacion(): Promise<ContextoOrganizacion> {
  const r = await fila<{ proyectos_activos: number; personas_activas: number; capacidad: number | null }>(`
    SELECT
      (SELECT COUNT(*) FROM proyectos WHERE archivado = 0
         AND estado NOT IN ('completado','cancelado'))                     AS proyectos_activos,
      (SELECT COUNT(*) FROM personas WHERE activo = 1)                     AS personas_activas,
      (SELECT SUM(disponibilidad_horas_semana) FROM personas
        WHERE activo = 1 AND tipo_relacion IN ('interno','freelance'))     AS capacidad
  `);
  return {
    nombre: process.env.ORG_NOMBRE ?? 'Verde Studio',
    proyectos_activos: r?.proyectos_activos ?? 0,
    personas_activas: r?.personas_activas ?? 0,
    capacidad_semanal_horas: r?.capacidad ?? null,
    prioridades_declaradas: [],
  };
}

const listaIds = (v: string | null): number[] =>
  v ? v.split(',').map(Number).filter((n) => !Number.isNaN(n)) : [];

const aTareaResumen = (t: FilaTarea): TareaResumen => ({
  id: t.id,
  titulo: t.titulo,
  estado: t.estado,
  prioridad: t.prioridad,
  tipo: t.tipo,
  responsable_id: t.responsable_id,
  responsable: t.responsable,
  dias_para_vencer: t.dias_para_vencer,
  dias_en_estado_actual: t.dias_en_estado_actual,
  motivo_bloqueo: t.motivo_bloqueo,
  bloquea_a: listaIds(t.bloquea_a),
  depende_de: listaIds(t.depende_de),
});

const aMiembroEquipo = (m: FilaMiembro) => ({
  persona_id: m.persona_id,
  nombre: m.nombre,
  rol: m.rol,
  seniority: m.seniority,
  asignacion_pct: m.asignacion_pct,
  fortalezas: m.fortalezas ? m.fortalezas.split(', ') : [],
  tareas_abiertas: m.tareas_abiertas,
  tareas_vencidas: m.tareas_vencidas,
  tareas_bloqueadas: m.tareas_bloqueadas,
  carga_total_proyectos: m.carga_total_proyectos,
  horas_comprometidas: m.horas_comprometidas,
  disponibilidad_horas_semana: m.disponibilidad_horas_semana,
});

/**
 * Arma el payload de `salud_proyecto`.
 *
 * Todo lo contable ya viene contado desde SQL. Aquí solo se ensambla y se
 * recorta a los topes. El objeto resultante es determinista para un mismo
 * estado de la base: dos llamadas seguidas producen el mismo hash y la segunda
 * sale de caché.
 */
export async function payloadSaludProyecto(proyectoId: number): Promise<PayloadSaludProyecto> {
  const p = await proyectoPorId(proyectoId);
  if (!p) throw new ProyectoNoEncontrado(proyectoId);

  const [
    tareas, asuntos, equipo, tendencia, eventos, decisiones, skills,
    patrones, previas, mt, ma, act,
  ] = await Promise.all([
    tareasDeProyecto(proyectoId),
    asuntosDeProyecto(proyectoId),
    equipoDeProyecto(proyectoId),
    tendenciaDeProyecto(proyectoId),
    eventosDeProyecto(proyectoId, TOPES.eventos),
    decisionesDeProyecto(proyectoId),
    habilidadesRequeridas(proyectoId),
    patronesActivos(),
    filasRecomendacionesPrevias(proyectoId),
    metricasTareas(proyectoId),
    metricasAsuntos(proyectoId),
    metricasActividad(proyectoId),
  ]);

  const abiertas = tareas.filter((t) => !['completada', 'cancelada'].includes(t.estado));

  return {
    meta: meta('salud_proyecto'),
    organizacion: await contextoOrganizacion(),
    proyecto: {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      etiquetas: [],
      cliente: p.empresa ? { id: 0, nombre: p.empresa, industria: null } : null,
      estado: p.estado,
      prioridad: p.prioridad,
      salud_actual: p.salud,
      objetivo: p.objetivo,
      descripcion: p.descripcion,

      fechas: {
        inicio: p.fecha_inicio,
        fin_estimada: p.fecha_fin_estimada,
        dias_transcurridos: diasEntre(p.fecha_inicio, hoyISO()),
        dias_restantes: p.dias_restantes,
        tiempo_consumido_pct: tiempoConsumido(p.fecha_inicio, p.fecha_fin_estimada),
      },

      progreso: {
        declarado_pct: p.progreso_pct,
        calculado_pct: p.tareas_total > 0
          ? Math.round((p.tareas_completadas / p.tareas_total) * 100)
          : 0,
        desviacion_pct: desviacion(p),
      },

      metricas: { tareas: mt, asuntos: ma, actividad: act },

      equipo: equipo.map(aMiembroEquipo),

      habilidades_requeridas: skills.map((s) => ({
        nombre: s.nombre,
        nivel_minimo: s.nivel_minimo,
        criticidad: s.criticidad,
        cubierta: Boolean(s.cubierta),
      })),

      tareas_criticas: abiertas.slice(0, TOPES.tareas).map(aTareaResumen),

      asuntos_abiertos: asuntos
        .filter((a) => !['resuelto', 'cerrado', 'descartado'].includes(a.estado))
        .slice(0, TOPES.asuntos)
        .map((a) => ({
          id: a.id,
          codigo: a.codigo,
          titulo: a.titulo,
          tipo: a.tipo,
          categoria: a.categoria,
          severidad: a.severidad,
          impacto: a.impacto,
          estado: a.estado,
          asignado_a_id: a.asignado_a_id,
          dias_abierto: a.dias_abierto,
          es_recurrente: Boolean(a.es_recurrente),
          causa_raiz: a.causa_raiz,
        })),

      hitos: await hitosDeProyecto(proyectoId),
      eventos_recientes: eventos,
      decisiones: decisiones.slice(0, TOPES.decisiones),
      tendencia: tendencia.slice(0, TOPES.tendencia).reverse(),
    },
    patrones_conocidos: patrones.map((x) => ({
      clave: x.clave,
      nombre: x.nombre,
      tipo: x.tipo,
      frecuencia: x.frecuencia,
      confianza: x.confianza,
      ultima_deteccion: String(x.ultima_deteccion).slice(0, 10),
    })),
    recomendaciones_previas: previas,
  };
}

/**
 * Payload de `planteamiento_proyecto`. La materia prima es la descripción
 * libre que el usuario escribió al crear el proyecto; los hitos y tareas
 * existentes viajan para que el modelo complemente en vez de duplicar.
 */
export async function payloadPlanteamientoProyecto(proyectoId: number): Promise<PayloadPlanteamientoProyecto> {
  const p = await proyectoPorId(proyectoId);
  if (!p) throw new ProyectoNoEncontrado(proyectoId);

  const [equipo, hitos, tareas, organizacion] = await Promise.all([
    equipoDeProyecto(proyectoId),
    hitosDeProyecto(proyectoId),
    tareasDeProyecto(proyectoId),
    contextoOrganizacion(),
  ]);

  return {
    meta: meta('planteamiento_proyecto'),
    organizacion,
    proyecto: {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      estado: p.estado,
      prioridad: p.prioridad,
      descripcion_libre: p.descripcion,
      // El resumen anterior viaja para que el modelo lo mejore en vez de
      // reescribirlo de cero, y para que aplicar uno invalide la caché.
      resumen_ia_previo: p.resumen_ia,
      objetivo: p.objetivo,
      fechas: { inicio: p.fecha_inicio, fin_estimada: p.fecha_fin_estimada },
      equipo: equipo.map(aMiembroEquipo),
      hitos_existentes: hitos,
      tareas_existentes: tareas.map((t) => ({
        id: t.id, titulo: t.titulo, estado: t.estado, tipo: t.tipo,
      })),
    },
  };
}

/** Payload de `tareas_sugeridas`: el estado ACTUAL con ids reales. */
export async function payloadTareasSugeridas(proyectoId: number): Promise<PayloadTareasSugeridas> {
  const p = await proyectoPorId(proyectoId);
  if (!p) throw new ProyectoNoEncontrado(proyectoId);

  const [equipo, hitos, tareas, mt, organizacion] = await Promise.all([
    equipoDeProyecto(proyectoId),
    hitosDeProyecto(proyectoId),
    tareasDeProyecto(proyectoId),
    metricasTareas(proyectoId),
    contextoOrganizacion(),
  ]);

  const abiertas = tareas.filter((t) => !['completada', 'cancelada'].includes(t.estado));

  return {
    meta: meta('tareas_sugeridas'),
    organizacion,
    proyecto: {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      estado: p.estado,
      prioridad: p.prioridad,
      objetivo: p.objetivo,
      descripcion: p.descripcion,
      fechas: {
        inicio: p.fecha_inicio,
        fin_estimada: p.fecha_fin_estimada,
        dias_restantes: p.dias_restantes,
      },
      metricas_tareas: mt,
      equipo: equipo.map(aMiembroEquipo),
      hitos,
      tareas_existentes: abiertas.map(aTareaResumen),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Métricas agregadas                                                         */
/* -------------------------------------------------------------------------- */

async function metricasTareas(id: number): Promise<MetricasTareas> {
  const r = await fila<Record<string, number | null>>(
    `SELECT
       COUNT(*)                                                                   AS total,
       SUM(estado='pendiente')    AS pendiente,  SUM(estado='en_progreso') AS en_progreso,
       SUM(estado='en_revision')  AS en_revision, SUM(estado='bloqueada')  AS bloqueada,
       SUM(estado='completada')   AS completada, SUM(estado='cancelada')   AS cancelada,
       SUM(estado NOT IN ('completada','cancelada') AND fecha_vencimiento < CURDATE()) AS vencidas,
       SUM(estado NOT IN ('completada','cancelada') AND responsable_id IS NULL)        AS sin_responsable,
       SUM(estado='completada' AND fecha_completada >= DATE_SUB(NOW(), INTERVAL 14 DAY)) AS compl_14d,
       SUM(creado_en >= DATE_SUB(NOW(), INTERVAL 14 DAY))                          AS creadas_14d,
       AVG(CASE WHEN estado='completada' AND fecha_completada IS NOT NULL
                THEN DATEDIFF(fecha_completada, creado_en) END)                    AS ciclo,
       SUM(CASE WHEN estado NOT IN ('completada','cancelada') THEN estimacion_horas END) AS horas
     FROM tareas WHERE proyecto_id = ?`,
    [id],
  );
  const n = (k: string) => Number(r?.[k] ?? 0);
  return {
    total: n('total'),
    por_estado: {
      pendiente: n('pendiente'), en_progreso: n('en_progreso'), en_revision: n('en_revision'),
      bloqueada: n('bloqueada'), completada: n('completada'), cancelada: n('cancelada'),
    } as Record<EstadoTarea, number>,
    bloqueadas: n('bloqueada'),
    vencidas: n('vencidas'),
    sin_responsable: n('sin_responsable'),
    completadas_ultimos_14d: n('compl_14d'),
    creadas_ultimos_14d: n('creadas_14d'),
    ciclo_promedio_dias: r?.ciclo != null ? Math.round(Number(r.ciclo)) : null,
    horas_estimadas_pendientes: r?.horas != null ? Number(r.horas) : null,
  };
}

async function metricasAsuntos(id: number): Promise<MetricasAsuntos> {
  const abierto = `estado NOT IN ('resuelto','cerrado','descartado')`;
  const r = await fila<Record<string, number | null>>(
    `SELECT
       SUM(${abierto})                                        AS abiertos,
       SUM(${abierto} AND severidad='baja')                   AS baja,
       SUM(${abierto} AND severidad='media')                  AS media,
       SUM(${abierto} AND severidad='alta')                   AS alta,
       SUM(${abierto} AND severidad='critica')                AS critica,
       SUM(${abierto} AND es_recurrente=1)                    AS recurrentes,
       AVG(CASE WHEN ${abierto} THEN DATEDIFF(CURDATE(), DATE(fecha_reporte)) END) AS edad,
       AVG(CASE WHEN fecha_resolucion IS NOT NULL
                THEN DATEDIFF(fecha_resolucion, fecha_reporte) END)                AS resol
     FROM asuntos WHERE proyecto_id = ?`,
    [id],
  );
  const cats = await import('@/db').then(({ filas }) => filas<{ categoria: string; total: number }>(
    `SELECT COALESCE(ca.nombre,'Sin categoría') AS categoria, COUNT(*) AS total
       FROM asuntos a LEFT JOIN categorias_asunto ca ON ca.id = a.categoria_asunto_id
      WHERE a.proyecto_id = ? AND a.${abierto}
      GROUP BY categoria`, [id]));
  const n = (k: string) => Number(r?.[k] ?? 0);
  return {
    abiertos: n('abiertos'),
    por_severidad: { baja: n('baja'), media: n('media'), alta: n('alta'), critica: n('critica') } as Record<Prioridad, number>,
    por_categoria: Object.fromEntries(cats.map((c) => [c.categoria, Number(c.total)])),
    criticos_abiertos: n('critica'),
    recurrentes: n('recurrentes'),
    edad_promedio_dias: r?.edad != null ? Math.round(Number(r.edad)) : null,
    resolucion_promedio_dias: r?.resol != null ? Math.round(Number(r.resol)) : null,
  };
}

async function metricasActividad(id: number): Promise<MetricasActividad> {
  const r = await fila<Record<string, number | null>>(
    `SELECT
       DATEDIFF(CURDATE(), DATE(COALESCE(p.ultimo_movimiento_en, p.creado_en)))  AS dias_sin_mov,
       (SELECT COUNT(*) FROM bitacora b WHERE b.proyecto_id = p.id
          AND b.creado_en >= DATE_SUB(NOW(), INTERVAL 7 DAY))                    AS e7,
       (SELECT COUNT(*) FROM bitacora b WHERE b.proyecto_id = p.id
          AND b.creado_en >= DATE_SUB(NOW(), INTERVAL 30 DAY))                   AS e30,
       (SELECT COUNT(*) FROM tareas t WHERE t.proyecto_id = p.id
          AND t.estado='completada'
          AND t.fecha_completada >= DATE_SUB(NOW(), INTERVAL 28 DAY))            AS compl_28d,
       (SELECT COUNT(*) FROM tareas t WHERE t.proyecto_id = p.id
          AND t.estado='completada'
          AND t.fecha_completada >= DATE_SUB(NOW(), INTERVAL 56 DAY)
          AND t.fecha_completada <  DATE_SUB(NOW(), INTERVAL 28 DAY))            AS compl_prev
     FROM proyectos p WHERE p.id = ?`,
    [id],
  );
  const c28 = Number(r?.compl_28d ?? 0);
  const cPrev = Number(r?.compl_prev ?? 0);
  const velocidad = c28 / 4;

  let tendencia: MetricasActividad['tendencia_velocidad'] = 'sin_datos';
  if (c28 + cPrev > 0) {
    if (c28 > cPrev) tendencia = 'sube';
    else if (c28 < cPrev) tendencia = 'baja';
    else tendencia = 'estable';
  }

  return {
    dias_sin_movimiento: Number(r?.dias_sin_mov ?? 0),
    eventos_ultimos_7d: Number(r?.e7 ?? 0),
    eventos_ultimos_30d: Number(r?.e30 ?? 0),
    velocidad_semanal: c28 > 0 ? Number(velocidad.toFixed(2)) : 0,
    tendencia_velocidad: tendencia,
  };
}

async function hitosDeProyecto(id: number) {
  const { filas } = await import('@/db');
  return filas<{ id: number; nombre: string; fecha_objetivo: string | null; dias_para_objetivo: number | null; estado: string; tareas_pendientes: number }>(
    `SELECT h.id, h.nombre, h.fecha_objetivo,
            DATEDIFF(h.fecha_objetivo, CURDATE()) AS dias_para_objetivo, h.estado,
            (SELECT COUNT(*) FROM tareas t WHERE t.hito_id = h.id
               AND t.estado NOT IN ('completada','cancelada')) AS tareas_pendientes
       FROM hitos h WHERE h.proyecto_id = ? AND h.estado <> 'cancelado'
      ORDER BY h.orden, h.fecha_objetivo`, [id]);
}

/* -------------------------------------------------------------------------- */
/*  Utilidades de fecha                                                        */
/* -------------------------------------------------------------------------- */

function diasEntre(desde: string | null, hasta: string): number | null {
  if (!desde) return null;
  const a = new Date(`${desde}T00:00:00`).getTime();
  const b = new Date(`${hasta}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function tiempoConsumido(inicio: string | null, fin: string | null): number | null {
  if (!inicio || !fin) return null;
  const total = diasEntre(inicio, fin);
  const corrido = diasEntre(inicio, hoyISO());
  if (total === null || corrido === null || total <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((corrido / total) * 100)));
}

function desviacion(p: { fecha_inicio: string | null; fecha_fin_estimada: string | null; tareas_total: number; tareas_completadas: number }): number | null {
  const t = tiempoConsumido(p.fecha_inicio, p.fecha_fin_estimada);
  if (t === null) return null;
  const avance = p.tareas_total > 0 ? Math.round((p.tareas_completadas / p.tareas_total) * 100) : 0;
  return t - avance;
}

/* -------------------------------------------------------------------------- */
/*  perfil_cv                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Payload del perfilado de una persona.
 *
 * El insumo es texto pegado (un CV o una descripción libre), no un archivo.
 * Los catálogos viajan enteros para que el modelo reutilice slugs en vez de
 * inventar variantes de lo que ya existe, y `registrado` evita que al
 * re-ejecutar el análisis repita o contradiga lo que ya validamos a mano.
 */
export async function payloadPerfilCv(
  personaId: number,
  insumo: { texto: string; notas: string | null },
): Promise<PayloadPerfilCv> {
  const p = await personaParaPerfil(personaId);
  if (!p) throw new PersonaNoEncontrada(personaId);

  const [
    organizacion, habilidades, sectores, experiencias,
    catHabilidades, catSectores, necesidades, demandados,
  ] = await Promise.all([
    contextoOrganizacion(),
    habilidadesRegistradas(personaId),
    sectoresDePersona(personaId),
    experienciasDePersona(personaId),
    listaHabilidades(),
    listaSectores(),
    habilidadesDemandadas(),
    sectoresDemandados(),
  ]);

  const texto = insumo.texto.trim();
  const truncado = texto.length > TOPES.textoInsumo;

  return {
    meta: meta('perfil_cv'),
    organizacion,
    persona: {
      id: p.id,
      nombre_completo: p.nombre_completo,
      tipo_relacion: p.tipo_relacion,
      rol_principal: p.rol_principal,
      seniority: p.seniority,
      anios_experiencia: p.anios_experiencia,
      ubicacion: p.ubicacion,
      empresa: p.empresa,
      bio: p.bio,
    },
    insumo: {
      texto: truncado ? texto.slice(0, TOPES.textoInsumo) : texto,
      truncado,
      notas: insumo.notas?.trim() || null,
      origen: 'texto_pegado',
    },
    registrado: {
      habilidades: habilidades.map((h) => ({
        slug: h.slug, nombre: h.nombre, nivel: h.nivel, validado: h.validado === 1,
      })),
      sectores: sectores.map((s) => ({ slug: s.slug, nombre: s.nombre, nivel: s.nivel })),
      experiencias: experiencias.map((e) => ({ empresa: e.empresa_nombre, cargo: e.cargo })),
    },
    catalogo_habilidades: catHabilidades.map((h) => ({
      slug: h.slug, nombre: h.nombre, tipo: h.tipo,
    })),
    catalogo_sectores: catSectores.map((s) => ({ slug: s.slug, nombre: s.nombre })),
    necesidades_actuales: necesidades,
    sectores_demandados: demandados,
  };
}

/* -------------------------------------------------------------------------- */
/*  preguntas_encuadre                                                         */
/* -------------------------------------------------------------------------- */

/** Payload del paso 2 del asistente: lo que hay y lo que ya se preguntó. */
export async function payloadPreguntasEncuadre(
  proyectoId: number,
): Promise<PayloadPreguntasEncuadre> {
  const p = await proyectoPorId(proyectoId);
  if (!p) throw new ProyectoNoEncontrado(proyectoId);

  const [organizacion, sectores, preguntas] = await Promise.all([
    contextoOrganizacion(),
    sectoresDeProyecto(proyectoId),
    preguntasDeProyecto(proyectoId),
  ]);

  return {
    meta: meta('preguntas_encuadre'),
    organizacion,
    proyecto: {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      sectores: sectores.map((s) => s.nombre),
      estado: p.estado,
      prioridad: p.prioridad,
      descripcion_libre: p.descripcion,
      objetivo: p.objetivo,
      fechas: { inicio: p.fecha_inicio, fin_estimada: p.fecha_fin_estimada },
      empresa: p.empresa ? { nombre: p.empresa, industria: null } : null,
    },
    preguntas_ya_respondidas: preguntas
      .filter((q) => q.estado === 'respondida' && q.respuesta)
      .map((q) => ({ pregunta: q.pregunta, respuesta: q.respuesta as string })),
    preguntas_pendientes: preguntas
      .filter((q) => q.estado === 'pendiente')
      .map((q) => q.pregunta),
  };
}

/* -------------------------------------------------------------------------- */
/*  perfiles_requeridos                                                        */
/* -------------------------------------------------------------------------- */

/** Tope de personas que viajan al modelo. Ver docs/03-contrato-ia.md. */
const TOPE_PERSONAS = 40;

/**
 * Payload de los perfiles necesarios.
 *
 * Manda el directorio real (acotado) para que los candidatos que devuelva sean
 * personas que existen. Las respuestas a las preguntas de encuadre entran
 * aquí: son la mitad del contexto que hace útil la recomendación.
 */
export async function payloadPerfilesRequeridos(
  proyectoId: number,
): Promise<PayloadPerfilesRequeridos> {
  const p = await proyectoPorId(proyectoId);
  if (!p) throw new ProyectoNoEncontrado(proyectoId);

  const [
    organizacion, sectores, preguntas, hitos, tareas, equipo, skills,
    catHabilidades, catSectores, personas,
  ] = await Promise.all([
    contextoOrganizacion(),
    sectoresDeProyecto(proyectoId),
    preguntasDeProyecto(proyectoId),
    hitosDeProyecto(proyectoId),
    tareasDeProyecto(proyectoId),
    equipoDeProyecto(proyectoId),
    habilidadesRequeridas(proyectoId),
    listaHabilidades(),
    listaSectores(),
    personasParaAsignar(TOPE_PERSONAS),
  ]);

  const porTipo: Record<string, number> = {};
  for (const t of tareas) porTipo[t.tipo] = (porTipo[t.tipo] ?? 0) + 1;

  return {
    meta: meta('perfiles_requeridos'),
    organizacion,
    proyecto: {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      sectores: sectores.map((s) => s.nombre),
      descripcion_libre: p.descripcion,
      resumen_ia: p.resumen_ia,
      objetivo: p.objetivo,
      fechas: {
        inicio: p.fecha_inicio,
        fin_estimada: p.fecha_fin_estimada,
        dias_totales: p.fecha_inicio && p.fecha_fin_estimada
          ? diasEntre(p.fecha_inicio, p.fecha_fin_estimada)
          : null,
      },
      hitos,
      tareas_por_tipo: porTipo,
      equipo_actual: equipo.map(aMiembroEquipo),
      habilidades_ya_declaradas: skills.map((s) => ({
        nombre: s.nombre, nivel_minimo: s.nivel_minimo, criticidad: s.criticidad,
      })),
    },
    preguntas_respondidas: preguntas
      .filter((q) => q.estado === 'respondida' && q.respuesta)
      .map((q) => ({ pregunta: q.pregunta, respuesta: q.respuesta as string })),
    catalogo_habilidades: catHabilidades.map((h) => ({
      slug: h.slug, nombre: h.nombre, tipo: h.tipo,
    })),
    catalogo_sectores: catSectores.map((s) => ({ slug: s.slug, nombre: s.nombre })),
    personas_disponibles: personas,
  };
}
