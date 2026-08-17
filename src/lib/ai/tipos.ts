/**
 * Contrato de datos con el motor de IA.
 *
 * Regla de oro: al modelo NO se le manda un volcado de la base de datos.
 * Se le manda un informe ya digerido — métricas calculadas, top-N ordenado y
 * vocabulario cerrado. Todo lo que el modelo puede contar solo (cuántas tareas
 * hay abiertas, cuántos días lleva algo detenido) se calcula en SQL, porque
 * ahí es exacto y gratis; en el modelo es caro y aproximado.
 *
 * Todo elemento lleva su `id` real de la base de datos. Sin eso la respuesta
 * es un texto bonito que no se puede enlazar a nada.
 */

/* ========================================================================== */
/*  Vocabulario compartido (idéntico a los ENUM de MySQL)                      */
/* ========================================================================== */

export type EstadoProyecto =
  | 'idea' | 'planificacion' | 'en_progreso' | 'en_pausa'
  | 'en_revision' | 'completado' | 'cancelado';

export type EstadoTarea =
  | 'pendiente' | 'en_progreso' | 'en_revision' | 'bloqueada' | 'completada' | 'cancelada';

export type EstadoAsunto =
  | 'pendiente' | 'en_progreso' | 'en_espera' | 'resuelto' | 'cerrado' | 'descartado';

export type Prioridad = 'baja' | 'media' | 'alta' | 'critica';
export type Salud = 'verde' | 'amarillo' | 'rojo' | 'sin_datos';
export type NivelTriple = 'bajo' | 'medio' | 'alto';
export type EntidadRef = 'proyecto' | 'tarea' | 'asunto' | 'persona';

export type TipoAnalisis =
  | 'salud_proyecto'
  | 'cuellos_botella'
  | 'match_persona_tarea'
  | 'patrones_globales'
  | 'priorizacion_diaria'
  | 'perfil_cv'
  | 'planteamiento_proyecto'
  | 'tareas_sugeridas';

/* ========================================================================== */
/*  1 · SOBRE (envelope) COMÚN                                                 */
/* ========================================================================== */

export interface MetaPayload {
  /** Versión del contrato. Súbela cuando cambies la forma del payload. */
  contrato: string;               // 'v1'
  tipo_analisis: TipoAnalisis;
  /** Fecha de referencia. El modelo NO debe usar "hoy": debe usar esto. */
  fecha_referencia: string;       // ISO 8601, ej. '2026-08-17'
  zona_horaria: string;           // 'America/Caracas'
  /** Ventana de historia incluida en el payload. */
  ventana_dias: number;
  idioma_respuesta: 'es';
}

export interface ContextoOrganizacion {
  nombre: string;
  /** Cuántos proyectos activos hay en total: sin esto el modelo no puede
   *  juzgar si "tres proyectos en rojo" es una crisis o el 5% del portafolio. */
  proyectos_activos: number;
  personas_activas: number;
  capacidad_semanal_horas: number | null;
  /** Prioridades declaradas del negocio para este trimestre, si existen. */
  prioridades_declaradas: string[];
}

/* ========================================================================== */
/*  2 · BLOQUES DE DATOS                                                       */
/* ========================================================================== */

export interface MetricasTareas {
  total: number;
  por_estado: Record<EstadoTarea, number>;
  bloqueadas: number;
  vencidas: number;
  sin_responsable: number;
  completadas_ultimos_14d: number;
  creadas_ultimos_14d: number;
  /** Días promedio entre creación y cierre de las últimas completadas. */
  ciclo_promedio_dias: number | null;
  horas_estimadas_pendientes: number | null;
}

export interface MetricasAsuntos {
  abiertos: number;
  por_severidad: Record<Prioridad, number>;
  por_categoria: Record<string, number>;
  criticos_abiertos: number;
  recurrentes: number;
  edad_promedio_dias: number | null;
  resolucion_promedio_dias: number | null;
}

export interface MetricasActividad {
  dias_sin_movimiento: number;
  eventos_ultimos_7d: number;
  eventos_ultimos_30d: number;
  /** Tareas cerradas por semana en las últimas 4 semanas. */
  velocidad_semanal: number | null;
  /** Tendencia de la velocidad frente al periodo anterior. */
  tendencia_velocidad: 'sube' | 'estable' | 'baja' | 'sin_datos';
}

