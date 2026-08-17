import 'server-only';
import type {
  PayloadSaludProyecto, PayloadPlanteamientoProyecto, PayloadTareasSugeridas,
  PayloadPerfilCv, PayloadPreguntasEncuadre, PayloadPerfilesRequeridos,
} from './tipos';
import type {
  RespuestaSaludValidada, RespuestaPlanteamientoValidada, RespuestaTareasSugeridasValidada,
  RespuestaPerfilCvValidada, RespuestaPreguntasEncuadreValidada,
  RespuestaPerfilesRequeridosValidada,
} from './validacion';

/**
 * Analista determinista de respaldo (IA_MODO=simulado).
 *
 * Aplica las mismas reglas que el prompt le pide al modelo, pero por código.
 * Sirve para tres cosas: desarrollar sin gastar tokens, tener un piso de
 * calidad cuando la API falla, y poder comparar lo que aporta el modelo real
 * frente a lo que ya se puede deducir con reglas. Todo lo que este archivo
 * resuelve solo, no hace falta pagárselo a un LLM.
 */
export function simularSaludProyecto(p: PayloadSaludProyecto): RespuestaSaludValidada {
  const pr = p.proyecto;
  const m = pr.metricas;
  const nombre = (id: number | null) =>
    pr.equipo.find((e) => e.persona_id === id)?.nombre ?? 'sin responsable';
  /** Los motivos suelen venir con punto final; concatenarlos duplicaría el punto. */
  const sinPuntoFinal = (t: string) => t.replace(/\s*\.\s*$/, '');

  const diagnostico: RespuestaSaludValidada['diagnostico'] = [];
  const riesgos: RespuestaSaludValidada['riesgos'] = [];
  const cuellos: RespuestaSaludValidada['cuellos_botella'] = [];
  const recomendaciones: RespuestaSaludValidada['recomendaciones'] = [];
  const preguntas: RespuestaSaludValidada['preguntas_para_el_equipo'] = [];
  const faltantes: string[] = [];

  let penalizacion = 0;

  /* ── Desviación entre calendario y avance ─────────────────────────────── */
  const desv = pr.progreso.desviacion_pct;
  if (desv !== null && desv >= 15) {
    penalizacion += Math.min(30, desv);
    diagnostico.push({
      area: 'tiempo',
      hallazgo: `El calendario va ${desv} puntos por delante del avance real.`,
      evidencia: [
        `Tiempo consumido: ${pr.fechas.tiempo_consumido_pct}%`,
        `Tareas completadas: ${pr.progreso.calculado_pct}%`,
        pr.fechas.dias_restantes !== null ? `Quedan ${pr.fechas.dias_restantes} días` : 'Sin fecha de cierre',
      ],
      severidad: desv >= 30 ? 'alto' : 'medio',
    });
  }

  /* ── Cadenas de bloqueo ───────────────────────────────────────────────── */
  const bloqueadas = pr.tareas_criticas.filter((t) => t.estado === 'bloqueada');
  for (const t of bloqueadas) {
    const arrastre = t.bloquea_a.length;
    penalizacion += 8 + arrastre * 4;
    cuellos.push({
      entidad_tipo: 'tarea',
      entidad_id: t.id,
      titulo: t.titulo,
      dias_detenido: t.dias_en_estado_actual,
      por_que_bloquea: arrastre > 0
        ? `Detiene ${arrastre} tarea${arrastre > 1 ? 's' : ''} que dependen de ella.`
        : 'Está detenida y es parte de la ruta comprometida.',
      desbloqueo_sugerido: t.motivo_bloqueo
        ? `Atacar la causa declarada: ${sinPuntoFinal(t.motivo_bloqueo)}`
        : 'Definir con el responsable qué falta exactamente para retomarla.',
    });
    recomendaciones.push({
      titulo: `Escalar el bloqueo de «${t.titulo}»`,
      descripcion: t.motivo_bloqueo
        ? `Lleva ${t.dias_en_estado_actual} días detenida por: ${sinPuntoFinal(t.motivo_bloqueo)}. Fijar una fecha compromiso con la contraparte y un plan alterno si no llega.`
        : `Lleva ${t.dias_en_estado_actual} días detenida sin motivo registrado. Registrar la causa antes de seguir.`,
      justificacion: `Tarea ${t.id} en estado bloqueada hace ${t.dias_en_estado_actual} días; arrastra ${arrastre} tarea(s) dependiente(s). Responsable: ${nombre(t.responsable_id)}.`,
      tipo: 'alerta',
      prioridad: arrastre > 1 || t.prioridad === 'critica' ? 'critica' : 'alta',
      impacto_estimado: arrastre > 0 ? 'alto' : 'medio',
      esfuerzo_estimado: 'bajo',
      entidad_tipo: 'tarea',
      entidad_id: t.id,
      persona_sugerida_id: t.responsable_id,
      plazo_sugerido_dias: 2,
    });
  }

  /* ── Asuntos críticos y recurrencia ───────────────────────────────────── */
  const criticos = pr.asuntos_abiertos.filter((a) => a.severidad === 'critica');
  if (criticos.length > 0) {
    penalizacion += criticos.length * 10;
    diagnostico.push({
      area: 'calidad',
      hallazgo: `Hay ${criticos.length} asunto${criticos.length > 1 ? 's' : ''} crítico${criticos.length > 1 ? 's' : ''} sin resolver.`,
      evidencia: criticos.map((a) => `${a.codigo ?? a.id}: ${a.titulo} (${a.dias_abierto} días abierto)`),
      severidad: 'alto',
    });
  }
  for (const a of criticos.filter((x) => x.es_recurrente)) {
    riesgos.push({
      titulo: `Problema recurrente: ${a.titulo}`,
      descripcion: 'Ya se marcó como recurrente, así que no es un incidente aislado sino un patrón que va a repetirse en el próximo proyecto.',
      probabilidad: 'alto',
      impacto: a.impacto,
      'señales_tempranas': ['Aparece la misma categoría de asunto en un proyecto nuevo', 'La contraparte no responde en la primera semana'],
      mitigacion: a.causa_raiz
        ? `Atacar la causa raíz registrada: ${sinPuntoFinal(a.causa_raiz)}`
        : 'Registrar la causa raíz y convertirla en una tarea de arranque para los próximos proyectos.',
    });
  }

  /* ── Estancamiento ────────────────────────────────────────────────────── */
  if (m.actividad.dias_sin_movimiento > 14) {
    penalizacion += m.actividad.dias_sin_movimiento > 30 ? 20 : 10;
    diagnostico.push({
      area: 'comunicacion',
      hallazgo: `El proyecto lleva ${m.actividad.dias_sin_movimiento} días sin ningún movimiento registrado.`,
      evidencia: [
        `${m.actividad.eventos_ultimos_30d} eventos en los últimos 30 días`,
        `Velocidad: ${m.actividad.velocidad_semanal} tareas/semana (${m.actividad.tendencia_velocidad})`,
      ],
      severidad: m.actividad.dias_sin_movimiento > 30 ? 'alto' : 'medio',
    });
    recomendaciones.push({
      titulo: 'Decidir formalmente si el proyecto sigue o se cierra',
      descripcion: `Sin movimiento en ${m.actividad.dias_sin_movimiento} días, mantenerlo abierto consume atención sin producir nada. O se le asigna a alguien con fecha, o se archiva.`,
      justificacion: `Último movimiento hace ${m.actividad.dias_sin_movimiento} días; ${m.actividad.eventos_ultimos_7d} eventos en la última semana.`,
      tipo: 'accion',
      prioridad: 'alta',
      impacto_estimado: 'medio',
      esfuerzo_estimado: 'bajo',
      entidad_tipo: 'proyecto',
      entidad_id: pr.id,
      persona_sugerida_id: null,
      plazo_sugerido_dias: 3,
    });
  }

  /* ── Concentración de carga ───────────────────────────────────────────── */
  const sobrecargados = pr.equipo
    .filter((e) => e.carga_total_proyectos >= 5 || (e.tareas_vencidas > 0 && e.tareas_abiertas >= 3))
    .sort((a, b) => b.carga_total_proyectos - a.carga_total_proyectos);

  if (sobrecargados.length > 0) {
    const s = sobrecargados[0];
    penalizacion += 8;
    diagnostico.push({
      area: 'equipo',
      hallazgo: `${s.nombre} concentra ${s.carga_total_proyectos} tareas abiertas sumando todos los proyectos.`,
      evidencia: [
        `${s.tareas_abiertas} tareas abiertas en este proyecto`,
        `${s.tareas_vencidas} vencidas`,
        s.horas_comprometidas !== null && s.disponibilidad_horas_semana !== null
          ? `${s.horas_comprometidas} h comprometidas contra ${s.disponibilidad_horas_semana} h/semana disponibles`
          : 'Sin disponibilidad declarada',
      ],
      severidad: 'medio',
    });
    recomendaciones.push({
      titulo: `Redistribuir parte de la carga de ${s.nombre}`,
      descripcion: 'Concentrar el trabajo crítico en una sola persona convierte cualquier ausencia suya en una parada total del proyecto.',
      justificacion: `${s.nombre} tiene ${s.carga_total_proyectos} tareas abiertas en el portafolio y ${s.tareas_vencidas} vencidas aquí.`,
      tipo: 'asignacion',
      prioridad: 'media',
      impacto_estimado: 'alto',
      esfuerzo_estimado: 'medio',
      entidad_tipo: 'persona',
      entidad_id: s.persona_id,
      persona_sugerida_id: s.persona_id,
      plazo_sugerido_dias: 7,
    });
    preguntas.push({
      persona_id: s.persona_id,
      pregunta: '¿Cuál de tus tareas actuales podría tomar otra persona sin que se pierda contexto?',
      motivo: 'Es la que concentra más trabajo del portafolio y hay que saber qué es delegable antes de repartir.',
    });
  }

  /* ── Habilidades no cubiertas ─────────────────────────────────────────── */
  const descubiertas = pr.habilidades_requeridas.filter((h) => !h.cubierta && h.criticidad !== 'deseable');
  if (descubiertas.length > 0) {
    penalizacion += descubiertas.length * 4;
    diagnostico.push({
      area: 'equipo',
      hallazgo: `El equipo no cubre ${descubiertas.length} habilidad(es) que el proyecto declara necesarias.`,
      evidencia: descubiertas.map((h) => `${h.nombre} (nivel ${h.nivel_minimo}, ${h.criticidad})`),
      severidad: descubiertas.some((h) => h.criticidad === 'indispensable') ? 'alto' : 'medio',
    });
  }

  /* ── Tareas vencidas ──────────────────────────────────────────────────── */
  if (m.tareas.vencidas > 0) {
    penalizacion += m.tareas.vencidas * 3;
    const vencidas = pr.tareas_criticas.filter((t) => (t.dias_para_vencer ?? 0) < 0);
    if (vencidas.length > 0) {
      recomendaciones.push({
        titulo: 'Reprogramar o cerrar las tareas ya vencidas',
        descripcion: `Hay ${m.tareas.vencidas} tarea(s) con fecha pasada. Mantener fechas falsas hace que el tablero deje de servir para decidir.`,
        justificacion: vencidas.slice(0, 3).map((t) => `«${t.titulo}» venció hace ${Math.abs(t.dias_para_vencer ?? 0)} días`).join('; '),
        tipo: 'accion',
        prioridad: 'media',
        impacto_estimado: 'medio',
        esfuerzo_estimado: 'bajo',
        entidad_tipo: 'proyecto',
        entidad_id: pr.id,
        persona_sugerida_id: null,
        plazo_sugerido_dias: 2,
      });
    }
  }

  /* ── Riesgo de incumplimiento ─────────────────────────────────────────── */
  if (pr.fechas.dias_restantes !== null && pr.fechas.dias_restantes <= 15 && pr.progreso.calculado_pct < 75) {
    penalizacion += 12;
    riesgos.push({
      titulo: 'La fecha comprometida no parece alcanzable',
      descripcion: `Quedan ${pr.fechas.dias_restantes} días y el avance real es de ${pr.progreso.calculado_pct}%, con ${m.tareas.bloqueadas} tarea(s) bloqueada(s).`,
      probabilidad: pr.fechas.dias_restantes <= 7 ? 'alto' : 'medio',
      impacto: 'alto',
      'señales_tempranas': ['La tarea bloqueada no se destraba esta semana', 'Aparecen tareas nuevas no previstas en el sprint'],
      mitigacion: 'Renegociar alcance o fecha esta semana, mientras todavía es una conversación y no un incumplimiento.',
    });
  }

  /* ── Memoria: patrones ya conocidos ───────────────────────────────────── */
  for (const pat of p.patrones_conocidos.filter((x) => x.frecuencia >= 2)) {
    riesgos.push({
      titulo: `Patrón conocido: ${pat.nombre}`,
      descripcion: `Ya se observó ${pat.frecuencia} veces en el portafolio (confianza ${pat.confianza ?? '—'}).`,
      probabilidad: pat.frecuencia >= 3 ? 'alto' : 'medio',
      impacto: 'medio',
      'señales_tempranas': ['Se repiten las condiciones que lo dispararon las veces anteriores'],
      mitigacion: 'Aplicar la contramedida ya definida para este patrón en lugar de improvisar otra vez.',
    });
  }

  /* ── Datos faltantes ──────────────────────────────────────────────────── */
  if (!pr.objetivo) faltantes.push('El proyecto no tiene objetivo declarado: sin eso "va bien" no significa nada.');
  if (pr.fechas.fin_estimada === null) faltantes.push('No hay fecha de cierre estimada.');
  if (m.tareas.sin_responsable > 0) faltantes.push(`${m.tareas.sin_responsable} tarea(s) sin responsable asignado.`);
  if (pr.tendencia.length < 3) faltantes.push('Hay pocos snapshots históricos: la tendencia todavía no es confiable.');
  if (pr.equipo.every((e) => e.disponibilidad_horas_semana === null))
    faltantes.push('Nadie del equipo tiene disponibilidad semanal declarada, así que la sobrecarga solo se estima por conteo de tareas.');

  /* ── Puntaje y semáforo ───────────────────────────────────────────────── */
  const puntaje = Math.max(0, Math.min(100, 100 - Math.round(penalizacion)));
  const semaforo = puntaje >= 70 ? 'verde' : puntaje >= 45 ? 'amarillo' : 'rojo';

  if (diagnostico.length === 0) {
    diagnostico.push({
      area: 'alcance',
      hallazgo: 'No se detectaron señales de alarma en las métricas actuales.',
      evidencia: [
        `${m.tareas.por_estado.completada}/${m.tareas.total} tareas completadas`,
        `${m.asuntos.abiertos} asuntos abiertos`,
        `${m.actividad.dias_sin_movimiento} días desde el último movimiento`,
      ],
      severidad: 'bajo',
    });
  }

  /* ── Plan de mejora: las recomendaciones ordenadas por prioridad ──────── */
  const orden = { critica: 0, alta: 1, media: 2, baja: 3 } as const;
  const ordenadas = [...recomendaciones].sort((a, b) => orden[a.prioridad] - orden[b.prioridad]);

  const resumen = construirResumen(pr.nombre, semaforo, puntaje, {
    bloqueadas: bloqueadas.length,
    criticos: criticos.length,
    vencidas: m.tareas.vencidas,
    diasSinMovimiento: m.actividad.dias_sin_movimiento,
    diasRestantes: pr.fechas.dias_restantes,
  });

  return {
    puntaje_salud: puntaje,
    semaforo,
    resumen_ejecutivo: resumen,
    diagnostico,
    riesgos,
    cuellos_botella: cuellos,
    recomendaciones: ordenadas,
    plan_mejora: {
      horizonte_dias: 14,
      pasos: ordenadas.slice(0, 5).map((r, i) => ({
        orden: i + 1,
        accion: r.titulo,
        responsable_sugerido_id: r.persona_sugerida_id,
        resultado_esperado: r.descripcion,
        dias_estimados: r.plazo_sugerido_dias,
      })),
    },
    preguntas_para_el_equipo: preguntas,
    // El análisis por reglas es sólido en lo que mide y ciego en el resto.
    confianza: faltantes.length >= 3 ? 0.5 : 0.68,
    datos_faltantes: faltantes,
  };
}

