import 'server-only';
import { filas } from '@/db';
import type { RecomendacionPrevia } from './tipos';

export {
  proyectoPorId, tareasDeProyecto, asuntosDeProyecto, equipoDeProyecto,
  tendenciaDeProyecto, eventosDeProyecto, decisionesDeProyecto,
  habilidadesRequeridas, patronesActivos,
} from '@/lib/consultas';

/**
 * Recomendaciones anteriores con su desenlace. Van dentro del payload para que
 * el modelo no vuelva a proponer lo que ya se descartó, y para que sepa qué de
 * lo suyo terminó implementándose.
 */
export const filasRecomendacionesPrevias = (proyectoId: number) =>
  filas<RecomendacionPrevia>(
    `SELECT id, titulo, tipo, estado, feedback_usuario,
            DATEDIFF(CURDATE(), DATE(creado_en)) AS dias_desde_emision
       FROM recomendaciones_ia
      WHERE proyecto_id = ?
      ORDER BY creado_en DESC LIMIT 15`,
    [proyectoId],
  );
