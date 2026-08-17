import { NextResponse } from 'next/server';
import { actualizarRecomendacion } from '@/lib/ai/cliente';

const ESTADOS = ['nueva', 'aceptada', 'en_progreso', 'implementada', 'descartada'] as const;
type Estado = (typeof ESTADOS)[number];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const recomendacionId = Number(id);
  if (!Number.isInteger(recomendacionId)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const cuerpo = (await req.json().catch(() => ({}))) as { estado?: string; feedback?: string };
  if (!cuerpo.estado || !ESTADOS.includes(cuerpo.estado as Estado)) {
    return NextResponse.json({ error: `estado debe ser uno de: ${ESTADOS.join(', ')}` }, { status: 400 });
  }

  await actualizarRecomendacion(recomendacionId, cuerpo.estado as Estado, cuerpo.feedback);
  return NextResponse.json({ ok: true });
}
