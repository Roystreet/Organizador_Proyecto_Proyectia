/**
 * Validación de lo que devuelve el modelo.
 *
 * Structured Outputs ya garantiza la forma, pero no garantiza los rangos:
 * un puntaje de 140 o una confianza de 3 pasan el esquema JSON y rompen la UI.
 * Zod es la segunda barrera, y además es lo que valida la salida del modo
 * simulado, que no pasa por OpenAI.
 */
import { z } from 'zod';

const PRIORIDAD = z.enum(['baja', 'media', 'alta', 'critica']);
const TRIPLE = z.enum(['bajo', 'medio', 'alto']);
const ENTIDAD = z.enum(['proyecto', 'tarea', 'asunto', 'persona']);

export const zRecomendacion = z.object({
  titulo: z.string().min(3).max(255),
  descripcion: z.string(),
  justificacion: z.string(),
  tipo: z.enum(['accion', 'alerta', 'riesgo', 'mejora', 'asignacion', 'pregunta']),
  prioridad: PRIORIDAD,
  impacto_estimado: TRIPLE,
  esfuerzo_estimado: TRIPLE,
  entidad_tipo: ENTIDAD.nullable(),
  entidad_id: z.number().int().positive().nullable(),
  persona_sugerida_id: z.number().int().positive().nullable(),
  plazo_sugerido_dias: z.number().int().nullable(),
});

export const zRespuestaSaludProyecto = z.object({
  puntaje_salud: z.number().int().min(0).max(100),
  semaforo: z.enum(['verde', 'amarillo', 'rojo']),
  resumen_ejecutivo: z.string().min(10),
  diagnostico: z.array(z.object({
    area: z.enum(['alcance', 'tiempo', 'equipo', 'calidad', 'comunicacion', 'dependencias']),
    hallazgo: z.string(),
    evidencia: z.array(z.string()),
    severidad: TRIPLE,
  })),
  riesgos: z.array(z.object({
    titulo: z.string(),
    descripcion: z.string(),
    probabilidad: TRIPLE,
    impacto: TRIPLE,
    'señales_tempranas': z.array(z.string()),
    mitigacion: z.string(),
  })),
  cuellos_botella: z.array(z.object({
    entidad_tipo: ENTIDAD,
    entidad_id: z.number().int(),
    titulo: z.string(),
    dias_detenido: z.number().int().nullable(),
    por_que_bloquea: z.string(),
    desbloqueo_sugerido: z.string(),
  })),
  recomendaciones: z.array(zRecomendacion),
  plan_mejora: z.object({
    horizonte_dias: z.number().int().positive(),
    pasos: z.array(z.object({
      orden: z.number().int(),
      accion: z.string(),
      responsable_sugerido_id: z.number().int().positive().nullable(),
      resultado_esperado: z.string(),
      dias_estimados: z.number().int().nullable(),
    })),
  }),
  preguntas_para_el_equipo: z.array(z.object({
    persona_id: z.number().int().positive().nullable(),
    pregunta: z.string(),
    motivo: z.string(),
  })),
  confianza: z.number().min(0).max(1),
  datos_faltantes: z.array(z.string()),
});

export type RespuestaSaludValidada = z.infer<typeof zRespuestaSaludProyecto>;

/**
 * Los ids que devuelve el modelo tienen que existir en el payload. Si inventa
 * uno, se anula en vez de guardar una referencia rota que rompería el enlace
 * en la interfaz.
 */
export function sanearReferencias(
  r: RespuestaSaludValidada,
  idsValidos: { tareas: Set<number>; asuntos: Set<number>; personas: Set<number>; proyecto: number },
): { datos: RespuestaSaludValidada; descartadas: number } {
  let descartadas = 0;

  const existe = (tipo: string | null, id: number | null) => {
    if (!tipo || id === null) return false;
    if (tipo === 'proyecto') return id === idsValidos.proyecto;
    if (tipo === 'tarea') return idsValidos.tareas.has(id);
    if (tipo === 'asunto') return idsValidos.asuntos.has(id);
    if (tipo === 'persona') return idsValidos.personas.has(id);
    return false;
  };

  const recomendaciones = r.recomendaciones.map((x) => {
    const ok = existe(x.entidad_tipo, x.entidad_id);
    if (x.entidad_id !== null && !ok) descartadas++;
    return {
      ...x,
      entidad_tipo: ok ? x.entidad_tipo : null,
      entidad_id: ok ? x.entidad_id : null,
      persona_sugerida_id:
        x.persona_sugerida_id && idsValidos.personas.has(x.persona_sugerida_id)
          ? x.persona_sugerida_id
          : null,
    };
  });

  const cuellos = r.cuellos_botella.filter((c) => {
    const ok = existe(c.entidad_tipo, c.entidad_id);
    if (!ok) descartadas++;
    return ok;
  });

  return { datos: { ...r, recomendaciones, cuellos_botella: cuellos }, descartadas };
}