export interface MiembroEquipo {
  persona_id: number;
  nombre: string;
  rol: string | null;
  seniority: string | null;
  asignacion_pct: number | null;
  /** Habilidades destacadas, ya filtradas a las relevantes para el proyecto. */
  fortalezas: string[];
  tareas_abiertas: number;
  tareas_vencidas: number;
  tareas_bloqueadas: number;
  /** Suma de tareas abiertas en TODOS los proyectos: detecta sobrecarga real. */
  carga_total_proyectos: number;
  horas_comprometidas: number | null;
  disponibilidad_horas_semana: number | null;
}

export interface TareaResumen {
  id: number;
  titulo: string;
  estado: EstadoTarea;
  prioridad: Prioridad;
  tipo: string;
  responsable_id: number | null;
  responsable: string | null;
  dias_para_vencer: number | null;   // negativo = vencida
  dias_en_estado_actual: number;
  motivo_bloqueo: string | null;
  /** IDs de tareas que no pueden avanzar hasta que esta termine. */
  bloquea_a: number[];
  depende_de: number[];
}

export interface AsuntoResumen {
  id: number;
  codigo: string | null;
  titulo: string;
  tipo: string;
  categoria: string | null;
  severidad: Prioridad;
  impacto: NivelTriple;
  estado: EstadoAsunto;
  asignado_a_id: number | null;
  dias_abierto: number;
  es_recurrente: boolean;
  causa_raiz: string | null;
}

export interface HitoResumen {
  id: number;
  nombre: string;
  fecha_objetivo: string | null;
  dias_para_objetivo: number | null;
  estado: string;
  tareas_pendientes: number;
}

export interface EventoResumen {
  fecha: string;
  entidad_tipo: string;
  entidad_id: number;
  accion: string;
  detalle: string;
}

export interface DecisionRegistrada {
  fecha: string;
  autor: string | null;
  contenido: string;
}

export interface PuntoTendencia {
  fecha: string;
  progreso_pct: number;
  tareas_completadas: number;
  tareas_bloqueadas: number;
  asuntos_abiertos: number;
}

/** Bloque completo de un proyecto. Es la unidad de análisis. */
export interface BloqueProyecto {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string | null;
  etiquetas: string[];
  cliente: { id: number; nombre: string; industria: string | null } | null;
  estado: EstadoProyecto;
  prioridad: Prioridad;
  salud_actual: Salud;
  /** Qué se considera éxito aquí. Es el ancla de todo el análisis. */
  objetivo: string | null;
  descripcion: string | null;

  fechas: {
    inicio: string | null;
    fin_estimada: string | null;
    dias_transcurridos: number | null;
    dias_restantes: number | null;
    /** % del calendario ya consumido. Comparado con progreso da la desviación. */
    tiempo_consumido_pct: number | null;
  };

  progreso: {
    declarado_pct: number;
    calculado_pct: number;
    /** tiempo_consumido_pct − calculado_pct. Positivo = va atrasado. */
    desviacion_pct: number | null;
  };

  metricas: {
    tareas: MetricasTareas;
    asuntos: MetricasAsuntos;
    actividad: MetricasActividad;
  };

  equipo: MiembroEquipo[];
  habilidades_requeridas: { nombre: string; nivel_minimo: number; criticidad: string; cubierta: boolean }[];

  /** Top-N, ya ordenadas por criticidad. No se manda la lista completa. */
  tareas_criticas: TareaResumen[];
  asuntos_abiertos: AsuntoResumen[];
  hitos: HitoResumen[];
  eventos_recientes: EventoResumen[];
  decisiones: DecisionRegistrada[];
  tendencia: PuntoTendencia[];
}

/** Versión reducida para el análisis de portafolio (muchos proyectos a la vez). */
export interface BloqueProyectoCompacto {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string | null;
  cliente: string | null;
  estado: EstadoProyecto;
  prioridad: Prioridad;
  salud_actual: Salud;
  progreso_pct: number;
  dias_restantes: number | null;
  desviacion_pct: number | null;
  tareas_abiertas: number;
  tareas_bloqueadas: number;
  tareas_vencidas: number;
  asuntos_abiertos: number;
  asuntos_criticos: number;
  dias_sin_movimiento: number;
  responsable: string | null;
  equipo_ids: number[];
}

/** Memoria del sistema: patrones ya detectados, para reforzar en vez de repetir. */
export interface PatronConocido {
  clave: string;
  nombre: string;
  tipo: string;
  frecuencia: number;
  confianza: number | null;
  ultima_deteccion: string;
}

/** Recomendaciones anteriores con su desenlace. Esto es lo que hace que el
 *  sistema mejore: el modelo ve qué aceptaste y qué descartaste, y por qué. */
