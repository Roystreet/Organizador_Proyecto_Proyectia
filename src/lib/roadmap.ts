/**
 * Cálculo del roadmap: escala temporal, ventanas de fase y reparto de fechas.
 *
 * Puro y sin dependencias: lo importan tanto el componente cliente como el
 * servidor. Aquí no se consulta la base ni se pinta nada.
 *
 * La decisión que sostiene el diseño: las barras NO se posicionan por columna
 * de grilla, sino por fracción (0..1) del ancho total. Así la precisión es de
 * un día independientemente de si el eje se muestra por mes o por trimestre, y
 * cambiar de granularidad solo cambia las etiquetas de cabecera y el ancho en
 * píxeles, no la geometría de las barras.
 */

export const DIA_MS = 86_400_000;

export type Granularidad = 'semana' | 'mes' | 'trimestre';

/** Ancho mínimo en px de cada cubo del eje, por granularidad. */
const ANCHO_CUBO: Record<Granularidad, number> = {
  semana: 26,
  mes: 90,
  trimestre: 140,
};

export interface Cabecera {
  /** Inicio del cubo como fracción 0..1 de la pista. */
  desde: number;
  /** Fin del cubo como fracción 0..1. */
  hasta: number;
  etiqueta: string;
  /** Marca el primer cubo de un año, para poder acentuarlo. */
  inicioDeAnio: boolean;
}

export interface Escala {
  granularidad: Granularidad;
  inicio: number;
  fin: number;
  /** Ancho mínimo total de la pista en px, para el scroll horizontal. */
  anchoMinimo: number;
  /** Posición de un instante como fracción 0..1, recortada al rango. */
  fraccion(t: number): number;
  cabeceras: Cabecera[];
}

/** Convierte 'AAAA-MM-DD' (o Date) a epoch local. null si no hay fecha. */
export function aTiempo(v: string | Date | null | undefined): number | null {
  if (!v) return null;
  if (v instanceof Date) return v.getTime();
  const t = new Date(`${v.slice(0, 10)}T00:00:00`).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Fecha ISO local (no UTC: `toISOString` correría el día según la zona). */
export function aIso(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function sumarDias(t: number, dias: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() + dias);
  return d.getTime();
}

const inicioDeDia = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const inicioDeSemana = (t: number) => {
  const d = new Date(inicioDeDia(t));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // lunes = 0
  return d.getTime();
};

const inicioDeMes = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};

const inicioDeTrimestre = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime();
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/**
 * Sugiere la granularidad según cuánto abarca el proyecto.
 *
 * Un roadmap de tres semanas por trimestres es una sola barra sin información;
 * uno de dos años por semanas son cien columnas de scroll.
 */
export function granularidadSugerida(desde: number, hasta: number): Granularidad {
  const dias = Math.max(1, Math.round((hasta - desde) / DIA_MS));
  // El mes es la unidad natural de un roadmap: un proyecto de mes y medio se
  // lee mejor en tres cubos («ago · sept · oct») que en siete columnas de
  // semana. La semana se reserva para lo que de verdad dura pocas semanas.
  if (dias <= 28) return 'semana';
  if (dias <= 450) return 'mes';
  return 'trimestre';
}

/**
 * Construye la escala.
 *
 * El rango se redondea al cubo completo por ambos extremos para que la
 * cabecera cuadre con las barras, y se garantiza `fin > inicio` (mínimo un
 * cubo): sin eso, `fraccion` dividiría entre cero en un proyecto de un día.
 */
