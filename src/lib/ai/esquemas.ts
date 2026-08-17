/**
 * JSON Schemas para Structured Outputs de OpenAI.
 *
 * Reglas del modo `strict` que hay que respetar sí o sí:
 *   1. Todo objeto lleva "additionalProperties": false.
 *   2. TODAS las propiedades deben estar en "required". Un campo opcional se
 *      modela como requerido pero anulable: "type": ["string", "null"].
 *   3. No se admiten minimum/maximum/minItems/pattern. Los rangos se expresan
 *      en "description" y se validan después con Zod al guardar en la BD.
 *
 * Uso:
 *   const r = await openai.chat.completions.create({
 *     model: process.env.OPENAI_MODEL!,
 *     messages: [...],
 *     response_format: formatoRespuesta('salud_proyecto'),
 *   });
 */

type Esquema = Record<string, unknown>;

const str = (description?: string): Esquema => ({ type: 'string', ...(description ? { description } : {}) });
const strNull = (description?: string): Esquema => ({ type: ['string', 'null'], ...(description ? { description } : {}) });
const num = (description?: string): Esquema => ({ type: 'number', ...(description ? { description } : {}) });
const numNull = (description?: string): Esquema => ({ type: ['number', 'null'], ...(description ? { description } : {}) });
const intNull = (description?: string): Esquema => ({ type: ['integer', 'null'], ...(description ? { description } : {}) });
const ent = (description?: string): Esquema => ({ type: 'integer', ...(description ? { description } : {}) });
const bool = (): Esquema => ({ type: 'boolean' });
const enumStr = (valores: readonly string[], description?: string): Esquema =>
  ({ type: 'string', enum: [...valores], ...(description ? { description } : {}) });
const enumStrNull = (valores: readonly string[], description?: string): Esquema =>
  ({ type: ['string', 'null'], enum: [...valores, null], ...(description ? { description } : {}) });
const arr = (items: Esquema, description?: string): Esquema =>
  ({ type: 'array', items, ...(description ? { description } : {}) });

/** Construye un objeto estricto: todas las claves quedan en `required`. */
const obj = (properties: Record<string, Esquema>, description?: string): Esquema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
  ...(description ? { description } : {}),
});

/* -------------------------------------------------------------------------- */
/*  Vocabulario compartido                                                     */
/* -------------------------------------------------------------------------- */

const PRIORIDAD = ['baja', 'media', 'alta', 'critica'] as const;
const TRIPLE = ['bajo', 'medio', 'alto'] as const;
const ENTIDAD = ['proyecto', 'tarea', 'asunto', 'persona'] as const;
const TIPO_RECO = ['accion', 'alerta', 'riesgo', 'mejora', 'asignacion', 'pregunta'] as const;

const RECOMENDACION = obj({
  titulo: str('Imperativo y concreto. Máx. 90 caracteres.'),
  descripcion: str('Qué hacer exactamente. 1–3 frases.'),
  justificacion: str(
    'Qué dato específico del payload la sustenta. Cita cifras o IDs reales. ' +
    'Si no puedes citar un dato concreto, no emitas la recomendación.',
  ),
  tipo: enumStr(TIPO_RECO),
  prioridad: enumStr(PRIORIDAD),
  impacto_estimado: enumStr(TRIPLE),
  esfuerzo_estimado: enumStr(TRIPLE),
  entidad_tipo: enumStrNull(ENTIDAD, 'A qué registro aplica; null si es general.'),
  entidad_id: intNull('ID real tomado del payload. Nunca lo inventes.'),
  persona_sugerida_id: intNull('persona_id del payload, o null.'),
  plazo_sugerido_dias: intNull(),
});

/* -------------------------------------------------------------------------- */
/*  1 · salud_proyecto                                                         */
/* -------------------------------------------------------------------------- */