/**
 * Planteamiento por plantilla (IA_MODO=simulado).
 *
 * Cuatro fases estándar con un primer desglose genérico. No lee la descripción
 * con inteligencia — para eso está el modelo de texto — pero deja el flujo
 * completo probable sin API key y sirve de piso comparable.
 */
export function simularPlanteamientoProyecto(p: PayloadPlanteamientoProyecto): RespuestaPlanteamientoValidada {
  const pr = p.proyecto;
  const descripcion = pr.descripcion_libre?.trim() || pr.nombre;
  const preguntas: string[] = [];
  if (!pr.descripcion_libre) preguntas.push('¿De qué trata el proyecto? No hay descripción registrada.');
  if (!pr.objetivo) preguntas.push('¿Qué se considera éxito? No hay objetivo declarado.');
  if (!pr.fechas.fin_estimada) preguntas.push('¿Para cuándo debe estar listo? No hay fecha de cierre estimada.');
  if (pr.equipo.length === 0) preguntas.push('¿Quiénes van a trabajar en esto? No hay equipo asignado.');

  const fases = [
    {
      ref: 1, nombre: 'Descubrimiento y alcance', duracion: 7,
      descripcion: 'Aterrizar qué se va a hacer, para quién y qué queda fuera.',
      entregable: 'Documento de alcance validado con el interesado principal.',
      tareas: [
        { titulo: 'Levantar los requisitos con el interesado principal', tipo: 'investigacion' as const, prioridad: 'alta' as const, horas: 4 },
        { titulo: 'Definir el alcance y lo que queda explícitamente fuera', tipo: 'documentacion' as const, prioridad: 'alta' as const, horas: 3 },
        { titulo: 'Acordar el criterio de éxito y cómo se medirá', tipo: 'reunion' as const, prioridad: 'media' as const, horas: 2 },
      ],
    },
    {
      ref: 2, nombre: 'Diseño de la solución', duracion: 10,
      descripcion: 'Decidir cómo se resuelve antes de construir.',
      entregable: 'Diseño o propuesta aprobada, con las decisiones registradas.',
      tareas: [
        { titulo: 'Diseñar la solución y validarla con quien decide', tipo: 'feature' as const, prioridad: 'alta' as const, horas: 8 },
        { titulo: 'Identificar riesgos y dependencias externas', tipo: 'investigacion' as const, prioridad: 'media' as const, horas: 3 },
        { titulo: 'Desglosar la construcción en tareas estimadas', tipo: 'administrativa' as const, prioridad: 'media' as const, horas: 2 },
      ],
    },
    {
      ref: 3, nombre: 'Construcción', duracion: 21,
      descripcion: 'Ejecutar el trabajo principal del proyecto.',
      entregable: 'Producto o entregable principal terminado y revisado.',
      tareas: [
        { titulo: 'Construir el primer entregable funcional', tipo: 'feature' as const, prioridad: 'alta' as const, horas: 24 },
        { titulo: 'Revisar avances con el interesado a mitad de fase', tipo: 'reunion' as const, prioridad: 'media' as const, horas: 1.5 },
        { titulo: 'Corregir lo encontrado en la revisión intermedia', tipo: 'correccion' as const, prioridad: 'media' as const, horas: 6 },
      ],
    },
    {
      ref: 4, nombre: 'Cierre y entrega', duracion: 7,
      descripcion: 'Entregar, documentar y cerrar formalmente.',
      entregable: 'Entrega aceptada y documentación mínima registrada.',
      tareas: [
        { titulo: 'Preparar la entrega final y validarla con el cliente', tipo: 'feature' as const, prioridad: 'alta' as const, horas: 6 },
        { titulo: 'Documentar lo aprendido y las decisiones tomadas', tipo: 'documentacion' as const, prioridad: 'media' as const, horas: 3 },
        { titulo: 'Cerrar pendientes y archivar el proyecto', tipo: 'administrativa' as const, prioridad: 'baja' as const, horas: 2 },
      ],
    },
  ];

  return {
    planteamiento:
      `${pr.nombre} parte de esta descripción: ${descripcion}. ` +
      'El plan por reglas propone cuatro fases estándar (descubrimiento, diseño, construcción y cierre) ' +
      'como esqueleto inicial; ajusta nombres, alcance y fechas a la realidad del proyecto.',
    de_que_trata: descripcion.length > 240 ? `${descripcion.slice(0, 237)}…` : descripcion,
    objetivo_sugerido: pr.objetivo
      ?? `Completar «${pr.nombre}» con el alcance acordado en descubrimiento, dentro de la fecha estimada.`,
    supuestos: [
      'Plan generado por reglas locales, sin leer la descripción con un modelo de texto.',
      'Se asume un proyecto de tamaño pequeño-mediano con un solo entregable principal.',
    ],
    hitos_propuestos: fases.map((f) => ({
      ref: f.ref,
      nombre: f.nombre,
      descripcion: f.descripcion,
      orden: f.ref,
      duracion_dias_estimada: f.duracion,
      entregable: f.entregable,
    })),
    tareas_propuestas: fases.flatMap((f) =>
      f.tareas.map((t, i) => ({
        hito_ref: f.ref,
        titulo: t.titulo,
        descripcion: `Parte de la fase «${f.nombre}».`,
        tipo: t.tipo,
        prioridad: t.prioridad,
        estimacion_horas: t.horas,
        orden: i + 1,
      })),
    ),
    preguntas_por_resolver: preguntas,
    confianza: pr.descripcion_libre ? 0.45 : 0.3,
  };
}

