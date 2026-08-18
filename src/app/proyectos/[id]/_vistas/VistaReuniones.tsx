import PanelReuniones from '@/components/reuniones/PanelReuniones';
import { opcionesPersonas } from '@/lib/consultas';
import { reunionesAgenda } from '@/lib/operacion';

/**
 * Reuniones del proyecto. Las personas seleccionables son todas las activas,
 * no solo el equipo: a una reunión se invita a quien haga falta.
 */
export default async function VistaReuniones({ proyectoId }: { proyectoId: number }) {
  const [reuniones, personas] = await Promise.all([
    reunionesAgenda(proyectoId),
    opcionesPersonas(),
  ]);

  return <PanelReuniones proyectoId={proyectoId} reuniones={reuniones} personas={personas} />;
}
