import { NextResponse } from 'next/server';
import {
  analizarSaludProyecto, generarPlanteamiento, sugerirTareas, analizarPerfilPersona,
  generarPreguntasEncuadre, generarPerfilesRequeridos,
} from '@/lib/ai/cliente';
import { ProyectoNoEncontrado, PersonaNoEncontrada } from '@/lib/ai/errores';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface Cuerpo {
  proyecto_id?: number;
  persona_id?: number;
  forzar?: boolean;
  tipo?: string;
  /** Solo para `perfil_cv`: el texto pegado y las notas. */
  texto?: string;
  notas?: string;
}

type Ejecutor = (id: number, opciones: { forzar?: boolean }, cuerpo: Cuerpo) => Promise<unknown>;

/**
 * Tipos ejecutables desde la interfaz.
 *
 * Cada uno declara sobre qué entidad opera: eso decide qué id se espera en el
 * cuerpo (`proyecto_id` o `persona_id`) y evita analizar una persona pasando
 * por error el id de un proyecto.
 *
 * `perfil_cv` no persiste el documento (eso lo hace la Server Action
 * `generarPerfilPersona`, que es el camino de la interfaz). Aquí solo analiza:
 * sirve para probar el contrato con curl sin ensuciar `persona_documentos`.
 */
const EJECUTORES: Record<string, { fn: Ejecutor; entidad: 'proyecto' | 'persona' }> = {
  salud_proyecto:         { fn: analizarSaludProyecto as Ejecutor, entidad: 'proyecto' },
  planteamiento_proyecto: { fn: generarPlanteamiento as Ejecutor,  entidad: 'proyecto' },
  tareas_sugeridas:       { fn: sugerirTareas as Ejecutor,         entidad: 'proyecto' },
  preguntas_encuadre:     { fn: generarPreguntasEncuadre as Ejecutor,  entidad: 'proyecto' },
  perfiles_requeridos:    { fn: generarPerfilesRequeridos as Ejecutor, entidad: 'proyecto' },
  perfil_cv: {
    entidad: 'persona',
    fn: (id, opciones, cuerpo) => {
      const texto = cuerpo.texto?.trim() ?? '';
      if (texto.length < 40) {
        throw new Error('perfil_cv necesita «texto» con al menos 40 caracteres');
      }
      return analizarPerfilPersona(id, { texto, notas: cuerpo.notas?.trim() || null }, opciones);
    },
  },
};

export async function POST(req: Request) {
  let cuerpo: Cuerpo;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
  }

  const tipo = cuerpo.tipo ?? 'salud_proyecto';
  const entrada = EJECUTORES[tipo];
  if (!entrada) {
    return NextResponse.json(
      { error: `tipo debe ser uno de: ${Object.keys(EJECUTORES).join(', ')}` },
      { status: 400 },
    );
  }

  const campo = entrada.entidad === 'persona' ? 'persona_id' : 'proyecto_id';
  const id = Number(cuerpo[campo]);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: `${campo} es obligatorio y debe ser un entero para el análisis «${tipo}»` },
      { status: 400 },
    );
  }

  try {
    const r = await entrada.fn(id, { forzar: Boolean(cuerpo.forzar) }, cuerpo);
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof ProyectoNoEncontrado || e instanceof PersonaNoEncontrada) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    const mensaje = e instanceof Error ? e.message : 'Error desconocido';
    console.error('[ia/analizar]', mensaje);
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