/**
 * Tareas sugeridas por reglas (IA_MODO=simulado): lo que se puede deducir del
 * estado sin inteligencia — hitos sin desglosar, datos faltantes, bloqueos.
 */
export function simularTareasSugeridas(p: PayloadTareasSugeridas): RespuestaTareasSugeridasValidada {
  const pr = p.proyecto;
  const tareas: RespuestaTareasSugeridasValidada['tareas'] = [];
  const faltantes: string[] = [];

  for (const h of pr.hitos.filter((x) => x.tareas_pendientes === 0 && x.estado !== 'completado')) {
    tareas.push({
      titulo: `Desglosar el hito «${h.nombre}» en tareas`,
      descripcion: 'El hito no tiene tareas pendientes asociadas: o está desglosado en otro lado o nadie lo ha aterrizado.',
      justificacion: `El hito ${h.id} (${h.nombre}) tiene 0 tareas pendientes y estado ${h.estado}.`,
      tipo: 'administrativa',
      prioridad: h.dias_para_objetivo !== null && h.dias_para_objetivo <= 14 ? 'alta' : 'media',
      hito_id: h.id,
      responsable_sugerido_id: null,
      estimacion_horas: 2,
    });
  }

  if (!pr.objetivo) {
    tareas.push({
      titulo: 'Redactar el objetivo del proyecto',
      descripcion: 'Sin objetivo declarado, ni el equipo ni la IA pueden juzgar si el proyecto va bien.',
      justificacion: 'El campo objetivo del proyecto está vacío.',
      tipo: 'documentacion',
      prioridad: 'alta',
      hito_id: null,
      responsable_sugerido_id: null,
      estimacion_horas: 1,
    });
  }

  if (!pr.fechas.fin_estimada) {
    tareas.push({
      titulo: 'Definir la fecha de cierre estimada',
      descripcion: 'Sin fecha comprometida no hay forma de medir desviación ni de priorizar contra otros proyectos.',
      justificacion: 'fecha_fin_estimada es null en el payload.',
      tipo: 'administrativa',
      prioridad: 'media',
      hito_id: null,
      responsable_sugerido_id: null,
      estimacion_horas: 0.5,
    });
  }

  if (pr.metricas_tareas.sin_responsable > 0) {
    tareas.push({
      titulo: 'Asignar responsable a las tareas sin dueño',
      descripcion: 'Una tarea sin responsable no avanza sola; repartirlas es rápido y destraba el tablero.',
      justificacion: `${pr.metricas_tareas.sin_responsable} tarea(s) abiertas sin responsable asignado.`,
      tipo: 'administrativa',
      prioridad: 'media',
      hito_id: null,
      responsable_sugerido_id: null,
      estimacion_horas: 0.5,
    });
  }

  for (const t of pr.tareas_existentes.filter((x) => x.estado === 'bloqueada').slice(0, 3)) {
    tareas.push({
      titulo: `Destrabar «${t.titulo}»`,
      descripcion: t.motivo_bloqueo
        ? `Atacar la causa declarada: ${t.motivo_bloqueo}`
        : 'Registrar la causa del bloqueo y fijar una fecha compromiso para resolverlo.',
      justificacion: `La tarea ${t.id} lleva ${t.dias_en_estado_actual} días bloqueada y arrastra ${t.bloquea_a.length} dependiente(s).`,
      tipo: 'administrativa',
      prioridad: t.bloquea_a.length > 0 ? 'critica' : 'alta',
      hito_id: null,
      responsable_sugerido_id: t.responsable_id,
      estimacion_horas: 1,
    });
  }

  if (pr.equipo.length === 0) {
    tareas.push({
      titulo: 'Asignar equipo al proyecto',
      descripcion: 'No hay personas vinculadas; sin equipo asignado ninguna tarea tiene dueño posible.',
      justificacion: 'El bloque equipo del payload está vacío.',
      tipo: 'administrativa',
      prioridad: 'alta',
      hito_id: null,
      responsable_sugerido_id: null,
      estimacion_horas: 1,
    });
  }

  if (pr.hitos.length === 0) faltantes.push('El proyecto no tiene hitos: las sugerencias no pueden anclarse a fases.');
  if (pr.tareas_existentes.length === 0) faltantes.push('No hay tareas registradas: las reglas solo pueden proponer arranque genérico.');

  const orden = { critica: 0, alta: 1, media: 2, baja: 3 } as const;
  const top = tareas.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]).slice(0, 10);

  return {
    resumen_contexto:
      `${pr.nombre} está en ${pr.estado} con ${pr.metricas_tareas.total} tarea(s) registradas` +
      ` (${pr.metricas_tareas.bloqueadas} bloqueadas, ${pr.metricas_tareas.vencidas} vencidas). ` +
      (top.length > 0
        ? `Las reglas locales detectan ${top.length} tarea(s) que faltan para avanzar.`
        : 'Las reglas locales no detectan huecos evidentes; un modelo de texto podría proponer más.'),
    tareas: top,
    confianza: 0.5,
    datos_faltantes: faltantes,
  };
}