export function crearEscala(g: Granularidad, desde: number, hasta: number): Escala {
  const alInicio = g === 'semana' ? inicioDeSemana : g === 'mes' ? inicioDeMes : inicioDeTrimestre;
  const siguiente = (t: number): number => {
    const d = new Date(t);
    if (g === 'semana') return sumarDias(t, 7);
    d.setMonth(d.getMonth() + (g === 'mes' ? 1 : 3));
    return d.getTime();
  };

  const inicio = alInicio(Math.min(desde, hasta));
  let fin = alInicio(Math.max(desde, hasta));
  fin = siguiente(fin);
  if (fin <= inicio) fin = siguiente(inicio);

  const span = fin - inicio;

  const cabeceras: Cabecera[] = [];
  let cursor = inicio;
  let anioPrevio: number | null = null;
  while (cursor < fin) {
    const sig = Math.min(siguiente(cursor), fin);
    const d = new Date(cursor);
    const anio = d.getFullYear();
    const etiqueta = g === 'trimestre'
      ? `T${Math.floor(d.getMonth() / 3) + 1} ${String(anio).slice(2)}`
      : g === 'mes'
        ? `${MESES[d.getMonth()]} ${String(anio).slice(2)}`
        : `${d.getDate()} ${MESES[d.getMonth()]}`;
    cabeceras.push({
      desde: (cursor - inicio) / span,
      hasta: (sig - inicio) / span,
      etiqueta,
      inicioDeAnio: anioPrevio !== null && anio !== anioPrevio,
    });
    anioPrevio = anio;
    cursor = sig;
  }

  return {
    granularidad: g,
    inicio,
    fin,
    anchoMinimo: Math.max(320, cabeceras.length * ANCHO_CUBO[g]),
    fraccion: (t) => Math.min(1, Math.max(0, (t - inicio) / span)),
    cabeceras,
  };
}

/* -------------------------------------------------------------------------- */
/*  Ventanas de fase                                                           */
/* -------------------------------------------------------------------------- */

export interface HitoParaVentana {
  id: number;
  fecha_inicio: string | Date | null;
  fecha_objetivo: string | Date | null;
  fecha_completado: string | Date | null;
  orden: number;
}

export interface VentanaFase {
  hitoId: number;
  inicio: number;
  fin: number;
  /** true si el inicio no está en la base y se dedujo de la fase anterior. */
  inicioDerivado: boolean;
}

/**
 * Calcula el tramo temporal de cada fase.
 *
 * `hitos` solo garantiza `fecha_objetivo`: el inicio puede no existir. Cuando
 * falta se deriva del final de la fase anterior, o del arranque del proyecto.
 * Lo derivado se marca para que la interfaz pueda distinguirlo — una
 * estimación etiquetada como tal no es una fecha falsa; escribirla en silencio
 * en la base sí lo sería, y por eso esta función no escribe nada.
 *
 * Una fase sin `fecha_objetivo` no produce ventana: no se inventa un final.
 */
export function ventanasDeFases(
  hitos: HitoParaVentana[],
  proyecto: { fecha_inicio: string | Date | null },
): Map<number, VentanaFase> {
  const ordenados = [...hitos].sort((a, b) => {
    if (a.orden !== b.orden) return a.orden - b.orden;
    return (aTiempo(a.fecha_objetivo) ?? 0) - (aTiempo(b.fecha_objetivo) ?? 0);
  });

  const inicioProyecto = aTiempo(proyecto.fecha_inicio);
  const ventanas = new Map<number, VentanaFase>();
  let finAnterior: number | null = null;

  for (const h of ordenados) {
    const fin = aTiempo(h.fecha_completado) ?? aTiempo(h.fecha_objetivo);
    if (fin === null) continue;                    // sin final no hay barra

    const propio = aTiempo(h.fecha_inicio);
    let inicio = propio;
    let derivado = false;

    if (inicio === null) {
      const base = finAnterior !== null ? sumarDias(finAnterior, 1) : inicioProyecto;
      // Si el arranque deducido cae después del final, la fase dura un día:
      // mejor una barra mínima honesta que una barra invertida.
      inicio = base !== null && base < fin ? base : sumarDias(fin, -1);
      derivado = true;
    }

    ventanas.set(h.id, { hitoId: h.id, inicio, fin, inicioDerivado: derivado });
    finAnterior = fin;
  }

  return ventanas;
}

