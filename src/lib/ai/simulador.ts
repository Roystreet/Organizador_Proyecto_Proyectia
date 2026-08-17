import 'server-only';
import type {
  PayloadSaludProyecto, PayloadPlanteamientoProyecto, PayloadTareasSugeridas,
} from './tipos';
import type {
  RespuestaSaludValidada, RespuestaPlanteamientoValidada, RespuestaTareasSugeridasValidada,
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
