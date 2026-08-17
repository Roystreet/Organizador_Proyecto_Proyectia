import 'server-only';
import type { ZodError } from 'zod';
import type { EstadoFormulario } from './tipos';

/** Campo de texto del FormData: '' y ausente se normalizan a null. */
export function texto(datos: FormData, campo: string): string | null {
  const v = datos.get(campo);
  if (typeof v !== 'string') return null;
  const limpio = v.trim();
  return limpio === '' ? null : limpio;
}

export function entero(datos: FormData, campo: string): number | null {
  const t = texto(datos, campo);
  if (t === null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function numero(datos: FormData, campo: string): number | null {
  const t = texto(datos, campo);
  if (t === null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Traduce un ZodError al mapa {campo: mensaje} que pinta el formulario. */
export function erroresDeZod(error: ZodError): EstadoFormulario {
  const errores: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = String(issue.path[0] ?? 'general');
    if (!errores[campo]) errores[campo] = issue.message;
  }
  return { ok: false, errores, mensaje: 'Revisa los campos marcados.' };
}

/** ER_DUP_ENTRY: la red final contra la carrera entre el SELECT y el INSERT. */
export function esDuplicado(e: unknown): boolean {
  return typeof e === 'object' && e !== null
    && (e as { errno?: number }).errno === 1062;
}