export const ESQUEMA_SALUD_PROYECTO = obj({
  puntaje_salud: ent('Entero de 0 a 100. 100 = proyecto sano.'),
  semaforo: enumStr(['verde', 'amarillo', 'rojo']),
  resumen_ejecutivo: str('2 o 3 frases. Lo que dirías en un pasillo, sin rodeos.'),

  diagnostico: arr(obj({
    area: enumStr(['alcance', 'tiempo', 'equipo', 'calidad', 'comunicacion', 'dependencias']),
    hallazgo: str(),
    evidencia: arr(str(), 'Datos concretos del payload que respaldan el hallazgo.'),
    severidad: enumStr(TRIPLE),
  })),

  riesgos: arr(obj({
    titulo: str(),
    descripcion: str(),
    probabilidad: enumStr(TRIPLE),
    impacto: enumStr(TRIPLE),
    'señales_tempranas': arr(str(), 'Qué observar para saber si el riesgo se materializa.'),
    mitigacion: str(),
  })),

  cuellos_botella: arr(obj({
    entidad_tipo: enumStr(ENTIDAD),
    entidad_id: ent('ID real del payload.'),
    titulo: str(),
    dias_detenido: intNull(),
    por_que_bloquea: str('A qué o a quién está frenando.'),
    desbloqueo_sugerido: str(),
  })),

  recomendaciones: arr(RECOMENDACION, 'Entre 3 y 7, ordenadas de más a menos importante.'),

  plan_mejora: obj({
    horizonte_dias: ent('Ventana del plan, típicamente 14 o 30.'),
    pasos: arr(obj({
      orden: ent(),
      accion: str(),
      responsable_sugerido_id: intNull(),
      resultado_esperado: str('Cómo se sabrá que el paso funcionó.'),
      dias_estimados: intNull(),
    })),
  }),

  preguntas_para_el_equipo: arr(obj({
    persona_id: intNull(),
    pregunta: str(),
    motivo: str('Qué información falta y por qué esa persona la tiene.'),
  })),

  confianza: num('0.0 a 1.0. Baja si el payload trae pocos datos.'),
  datos_faltantes: arr(str(), 'Qué habría hecho mejor el análisis. Vacío si no falta nada.'),
});

/* -------------------------------------------------------------------------- */
/*  2 · match_persona_tarea                                                    */
/* -------------------------------------------------------------------------- */

export const ESQUEMA_MATCH_PERSONA = obj({
  candidatos: arr(obj({
    persona_id: ent('Debe existir en payload.candidatos.'),
    puntaje_ajuste: ent('0 a 100. Combina experticia, disponibilidad e historial.'),
    fortalezas_aplicables: arr(str()),
    brechas: arr(str(), 'Qué le falta para esta tarea en concreto.'),
    riesgo_sobrecarga: enumStr(TRIPLE),
    justificacion: str(),
  })),
  recomendado_persona_id: intNull('El mejor candidato, o null si ninguno encaja.'),
  justificacion_final: str(),
  brechas_de_equipo: arr(obj({
    habilidad: str(),
    nivel_requerido: ent('1 a 5.'),
    situacion: str('Quién la cubre hoy y con qué limitaciones.'),
    sugerencia: enumStr(['capacitar', 'contratar', 'subcontratar', 'redistribuir', 'aceptar_riesgo']),
  })),
  confianza: num('0.0 a 1.0'),
});

/* -------------------------------------------------------------------------- */
/*  3 · patrones_globales                                                      */
/* -------------------------------------------------------------------------- */

export const ESQUEMA_PATRONES = obj({
  patrones: arr(obj({
    clave: str(
      'Identificador estable en snake_case, ej. "bloqueo_credenciales_cliente". ' +
      'Si el patrón ya viene en payload.patrones_conocidos, reutiliza su clave exacta ' +
      'para que el sistema acumule frecuencia en vez de duplicar.',
    ),
    nombre: str(),
    tipo: enumStr(['riesgo_recurrente', 'antipatron', 'buena_practica', 'correlacion_exito', 'brecha_skill']),
    ambito: enumStr(['categoria', 'empresa', 'persona', 'global']),
    descripcion: str(),
    evidencia: obj({
      proyecto_ids: arr(ent()),
      asunto_ids: arr(ent()),
      nota: str('Cómo se observa el patrón en esos registros.'),
    }),
    frecuencia_observada: ent('En cuántos casos distintos aparece.'),
    confianza: num('0.0 a 1.0. Con menos de 3 casos, no pases de 0.5.'),
    recomendacion: str(),
  })),
  alertas_portafolio: arr(obj({
    titulo: str(),
    descripcion: str(),
    prioridad: enumStr(PRIORIDAD),
    proyectos_afectados: arr(ent()),
  })),
  resumen_ejecutivo: str('Qué está pasando a nivel portafolio, en 3–4 frases.'),
});

/* -------------------------------------------------------------------------- */
/*  4 · priorizacion_diaria                                                    */
/* -------------------------------------------------------------------------- */

