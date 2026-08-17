import type { Salud } from './ai/tipos';

export const fmtFecha = (v: string | Date | null | undefined): string => {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v.length <= 10 ? `${v}T00:00:00` : v) : v;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDias = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  if (n === 0) return 'hoy';
  return n > 0 ? `en ${n} d` : `hace ${Math.abs(n)} d`;
};

/**
 * Semáforo calculado en el servidor a partir de las métricas duras.
 * La IA puede sobrescribirlo después; esto es la línea base determinista para
 * que el dashboard nunca muestre "sin datos" cuando sí hay datos.
 */
export function calcularSalud(p: {
  estado: string;
  dias_sin_movimiento: number;
  tareas_bloqueadas: number;
  tareas_vencidas: number;
  asuntos_criticos: number;
  dias_restantes: number | null;
  progreso_pct: number;
}): Salud {
  if (p.estado === 'completado') return 'verde';
  if (p.estado === 'cancelado' || p.estado === 'idea') return 'sin_datos';

  let puntos = 0;
  if (p.asuntos_criticos > 0) puntos += 2 * p.asuntos_criticos;
  if (p.tareas_bloqueadas > 0) puntos += 2 * p.tareas_bloqueadas;
  puntos += p.tareas_vencidas;
  if (p.dias_sin_movimiento > 21) puntos += 3;
  else if (p.dias_sin_movimiento > 10) puntos += 1;
  // Compromiso cerca y avance corto: la combinación más peligrosa.
  if (p.dias_restantes !== null && p.dias_restantes < 15 && p.progreso_pct < 70) puntos += 2;
  if (p.estado === 'en_pausa') puntos += 2;

  if (puntos >= 5) return 'rojo';
  if (puntos >= 2) return 'amarillo';
  return 'verde';
}
