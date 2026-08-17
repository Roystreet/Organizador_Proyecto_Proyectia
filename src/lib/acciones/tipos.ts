/**
 * Contrato entre formularios (useActionState) y Server Actions.
 * `errores` va por campo, para pintarse debajo del input correspondiente.
 */
export interface EstadoFormulario {
  ok: boolean;
  errores?: Record<string, string>;
  mensaje?: string;
  id?: number;
}

export const ESTADO_INICIAL: EstadoFormulario = { ok: false };
