'use client';

import Link from 'next/link';
import {
  Card, CardActionArea, CardContent, Box, Typography, LinearProgress, Stack, Tooltip,
} from '@mui/material';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined';
import PeopleOutlined from '@mui/icons-material/PeopleOutlined';
import PuntoSalud from './PuntoSalud';
import ChipSemantico from './ChipSemantico';
import { fmtDias } from '@/lib/formato';
import type { FilaResumenProyecto } from '@/lib/consultas';
import type { Salud } from '@/lib/ai/tipos';

/** Contador con icono. En gris cuando vale 0, en color cuando hay algo que mirar. */
function Señal({ icono, valor, titulo, color }: {
  icono: React.ReactNode; valor: number; titulo: string; color: string;
}) {
  const activo = valor > 0;
  return (
    <Tooltip title={titulo}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.5,
        color: activo ? color : 'text.disabled',
        fontWeight: activo ? 700 : 500, fontSize: '0.8125rem',
      }}>
        {icono}{valor}
      </Box>
    </Tooltip>
  );
}

export default function TarjetaProyecto({ p, salud }: { p: FilaResumenProyecto; salud: Salud }) {
  const avance = p.tareas_total > 0
    ? Math.round((p.tareas_completadas / p.tareas_total) * 100)
    : p.progreso_pct;

  const cerrado = ['completado', 'cancelado'].includes(p.estado);
  const tarde = !cerrado && p.dias_restantes !== null && p.dias_restantes < 0;
  const cerca = !cerrado && p.dias_restantes !== null && p.dias_restantes >= 0 && p.dias_restantes <= 14;

  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea component={Link} href={`/proyectos/${p.id}`} sx={{ height: '100%' }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PuntoSalud salud={salud} />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {p.codigo}
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <ChipSemantico grupo="prioridad" valor={p.prioridad} />
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }}>{p.nombre}</Typography>
            <Typography variant="caption" color="text.secondary">
              {[p.categoria, p.empresa].filter(Boolean).join(' · ') || 'Sin categoría'}
            </Typography>
          </Box>

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {p.tareas_completadas}/{p.tareas_total} tareas
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>{avance}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={avance} />
          </Box>

          <Stack direction="row" spacing={1.75} sx={{ mt: 'auto', pt: 0.5, flexWrap: 'wrap' }}>
            <Señal icono={<BlockOutlined sx={{ fontSize: 16 }} />} valor={p.tareas_bloqueadas}
                   titulo="Tareas bloqueadas" color="error.main" />
            <Señal icono={<EventBusyOutlined sx={{ fontSize: 16 }} />} valor={p.tareas_vencidas}
                   titulo="Tareas vencidas" color="warning.main" />
            <Señal icono={<ReportProblemOutlined sx={{ fontSize: 16 }} />} valor={p.asuntos_criticos}
                   titulo="Asuntos críticos" color="error.main" />
            <Señal icono={<PeopleOutlined sx={{ fontSize: 16 }} />} valor={p.involucrados}
                   titulo="Involucrados" color="text.secondary" />
          </Stack>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <ChipSemantico grupo="estadoProyecto" valor={p.estado} />
            <Typography
              variant="caption"
              sx={{ color: tarde ? 'error.main' : cerca ? 'warning.main' : 'text.secondary', fontWeight: tarde || cerca ? 700 : 500 }}
            >
              {cerrado
                ? 'Cerrado'
                : p.fecha_fin_estimada
                  ? `Entrega ${fmtDias(p.dias_restantes)}`
                  : 'Sin fecha'}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
