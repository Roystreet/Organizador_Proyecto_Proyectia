import 'server-only';
import { filas, fila } from '@/db';
import type { Salud, Prioridad, EstadoProyecto, EstadoTarea, EstadoAsunto } from './ai/tipos';

/* -------------------------------------------------------------------------- */
/*  Tipos de fila                                                              */
/* -------------------------------------------------------------------------- */

export interface FilaResumenProyecto {
  id: number;
  codigo: string;
  nombre: string;
  estado: EstadoProyecto;
  prioridad: Prioridad;
  salud: Salud;
  progreso_pct: number;
  categoria: string | null;
  empresa: string | null;
  responsable: string | null;
  fecha_inicio: string | null;
  fecha_fin_estimada: string | null;
  dias_restantes: number | null;
  dias_sin_movimiento: number;
  tareas_total: number;
  tareas_completadas: number;
  tareas_bloqueadas: number;
  tareas_vencidas: number;
  asuntos_abiertos: number;
  asuntos_criticos: number;
  involucrados: number;
}

export interface FilaCargaPersona {
  persona_id: number;
  nombre_completo: string;
  rol_principal: string | null;
  disponibilidad_horas_semana: number | null;
  proyectos_activos: number;
  tareas_abiertas: number;
  tareas_bloqueadas: number;
  tareas_vencidas: number;
  horas_estimadas_pendientes: number;
}

export interface FilaCuelloBotella {
  tarea_id: number;
  proyecto_id: number;
  proyecto_codigo: string;
  titulo: string;
  estado: EstadoTarea;
  prioridad: Prioridad;
  motivo_bloqueo: string | null;
  responsable: string | null;
  dias_detenida: number;
  tareas_que_bloquea: number;
}

export interface FilaTarea {
  id: number;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  estado: EstadoTarea;
  prioridad: Prioridad;
  responsable_id: number | null;
  responsable: string | null;
  fecha_vencimiento: string | null;
  dias_para_vencer: number | null;
  dias_en_estado_actual: number;
  estimacion_horas: number | null;
  progreso_pct: number;
  motivo_bloqueo: string | null;
  hito: string | null;
  bloquea_a: string | null;
  depende_de: string | null;
}

export interface FilaAsunto {
  id: number;
  codigo: string | null;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  categoria: string | null;
  severidad: Prioridad;
  impacto: 'bajo' | 'medio' | 'alto';
  estado: EstadoAsunto;
  asignado_a_id: number | null;
  asignado_a: string | null;
  dias_abierto: number;
  es_recurrente: number;
  causa_raiz: string | null;
}

export interface FilaMiembro {
  persona_id: number;
  nombre: string;
  rol: string | null;
  seniority: string | null;
  asignacion_pct: number | null;
  tareas_abiertas: number;
  tareas_vencidas: number;
  tareas_bloqueadas: number;
  carga_total_proyectos: number;
  horas_comprometidas: number | null;
  disponibilidad_horas_semana: number | null;
  fortalezas: string | null;
}

export interface FilaPersona {
  id: number;
  nombre_completo: string;
  email: string | null;
  rol_principal: string | null;
  seniority: string | null;
  anios_experiencia: number | null;
  tipo_relacion: string;
  empresa: string | null;
  disponibilidad_horas_semana: number | null;
  ubicacion: string | null;
  proyectos_activos: number;
  tareas_abiertas: number;
  fortalezas: string | null;
}

export interface FilaRecomendacion {
  id: number;
  analisis_id: number;
  proyecto_id: number | null;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  justificacion: string | null;
  prioridad: Prioridad;
  impacto_estimado: string;
  esfuerzo_estimado: string;
  entidad_tipo: string | null;
  entidad_id: number | null;
  persona_sugerida_id: number | null;
  persona_sugerida: string | null;
  estado: string;
  creado_en: string;
}

/* -------------------------------------------------------------------------- */
/*  Consultas                                                                  */
/* -------------------------------------------------------------------------- */

export const resumenProyectos = () =>
  filas<FilaResumenProyecto>(`
    SELECT * FROM v_resumen_proyectos
    ORDER BY FIELD(prioridad,'critica','alta','media','baja'),
             FIELD(estado,'en_progreso','en_revision','planificacion','en_pausa','idea','completado','cancelado'),
             codigo
  `);