export const ESQUEMA_PRIORIZACION = obj({
  foco_del_dia: str('Una sola frase: si hoy solo se logra una cosa, ¿cuál debe ser?'),
  top_acciones: arr(obj({
    orden: ent('1 = primero.'),
    proyecto_id: ent(),
    entidad_tipo: enumStr(ENTIDAD),
    entidad_id: ent(),
    accion: str(),
    por_que_ahora: str('Qué se destraba o qué se evita al hacerlo hoy.'),
    minutos_estimados: intNull(),
  }), 'Máximo 7. Que quepan en la capacidad declarada en el payload.'),
  no_hacer_hoy: arr(obj({
    entidad_tipo: enumStr(ENTIDAD),
    entidad_id: ent(),
    motivo: str('Por qué conviene posponerlo pese a parecer urgente.'),
  })),
  alertas: arr(obj({
    titulo: str(),
    descripcion: str(),
    prioridad: enumStr(PRIORIDAD),
  })),
});

/* -------------------------------------------------------------------------- */
/*  5 · perfil_cv                                                              */
/* -------------------------------------------------------------------------- */

export const ESQUEMA_PERFIL_CV = obj({
  perfil: obj({
    nombre_completo: strNull(),
    email: strNull(),
    telefono: strNull(),
    rol_principal: strNull(),
    seniority: enumStrNull(['junior', 'semi_senior', 'senior', 'lead', 'director']),
    anios_experiencia: numNull(),
    ubicacion: strNull(),
    resumen: str('3–4 frases. Qué hace esta persona y dónde es fuerte.'),
  }),

  habilidades: arr(obj({
    slug_existente: strNull(
      'Si la habilidad coincide con una de payload.catalogo_habilidades, pon su slug exacto. ' +
      'Si no existe en el catálogo, null y se creará nueva.',
    ),
    nombre: str(),
    tipo: enumStr(['tecnica', 'herramienta', 'dominio', 'blanda', 'idioma', 'metodologia']),
    nivel: ent('1 = básico, 5 = experto. Infiérelo de años, cargos y logros.'),
    anios_experiencia: numNull(),
    es_fortaleza: bool(),
    evidencia: strNull('Frase textual del CV que la respalda.'),
    confianza: num('0.0 a 1.0'),
  })),

  sectores: arr(obj({
    slug_existente: strNull(
      'Slug exacto de payload.catalogo_sectores si el sector coincide con uno del ' +
      'catálogo. null solo si ninguno aplica de verdad.',
    ),
    nombre: str(),
    nivel: ent('1 = roce puntual, 5 = especialista del sector. Sé conservador.'),
    anios_experiencia: numNull(),
    es_principal: bool(),
    evidencia: strNull('Frase textual del insumo que lo respalda.'),
    confianza: num('0.0 a 1.0'),
  }), 'Industrias donde ha trabajado de verdad. Máximo 5. Haber tenido un cliente ' +
      'de un sector no convierte a nadie en especialista de ese sector.'),

  experiencias: arr(obj({
    empresa: str(),
    cargo: str(),
    industria: strNull(),
    fecha_inicio: strNull('AAAA-MM-DD. Usa el día 01 si solo hay mes y año.'),
    fecha_fin: strNull('AAAA-MM-DD, o null si sigue ahí.'),
    es_actual: bool(),
    logros: arr(str()),
  })),

  fortalezas: arr(obj({
    titulo: str(),
    detalle: str(),
    contexto: strNull('En qué tipo de proyecto o fase rinde mejor.'),
    confianza: num(),
  })),

  aportes: arr(obj({
    titulo: str('Qué le puede aportar a la organización.'),
    detalle: str(),
    contexto: strNull(),
    confianza: num(),
  }), 'Enfócate en lo que la organización puede aprovechar, no en elogios genéricos.'),

  preguntas_sugeridas: arr(obj({
    pregunta: str('Pregunta concreta que le haríamos para extraer su conocimiento.'),
    motivo: str('Qué sabe esta persona que nos conviene documentar o aprender.'),
    tema: str(),
  }), 'Entre 3 y 6.'),

  areas_mejora: arr(obj({
    titulo: str(),
    detalle: str('Redáctalo como oportunidad de desarrollo, no como defecto.'),
  })),

  encaje_con_necesidades: arr(obj({
    habilidad: str('De payload.necesidades_actuales.'),
    cubre: bool(),
    nivel_estimado: intNull('1 a 5, o null si no la tiene.'),
  })),

  confianza_global: num('0.0 a 1.0'),
  datos_faltantes: arr(str(), 'Qué no se pudo extraer del documento.'),
});

