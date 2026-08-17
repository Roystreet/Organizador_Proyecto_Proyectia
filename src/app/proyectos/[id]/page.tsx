import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Box, Button, Card, CardContent, Chip, Divider, LinearProgress, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography, Tooltip, Breadcrumbs,
} from '@mui/material';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ChipSemantico from '@/components/ChipSemantico';
import PuntoSalud from '@/components/PuntoSalud';
import PanelIa from '@/components/PanelIa';
import PanelPlanteamiento from '@/components/PanelPlanteamiento';
import PanelPreguntas from '@/components/PanelPreguntas';
import RoadmapProyecto from '@/components/roadmap/RoadmapProyecto';
import SeccionColapsable from '@/components/SeccionColapsable';
import Kpi from '@/components/Kpi';
import {
  proyectoPorId, tareasDeProyecto, asuntosDeProyecto, equipoDeProyecto,
  habilidadesRequeridas, ultimoAnalisis, ultimoAnalisisPorTipo, roadmapDeProyecto,
  preguntasDeProyecto,
} from '@/lib/consultas';
import { idsRecomendaciones, normalizarJson } from '@/lib/ai/cliente';
import { calcularSalud, fmtDias, fmtFecha } from '@/lib/formato';
import type { RespuestaSaludProyecto, RespuestaPlanteamientoProyecto } from '@/lib/ai/tipos';

export const dynamic = 'force-dynamic';

