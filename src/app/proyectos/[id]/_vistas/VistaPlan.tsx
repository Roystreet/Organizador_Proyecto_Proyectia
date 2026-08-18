import RoadmapProyecto from '@/components/roadmap/RoadmapProyecto';
import { roadmapDeProyecto } from '@/lib/consultas';

/** Fases, sprints y las tareas colocadas en el tiempo. */
export default async function VistaPlan({
  proyectoId, codigo, nombre, fechaInicio, fechaFinEstimada,
}: {
  proyectoId: number;
  codigo: string;
  nombre: string;
  fechaInicio: string | null;
  fechaFinEstimada: string | null;
}) {
  const roadmap = await roadmapDeProyecto(proyectoId);

  return (
    <RoadmapProyecto
      proyectoId={proyectoId}
      codigoProyecto={codigo}
      nombreProyecto={nombre}
      hitos={roadmap.hitos}
      sprints={roadmap.sprints}
      tareas={roadmap.tareas}
      fechaInicio={fechaInicio}
      fechaFinEstimada={fechaFinEstimada}
    />
  );
}
