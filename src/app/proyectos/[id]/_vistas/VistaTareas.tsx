import TareasProyecto from '@/components/TareasProyecto';
import { equipoDeProyecto, tareasDeProyecto } from '@/lib/consultas';

/** Kanban y tabla. */
export default async function VistaTareas({ proyectoId }: { proyectoId: number }) {
  const [tareas, equipo] = await Promise.all([
    tareasDeProyecto(proyectoId),
    equipoDeProyecto(proyectoId),
  ]);

  return <TareasProyecto proyectoId={proyectoId} iniciales={tareas} equipo={equipo} />;
}