/* -------------------------------------------------------------------------- */
/*  planteamiento_proyecto                                                     */
/* -------------------------------------------------------------------------- */

const TIPO_TAREA = z.enum([
  'feature', 'mejora', 'correccion', 'investigacion', 'documentacion', 'reunion', 'administrativa',
]);

export const zRespuestaPlanteamiento = z.object({
  planteamiento: z.string().min(20),
  de_que_trata: z.string().min(10),
  objetivo_sugerido: z.string().min(10),
  supuestos: z.array(z.string()),
  hitos_propuestos: z.array(z.object({
    ref: z.number().int().positive(),
    nombre: z.string().min(3).max(200),
    descripcion: z.string(),
    orden: z.number().int(),
    duracion_dias_estimada: z.number().int().positive().nullable(),
    entregable: z.string(),
  })),
  tareas_propuestas: z.array(z.object({
    hito_ref: z.number().int().positive().nullable(),
    titulo: z.string().min(3).max(255),
    descripcion: z.string(),
    tipo: TIPO_TAREA,
    prioridad: PRIORIDAD,
    estimacion_horas: z.number().positive().nullable(),
    orden: z.number().int(),
  })),
  preguntas_por_resolver: z.array(z.string()),
  confianza: z.number().min(0).max(1),
}).superRefine((r, ctx) => {
  // Los refs son locales, pero aun así deben ser coherentes entre sí.
  const refs = new Set(r.hitos_propuestos.map((h) => h.ref));
  if (refs.size !== r.hitos_propuestos.length) {
    ctx.addIssue({ code: 'custom', message: 'Hay refs de hito duplicados en hitos_propuestos.' });
  }
  r.tareas_propuestas.forEach((t, i) => {
    if (t.hito_ref !== null && !refs.has(t.hito_ref)) {
      ctx.addIssue({
        code: 'custom',
        path: ['tareas_propuestas', i, 'hito_ref'],
        message: `hito_ref ${t.hito_ref} no existe en hitos_propuestos.`,
      });
    }
  });
});

export type RespuestaPlanteamientoValidada = z.infer<typeof zRespuestaPlanteamiento>;

/* -------------------------------------------------------------------------- */
/*  tareas_sugeridas                                                          */
/* -------------------------------------------------------------------------- */

export const zRespuestaTareasSugeridas = z.object({
  resumen_contexto: z.string().min(10),
  tareas: z.array(z.object({
    titulo: z.string().min(3).max(255),
    descripcion: z.string(),
    justificacion: z.string(),
    tipo: TIPO_TAREA,
    prioridad: PRIORIDAD,
    hito_id: z.number().int().positive().nullable(),
    responsable_sugerido_id: z.number().int().positive().nullable(),
    estimacion_horas: z.number().positive().nullable(),
  })).max(15),
  confianza: z.number().min(0).max(1),
  datos_faltantes: z.array(z.string()),
});

export type RespuestaTareasSugeridasValidada = z.infer<typeof zRespuestaTareasSugeridas>;

/**
 * Mismo principio que sanearReferencias: un hito o persona inventados se
 * anulan en vez de guardar una referencia rota. La tarea sobrevive con null.
 */
export function sanearTareasSugeridas(
  r: RespuestaTareasSugeridasValidada,
  idsValidos: { hitos: Set<number>; personas: Set<number> },
): { datos: RespuestaTareasSugeridasValidada; descartadas: number } {
  let descartadas = 0;
  const tareas = r.tareas.map((t) => {
    const hitoOk = t.hito_id === null || idsValidos.hitos.has(t.hito_id);
    const personaOk = t.responsable_sugerido_id === null
      || idsValidos.personas.has(t.responsable_sugerido_id);
    if (!hitoOk) descartadas++;
    if (!personaOk) descartadas++;
    return {
      ...t,
      hito_id: hitoOk ? t.hito_id : null,
      responsable_sugerido_id: personaOk ? t.responsable_sugerido_id : null,
    };
  });
  return { datos: { ...r, tareas }, descartadas };
}
