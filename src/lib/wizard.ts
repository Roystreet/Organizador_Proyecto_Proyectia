/**
 * Constantes del asistente de creación de proyecto.
 *
 * Viven fuera de `acciones/wizard.ts` porque un archivo `'use server'` solo
 * puede exportar funciones async: cualquier constante exportada rompe el build.
 */

/** Pasos del asistente: básico → preguntas → planteamiento → perfiles. */
export const PASOS_TOTAL = 4;

export const TITULOS_PASOS = ['Lo básico', 'Preguntas', 'Planteamiento', 'Perfiles'] as const;