export interface RecomendacionPrevia {
  id: number;
  titulo: string;
  tipo: string;
  estado: 'nueva' | 'aceptada' | 'en_progreso' | 'implementada' | 'descartada';
  feedback_usuario: string | null;
  dias_desde_emision: number;
}

/* ========================================================================== */
/*  3 · PAYLOADS POR TIPO DE ANÁLISIS                                          */
/* ========================================================================== */

export interface PayloadSaludProyecto {
  meta: MetaPayload;
  organizacion: ContextoOrganizacion;
  proyecto: BloqueProyecto;
  patrones_conocidos: PatronConocido[];
  recomendaciones_previas: RecomendacionPrevia[];
}

export interface PayloadCuellosBotella {
  meta: MetaPayload;
  organizacion: ContextoOrganizacion;
  proyectos: BloqueProyectoCompacto[];
  /** Cadenas de dependencia abiertas en todo el portafolio. */
  bloqueos: (TareaResumen & { proyecto_id: number; proyecto_codigo: string })[];
  equipo: MiembroEquipo[];
}

export interface PayloadMatchPersonaTarea {
  meta: MetaPayload;
  objetivo: {
    tipo: 'tarea' | 'proyecto';
    id: number;
    titulo: string;
    descripcion: string | null;
    prioridad: Prioridad;
    fecha_limite: string | null;
    habilidades_requeridas: { nombre: string; nivel_minimo: number; criticidad: string }[];
    contexto_proyecto: { id: number; nombre: string; categoria: string | null; industria: string | null };
  };
  candidatos: {
    persona_id: number;
    nombre: string;
    rol: string | null;
    seniority: string | null;
    anios_experiencia: number | null;
    habilidades: { nombre: string; nivel: number; anios: number | null; evidencia: string | null }[];
    industrias: string[];
    fortalezas: string[];
    carga_actual: { proyectos: number; tareas_abiertas: number; horas_comprometidas: number | null };
    disponibilidad_horas_semana: number | null;
    /** Desempeño histórico en trabajo parecido, calculado en SQL. */
    historial: { proyectos_similares: number; tareas_completadas_a_tiempo_pct: number | null };
  }[];
}

export interface PayloadPatronesGlobales {
  meta: MetaPayload;
  organizacion: ContextoOrganizacion;
  proyectos: BloqueProyectoCompacto[];
  /** Agregados que hacen visible el patrón sin mandar cada registro. */
  agregados: {
    asuntos_por_categoria: { categoria: string; total: number; proyectos_afectados: number; edad_promedio_dias: number }[];
    proyectos_por_categoria: { categoria: string; total: number; completados: number; atraso_promedio_dias: number | null }[];
    desempeno_por_persona: { persona_id: number; nombre: string; tareas_completadas: number; a_tiempo_pct: number | null; asuntos_asignados: number }[];
    combinaciones_equipo: { proyecto_id: number; roles: string[]; resultado: 'a_tiempo' | 'atrasado' | 'en_curso' }[];
    brechas_skill: { habilidad: string; demanda: number; personas_con_nivel_3_o_mas: number }[];
  };
  patrones_conocidos: PatronConocido[];
}

export interface PayloadPriorizacionDiaria {
  meta: MetaPayload;
  organizacion: ContextoOrganizacion;
  /** Cuánto tiempo real hay disponible hoy. Sin esto la lista es fantasía. */
  capacidad_hoy: { horas_disponibles: number | null; compromisos: string[] };
  proyectos: BloqueProyectoCompacto[];
  tareas_candidatas: (TareaResumen & { proyecto_id: number; proyecto_codigo: string; proyecto_prioridad: Prioridad })[];
  asuntos_candidatos: (AsuntoResumen & { proyecto_id: number; proyecto_codigo: string })[];
  recomendaciones_previas: RecomendacionPrevia[];
}

export interface PayloadPerfilCv {
  meta: MetaPayload;
  documento: {
    persona_id: number | null;
    nombre_archivo: string;
    tipo: string;
    /** Texto plano ya extraído del PDF/DOCX. Truncado a un tope de caracteres. */
    texto: string;
    truncado: boolean;
  };
  /** Catálogo existente para que el modelo reutilice slugs en vez de inventarlos. */
  catalogo_habilidades: { slug: string; nombre: string; tipo: string }[];
  /** Contexto del negocio: qué necesitamos, para que evalúe el encaje. */
  necesidades_actuales: { habilidad: string; demanda: number }[];
}