function construirResumen(
  nombre: string,
  semaforo: string,
  puntaje: number,
  d: { bloqueadas: number; criticos: number; vencidas: number; diasSinMovimiento: number; diasRestantes: number | null },
): string {
  const partes: string[] = [];
  if (d.bloqueadas > 0) partes.push(`${d.bloqueadas} tarea(s) bloqueada(s)`);
  if (d.criticos > 0) partes.push(`${d.criticos} asunto(s) crítico(s)`);
  if (d.vencidas > 0) partes.push(`${d.vencidas} tarea(s) vencida(s)`);
  if (d.diasSinMovimiento > 14) partes.push(`${d.diasSinMovimiento} días sin movimiento`);

  const cabeza = `${nombre} está en ${semaforo} con ${puntaje}/100.`;
  const cuerpo = partes.length > 0
    ? ` Lo que pesa: ${partes.join(', ')}.`
    : ' Las métricas no muestran señales de alarma.';
  const cola = d.diasRestantes !== null && d.diasRestantes <= 15
    ? ` Quedan ${d.diasRestantes} días para la fecha comprometida.`
    : '';

  return cabeza + cuerpo + cola;
}

/* -------------------------------------------------------------------------- */
/*  perfil_cv                                                                  */
/* -------------------------------------------------------------------------- */

