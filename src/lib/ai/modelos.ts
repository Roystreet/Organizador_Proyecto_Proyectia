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

export function modeloPara(tipo: TipoAnalisis): string {
  const principal = process.env.OPENAI_MODEL || MODELO_POR_DEFECTO;
  if (SOLO_TEXTO.has(tipo)) return process.env.OPENAI_MODEL_TEXTO || principal;
  if (BARATOS.has(tipo)) return process.env.OPENAI_MODEL_BARATO || principal;
  return principal;
}