/* -------------------------------------------------------------------------- */
/*  6 · planteamiento_proyecto                                                 */
/* -------------------------------------------------------------------------- */

const TIPO_TAREA = [
  'feature', 'mejora', 'correccion', 'investigacion', 'documentacion', 'reunion', 'administrativa',
] as const;

export const ESQUEMA_PLANTEAMIENTO = obj({
  planteamiento: str('Problema, solución y alcance del proyecto. 1–2 párrafos.'),
  de_que_trata: str('2–3 frases que cualquiera entiende, sin jerga.'),
  objetivo_sugerido: str('Qué se considera éxito, medible. 1–2 frases.'),
  supuestos: arr(str(), 'Supuestos tomados donde la descripción no aclara.'),

  hitos_propuestos: arr(obj({
    ref: ent('Identificador LOCAL 1..n, solo para que las tareas lo referencien. No es un id de la base de datos.'),
    nombre: str(),
    descripcion: str('Qué se logra en esta fase.'),
    orden: ent('1 = primero.'),
    duracion_dias_estimada: intNull('Días estimados de la fase, o null.'),
    entregable: str('Resultado verificable con el que se da por cerrado el hito.'),
  }), 'Entre 3 y 6 fases con entregable verificable.'),

  tareas_propuestas: arr(obj({
    hito_ref: intNull('ref del hito propuesto al que pertenece, o null si es transversal.'),
    titulo: str('Imperativo y concreto. Máx. 90 caracteres.'),
    descripcion: str('Qué hacer exactamente. 1–3 frases.'),
    tipo: enumStr(TIPO_TAREA),
    prioridad: enumStr(PRIORIDAD),
    estimacion_horas: numNull(),
    orden: ent('Orden dentro del hito. 1 = primero.'),
  }), 'Primer desglose accionable de cada hito.'),

  preguntas_por_resolver: arr(str(), 'Lo que la descripción no aclara y condiciona el plan.'),
  confianza: num('0.0 a 1.0. Baja si la descripción es vaga.'),
});

/* -------------------------------------------------------------------------- */
/*  7 · tareas_sugeridas                                                       */
/* -------------------------------------------------------------------------- */

export const ESQUEMA_TAREAS_SUGERIDAS = obj({
  resumen_contexto: str('En qué punto está el proyecto y qué le falta. 2–3 frases.'),
  tareas: arr(obj({
    titulo: str('Imperativo y concreto. Máx. 90 caracteres.'),
    descripcion: str('Qué hacer exactamente. 1–3 frases.'),
    justificacion: str('Qué dato del payload la motiva. Cita cifras o IDs reales.'),
    tipo: enumStr(TIPO_TAREA),
    prioridad: enumStr(PRIORIDAD),
    hito_id: intNull('ID REAL de proyecto.hitos, o null.'),
    responsable_sugerido_id: intNull('persona_id del equipo del payload, o null.'),
    estimacion_horas: numNull(),
  }), 'Máximo 10, ordenadas de más a menos urgente. Sin duplicar tareas existentes.'),
  confianza: num('0.0 a 1.0'),
  datos_faltantes: arr(str(), 'Qué habría hecho mejor la sugerencia. Vacío si no falta nada.'),
});

/* -------------------------------------------------------------------------- */
/*  8 · preguntas_encuadre                                                     */
/* -------------------------------------------------------------------------- */

const TEMA_PREGUNTA = [
  'alcance', 'objetivo', 'usuarios', 'restricciones', 'plazos', 'presupuesto',
  'equipo', 'riesgos', 'calidad', 'normativa', 'datos', 'integraciones',
] as const;

export const ESQUEMA_PREGUNTAS_ENCUADRE = obj({
  lectura_inicial: str(
    'Qué se entiende hoy del proyecto y qué falta para poder planificarlo. 2–3 frases.',
  ),
  preguntas: arr(obj({
    pregunta: str('Una sola pregunta, concreta y respondible en 1–3 frases.'),
    motivo: str('Qué decisión del plan cambia según la respuesta.'),
    tema: enumStr(TEMA_PREGUNTA),
    importancia: enumStr(PRIORIDAD),
    ejemplo_respuesta: strNull('Ejemplo breve de una respuesta útil, o null.'),
  }), 'Entre 4 y 8, ordenadas de más a menos determinante. Nada que ya esté respondido.'),
  supuestos_provisionales: arr(str(), 'Lo que se asumirá si la pregunta queda sin responder.'),
  confianza: num('0.0 a 1.0'),
});