export const proyectoPorId = (id: number) =>
  fila<FilaResumenProyecto & { descripcion: string | null; objetivo: string | null; notas: string | null }>(
    `SELECT v.*, p.descripcion, p.objetivo, p.notas
       FROM v_resumen_proyectos v
       JOIN proyectos p ON p.id = v.id
      WHERE v.id = ?`,
    [id],
  );

/** Fila cruda para el formulario de edición (ids, no nombres de la vista). */
export const proyectoParaEditar = (id: number) =>
  fila<{
    id: number; nombre: string; descripcion: string | null; objetivo: string | null;
    categoria_id: number | null; empresa_id: number | null; responsable_id: number | null;
    estado: string; prioridad: string; fecha_inicio: string | null;
    fecha_fin_estimada: string | null;
  }>(
    `SELECT id, nombre, descripcion, objetivo, categoria_id, empresa_id, responsable_id,
            estado, prioridad, fecha_inicio, fecha_fin_estimada
       FROM proyectos WHERE id = ? AND archivado = 0`,
    [id],
  );

export const cargaPersonas = () =>
  filas<FilaCargaPersona>(`
    SELECT * FROM v_carga_personas
    ORDER BY tareas_abiertas DESC, tareas_vencidas DESC
  `);

export const cuellosBotella = () =>
  filas<FilaCuelloBotella>(`
    SELECT * FROM v_cuellos_botella
    ORDER BY tareas_que_bloquea DESC, dias_detenida DESC
  `);

