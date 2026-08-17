import { NextResponse } from 'next/server';
import {
  analizarSaludProyecto, generarPlanteamiento, sugerirTareas,
} from '@/lib/ai/cliente';
import { ProyectoNoEncontrado } from '@/lib/ai/errores';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Tipos ejecutables desde la interfaz. Default: salud (retrocompatible). */
const EJECUTORES = {
  salud_proyecto: analizarSaludProyecto,
  planteamiento_proyecto: generarPlanteamiento,
  tareas_sugeridas: sugerirTareas,
} as const;

type TipoEjecutable = keyof typeof EJECUTORES;

export async function POST(req: Request) {
  let cuerpo: { proyecto_id?: number; forzar?: boolean; tipo?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
  }

  const proyectoId = Number(cuerpo.proyecto_id);
  if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
    return NextResponse.json({ error: 'proyecto_id es obligatorio y debe ser un entero' }, { status: 400 });
  }

  const tipo = (cuerpo.tipo ?? 'salud_proyecto') as TipoEjecutable;
  if (!(tipo in EJECUTORES)) {
    return NextResponse.json(
      { error: `tipo debe ser uno de: ${Object.keys(EJECUTORES).join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const r = await EJECUTORES[tipo](proyectoId, { forzar: Boolean(cuerpo.forzar) });
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof ProyectoNoEncontrado) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    const mensaje = e instanceof Error ? e.message : 'Error desconocido';
    console.error('[ia/analizar]', mensaje);
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