/* -------------------------------------------------------------------------- */
/*  Reparto de fechas a las tareas sin planificar                              */
/* -------------------------------------------------------------------------- */

export interface TareaParaPlanificar {
  id: number;
  titulo: string;
  hito_id: number | null;
  orden: number;
  prioridad: string;
  estimacion_horas: number | null;
}

export interface AsignacionFecha {
  tareaId: number;
  titulo: string;
  hitoId: number;
  fechaInicio: string;
  fechaVencimiento: string;
}

const PESO_PRIORIDAD: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 };

/**
 * Reparte las tareas sin fecha dentro de la ventana de su fase.
 *
 * Es aritmética, no criterio: la ventana ya está decidida y aquí solo se
 * trocea en tramos contiguos proporcionales a la estimación. Por eso es
 * determinista y no pasa por el modelo — un LLM costaría latencia y dinero
 * para producir peores fechas.
 *
 * Dos reglas que evitan resultados absurdos:
 *  - el suelo es hoy, así que ninguna tarea nace ya vencida;
 *  - una tarea sin fase, o cuya fase no tiene ventana, NO se planifica: se
 *    queda en «sin fecha» en vez de recibir una fecha inventada.
 */
export function planificarTareas(entrada: {
  tareas: TareaParaPlanificar[];
  ventanas: Map<number, VentanaFase>;
  hoy?: number;
}): AsignacionFecha[] {
  const hoy = inicioDeDia(entrada.hoy ?? Date.now());
  const porHito = new Map<number, TareaParaPlanificar[]>();

  for (const t of entrada.tareas) {
    if (t.hito_id === null || !entrada.ventanas.has(t.hito_id)) continue;
    const lista = porHito.get(t.hito_id) ?? [];
    lista.push(t);
    porHito.set(t.hito_id, lista);
  }

  const salida: AsignacionFecha[] = [];

  for (const [hitoId, lista] of porHito) {
    const v = entrada.ventanas.get(hitoId)!;
    const desde = Math.max(inicioDeDia(v.inicio), hoy);
    const hasta = Math.max(inicioDeDia(v.fin), desde);
    const diasDisponibles = Math.max(1, Math.round((hasta - desde) / DIA_MS) + 1);

    const ordenadas = [...lista].sort((a, b) => {
      if (a.orden !== b.orden) return a.orden - b.orden;
      const pa = PESO_PRIORIDAD[a.prioridad] ?? 9;
      const pb = PESO_PRIORIDAD[b.prioridad] ?? 9;
      if (pa !== pb) return pa - pb;
      return a.id - b.id;
    });

    // Reparto proporcional a las horas; si nadie estimó, reparto igual.
    const horas = ordenadas.map((t) => (t.estimacion_horas && t.estimacion_horas > 0 ? t.estimacion_horas : 0));
    const totalHoras = horas.reduce((a, b) => a + b, 0);
    const pesos = totalHoras > 0
      ? horas.map((h) => (h > 0 ? h / totalHoras : 0))
      : ordenadas.map(() => 1 / ordenadas.length);
    const sumaPesos = pesos.reduce((a, b) => a + b, 0) || 1;

    let cursor = desde;
    ordenadas.forEach((t, i) => {
      const esUltima = i === ordenadas.length - 1;
      const dias = Math.max(1, Math.round((pesos[i] / sumaPesos) * diasDisponibles));
      const inicio = Math.min(cursor, hasta);
      // La última cierra en el fin de la fase: así el reparto no se queda corto
      // por redondeos ni se pasa de la ventana.
      const fin = esUltima ? hasta : Math.min(sumarDias(inicio, dias - 1), hasta);
      salida.push({
        tareaId: t.id,
        titulo: t.titulo,
        hitoId,
        fechaInicio: aIso(inicio),
        fechaVencimiento: aIso(Math.max(fin, inicio)),
      });
      cursor = sumarDias(fin, 1);
    });
  }

  return salida;
}