/**
 * Payload del planteamiento inicial. Se arma a partir de la descripción libre
 * que el usuario escribió al crear el proyecto; los hitos y tareas existentes
 * viajan para que el modelo no proponga duplicados al re-ejecutarlo.
 */
export interface PayloadPlanteamientoProyecto {
  meta: MetaPayload;
  organizacion: ContextoOrganizacion;
  proyecto: {
    id: number;
    codigo: string;
    nombre: string;
    categoria: string | null;
    estado: EstadoProyecto;
    prioridad: Prioridad;
    /** Lo que el usuario escribió al crear el proyecto. Es la materia prima. */
    descripcion_libre: string | null;
    objetivo: string | null;
    fechas: { inicio: string | null; fin_estimada: string | null };
    equipo: MiembroEquipo[];
    hitos_existentes: HitoResumen[];
    tareas_existentes: { id: number; titulo: string; estado: EstadoTarea; tipo: string }[];
  };
}

/** Payload de sugerencia de tareas según el estado ACTUAL del proyecto. */
export interface PayloadTareasSugeridas {
  meta: MetaPayload;
  organizacion: ContextoOrganizacion;
  proyecto: {
    id: number;
    codigo: string;
    nombre: string;
    estado: EstadoProyecto;
    prioridad: Prioridad;
    objetivo: string | null;
    descripcion: string | null;
    fechas: { inicio: string | null; fin_estimada: string | null; dias_restantes: number | null };
    metricas_tareas: MetricasTareas;
    equipo: MiembroEquipo[];
    hitos: HitoResumen[];
    tareas_existentes: TareaResumen[];
  };
}

export type PayloadIa =
  | PayloadSaludProyecto
  | PayloadCuellosBotella
  | PayloadMatchPersonaTarea
  | PayloadPatronesGlobales
  | PayloadPriorizacionDiaria
  | PayloadPerfilCv
  | PayloadPlanteamientoProyecto
  | PayloadTareasSugeridas;

/* ========================================================================== */
/*  4 · RESPUESTAS ESTRUCTURADAS                                               */
/* ========================================================================== */

export interface Recomendacion {
  titulo: string;
  descripcion: string;
  /** Qué dato concreto del payload la sustenta. Obligatorio: mata alucinaciones. */
  justificacion: string;
  tipo: 'accion' | 'alerta' | 'riesgo' | 'mejora' | 'asignacion' | 'pregunta';
  prioridad: Prioridad;
  impacto_estimado: NivelTriple;
  esfuerzo_estimado: NivelTriple;
  entidad_tipo: EntidadRef | null;
  entidad_id: number | null;
  persona_sugerida_id: number | null;
  plazo_sugerido_dias: number | null;
}

export interface RespuestaSaludProyecto {
  puntaje_salud: number;            // 0–100
  semaforo: 'verde' | 'amarillo' | 'rojo';
  resumen_ejecutivo: string;        // 2–3 frases
  diagnostico: {
    area: 'alcance' | 'tiempo' | 'equipo' | 'calidad' | 'comunicacion' | 'dependencias';
    hallazgo: string;
    evidencia: string[];
    severidad: NivelTriple;
  }[];
  riesgos: {
    titulo: string;
    descripcion: string;
    probabilidad: NivelTriple;
    impacto: NivelTriple;
    señales_tempranas: string[];
    mitigacion: string;
  }[];
  cuellos_botella: {
    entidad_tipo: EntidadRef;
    entidad_id: number;
    titulo: string;
    dias_detenido: number | null;
    por_que_bloquea: string;
    desbloqueo_sugerido: string;
  }[];
  recomendaciones: Recomendacion[];
  plan_mejora: {
    horizonte_dias: number;
    pasos: {
      orden: number;
      accion: string;
      responsable_sugerido_id: number | null;
      resultado_esperado: string;
      dias_estimados: number | null;
    }[];
  };
  preguntas_para_el_equipo: { persona_id: number | null; pregunta: string; motivo: string }[];
  confianza: number;                // 0–1
  datos_faltantes: string[];
}

export interface RespuestaMatchPersonaTarea {
  candidatos: {
    persona_id: number;
    puntaje_ajuste: number;         // 0–100
    fortalezas_aplicables: string[];
    brechas: string[];
    riesgo_sobrecarga: NivelTriple;
    justificacion: string;
  }[];
  recomendado_persona_id: number | null;
  justificacion_final: string;
  brechas_de_equipo: { habilidad: string; nivel_requerido: number; situacion: string; sugerencia: string }[];
  confianza: number;
}