export default async function DetalleProyecto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ planteamiento?: string }>;
}) {
  const [{ id }, consulta] = await Promise.all([params, searchParams]);
  const proyectoId = Number(id);
  if (!Number.isInteger(proyectoId)) notFound();

  const p = await proyectoPorId(proyectoId);
  if (!p) notFound();

  const [tareas, asuntos, equipo, skills, analisis, planteamiento, roadmap, preguntas] =
    await Promise.all([
      tareasDeProyecto(proyectoId),
      asuntosDeProyecto(proyectoId),
      equipoDeProyecto(proyectoId),
      habilidadesRequeridas(proyectoId),
      ultimoAnalisis(proyectoId),
      ultimoAnalisisPorTipo(proyectoId, 'planteamiento_proyecto'),
      roadmapDeProyecto(proyectoId),
      preguntasDeProyecto(proyectoId),
    ]);

  const salud = p.salud === 'sin_datos' ? calcularSalud(p) : p.salud;
  const avance = p.tareas_total > 0
    ? Math.round((p.tareas_completadas / p.tareas_total) * 100)
    : p.progreso_pct;

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

  const abiertos = asuntos.filter((a) => !['resuelto', 'cerrado', 'descartado'].includes(a.estado));

  return (
    <Stack spacing={3}>
      {/* Cabecera */}
      <Box>
        <Breadcrumbs sx={{ mb: 0.5, fontSize: '0.8125rem' }}>
          <Link href="/proyectos" style={{ color: 'inherit' }}>Proyectos</Link>
          <Typography variant="body2" color="text.secondary">{p.codigo}</Typography>
        </Breadcrumbs>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <PuntoSalud salud={salud} tam={14} />
          <Typography variant="h2">{p.nombre}</Typography>
          <ChipSemantico grupo="estadoProyecto" valor={p.estado} />
          <ChipSemantico grupo="prioridad" valor={p.prioridad} />
          <Box sx={{ flexGrow: 1 }} />
          <Button component={Link} href={`/proyectos/${proyectoId}/editar`}
                  size="small" variant="outlined" startIcon={<EditOutlined />}>
            Editar
          </Button>
        </Box>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          {[p.categoria, p.empresa, p.responsable && `Responsable: ${p.responsable}`]
            .filter(Boolean).join(' · ')}
        </Typography>
        {p.objetivo && (
          <Typography variant="body2" sx={{ mt: 1.5, maxWidth: 900 }}>
            <Typography component="span" variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              OBJETIVO ·{' '}
            </Typography>
            {p.objetivo}
          </Typography>
        )}
      </Box>

      {/* De qué trata: el resumen de la IA, con la descripción original detrás */}
      {(p.resumen_ia || p.descripcion) && (
        <Card>
          <CardContent>
            {p.resumen_ia ? (
              <>
                <Typography variant="overline" color="text.secondary">De qué trata</Typography>
                <Typography variant="body1" sx={{ maxWidth: 900, mt: 0.5 }}>
                  {p.resumen_ia}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                  Redactado por la IA{p.resumen_ia_actualizado_en
                    ? ` · ${fmtFecha(p.resumen_ia_actualizado_en)}`
                    : ''}
                </Typography>
                {p.descripcion && (
                  <Box sx={{ mt: 2 }}>
                    <SeccionColapsable titulo="Descripción original" inicial={false}>
                      <Typography variant="body2" color="text.secondary"
                                  sx={{ whiteSpace: 'pre-line', maxWidth: 900, mt: 0.5 }}>
                        {p.descripcion}
                      </Typography>
                    </SeccionColapsable>
                  </Box>
                )}
              </>
            ) : (
              <>
                <Typography variant="overline" color="text.secondary">De qué trata</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line', maxWidth: 900, mt: 0.5 }}>
                  {p.descripcion}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                  Todavía sin resumen. Genera el planteamiento más abajo para tener una
                  versión que se entienda de un vistazo.
                </Typography>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPIs del proyecto */}
      <Box sx={{
        display: 'grid', gap: 2,
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
      }}>
        <Kpi etiqueta="Avance" valor={`${avance}%`}
             detalle={`${p.tareas_completadas} de ${p.tareas_total} tareas`} />
        <Kpi etiqueta="Bloqueadas" valor={p.tareas_bloqueadas}
             tono={p.tareas_bloqueadas > 0 ? 'critico' : 'normal'} />
        <Kpi etiqueta="Vencidas" valor={p.tareas_vencidas}
             tono={p.tareas_vencidas > 0 ? 'alerta' : 'normal'} />
        <Kpi etiqueta="Asuntos abiertos" valor={p.asuntos_abiertos}
             detalle={p.asuntos_criticos > 0 ? `${p.asuntos_criticos} críticos` : undefined}
             tono={p.asuntos_criticos > 0 ? 'critico' : 'normal'} />
        <Kpi etiqueta="Entrega" valor={p.fecha_fin_estimada ? fmtDias(p.dias_restantes) : '—'}
             detalle={fmtFecha(p.fecha_fin_estimada)}
             tono={p.dias_restantes !== null && p.dias_restantes < 15 ? 'alerta' : 'normal'} />
      </Box>

      {preguntas.length > 0 && (
        <PanelPreguntas proyectoId={proyectoId} preguntas={preguntas} />
      )}

      <PanelPlanteamiento
        proyectoId={proyectoId}
        autoGenerar={consulta.planteamiento === 'auto'}
        inicial={inicialPlanteamiento}
      />

      <PanelIa proyectoId={proyectoId} inicial={inicial} />

      {/* Roadmap. La Card y la cabecera viven dentro del componente: el
          selector de escala y «Añadir fase» son parte de la misma unidad. */}
      <RoadmapProyecto
        proyectoId={proyectoId}
        codigoProyecto={p.codigo}
        nombreProyecto={p.nombre}
        hitos={roadmap.hitos}
        sprints={roadmap.sprints}
        tareas={roadmap.tareas}
        fechaInicio={p.fecha_inicio}
        fechaFinEstimada={p.fecha_fin_estimada}
      />

      {/* Tareas */}
      <Card>
        <CardContent>
          <Typography variant="h4" sx={{ mb: 1.5 }}>Tareas</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tarea</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Prioridad</TableCell>
                <TableCell>Responsable</TableCell>
                <TableCell>Vence</TableCell>
                <TableCell align="right">Avance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tareas.map((t) => {
                const frena = t.bloquea_a ? t.bloquea_a.split(',').length : 0;
                const vencida = (t.dias_para_vencer ?? 1) < 0
                  && !['completada', 'cancelada'].includes(t.estado);
                return (
                  <TableRow key={t.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        {t.estado === 'bloqueada' && (
                          <Tooltip title={t.motivo_bloqueo ?? 'Bloqueada'}>
                            <BlockOutlined sx={{ fontSize: 15, color: 'error.main' }} />
                          </Tooltip>
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{t.titulo}</Typography>
                        {frena > 0 && (
                          <Chip size="small" color="error" variant="outlined"
                                label={`frena ${frena}`} sx={{ height: 18, fontSize: '0.65rem' }} />
                        )}
                      </Box>
                      {t.hito && (
                        <Typography variant="caption" color="text.secondary">{t.hito}</Typography>
                      )}
                    </TableCell>
                    <TableCell><ChipSemantico grupo="estadoTarea" valor={t.estado} /></TableCell>
                    <TableCell><ChipSemantico grupo="prioridad" valor={t.prioridad} /></TableCell>
                    <TableCell>
                      <Typography variant="body2">{t.responsable ?? '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2"
                                  sx={{ color: vencida ? 'error.main' : 'text.secondary', fontWeight: vencida ? 700 : 400 }}>
                        {t.fecha_vencimiento ? fmtDias(t.dias_para_vencer) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ minWidth: 90 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress variant="determinate" value={t.progreso_pct}
                                        sx={{ flexGrow: 1, minWidth: 40 }} />
                        <Typography variant="caption">{t.progreso_pct}%</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
        {/* Asuntos */}
        <Card>
          <CardContent>
            <Typography variant="h4" sx={{ mb: 1 }}>Asuntos</Typography>
            <Stack divider={<Divider />}>
              {abiertos.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No hay asuntos abiertos.
                </Typography>
              )}
              {abiertos.map((a) => (
                <Box key={a.id} sx={{ py: 1.25 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ChipSemantico grupo="prioridad" valor={a.severidad}
                                   etiqueta={a.severidad === 'critica' ? 'crítica' : a.severidad} />
                    <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
                      {a.titulo}
                    </Typography>
                    <ChipSemantico grupo="estadoAsunto" valor={a.estado} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {[a.codigo, a.categoria, `${a.dias_abierto} días abierto`,
                      a.asignado_a && `→ ${a.asignado_a}`].filter(Boolean).join(' · ')}
                    {Boolean(a.es_recurrente) && ' · recurrente'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Equipo y habilidades */}
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1 }}>Involucrados</Typography>
              <Stack divider={<Divider />}>
                {equipo.map((m) => (
                  <Box key={m.persona_id} sx={{ py: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        <Link href={`/personas/${m.persona_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {m.nombre}
                        </Link>
                      </Typography>
                      <Tooltip title="Tareas abiertas aquí / en todo el portafolio">
                        <Typography variant="caption" color="text.secondary">
                          {m.tareas_abiertas} / {m.carga_total_proyectos}
                        </Typography>
                      </Tooltip>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {[m.rol, m.asignacion_pct !== null && `${m.asignacion_pct}%`]
                        .filter(Boolean).join(' · ')}
                    </Typography>
                    {m.fortalezas && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'primary.main' }}>
                        {m.fortalezas}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          {skills.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 1 }}>Habilidades requeridas</Typography>
                <Stack spacing={0.75}>
                  {skills.map((s) => (
                    <Box key={s.nombre} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 7, height: 7, borderRadius: '50%',
                        bgcolor: s.cubierta ? 'success.main' : 'error.main',
                      }} />
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>{s.nombre}</Typography>
                      <Chip size="small" variant="outlined" label={`nivel ${s.nivel_minimo}`} />
                      <Typography variant="caption" color="text.secondary">{s.criticidad}</Typography>
                    </Box>
                  ))}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Verde = alguien del equipo la cubre al nivel pedido.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}
