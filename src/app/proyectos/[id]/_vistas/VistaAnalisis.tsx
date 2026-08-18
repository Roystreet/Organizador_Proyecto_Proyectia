import { Stack } from '@mui/material';
import PanelIa from '@/components/PanelIa';
import PanelPlanteamiento from '@/components/PanelPlanteamiento';
import PanelPreguntas from '@/components/PanelPreguntas';
import { preguntasDeProyecto, ultimoAnalisis, ultimoAnalisisPorTipo } from '@/lib/consultas';
import { idsRecomendaciones, normalizarJson } from '@/lib/ai/cliente';
import type { RespuestaSaludProyecto, RespuestaPlanteamientoProyecto } from '@/lib/ai/tipos';

/** Todo lo que produce la IA sobre el proyecto: encuadre, planteamiento y salud. */
export default async function VistaAnalisis({
  proyectoId, autoGenerar,
}: {
  proyectoId: number;
  autoGenerar: boolean;
}) {
  const [preguntas, analisis, planteamiento] = await Promise.all([
    preguntasDeProyecto(proyectoId),
    ultimoAnalisis(proyectoId),
    ultimoAnalisisPorTipo(proyectoId, 'planteamiento_proyecto'),
  ]);

  const inicial = analisis
    ? {
        analisis_id: analisis.id,
        recomendacion_ids: await idsRecomendaciones(analisis.id),
        datos: normalizarJson(analisis.respuesta_json) as RespuestaSaludProyecto,
        modelo: analisis.modelo,
      }
    : null;

  const inicialPlanteamiento = planteamiento
    ? {
        analisis_id: planteamiento.id,
        datos: normalizarJson(planteamiento.respuesta_json) as RespuestaPlanteamientoProyecto,
        modelo: planteamiento.modelo,
      }
    : null;

  return (
    <Stack spacing={2.5}>
      {preguntas.length > 0 && <PanelPreguntas proyectoId={proyectoId} preguntas={preguntas} />}
      <PanelPlanteamiento proyectoId={proyectoId} autoGenerar={autoGenerar} inicial={inicialPlanteamiento} />
      <PanelIa proyectoId={proyectoId} inicial={inicial} />
    </Stack>
  );
}
