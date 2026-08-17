'use client';

import * as React from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Button, Chip, Tooltip, Typography } from '@mui/material';
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined';
import { colorDe } from '@/theme/theme';
import type { FilaTareaRoadmap } from '@/lib/consultas';

const VISIBLES = 7;

/**
 * Las tareas que no tienen fecha, agrupadas aparte.
 *
 * No se les inventa una posición en la línea de tiempo: el roadmap solo
 * muestra lo que de verdad está fechado. Desde aquí se pueden planificar todas
 * de una vez, pero pasando por una revisión.
 */
export default function BloqueSinFecha({
  tareas,
  puedePlanificar,
  motivoDeshabilitado,
  alPlanificar,
}: {
  tareas: FilaTareaRoadmap[];
  puedePlanificar: boolean;
  motivoDeshabilitado: string;
  alPlanificar: () => void;
}) {
  const tema = useTheme();
  const [verTodas, setVerTodas] = React.useState(false);

  if (tareas.length === 0) return null;

  const mostradas = verTodas ? tareas : tareas.slice(0, VISIBLES);
  const restantes = tareas.length - mostradas.length;

  return (
    <Box
      sx={{
        mt: 2,
        p: 1.75,
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.sutil',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25, flexWrap: 'wrap' }}>
        <Typography variant="overline" color="text.secondary">Sin fecha</Typography>
        <Chip size="small" label={`${tareas.length} tarea${tareas.length === 1 ? '' : 's'}`}
              sx={{ height: 20, fontSize: '0.7rem' }} />
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title={puedePlanificar ? '' : motivoDeshabilitado}>
          {/* El span deja que el Tooltip funcione con el botón deshabilitado */}
          <span>
            <Button size="small" variant="text" color="secondary"
                    startIcon={<EventAvailableOutlined />}
                    disabled={!puedePlanificar} onClick={alPlanificar}>
              Planificar todo
            </Button>
          </span>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
        {mostradas.map((t) => {
          const c = colorDe(tema, 'estadoTarea', t.estado as never);
          return (
            <Tooltip key={t.id} title={t.responsable ? `Responsable: ${t.responsable}` : 'Sin responsable'}>
              <Chip
                size="small"
                variant="outlined"
                label={t.titulo}
                icon={
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.main, ml: 1 }} />
                }
                sx={{ maxWidth: 340 }}
              />
            </Tooltip>
          );
        })}
        {restantes > 0 && (
          <Button size="small" variant="text" onClick={() => setVerTodas(true)}>
            + {restantes} más
          </Button>
        )}
        {verTodas && tareas.length > VISIBLES && (
          <Button size="small" variant="text" onClick={() => setVerTodas(false)}>
            ver menos
          </Button>
        )}
      </Box>
    </Box>
  );
}