/** Agregado del portafolio para la fila de KPIs del dashboard. */
export const kpisPortafolio = () =>
  fila<{
    proyectos_activos: number;
    tareas_abiertas: number;
    tareas_bloqueadas: number;
    tareas_vencidas: number;
    asuntos_criticos: number;
    personas_activas: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM proyectos
        WHERE archivado = 0 AND estado NOT IN ('completado','cancelado'))              AS proyectos_activos,
      (SELECT COUNT(*) FROM tareas t JOIN proyectos p ON p.id = t.proyecto_id
        WHERE p.archivado = 0 AND t.estado NOT IN ('completada','cancelada'))          AS tareas_abiertas,
      (SELECT COUNT(*) FROM tareas t JOIN proyectos p ON p.id = t.proyecto_id
        WHERE p.archivado = 0 AND t.estado = 'bloqueada')                              AS tareas_bloqueadas,
      (SELECT COUNT(*) FROM tareas t JOIN proyectos p ON p.id = t.proyecto_id
        WHERE p.archivado = 0 AND t.estado NOT IN ('completada','cancelada')
          AND t.fecha_vencimiento < CURDATE())                                         AS tareas_vencidas,
      (SELECT COUNT(*) FROM asuntos a JOIN proyectos p ON p.id = a.proyecto_id
        WHERE p.archivado = 0 AND a.severidad = 'critica'
          AND a.estado NOT IN ('resuelto','cerrado','descartado'))                     AS asuntos_criticos,
      (SELECT COUNT(*) FROM personas WHERE activo = 1)                                 AS personas_activas
  `);

export const tareasDeProyecto = (id: number) =>
  filas<FilaTarea>(
    `SELECT t.id, t.titulo, t.descripcion, t.tipo, t.estado, t.prioridad,
            t.responsable_id, CONCAT_WS(' ', pe.nombre, pe.apellido) AS responsable,
            t.fecha_vencimiento,
            DATEDIFF(t.fecha_vencimiento, CURDATE())                 AS dias_para_vencer,
            DATEDIFF(CURDATE(), COALESCE(t.bloqueada_desde, t.actualizado_en)) AS dias_en_estado_actual,
            t.estimacion_horas, t.progreso_pct, t.motivo_bloqueo,
            h.nombre AS hito,
            (SELECT GROUP_CONCAT(td.tarea_id)     FROM tarea_dependencias td
              WHERE td.depende_de_id = t.id AND td.tipo = 'bloquea')  AS bloquea_a,
            (SELECT GROUP_CONCAT(td.depende_de_id) FROM tarea_dependencias td
              WHERE td.tarea_id = t.id AND td.tipo = 'bloquea')       AS depende_de
       FROM tareas t
       LEFT JOIN personas pe ON pe.id = t.responsable_id
       LEFT JOIN hitos    h  ON h.id  = t.hito_id
      WHERE t.proyecto_id = ?
      ORDER BY FIELD(t.estado,'bloqueada','en_progreso','en_revision','pendiente','completada','cancelada'),
               FIELD(t.prioridad,'critica','alta','media','baja'),
               t.fecha_vencimiento IS NULL, t.fecha_vencimiento`,
    [id],
  );

export const asuntosDeProyecto = (id: number) =>
  filas<FilaAsunto>(
    `SELECT a.id, a.codigo, a.titulo, a.descripcion, a.tipo, ca.nombre AS categoria,
            a.severidad, a.impacto, a.estado, a.asignado_a_id,
            CONCAT_WS(' ', pe.nombre, pe.apellido) AS asignado_a,
            DATEDIFF(CURDATE(), DATE(a.fecha_reporte)) AS dias_abierto,
            a.es_recurrente, a.causa_raiz
       FROM asuntos a
       LEFT JOIN categorias_asunto ca ON ca.id = a.categoria_asunto_id
       LEFT JOIN personas pe          ON pe.id = a.asignado_a_id
      WHERE a.proyecto_id = ?
      ORDER BY a.estado IN ('resuelto','cerrado','descartado'),
               FIELD(a.severidad,'critica','alta','media','baja'),
               FIELD(a.estado,'pendiente','en_progreso','en_espera','resuelto','cerrado','descartado'),
               a.fecha_reporte`,
    [id],
  );

export const equipoDeProyecto = (id: number) =>
  filas<FilaMiembro>(
    `SELECT pe.id AS persona_id,
            CONCAT_WS(' ', pe.nombre, pe.apellido) AS nombre,
            COALESCE(rp.nombre, pe.rol_principal)  AS rol,
            pe.seniority, pp.asignacion_pct,
            (SELECT COUNT(*) FROM tareas t WHERE t.responsable_id = pe.id
               AND t.proyecto_id = pp.proyecto_id
               AND t.estado NOT IN ('completada','cancelada'))                      AS tareas_abiertas,
            (SELECT COUNT(*) FROM tareas t WHERE t.responsable_id = pe.id
               AND t.proyecto_id = pp.proyecto_id
               AND t.estado NOT IN ('completada','cancelada')
               AND t.fecha_vencimiento < CURDATE())                                 AS tareas_vencidas,
            (SELECT COUNT(*) FROM tareas t WHERE t.responsable_id = pe.id
               AND t.proyecto_id = pp.proyecto_id AND t.estado = 'bloqueada')       AS tareas_bloqueadas,
            (SELECT COUNT(*) FROM tareas t WHERE t.responsable_id = pe.id
               AND t.estado NOT IN ('completada','cancelada'))                      AS carga_total_proyectos,
            (SELECT SUM(t.estimacion_horas) FROM tareas t WHERE t.responsable_id = pe.id
               AND t.estado NOT IN ('completada','cancelada'))                      AS horas_comprometidas,
            pe.disponibilidad_horas_semana,
            (SELECT GROUP_CONCAT(h.nombre ORDER BY ph.nivel DESC SEPARATOR ', ')
               FROM persona_habilidades ph JOIN habilidades h ON h.id = ph.habilidad_id
              WHERE ph.persona_id = pe.id AND ph.es_fortaleza = 1)                  AS fortalezas
       FROM proyecto_personas pp
       JOIN personas pe      ON pe.id = pp.persona_id
       LEFT JOIN roles_proyecto rp ON rp.id = pp.rol_id
      WHERE pp.proyecto_id = ? AND pp.activo = 1
      ORDER BY pp.es_principal DESC, pe.nombre`,
    [id],
  );

export const tendenciaDeProyecto = (id: number) =>
  filas<{
    fecha: string; progreso_pct: number; tareas_completadas: number;
    tareas_bloqueadas: number; asuntos_abiertos: number;
  }>(
    `SELECT fecha, progreso_pct, tareas_completadas, tareas_bloqueadas, asuntos_abiertos
       FROM metricas_snapshot WHERE proyecto_id = ?
      ORDER BY fecha DESC LIMIT 12`,
    [id],
  );

export const eventosDeProyecto = (id: number, limite = 30) =>
  filas<{ fecha: string; entidad_tipo: string; entidad_id: number; accion: string; detalle: string }>(
    `SELECT DATE_FORMAT(creado_en, '%Y-%m-%d') AS fecha, entidad_tipo, entidad_id, accion,
            TRIM(CONCAT_WS(' ', campo, valor_anterior, '->', valor_nuevo)) AS detalle
       FROM bitacora WHERE proyecto_id = ?
      ORDER BY creado_en DESC LIMIT ?`,
    [id, limite],
  );

export const decisionesDeProyecto = (id: number) =>
  filas<{ fecha: string; autor: string | null; contenido: string }>(
    `SELECT DATE_FORMAT(c.creado_en,'%Y-%m-%d') AS fecha,
            CONCAT_WS(' ', pe.nombre, pe.apellido) AS autor, c.contenido
       FROM comentarios c LEFT JOIN personas pe ON pe.id = c.autor_id
      WHERE c.es_decision = 1
        AND ((c.entidad_tipo = 'proyecto' AND c.entidad_id = ?)
          OR (c.entidad_tipo = 'tarea'
              AND c.entidad_id IN (SELECT id FROM tareas WHERE proyecto_id = ?)))
      ORDER BY c.creado_en DESC LIMIT 10`,
    [id, id],
  );

export const habilidadesRequeridas = (id: number) =>
  filas<{ nombre: string; nivel_minimo: number; criticidad: string; cubierta: number }>(
    `SELECT h.nombre, phr.nivel_minimo, phr.criticidad,
            EXISTS (
              SELECT 1 FROM proyecto_personas pp
                JOIN persona_habilidades ph ON ph.persona_id = pp.persona_id
               WHERE pp.proyecto_id = phr.proyecto_id AND pp.activo = 1
                 AND ph.habilidad_id = phr.habilidad_id
                 AND ph.nivel >= phr.nivel_minimo
            ) AS cubierta
       FROM proyecto_habilidades_requeridas phr
       JOIN habilidades h ON h.id = phr.habilidad_id
      WHERE phr.proyecto_id = ?
      ORDER BY FIELD(phr.criticidad,'indispensable','importante','deseable'), h.nombre`,
    [id],
  );

export interface FiltrosPersonas {
  /** Busca en nombre completo, email y rol. */
  q?: string;
  tipoRelacion?: string;
  empresaId?: number;
  habilidadId?: number;
}

const TIPOS_RELACION_VALIDOS = new Set(
  ['interno', 'freelance', 'cliente', 'stakeholder', 'proveedor', 'candidato'],
);

export const listaPersonas = (filtros: FiltrosPersonas = {}) => {
  const condiciones = ['pe.activo = 1'];
  const params: unknown[] = [];

  if (filtros.q) {
    condiciones.push(`(CONCAT_WS(' ', pe.nombre, pe.apellido) LIKE ?
      OR pe.email LIKE ? OR pe.rol_principal LIKE ?)`);
    const patron = `%${filtros.q}%`;
    params.push(patron, patron, patron);
  }
  if (filtros.tipoRelacion && TIPOS_RELACION_VALIDOS.has(filtros.tipoRelacion)) {
    condiciones.push('pe.tipo_relacion = ?');
    params.push(filtros.tipoRelacion);
  }
  if (filtros.empresaId) {
    condiciones.push('pe.empresa_id = ?');
    params.push(filtros.empresaId);
  }
  if (filtros.habilidadId) {
    condiciones.push(`EXISTS (SELECT 1 FROM persona_habilidades ph
      WHERE ph.persona_id = pe.id AND ph.habilidad_id = ?)`);
    params.push(filtros.habilidadId);
  }

  return filas<FilaPersona>(`
    SELECT pe.id,
           CONCAT_WS(' ', pe.nombre, pe.apellido) AS nombre_completo,
           pe.email, pe.rol_principal, pe.seniority, pe.anios_experiencia,
           pe.tipo_relacion, em.nombre AS empresa,
           pe.disponibilidad_horas_semana, pe.ubicacion,
           (SELECT COUNT(DISTINCT pp.proyecto_id) FROM proyecto_personas pp
             JOIN proyectos p ON p.id = pp.proyecto_id
            WHERE pp.persona_id = pe.id AND pp.activo = 1
              AND p.estado NOT IN ('completado','cancelado'))                     AS proyectos_activos,
           (SELECT COUNT(*) FROM tareas t WHERE t.responsable_id = pe.id
             AND t.estado NOT IN ('completada','cancelada'))                      AS tareas_abiertas,
           (SELECT GROUP_CONCAT(h.nombre ORDER BY ph.nivel DESC SEPARATOR ', ')
              FROM persona_habilidades ph JOIN habilidades h ON h.id = ph.habilidad_id
             WHERE ph.persona_id = pe.id AND ph.es_fortaleza = 1)                 AS fortalezas
      FROM personas pe
      LEFT JOIN empresas em ON em.id = pe.empresa_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY FIELD(pe.tipo_relacion,'interno','freelance','cliente','stakeholder','proveedor','candidato'),
              pe.nombre
  `, params);
};

export interface FilaPersonaDetalle {
  id: number;
  nombre: string;
  apellido: string | null;
  nombre_completo: string;
  email: string | null;
  telefono: string | null;
  empresa_id: number | null;
  empresa: string | null;
  tipo_relacion: string;
  rol_principal: string | null;
  seniority: string | null;
  anios_experiencia: number | null;
  disponibilidad_horas_semana: number | null;
  ubicacion: string | null;
  linkedin_url: string | null;
  portafolio_url: string | null;
  bio: string | null;
  resumen_ia: string | null;
}

export const personaPorId = (id: number) =>
  fila<FilaPersonaDetalle>(
    `SELECT pe.id, pe.nombre, pe.apellido,
            CONCAT_WS(' ', pe.nombre, pe.apellido) AS nombre_completo,
            pe.email, pe.telefono, pe.empresa_id, em.nombre AS empresa,
            pe.tipo_relacion, pe.rol_principal, pe.seniority, pe.anios_experiencia,
            pe.disponibilidad_horas_semana, pe.ubicacion, pe.linkedin_url,
            pe.portafolio_url, pe.bio, pe.resumen_ia
       FROM personas pe
       LEFT JOIN empresas em ON em.id = pe.empresa_id
      WHERE pe.id = ? AND pe.activo = 1`,
    [id],
  );

export const experienciasDePersona = (id: number) =>
  filas<{
    empresa_nombre: string; cargo: string; industria: string | null;
    fecha_inicio: string | null; fecha_fin: string | null; es_actual: number;
    descripcion: string | null; logros: string | null;
  }>(
    `SELECT empresa_nombre, cargo, industria, fecha_inicio, fecha_fin,
            es_actual, descripcion, logros
       FROM persona_experiencias WHERE persona_id = ?
      ORDER BY es_actual DESC, fecha_inicio DESC`,
    [id],
  );

export const proyectosDePersona = (id: number) =>
  filas<{
    proyecto_id: number; codigo: string; nombre: string; estado: EstadoProyecto;
    salud: Salud; rol: string | null; asignacion_pct: number | null;
    es_principal: number; tareas_abiertas: number;
  }>(
    `SELECT p.id AS proyecto_id, p.codigo, p.nombre, p.estado, p.salud,
            COALESCE(rp.nombre, '') AS rol, pp.asignacion_pct, pp.es_principal,
            (SELECT COUNT(*) FROM tareas t WHERE t.responsable_id = pp.persona_id
               AND t.proyecto_id = p.id
               AND t.estado NOT IN ('completada','cancelada')) AS tareas_abiertas
       FROM proyecto_personas pp
       JOIN proyectos p ON p.id = pp.proyecto_id
       LEFT JOIN roles_proyecto rp ON rp.id = pp.rol_id
      WHERE pp.persona_id = ? AND pp.activo = 1
      ORDER BY p.estado NOT IN ('en_progreso','en_revision','planificacion'), p.nombre`,
    [id],
  );

/* -------------------------------------------------------------------------- */
/*  Empresas (CRM)                                                             */
/* -------------------------------------------------------------------------- */

export interface FilaEmpresa {
  id: number;
  nombre: string;
  tipo: string;
  industria: string | null;
  tamano: string | null;
  pais: string | null;
  sitio_web: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  notas: string | null;
  contactos: number;
  proyectos_activos: number;
  proyectos_total: number;
}

export const listaEmpresas = () =>
  filas<FilaEmpresa>(`
    SELECT em.id, em.nombre, em.tipo, em.industria, em.tamano, em.pais,
           em.sitio_web, em.contacto_email, em.contacto_telefono, em.notas,
           (SELECT COUNT(*) FROM personas pe
             WHERE pe.empresa_id = em.id AND pe.activo = 1)              AS contactos,
           (SELECT COUNT(*) FROM proyectos p WHERE p.empresa_id = em.id
             AND p.archivado = 0
             AND p.estado NOT IN ('completado','cancelado'))             AS proyectos_activos,
           (SELECT COUNT(*) FROM proyectos p WHERE p.empresa_id = em.id) AS proyectos_total
      FROM empresas em
     WHERE em.activo = 1
     ORDER BY FIELD(em.tipo,'cliente','prospecto','aliado','proveedor','interna'), em.nombre
  `);

export const empresaPorId = (id: number) =>
  fila<FilaEmpresa>(`
    SELECT em.id, em.nombre, em.tipo, em.industria, em.tamano, em.pais,
           em.sitio_web, em.contacto_email, em.contacto_telefono, em.notas,
           (SELECT COUNT(*) FROM personas pe
             WHERE pe.empresa_id = em.id AND pe.activo = 1)              AS contactos,
           (SELECT COUNT(*) FROM proyectos p WHERE p.empresa_id = em.id
             AND p.archivado = 0
             AND p.estado NOT IN ('completado','cancelado'))             AS proyectos_activos,
           (SELECT COUNT(*) FROM proyectos p WHERE p.empresa_id = em.id) AS proyectos_total
      FROM empresas em
     WHERE em.id = ? AND em.activo = 1
  `, [id]);

export const personasDeEmpresa = (id: number) =>
  filas<{
    id: number; nombre_completo: string; email: string | null;
    rol_principal: string | null; tipo_relacion: string; telefono: string | null;
  }>(
    `SELECT id, CONCAT_WS(' ', nombre, apellido) AS nombre_completo,
            email, rol_principal, tipo_relacion, telefono
       FROM personas WHERE empresa_id = ? AND activo = 1
      ORDER BY nombre`,
    [id],
  );

export const proyectosDeEmpresa = (id: number) =>
  filas<{
    id: number; codigo: string; nombre: string; estado: EstadoProyecto;
    prioridad: Prioridad; salud: Salud; progreso_pct: number;
    fecha_fin_estimada: string | null;
  }>(
    `SELECT id, codigo, nombre, estado, prioridad, salud, progreso_pct, fecha_fin_estimada
       FROM proyectos WHERE empresa_id = ? AND archivado = 0
      ORDER BY estado NOT IN ('en_progreso','en_revision','planificacion'), nombre`,
    [id],
  );

/* -------------------------------------------------------------------------- */
/*  Catálogos para formularios                                                 */
/* -------------------------------------------------------------------------- */

export const listaCategorias = () =>
  filas<{ id: number; nombre: string }>(
    `SELECT id, nombre FROM categorias WHERE activo = 1 ORDER BY orden, nombre`,
  );

export const opcionesEmpresas = () =>
  filas<{ id: number; nombre: string }>(
    `SELECT id, nombre FROM empresas WHERE activo = 1 ORDER BY nombre`,
  );

export const opcionesPersonas = () =>
  filas<{ id: number; nombre_completo: string }>(
    `SELECT id, CONCAT_WS(' ', nombre, apellido) AS nombre_completo
       FROM personas WHERE activo = 1 ORDER BY nombre`,
  );

export const listaHabilidades = () =>
  filas<{ id: number; nombre: string; tipo: string }>(
    `SELECT id, nombre, tipo FROM habilidades ORDER BY nombre`,
  );

/* -------------------------------------------------------------------------- */
/*  Roadmap                                                                    */
/* -------------------------------------------------------------------------- */

export interface FilaHitoRoadmap {
  id: number;
  nombre: string;
  descripcion: string | null;
  fecha_objetivo: string | null;
  fecha_completado: string | null;
  estado: string;
  orden: number;
  tareas_total: number;
  tareas_completadas: number;
}

export interface FilaSprint {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
}

export interface FilaTareaRoadmap {
  id: number;
  titulo: string;
  estado: EstadoTarea;
  prioridad: Prioridad;
  hito_id: number | null;
  sprint_id: number | null;
  fecha_inicio: string | null;
  fecha_vencimiento: string | null;
  progreso_pct: number;
  responsable: string | null;
}

export const roadmapDeProyecto = async (id: number) => {
  const [hitos, sprints, tareas] = await Promise.all([
    filas<FilaHitoRoadmap>(
      `SELECT h.id, h.nombre, h.descripcion, h.fecha_objetivo, h.fecha_completado,
              h.estado, h.orden,
              (SELECT COUNT(*) FROM tareas t WHERE t.hito_id = h.id
                 AND t.estado <> 'cancelada')                            AS tareas_total,
              (SELECT COUNT(*) FROM tareas t WHERE t.hito_id = h.id
                 AND t.estado = 'completada')                            AS tareas_completadas
         FROM hitos h
        WHERE h.proyecto_id = ? AND h.estado <> 'cancelado'
        ORDER BY h.orden, h.fecha_objetivo`,
      [id],
    ),
    filas<FilaSprint>(
      `SELECT id, nombre, fecha_inicio, fecha_fin, estado
         FROM sprints WHERE proyecto_id = ?
        ORDER BY fecha_inicio`,
      [id],
    ),
    filas<FilaTareaRoadmap>(
      `SELECT t.id, t.titulo, t.estado, t.prioridad, t.hito_id, t.sprint_id,
              t.fecha_inicio, t.fecha_vencimiento, t.progreso_pct,
              CONCAT_WS(' ', pe.nombre, pe.apellido) AS responsable
         FROM tareas t
         LEFT JOIN personas pe ON pe.id = t.responsable_id
        WHERE t.proyecto_id = ? AND t.estado <> 'cancelada'
        ORDER BY t.fecha_inicio IS NULL, t.fecha_inicio, t.orden`,
      [id],
    ),
  ]);
  return { hitos, sprints, tareas };
};

export const habilidadesDePersona = (id: number) =>
  filas<{ nombre: string; tipo: string; nivel: number; anios_experiencia: number | null; es_fortaleza: number; evidencia: string | null }>(
    `SELECT h.nombre, h.tipo, ph.nivel, ph.anios_experiencia, ph.es_fortaleza, ph.evidencia
       FROM persona_habilidades ph JOIN habilidades h ON h.id = ph.habilidad_id
      WHERE ph.persona_id = ?
      ORDER BY ph.es_fortaleza DESC, ph.nivel DESC, h.nombre`,
    [id],
  );

export const insumosDePersona = (id: number) =>
  filas<{ tipo: string; titulo: string; detalle: string | null; contexto: string | null }>(
    `SELECT tipo, titulo, detalle, contexto FROM persona_insumos
      WHERE persona_id = ?
      ORDER BY FIELD(tipo,'fortaleza','aporte','pregunta_sugerida','logro','interes','area_mejora')`,
    [id],
  );

export const recomendacionesDeProyecto = (id: number) =>
  filas<FilaRecomendacion>(
    `SELECT r.*, CONCAT_WS(' ', pe.nombre, pe.apellido) AS persona_sugerida
       FROM recomendaciones_ia r
       LEFT JOIN personas pe ON pe.id = r.persona_sugerida_id
      WHERE r.proyecto_id = ? AND r.estado <> 'descartada'
      ORDER BY r.creado_en DESC,
               FIELD(r.prioridad,'critica','alta','media','baja')
      LIMIT 20`,
    [id],
  );

export const ultimoAnalisisPorTipo = (proyectoId: number, tipo: string) =>
  fila<{
    id: number; tipo_analisis: string; resumen: string | null; puntaje_salud: number | null;
    respuesta_json: unknown; modelo: string; creado_en: string;
  }>(
    `SELECT id, tipo_analisis, resumen, puntaje_salud, respuesta_json, modelo, creado_en
       FROM analisis_ia
      WHERE proyecto_id = ? AND tipo_analisis = ? AND estado = 'ok'
      ORDER BY creado_en DESC LIMIT 1`,
    [proyectoId, tipo],
  );

export const ultimoAnalisis = (proyectoId: number) =>
  ultimoAnalisisPorTipo(proyectoId, 'salud_proyecto');

export const patronesActivos = () =>
  filas<{ clave: string; nombre: string; descripcion: string | null; tipo: string; frecuencia: number; confianza: number | null; recomendacion: string | null; ultima_deteccion: string }>(`
    SELECT clave, nombre, descripcion, tipo, frecuencia, confianza, recomendacion, ultima_deteccion
      FROM patrones_detectados WHERE estado = 'activo'
     ORDER BY frecuencia DESC, confianza DESC LIMIT 10
  `);
