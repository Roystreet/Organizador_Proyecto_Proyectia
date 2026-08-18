import { Stack } from '@mui/material';
import ImpactosPanel from '@/components/ImpactosPanel';
import GrafoOperacion from '@/components/GrafoOperacion';
import { equipoDeProyecto } from '@/lib/consultas';
import { grafoOperacion, impactosProyectoConsulta } from '@/lib/operacion';

/**
 * Oportunidades, riesgos y cómo se conecta todo.
 *
 * Es la pestaña más cara del servidor: `grafoOperacion` son seis consultas.
 * Antes se pagaban al abrir cualquier proyecto; ahora solo al entrar aquí.
 */
export default async function VistaRiesgos({ proyectoId }: { proyectoId: number }) {
  const [impactos, equipo, grafo] = await Promise.all([
    impactosProyectoConsulta(proyectoId),
    equipoDeProyecto(proyectoId),
    grafoOperacion(proyectoId),
  ]);

  return (
    <Stack spacing={2.5}>
      <ImpactosPanel proyectoId={proyectoId} impactos={impactos} equipo={equipo} />
      <GrafoOperacion grafo={grafo} titulo="Relaciones del proyecto" />
    </Stack>
  );
}
