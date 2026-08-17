import Link from 'next/link';
import {
  Box, Card, CardContent, Typography, Stack, Divider, LinearProgress, Tooltip, Chip,
} from '@mui/material';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import ChecklistOutlined from '@mui/icons-material/ChecklistOutlined';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import Kpi from '@/components/Kpi';
import TarjetaProyecto from '@/components/TarjetaProyecto';
import PuntoSalud from '@/components/PuntoSalud';
import {
  resumenProyectos, kpisPortafolio, cuellosBotella, cargaPersonas, patronesActivos,
} from '@/lib/consultas';
import { calcularSalud } from '@/lib/formato';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const [proyectos, kpis, cuellos, carga, patrones] = await Promise.all([
    resumenProyectos(), kpisPortafolio(), cuellosBotella(), cargaPersonas(), patronesActivos(),
  ]);

  // Si el análisis de IA ya dictaminó un semáforo se respeta; si no, se calcula.
  const conSalud = proyectos.map((p) => ({
    p,
    salud: p.salud === 'sin_datos' ? calcularSalud(p) : p.salud,
  }));

  const activos = conSalud.filter(({ p }) => !['completado', 'cancelado'].includes(p.estado));
  const enRojo = activos.filter(({ salud }) => salud === 'rojo').length;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h2">Visión global</Typography>
        <Typography color="text.secondary" variant="body2">
          {activos.length} proyectos activos
          {enRojo > 0 && ` · ${enRojo} requiere${enRojo > 1 ? 'n' : ''} atención inmediata`}
        </Typography>
      </Box>

      {/* Fila de KPIs */}
      <Box sx={{
        display: 'grid', gap: 2,
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
      }}>
        <Kpi etiqueta="Proyectos activos" valor={kpis?.proyectos_activos ?? 0}
             icono={<FolderOutlined fontSize="small" />} />
        <Kpi etiqueta="Tareas abiertas" valor={kpis?.tareas_abiertas ?? 0}
             icono={<ChecklistOutlined fontSize="small" />} />
        <Kpi etiqueta="Bloqueadas" valor={kpis?.tareas_bloqueadas ?? 0}
             tono={(kpis?.tareas_bloqueadas ?? 0) > 0 ? 'critico' : 'normal'}
             icono={<BlockOutlined fontSize="small" />} />
        <Kpi etiqueta="Vencidas" valor={kpis?.tareas_vencidas ?? 0}
             tono={(kpis?.tareas_vencidas ?? 0) > 0 ? 'alerta' : 'normal'}
             icono={<EventBusyOutlined fontSize="small" />} />
        <Kpi etiqueta="Asuntos críticos" valor={kpis?.asuntos_criticos ?? 0}
             tono={(kpis?.asuntos_criticos ?? 0) > 0 ? 'critico' : 'normal'}
             icono={<ReportProblemOutlined fontSize="small" />} />
        <Kpi etiqueta="Personas" valor={kpis?.personas_activas ?? 0}
             icono={<GroupsOutlined fontSize="small" />} />
      </Box>

      {/* Proyectos */}
      <Box>
        <Typography variant="h4" sx={{ mb: 1.5 }}>Proyectos</Typography>
        <Box sx={{
          display: 'grid', gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
        }}>
          {conSalud.map(({ p, salud }) => (
            <TarjetaProyecto key={p.id} p={p} salud={salud} />
          ))}
        </Box>
      </Box>

      {/* Paneles inferiores */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        {/* Cuellos de botella */}
        <Card>
          <CardContent>
            <Typography variant="h4" sx={{ mb: 0.5 }}>Cuellos de botella</Typography>
            <Typography variant="caption" color="text.secondary">
              Tareas abiertas que están frenando a otras
            </Typography>
            <Stack divider={<Divider />} sx={{ mt: 1.5 }}>
              {cuellos.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  Nada frenando el avance ahora mismo.
                </Typography>
              )}
              {cuellos.map((c) => (
                <Box key={c.tarea_id} sx={{ py: 1.25 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                    <Typography
                      component={Link}
                      href={`/proyectos/${c.proyecto_id}`}
                      variant="caption"
                      sx={{ fontWeight: 700, color: 'primary.main', textDecoration: 'none' }}
                    >
                      {c.proyecto_codigo}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
                      {c.titulo}
                    </Typography>
                    <Chip size="small" color="error" variant="outlined"
                          label={`frena ${c.tareas_que_bloquea}`} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {c.dias_detenida} días detenida · {c.responsable ?? 'sin responsable'}
                    {c.motivo_bloqueo ? ` · ${c.motivo_bloqueo}` : ''}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Carga del equipo */}
        <Card>
          <CardContent>
            <Typography variant="h4" sx={{ mb: 0.5 }}>Carga del equipo</Typography>
            <Typography variant="caption" color="text.secondary">
              Tareas abiertas sumando todos los proyectos
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              {carga.filter((c) => c.tareas_abiertas > 0).map((c) => {
                const tope = Math.max(...carga.map((x) => x.tareas_abiertas), 1);
                const pct = Math.round((c.tareas_abiertas / tope) * 100);
                return (
                  <Box key={c.persona_id}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {c.nombre_completo}
                        <Typography component="span" variant="caption" color="text.secondary">
                          {' '}· {c.rol_principal ?? '—'}
                        </Typography>
                      </Typography>
                      <Tooltip title={`${c.proyectos_activos} proyecto(s) · ${c.horas_estimadas_pendientes ?? 0} h estimadas`}>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {c.tareas_abiertas}
                          {c.tareas_vencidas > 0 && (
                            <Typography component="span" variant="caption" color="warning.main">
                              {' '}({c.tareas_vencidas} vencidas)
                            </Typography>
                          )}
                        </Typography>
                      </Tooltip>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      color={c.tareas_vencidas > 0 ? 'warning' : 'primary'}
                    />
                  </Box>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Memoria de patrones */}
      {patrones.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h4" sx={{ mb: 0.5 }}>Patrones detectados</Typography>
            <Typography variant="caption" color="text.secondary">
              Lo que se repite entre proyectos distintos
            </Typography>
            <Stack divider={<Divider />} sx={{ mt: 1.5 }}>
              {patrones.map((p) => (
                <Box key={p.clave} sx={{ py: 1.25 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.25 }}>
                    <PuntoSalud salud={p.frecuencia >= 3 ? 'rojo' : 'amarillo'} tam={8} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.nombre}</Typography>
                    <Chip size="small" variant="outlined" label={`${p.frecuencia} casos`} />
                    {p.confianza !== null && (
                      <Chip size="small" variant="outlined"
                            label={`confianza ${Math.round(Number(p.confianza) * 100)}%`} />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">{p.descripcion}</Typography>
                  {p.recomendacion && (
                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                      → {p.recomendacion}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