export interface RespuestaPatronesGlobales {
  patrones: {
    clave: string;                  // estable, para acumular frecuencia en BD
    nombre: string;
    tipo: 'riesgo_recurrente' | 'antipatron' | 'buena_practica' | 'correlacion_exito' | 'brecha_skill';
    ambito: 'categoria' | 'empresa' | 'persona' | 'global';
    descripcion: string;
    evidencia: { proyecto_ids: number[]; asunto_ids: number[]; nota: string };
    frecuencia_observada: number;
    confianza: number;
    recomendacion: string;
  }[];
  alertas_portafolio: { titulo: string; descripcion: string; prioridad: Prioridad; proyectos_afectados: number[] }[];
  resumen_ejecutivo: string;
}

export interface RespuestaPriorizacionDiaria {
  foco_del_dia: string;
  top_acciones: {
    orden: number;
    proyecto_id: number;
    entidad_tipo: EntidadRef;
    entidad_id: number;
    accion: string;
    por_que_ahora: string;
    minutos_estimados: number | null;
  }[];
  no_hacer_hoy: { entidad_tipo: EntidadRef; entidad_id: number; motivo: string }[];
  alertas: { titulo: string; descripcion: string; prioridad: Prioridad }[];
}

export interface RespuestaPerfilCv {
  perfil: {
    nombre_completo: string | null;
    email: string | null;
    telefono: string | null;
    rol_principal: string | null;
    seniority: 'junior' | 'semi_senior' | 'senior' | 'lead' | 'director' | null;
    anios_experiencia: number | null;
    ubicacion: string | null;
    resumen: string;
  };
  habilidades: {
    slug_existente: string | null;   // si coincide con el catálogo
    nombre: string;
    tipo: 'tecnica' | 'herramienta' | 'dominio' | 'blanda' | 'idioma' | 'metodologia';
    nivel: number;                   // 1–5
    anios_experiencia: number | null;
    es_fortaleza: boolean;
    evidencia: string | null;
    confianza: number;
  }[];
  experiencias: {
    empresa: string;
    cargo: string;
    industria: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    es_actual: boolean;
    logros: string[];
  }[];
  fortalezas: { titulo: string; detalle: string; contexto: string | null; confianza: number }[];
  aportes: { titulo: string; detalle: string; contexto: string | null; confianza: number }[];
  /** "Cosas que le podemos preguntar": el conocimiento que esta persona tiene
   *  y que a la organización le conviene extraer. */
  preguntas_sugeridas: { pregunta: string; motivo: string; tema: string }[];
  areas_mejora: { titulo: string; detalle: string }[];
  encaje_con_necesidades: { habilidad: string; cubre: boolean; nivel_estimado: number | null }[];
  confianza_global: number;
  datos_faltantes: string[];
}

/**
 * Respuesta del planteamiento. Los hitos llevan un `ref` local (1..n) y las
 * tareas apuntan a ese ref: nada existe todavía en la BD, así que no hay ids
 * reales que citar. Al aceptar, el flujo mapea ref → insertId.
 */
export interface RespuestaPlanteamientoProyecto {
  planteamiento: string;
  de_que_trata: string;
  objetivo_sugerido: string;
  supuestos: string[];
  hitos_propuestos: {
    ref: number;
    nombre: string;
    descripcion: string;
    orden: number;
    duracion_dias_estimada: number | null;
    entregable: string;
  }[];
  tareas_propuestas: {
    hito_ref: number | null;
    titulo: string;
    descripcion: string;
    tipo: string;
    prioridad: Prioridad;
    estimacion_horas: number | null;
    orden: number;
  }[];
  preguntas_por_resolver: string[];
  confianza: number;               // 0–1
}

/** Respuesta de tareas sugeridas. Aquí los ids SÍ son reales (del payload). */
export interface RespuestaTareasSugeridas {
  resumen_contexto: string;
  tareas: {
    titulo: string;
    descripcion: string;
    justificacion: string;
    tipo: string;
    prioridad: Prioridad;
    hito_id: number | null;
    responsable_sugerido_id: number | null;
    estimacion_horas: number | null;
  }[];
  confianza: number;               // 0–1
  datos_faltantes: string[];
}

/* ========================================================================== */
/*  5 · SOBRE DE RESPUESTA + TRAZA                                             */
/* ========================================================================== */

export interface ResultadoAnalisis<T> {
  analisis_id: number;
  tipo: TipoAnalisis;
  modelo: string;
  prompt_version: string;
  payload_hash: string;
  datos: T;
  uso: { tokens_entrada: number; tokens_salida: number; costo_usd: number | null; latencia_ms: number };
}