/* -------------------------------------------------------------------------- */
/*  9 · perfiles_requeridos                                                    */
/* -------------------------------------------------------------------------- */

const SENIORITY = ['junior', 'semi_senior', 'senior', 'lead', 'director'] as const;
const CRITICIDAD = ['deseable', 'importante', 'indispensable'] as const;
const TIPO_HABILIDAD = ['tecnica', 'herramienta', 'dominio', 'blanda', 'idioma', 'metodologia'] as const;

export const ESQUEMA_PERFILES_REQUERIDOS = obj({
  resumen_necesidad: str('Qué tipo de equipo pide este proyecto. 2–3 frases.'),
  perfiles: arr(obj({
    rol: str('Nombre del rol tal como se publicaría. Máx. 80 caracteres.'),
    proposito: str('Qué resuelve esta persona en el proyecto. 1–2 frases.'),
    seniority: enumStr(SENIORITY),
    sector_slug: strNull(
      'Slug de payload.catalogo_sectores si el rol exige experiencia sectorial; ' +
      'null si el sector es indiferente.',
    ),
    cantidad: ent('Cuántas personas con este perfil hacen falta.'),
    dedicacion_pct: intNull('% de una jornada completa, o null.'),
    criticidad: enumStr(CRITICIDAD),
    fases: arr(str(), 'Nombres de hitos del payload en los que participa. Vacío si es transversal.'),
    habilidades: arr(obj({
      slug_existente: strNull('Slug exacto de payload.catalogo_habilidades, o null si hay que crearla.'),
      nombre: str(),
      tipo: enumStr(TIPO_HABILIDAD),
      nivel_minimo: ent('1 = básico … 5 = experto.'),
      criticidad: enumStr(CRITICIDAD),
    })),
    candidatos: arr(obj({
      persona_id: ent('ID REAL de payload.personas_disponibles. Nunca lo inventes.'),
      puntaje_ajuste: ent('0 a 100.'),
      por_que: str('Qué habilidad o sector concreto del payload lo respalda.'),
      brechas: arr(str()),
      riesgo_sobrecarga: enumStr(TRIPLE),
    }), 'Solo personas del payload. Vacío si ninguna encaja: no rellenes.'),
  }), 'Entre 1 y 6 perfiles, ordenados por criticidad.'),
  brechas_del_directorio: arr(obj({
    habilidad: str(),
    nivel_requerido: ent('1 a 5.'),
    situacion: str('Quién se acerca hoy y qué le falta.'),
    sugerencia: enumStr(['capacitar', 'contratar', 'subcontratar', 'redistribuir', 'aceptar_riesgo']),
  })),
  confianza: num('0.0 a 1.0'),
  datos_faltantes: arr(str()),
});

/* -------------------------------------------------------------------------- */
/*  Registro y helper de response_format                                       */
/* -------------------------------------------------------------------------- */

export const ESQUEMAS = {
  salud_proyecto:         { nombre: 'analisis_salud_proyecto',   esquema: ESQUEMA_SALUD_PROYECTO },
  cuellos_botella:        { nombre: 'analisis_cuellos_botella',  esquema: ESQUEMA_SALUD_PROYECTO },
  match_persona_tarea:    { nombre: 'match_persona_tarea',       esquema: ESQUEMA_MATCH_PERSONA },
  patrones_globales:      { nombre: 'patrones_globales',         esquema: ESQUEMA_PATRONES },
  priorizacion_diaria:    { nombre: 'priorizacion_diaria',       esquema: ESQUEMA_PRIORIZACION },
  perfil_cv:              { nombre: 'perfil_cv',                 esquema: ESQUEMA_PERFIL_CV },
  planteamiento_proyecto: { nombre: 'planteamiento_proyecto',    esquema: ESQUEMA_PLANTEAMIENTO },
  tareas_sugeridas:       { nombre: 'tareas_sugeridas',          esquema: ESQUEMA_TAREAS_SUGERIDAS },
  preguntas_encuadre:     { nombre: 'preguntas_encuadre',        esquema: ESQUEMA_PREGUNTAS_ENCUADRE },
  perfiles_requeridos:    { nombre: 'perfiles_requeridos',       esquema: ESQUEMA_PERFILES_REQUERIDOS },
} as const;

export type ClaveEsquema = keyof typeof ESQUEMAS;

export function formatoRespuesta(clave: ClaveEsquema) {
  const { nombre, esquema } = ESQUEMAS[clave];
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: nombre,
      strict: true,
      schema: esquema,
    },
  };
}
