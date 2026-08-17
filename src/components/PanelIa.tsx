'use client';

import * as React from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  LinearProgress, Stack, Typography, Tooltip, IconButton, Collapse,
} from '@mui/material';
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlineOutlined';
import HighlightOffOutlined from '@mui/icons-material/HighlightOffOutlined';
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined';
import ChipSemantico from './ChipSemantico';
import PuntoSalud from './PuntoSalud';
import type { RespuestaSaludProyecto } from '@/lib/ai/tipos';

interface Respuesta {
  analisis_id: number;
  recomendacion_ids: number[];
  datos: RespuestaSaludProyecto;
  desde_cache: boolean;
  modo: 'real' | 'simulado';
  modelo: string;
  latencia_ms: number;
  referencias_descartadas: number;
}

export default function PanelIa({
  proyectoId,
  inicial,
}: {
  proyectoId: number;
  inicial: {
    analisis_id: number;
    recomendacion_ids: number[];
    datos: RespuestaSaludProyecto;
    modelo: string;
  } | null;
}) {
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [r, setR] = React.useState<Respuesta | null>(
    inicial
      ? { ...inicial, desde_cache: true, modo: inicial.modelo === 'reglas-locales' ? 'simulado' : 'real', latencia_ms: 0, referencias_descartadas: 0 }
      : null,
  );
  const [feedback, setFeedback] = React.useState<Record<number, string>>({});

  async function analizar(forzar: boolean) {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/ia/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId, forzar }),
      });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error ?? 'Falló el análisis');
      setR(cuerpo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }

  /**
   * `indice` es la posición en la lista; el id real viene de recomendacion_ids,
   * que el backend devuelve alineado con datos.recomendaciones.
   */
  async function marcar(indice: number, estado: 'aceptada' | 'descartada') {
    const id = r?.recomendacion_ids?.[indice];
    setFeedback((f) => ({ ...f, [indice]: estado }));
    if (!id) return;
    await fetch(`/api/ia/recomendaciones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    }).catch(() => {});
  }

  const d = r?.datos;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <AutoAwesomeOutlined sx={{ color: 'primary.main' }} />
          <Typography variant="h4" sx={{ flexGrow: 1 }}>Análisis de IA</Typography>
          {r && (
            <Tooltip title={`${r.modelo}${r.latencia_ms ? ` · ${r.latencia_ms} ms` : ''}`}>
              <Chip size="small" variant="outlined"
                    label={r.modo === 'simulado' ? 'reglas locales' : r.modelo} />
            </Tooltip>
          )}
          <Button
            size="small"
            variant={r ? 'text' : 'contained'}
            startIcon={cargando ? <CircularProgress size={14} /> : r ? <RefreshOutlined /> : <AutoAwesomeOutlined />}
            onClick={() => analizar(Boolean(r))}
            disabled={cargando}
          >
            {cargando ? 'Analizando…' : r ? 'Volver a analizar' : 'Analizar proyecto'}
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!r && !cargando && (
          <Typography variant="body2" color="text.secondary">
            Todavía no se ha analizado este proyecto. El análisis cruza métricas, bloqueos,
            carga del equipo y patrones ya detectados en el portafolio.
          </Typography>
        )}

        {d && (
          <Stack spacing={2.5}>
            {/* Puntaje y resumen */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <PuntoSalud salud={d.semaforo} tam={14} />
                <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1 }}>
                  {d.puntaje_salud}
                </Typography>
                <Typography variant="caption" color="text.secondary">/100</Typography>
              </Box>
              <Box sx={{ flexGrow: 1, minWidth: 240 }}>
                <Typography variant="body2">{d.resumen_ejecutivo}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Confianza del análisis: {Math.round(d.confianza * 100)}%
                </Typography>
              </Box>
            </Box>

            {/* Recomendaciones */}
            {d.recomendaciones.length > 0 && (
              <Box>
                <Typography variant="overline" color="text.secondary">Recomendaciones</Typography>
                <Stack spacing={1} sx={{ mt: 0.5 }}>
                  {d.recomendaciones.map((rec, i) => {
                    const marcada = feedback[i];
                    return (
                      <Box
                        key={i}
                        sx={{
                          p: 1.5, borderRadius: 2,
                          border: 1, borderColor: 'divider',
                          opacity: marcada === 'descartada' ? 0.45 : 1,
                          bgcolor: 'background.sutil',
                        }}
                      >
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                          <ChipSemantico grupo="prioridad" valor={rec.prioridad} />
                          <Typography variant="body2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                            {rec.titulo}
                          </Typography>
                          <Tooltip title="Marcar como aceptada">
                            <span>
                              <IconButton size="small" disabled={Boolean(marcada)}
                                          color={marcada === 'aceptada' ? 'success' : 'default'}
                                          onClick={() => marcar(i, 'aceptada')}>
                                <CheckCircleOutline fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Descartar">
                            <span>
                              <IconButton size="small" disabled={Boolean(marcada)}
                                          onClick={() => marcar(i, 'descartada')}>
                                <HighlightOffOutlined fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                        <Typography variant="body2" color="text.secondary">{rec.descripcion}</Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, fontStyle: 'italic', color: 'text.disabled' }}>
                          Por qué: {rec.justificacion}
                        </Typography>
                        <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }}>
                          <Chip size="small" variant="outlined" label={`impacto ${rec.impacto_estimado}`} />
                          <Chip size="small" variant="outlined" label={`esfuerzo ${rec.esfuerzo_estimado}`} />
                          {rec.plazo_sugerido_dias !== null && (
                            <Chip size="small" variant="outlined" label={`${rec.plazo_sugerido_dias} días`} />
                          )}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            )}

            {/* Diagnóstico */}
            {d.diagnostico.length > 0 && (
              <Seccion titulo="Diagnóstico">
                <Stack divider={<Divider />}>
                  {d.diagnostico.map((x, i) => (
                    <Box key={i} sx={{ py: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip size="small" label={x.area} variant="outlined" />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{x.hallazgo}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {x.evidencia.join(' · ')}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Seccion>
            )}

            {/* Riesgos */}
            {d.riesgos.length > 0 && (
              <Seccion titulo={`Riesgos (${d.riesgos.length})`}>
                <Stack divider={<Divider />}>
                  {d.riesgos.map((x, i) => (
                    <Box key={i} sx={{ py: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{x.titulo}</Typography>
                      <Typography variant="body2" color="text.secondary">{x.descripcion}</Typography>
                      <Typography variant="caption" sx={{ color: 'primary.main' }}>
                        Mitigación: {x.mitigacion}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Seccion>
            )}

            {/* Plan de mejora */}
            {d.plan_mejora.pasos.length > 0 && (
              <Seccion titulo={`Plan de mejora · ${d.plan_mejora.horizonte_dias} días`}>
                <Stack spacing={1}>
                  {d.plan_mejora.pasos.map((p) => (
                    <Box key={p.orden} sx={{ display: 'flex', gap: 1.25 }}>
                      <Box sx={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        bgcolor: 'primary.main', color: 'primary.contrastText',
                        display: 'grid', placeItems: 'center', fontSize: '0.7rem', fontWeight: 700,
                      }}>
                        {p.orden}
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.accion}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.resultado_esperado}
                          {p.dias_estimados !== null && ` · ${p.dias_estimados} días`}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Seccion>
            )}

            {/* Preguntas al equipo */}
            {d.preguntas_para_el_equipo.length > 0 && (
              <Seccion titulo="Qué preguntarle al equipo">
                <Stack spacing={1}>
                  {d.preguntas_para_el_equipo.map((q, i) => (
                    <Box key={i}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>«{q.pregunta}»</Typography>
                      <Typography variant="caption" color="text.secondary">{q.motivo}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Seccion>
            )}

            {d.datos_faltantes.length > 0 && (
              <Alert severity="info" variant="outlined">
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                  Lo que habría mejorado este análisis
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {d.datos_faltantes.map((x, i) => (
                    <Typography component="li" variant="caption" key={i}>{x}</Typography>
                  ))}
                </Box>
              </Alert>
            )}
          </Stack>
        )}

        {cargando && !d && <LinearProgress sx={{ mt: 2 }} />}
      </CardContent>
    </Card>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = React.useState(true);
  return (
    <Box>
      <Box
        onClick={() => setAbierto((v) => !v)}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none' }}
      >
        <Typography variant="overline" color="text.secondary">{titulo}</Typography>
        <ExpandMoreOutlined
          fontSize="small"
          sx={{ color: 'text.disabled', transform: abierto ? 'rotate(180deg)' : 'none', transition: '.2s' }}
        />
      </Box>
      <Collapse in={abierto}>{children}</Collapse>
    </Box>
  );
}
