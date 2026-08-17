import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Box, Breadcrumbs, Stack, Typography } from '@mui/material';
import AsistenteProyecto from '@/components/wizard/AsistenteProyecto';
import PasoBasico from '@/components/wizard/PasoBasico';
import PasoPerfiles from '@/components/wizard/PasoPerfiles';
import PanelPreguntas from '@/components/PanelPreguntas';
import PanelPlanteamiento from '@/components/PanelPlanteamiento';
import {
  listaCategorias, opcionesEmpresas, opcionesPersonas, listaSectores,
  borradorProyecto, sectoresDeProyecto, preguntasDeProyecto,
  ultimoAnalisisPorTipo,
} from '@/lib/consultas';
import { normalizarJson } from '@/lib/ai/cliente';
import { PASOS_TOTAL } from '@/lib/wizard';
import type { RespuestaPlanteamientoProyecto } from '@/lib/ai/tipos';
import type { RespuestaPerfilesRequeridosValidada } from '@/lib/ai/validacion';

export const dynamic = 'force-dynamic';

const DESCRIPCION_PASO: Record<number, string> = {
  1: 'Lo mínimo para arrancar. Cuanto mejor describas de qué trata, mejores serán las preguntas del paso siguiente.',
  2: 'La IA leyó lo que escribiste y te devuelve lo que falta por definir. Responder aquí mejora el plan y los perfiles que vienen después.',
  3: 'Con lo anterior, la IA propone de qué trata, el objetivo y un roadmap de fases con sus tareas. Tú eliges qué se inserta.',
  4: 'Qué perfiles hacen falta para sacar esto adelante, y quién de tu directorio encaja.',
};

export default async function NuevoProyecto({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; paso?: string }>;
}) {
  const q = await searchParams;
  const proyectoId = q.id ? Number(q.id) : null;

  const [categorias, empresas, personas, sectores] = await Promise.all([
    listaCategorias(),
    opcionesEmpresas(),
    opcionesPersonas(),
    listaSectores(),
  ]);
  const catalogos = { categorias, empresas, personas, sectores };

  /* Sin id: paso 1 en limpio. */
  if (proyectoId === null || !Number.isInteger(proyectoId)) {
    return (
      <Marco paso={1}>
        <AsistenteProyecto proyectoId={null} paso={1} pasoMaximo={1}>
          <PasoBasico catalogos={catalogos} />
        </AsistenteProyecto>
      </Marco>
    );
  }

  const borrador = await borradorProyecto(proyectoId);
  if (!borrador) notFound();

  // El paso guardado manda: no se puede saltar por URL a lo que no se alcanzó.
  const pasoMaximo = Math.max(1, Math.min(PASOS_TOTAL, borrador.wizard_paso ?? PASOS_TOTAL));
  const pedido = Number(q.paso ?? 1);
  const paso = Math.max(1, Math.min(pasoMaximo, Number.isInteger(pedido) ? pedido : 1));

  const [suyos, preguntas, planteamiento, perfiles] = await Promise.all([
    sectoresDeProyecto(proyectoId),
    preguntasDeProyecto(proyectoId),
    paso === 3 ? ultimoAnalisisPorTipo(proyectoId, 'planteamiento_proyecto') : null,
    paso === 4 ? ultimoAnalisisPorTipo(proyectoId, 'perfiles_requeridos') : null,
  ]);

  return (
    <Marco paso={paso} nombre={borrador.nombre} codigo={borrador.codigo}>
      <AsistenteProyecto proyectoId={proyectoId} paso={paso} pasoMaximo={pasoMaximo}>
        {paso === 1 && (
          <PasoBasico
            catalogos={catalogos}
            borrador={borrador}
            sectoresMarcados={suyos.map((s) => s.id)}
          />
        )}

        {paso === 2 && (
          <PanelPreguntas
            proyectoId={proyectoId}
            preguntas={preguntas}
            autoGenerar
            comoTarjeta={false}
          />
        )}

        {paso === 3 && (
          <PanelPlanteamiento
            proyectoId={proyectoId}
            autoGenerar
            inicial={planteamiento
              ? {
                  analisis_id: planteamiento.id,
                  datos: normalizarJson(planteamiento.respuesta_json) as RespuestaPlanteamientoProyecto,
                  modelo: planteamiento.modelo,
                }
              : null}
          />
        )}

        {paso === 4 && (
          <PasoPerfiles
            proyectoId={proyectoId}
            nombrePorPersona={new Map(personas.map((p) => [p.id, p.nombre_completo]))}
            inicial={perfiles
              ? {
                  analisis_id: perfiles.id,
                  datos: normalizarJson(perfiles.respuesta_json) as RespuestaPerfilesRequeridosValidada,
                  modelo: perfiles.modelo,
                }
              : null}
          />
        )}
      </AsistenteProyecto>
    </Marco>
  );
}

function Marco({
  paso, nombre, codigo, children,
}: {
  paso: number; nombre?: string; codigo?: string; children: React.ReactNode;
}) {
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 980 }}>
      <Box>
        <Breadcrumbs sx={{ mb: 0.5, fontSize: '0.8125rem' }}>
          <Link href="/proyectos" style={{ color: 'inherit' }}>Proyectos</Link>
          <Typography variant="body2" color="text.secondary">
            {codigo ? `${codigo} · borrador` : 'Nuevo'}
          </Typography>
        </Breadcrumbs>
        <Typography variant="h2">{nombre ?? 'Nuevo proyecto'}</Typography>
        <Typography color="text.secondary" variant="body2">
          Paso {paso} de {PASOS_TOTAL} · {DESCRIPCION_PASO[paso]}
        </Typography>
      </Box>
      {children}
    </Stack>
  );
}
