/**
 * Selección de modelo por tipo de análisis.
 *
 * Tres niveles, cada uno con su variable de entorno:
 *   - OPENAI_MODEL        → análisis pesados (salud, patrones, perfil de CV):
 *                           mucho contexto numérico y razonamiento cruzado.
 *   - OPENAI_MODEL_TEXTO  → tareas de solo texto (planteamiento, resúmenes,
 *                           propuesta de roadmap): redacción sobre una
 *                           descripción, sin métricas que cruzar.
 *   - OPENAI_MODEL_BARATO → tareas ligeras y frecuentes (priorización diaria).
 *
 * Cada nivel puede fijar también su esfuerzo de razonamiento con
 * OPENAI_REASONING_EFFORT, OPENAI_REASONING_EFFORT_TEXTO y
 * OPENAI_REASONING_EFFORT_BARATO. Los valores admitidos son los de la API:
 * none, minimal, low, medium, high, xhigh y max.
 *
 * Todo cae en OPENAI_MODEL si la variable específica está vacía, así que
 * configurar solo OPENAI_MODEL sigue funcionando como antes.
 */
import type { TipoAnalisis } from './tipos';

const MODELO_POR_DEFECTO = 'gpt-4.1';

const SOLO_TEXTO: ReadonlySet<TipoAnalisis> = new Set([
  'planteamiento_proyecto',
  'tareas_sugeridas',
  'preguntas_encuadre',
]);

const BARATOS: ReadonlySet<TipoAnalisis> = new Set([
  'priorizacion_diaria',
]);

const ESFUERZOS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EsfuerzoRazonamiento = (typeof ESFUERZOS)[number];

function leerEsfuerzo(nombre: string): EsfuerzoRazonamiento | undefined {
  const valor = process.env[nombre]?.trim().toLowerCase();
  if (!valor) return undefined;
  if ((ESFUERZOS as readonly string[]).includes(valor)) {
    return valor as EsfuerzoRazonamiento;
  }
  throw new Error(`${nombre} debe ser uno de: ${ESFUERZOS.join(', ')}`);
}

function admiteRazonamiento(modelo: string): boolean {
  return /^gpt-5(?:[.-]|$)|^o[134](?:-|$)/.test(modelo);
}

export function modeloPara(tipo: TipoAnalisis): string {
  const principal = process.env.OPENAI_MODEL || MODELO_POR_DEFECTO;
  if (SOLO_TEXTO.has(tipo)) return process.env.OPENAI_MODEL_TEXTO || principal;
  if (BARATOS.has(tipo)) return process.env.OPENAI_MODEL_BARATO || principal;
  return principal;
}

/** Devuelve el esfuerzo del nivel correspondiente solo para modelos compatibles. */
export function razonamientoPara(
  tipo: TipoAnalisis,
  modelo: string,
): EsfuerzoRazonamiento | undefined {
  if (!admiteRazonamiento(modelo)) return undefined;

  if (SOLO_TEXTO.has(tipo)) {
    return leerEsfuerzo('OPENAI_REASONING_EFFORT_TEXTO')
      ?? leerEsfuerzo('OPENAI_REASONING_EFFORT');
  }
  if (BARATOS.has(tipo)) {
    return leerEsfuerzo('OPENAI_REASONING_EFFORT_BARATO')
      ?? leerEsfuerzo('OPENAI_REASONING_EFFORT');
  }
  return leerEsfuerzo('OPENAI_REASONING_EFFORT');
}