/** Sin tildes, minúsculas: para buscar el catálogo dentro del texto libre. */
const plano = (t: string) =>
  // NFD + quitar diacríticos conserva la longitud, así que los índices que
  // devuelve una búsqueda sobre el resultado sirven para cortar el original.
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Patrón para buscar un término del catálogo dentro de texto libre.
 *
 * Entre palabras admite cualquier espacio en blanco, no solo uno: en un CV
 * pegado, «Seguridad de procesos químicos» aparece cortado por saltos de línea
 * y con sangría, y una comparación literal no lo encontraría.
 */
function patron(aguja: string): RegExp | null {
  const palabras = plano(aguja).trim().split(/\s+/).filter(Boolean);
  if (palabras.join('').length < 3) return null;   // "IA", "QA": demasiado ruido
  const cuerpo = palabras
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  return new RegExp(`(?<![a-z0-9])${cuerpo}(?![a-z0-9])`, 'g');
}

/** Cuenta apariciones de `aguja` como término, no como subcadena. */
function ocurrencias(heno: string, aguja: string): number {
  const re = patron(aguja);
  return re ? (heno.match(re) ?? []).length : 0;
}

/**
 * Fragmento alrededor de la primera aparición, como evidencia citable.
 *
 * `heno` es `original` en minúsculas y sin tildes: `plano` no cambia la
 * longitud, así que los índices sirven para cortar el texto original tal cual.
 */
function fragmento(original: string, heno: string, aguja: string): string | null {
  const re = patron(aguja);
  if (!re) return null;
  const m = re.exec(heno);
  if (!m) return null;
  const desde = Math.max(0, m.index - 90);
  const hasta = Math.min(original.length, m.index + m[0].length + 90);
  return `${desde > 0 ? '…' : ''}${original.slice(desde, hasta).trim()}${hasta < original.length ? '…' : ''}`;
}

/**
 * Perfilado por reglas (IA_MODO=simulado).
 *
 * No "entiende" el texto: busca en él los nombres del catálogo de habilidades y
 * sectores. Eso basta para probar el flujo entero sin API key y, de paso, mide
 * el piso: todo lo que esto ya detecta no hace falta pagárselo al modelo. Lo
 * que NO puede hacer —separar la experiencia laboral en cargos y fechas— lo
 * declara en `datos_faltantes` en vez de inventarlo.
 */
export function simularPerfilCv(p: PayloadPerfilCv): RespuestaPerfilCvValidada {
  const original = [p.insumo.texto, p.insumo.notas].filter(Boolean).join('\n\n');
  const heno = plano(original);

  const habilidades = p.catalogo_habilidades
    .map((h) => ({ h, n: ocurrencias(heno, h.nombre) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 25)
    .map(({ h, n }) => ({
      slug_existente: h.slug,
      nombre: h.nombre,
      tipo: h.tipo as RespuestaPerfilCvValidada['habilidades'][number]['tipo'],
      nivel: 3,                                  // sin criterio real: el medio
      anios_experiencia: null,
      es_fortaleza: n >= 2,                      // repetido = probablemente central
      evidencia: fragmento(original, heno, h.nombre),
      confianza: 0.4,
    }));

  const sectoresDetectados = p.catalogo_sectores
    .map((s) => ({ s, n: ocurrencias(heno, s.nombre) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);

  const sectores = sectoresDetectados.map(({ s }, i) => ({
    slug_existente: s.slug,
    nombre: s.nombre,
    nivel: 3,
    anios_experiencia: null,
    es_principal: i === 0,                       // el más mencionado
    evidencia: fragmento(original, heno, s.nombre),
    confianza: 0.4,
  }));

  const email = /[\w.+-]+@[\w-]+\.[\w.]+/.exec(original)?.[0] ?? null;
  const telefono = /(?:\+?\d[\d\s().-]{7,}\d)/.exec(original)?.[0]?.trim() ?? null;

  const top = habilidades.slice(0, 3);
  const sectorPrincipal = sectores.find((s) => s.es_principal) ?? null;

  const datosFaltantes = [
    'Las reglas locales no separan la experiencia laboral en cargos y fechas: ' +
    'eso necesita el modelo de texto (IA_MODO=real).',
  ];
  if (habilidades.length === 0) {
    datosFaltantes.push(
      'No se reconoció ninguna habilidad del catálogo en el texto. Puede que el ' +
      'catálogo no cubra este perfil todavía.',
    );
  }
  if (p.insumo.truncado) datosFaltantes.push('El texto se truncó a 25.000 caracteres.');

  return {
    perfil: {
      nombre_completo: p.persona.nombre_completo,
      email,
      telefono,
      rol_principal: p.persona.rol_principal,
      seniority: (p.persona.seniority ?? null) as RespuestaPerfilCvValidada['perfil']['seniority'],
      anios_experiencia: p.persona.anios_experiencia,
      ubicacion: p.persona.ubicacion,
      resumen:
        `${p.persona.nombre_completo}: ${habilidades.length} habilidad(es) del catálogo ` +
        `reconocidas en el texto${sectorPrincipal ? `, con ${sectorPrincipal.nombre} como sector principal` : ''}. ` +
        'Perfil armado por reglas locales sobre el texto aportado, sin modelo de lenguaje.',
    },
    habilidades,
    sectores,
    experiencias: [],
    fortalezas: top.map((h) => ({
      titulo: h.nombre,
      detalle: `Aparece de forma recurrente en el texto aportado.`,
      contexto: sectorPrincipal?.nombre ?? null,
      confianza: 0.35,
    })),
    aportes: sectorPrincipal
      ? [{
          titulo: `Conocimiento del sector ${sectorPrincipal.nombre}`,
          detalle: `El texto lo sitúa en ${sectorPrincipal.nombre}; es el contexto donde su ` +
                   'experiencia rinde sin curva de aprendizaje.',
          contexto: sectorPrincipal.nombre,
          confianza: 0.35,
        }]
      : [],
    preguntas_sugeridas: top.map((h) => ({
      pregunta: `¿En qué trabajo aplicaste ${h.nombre} y qué aprendiste que no esté documentado?`,
      motivo: `Se detectó ${h.nombre} en su perfil y la organización no tiene ese conocimiento escrito.`,
      tema: h.nombre,
    })),
    areas_mejora: [],
    encaje_con_necesidades: p.necesidades_actuales.map((n) => {
      const tiene = habilidades.find((h) => h.slug_existente === n.slug);
      return { habilidad: n.habilidad, cubre: Boolean(tiene), nivel_estimado: tiene ? 3 : null };
    }),
    confianza_global: 0.35,
    datos_faltantes: datosFaltantes,
  };
}

/* -------------------------------------------------------------------------- */
/*  preguntas_encuadre                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Preguntas de encuadre por reglas (IA_MODO=simulado).
 *
 * Un banco fijo filtrado por lo que falta en el proyecto. No "entiende" la
 * descripción, pero sí sabe qué campos vacíos bloquean la planificación, que
 * es de donde salen las preguntas que más importan.
 */
export function simularPreguntasEncuadre(
  p: PayloadPreguntasEncuadre,
): RespuestaPreguntasEncuadreValidada {
  const pr = p.proyecto;
  const preguntas: RespuestaPreguntasEncuadreValidada['preguntas'] = [];

  if (!pr.descripcion_libre || pr.descripcion_libre.trim().length < 60) {
    preguntas.push({
      pregunta: '¿Qué problema concreto resuelve este proyecto, y para quién?',
      motivo: 'Sin el problema y el destinatario no se puede juzgar si el alcance propuesto sobra o falta.',
      tema: 'alcance',
      importancia: 'critica',
      ejemplo_respuesta: 'El área de ventas pierde 2 h diarias consolidando reportes a mano.',
    });
  }
  if (!pr.objetivo) {
    preguntas.push({
      pregunta: '¿Cómo sabremos que salió bien? Da un criterio que se pueda medir.',
      motivo: 'El objetivo es el ancla de todo el análisis posterior: sin él, «va bien» no significa nada.',
      tema: 'objetivo',
      importancia: 'critica',
      ejemplo_respuesta: 'Que el 80 % de los pedidos entren por el sistema en tres meses.',
    });
  }
  if (!pr.fechas.fin_estimada) {
    preguntas.push({
      pregunta: '¿Hay una fecha comprometida con alguien de fuera? ¿Cuál y por qué esa?',
      motivo: 'Una fecha externa cambia por completo el orden de las fases y qué se puede recortar.',
      tema: 'plazos',
      importancia: 'alta',
      ejemplo_respuesta: 'Sí, el 30 de noviembre: arranca la temporada alta.',
    });
  }
  if (pr.sectores.length === 0) {
    preguntas.push({
      pregunta: '¿En qué sector o industria se enmarca este proyecto?',
      motivo: 'El sector condiciona la normativa aplicable y qué perfiles hacen falta.',
      tema: 'normativa',
      importancia: 'alta',
      ejemplo_respuesta: 'Farmacia: hay que cumplir BPM y llevar registro sanitario.',
    });
  }

  // Siempre útiles, independientemente de lo que ya esté lleno.
  preguntas.push(
    {
      pregunta: '¿Qué queda explícitamente FUERA del alcance?',
      motivo: 'Lo que no se escribe como fuera acaba pedido a mitad de camino como si estuviera dentro.',
      tema: 'alcance',
      importancia: 'alta',
      ejemplo_respuesta: 'No incluye migrar el histórico anterior a 2024.',
    },
    {
      pregunta: '¿Qué restricción real condiciona la solución: presupuesto, normativa, tecnología o personal?',
      motivo: 'Define qué soluciones son viables antes de diseñar una que no lo sea.',
      tema: 'restricciones',
      importancia: 'alta',
      ejemplo_respuesta: 'Tiene que correr sobre el ERP actual, no se puede reemplazar.',
    },
    {
      pregunta: '¿De quién dependes para algo que no controlas tú?',
      motivo: 'Las dependencias externas son la causa más común de bloqueo, y se detectan antes o se sufren después.',
      tema: 'riesgos',
      importancia: 'media',
      ejemplo_respuesta: 'Del proveedor del ERP para que habilite el API.',
    },
    {
      pregunta: '¿Qué pasa si esto no se hace?',
      motivo: 'Sitúa la prioridad real del proyecto frente a los demás del portafolio.',
      tema: 'objetivo',
      importancia: 'media',
      ejemplo_respuesta: 'Seguimos con el proceso manual; es sostenible pero no escala.',
    },
  );

  // No repetir lo que ya está respondido o pendiente.
  const yaHechas = new Set(
    [...p.preguntas_ya_respondidas.map((x) => x.pregunta), ...p.preguntas_pendientes]
      .map((x) => x.trim().toLowerCase()),
  );
  const filtradas = preguntas.filter((q) => !yaHechas.has(q.pregunta.trim().toLowerCase()));

  const faltantes: string[] = [];
  if (!pr.descripcion_libre) faltantes.push('Se asumirá el alcance a partir del nombre del proyecto.');
  if (!pr.objetivo) faltantes.push('Sin criterio de éxito, el avance se medirá solo por tareas cerradas.');
  if (!pr.fechas.fin_estimada) faltantes.push('Sin fecha de cierre, las fases se estimarán por duración relativa.');

  return {
    lectura_inicial:
      `${pr.nombre}${pr.categoria ? ` (${pr.categoria})` : ''} está en estado ${pr.estado}. `
      + (pr.descripcion_libre
        ? 'Hay una descripción registrada, pero falta cerrar el encuadre antes de planificar.'
        : 'Todavía no hay descripción: es lo primero que hace falta para poder planificar.')
      + ` Quedan ${filtradas.length} pregunta(s) por resolver.`,
    preguntas: filtradas.slice(0, 8),
    supuestos_provisionales: faltantes,
    confianza: 0.4,
  };
}

/* -------------------------------------------------------------------------- */
/*  perfiles_requeridos                                                        */
/* -------------------------------------------------------------------------- */

/** Roles típicos por categoría, para cuando el proyecto no declara habilidades. */
const ROLES_POR_CATEGORIA: Record<string, string[]> = {
  'Desarrollo Web': ['Líder de proyecto', 'Desarrollador Full-stack', 'Diseñador UI/UX'],
  'Aplicación Móvil': ['Líder de proyecto', 'Desarrollador móvil', 'Diseñador UI/UX'],
  'Datos e IA': ['Líder de proyecto', 'Analista de datos'],
  'Infraestructura': ['Líder de proyecto', 'Especialista en infraestructura'],
  'Integraciones': ['Líder de proyecto', 'Especialista en integraciones'],
  'Consultoría': ['Consultor líder', 'Analista funcional'],
};

const ROLES_GENERICOS = ['Líder de proyecto', 'Especialista del dominio'];

export function simularPerfilesRequeridos(
  p: PayloadPerfilesRequeridos,
): RespuestaPerfilesRequeridosValidada {
  const pr = p.proyecto;
  const sectorPrincipal = pr.sectores[0] ?? null;
  const slugSector = p.catalogo_sectores.find((s) => s.nombre === sectorPrincipal)?.slug ?? null;

  /** Puntaje determinista: sector, habilidades coincidentes y carga. */
  const puntuar = (
    persona: PayloadPerfilesRequeridos['personas_disponibles'][number],
    slugsPedidos: string[],
  ) => {
    let puntaje = 0;
    const brechas: string[] = [];

    if (sectorPrincipal && persona.sectores.includes(sectorPrincipal)) puntaje += 40;
    else if (sectorPrincipal) brechas.push(`Sin experiencia registrada en ${sectorPrincipal}`);

    const suyas = new Set(persona.habilidades.map((h) => h.slug));
    const coincidencias = slugsPedidos.filter((s) => suyas.has(s));
    puntaje += Math.min(40, coincidencias.length * 10);
    for (const s of slugsPedidos.filter((x) => !suyas.has(x))) {
      const nombre = p.catalogo_habilidades.find((h) => h.slug === s)?.nombre ?? s;
      brechas.push(`No tiene registrada: ${nombre}`);
    }

    if (persona.carga.tareas_abiertas <= 3) puntaje += 20;
    else if (persona.carga.tareas_abiertas >= 8) puntaje -= 15;

    const riesgo = persona.carga.tareas_abiertas >= 8
      ? 'alto' : persona.carga.tareas_abiertas >= 4 ? 'medio' : 'bajo';

    return {
      persona_id: persona.persona_id,
      puntaje_ajuste: Math.max(0, Math.min(100, puntaje)),
      por_que: coincidencias.length > 0
        ? `Cubre ${coincidencias.length} de las ${slugsPedidos.length} habilidades pedidas`
          + (sectorPrincipal && persona.sectores.includes(sectorPrincipal)
            ? ` y viene del sector ${sectorPrincipal}.` : '.')
        : sectorPrincipal && persona.sectores.includes(sectorPrincipal)
          ? `Viene del sector ${sectorPrincipal}, aunque no cubre las habilidades pedidas.`
          : 'Coincidencia débil: ni sector ni habilidades registradas encajan.',
      brechas: brechas.slice(0, 5),
      riesgo_sobrecarga: riesgo as 'bajo' | 'medio' | 'alto',
    };
  };

  const declaradas = pr.habilidades_ya_declaradas;
  const perfiles: RespuestaPerfilesRequeridosValidada['perfiles'] = [];

  if (declaradas.length > 0) {
    // Agrupa lo declarado por criticidad: un perfil por grupo.
    const grupos = new Map<string, typeof declaradas>();
    for (const h of declaradas) {
      const g = grupos.get(h.criticidad) ?? [];
      g.push(h);
      grupos.set(h.criticidad, g);
    }
    for (const [criticidad, lista] of grupos) {
      const slugs = lista
        .map((h) => p.catalogo_habilidades.find((c) => c.nombre === h.nombre)?.slug)
        .filter((x): x is string => Boolean(x));
      const habilidades = lista.map((h) => {
        const cat = p.catalogo_habilidades.find((c) => c.nombre === h.nombre);
        return {
          slug_existente: cat?.slug ?? null,
          nombre: h.nombre,
          tipo: (cat?.tipo ?? 'tecnica') as 'tecnica' | 'herramienta' | 'dominio' | 'blanda' | 'idioma' | 'metodologia',
          nivel_minimo: h.nivel_minimo,
          criticidad: criticidad as 'deseable' | 'importante' | 'indispensable',
        };
      });
      perfiles.push({
        rol: `Especialista en ${lista[0].nombre}`,
        proposito: `Cubre las habilidades marcadas como ${criticidad} en este proyecto.`,
        seniority: criticidad === 'indispensable' ? 'senior' : 'semi_senior',
        sector_slug: slugSector,
        cantidad: 1,
        dedicacion_pct: null,
        criticidad: criticidad as 'deseable' | 'importante' | 'indispensable',
        fases: [],
        habilidades,
        candidatos: p.personas_disponibles
          .map((x) => puntuar(x, slugs))
          .filter((c) => c.puntaje_ajuste > 0)
          .sort((a, b) => b.puntaje_ajuste - a.puntaje_ajuste)
          .slice(0, 3),
      });
    }
  } else {
    const roles = ROLES_POR_CATEGORIA[pr.categoria ?? ''] ?? ROLES_GENERICOS;
    roles.forEach((rol, i) => {
      perfiles.push({
        rol,
        proposito: i === 0
          ? 'Coordina el proyecto y responde por la entrega.'
          : `Ejecuta el trabajo principal${sectorPrincipal ? ` en el contexto de ${sectorPrincipal}` : ''}.`,
        seniority: i === 0 ? 'lead' : 'semi_senior',
        sector_slug: i === 0 ? null : slugSector,
        cantidad: 1,
        dedicacion_pct: null,
        criticidad: i === 0 ? 'indispensable' : 'importante',
        fases: [],
        habilidades: [],
        candidatos: p.personas_disponibles
          .map((x) => puntuar(x, []))
          .filter((c) => c.puntaje_ajuste > 0)
          .sort((a, b) => b.puntaje_ajuste - a.puntaje_ajuste)
          .slice(0, 3),
      });
    });
  }

  // Brechas: lo que se pide y nadie cubre al nivel requerido.
  const brechas: RespuestaPerfilesRequeridosValidada['brechas_del_directorio'] = [];
  for (const h of declaradas) {
    const slug = p.catalogo_habilidades.find((c) => c.nombre === h.nombre)?.slug;
    const quien = p.personas_disponibles.filter(
      (x) => slug && x.habilidades.some((y) => y.slug === slug && y.nivel >= h.nivel_minimo),
    );
    if (quien.length === 0) {
      const cerca = p.personas_disponibles.filter(
        (x) => slug && x.habilidades.some((y) => y.slug === slug),
      );
      brechas.push({
        habilidad: h.nombre,
        nivel_requerido: h.nivel_minimo,
        situacion: cerca.length > 0
          ? `${cerca.length} persona(s) la tienen registrada pero por debajo del nivel ${h.nivel_minimo}.`
          : 'Nadie del directorio la tiene registrada.',
        sugerencia: cerca.length > 0 ? 'capacitar' : 'contratar',
      });
    }
  }

  return {
    resumen_necesidad:
      `${pr.nombre} necesita ${perfiles.length} perfil(es)`
      + (sectorPrincipal ? `, con experiencia en ${sectorPrincipal}` : '')
      + `. Hay ${p.personas_disponibles.length} persona(s) en el directorio para cruzar.`,
    perfiles,
    brechas_del_directorio: brechas,
    confianza: 0.4,
    datos_faltantes: [
      'Perfiles derivados por reglas locales a partir de las habilidades declaradas '
      + 'y la categoría; el modelo de texto los ajustaría a la descripción real.',
      ...(declaradas.length === 0
        ? ['El proyecto no declara habilidades requeridas: los roles salen de la categoría.']
        : []),
    ],
  };
}
