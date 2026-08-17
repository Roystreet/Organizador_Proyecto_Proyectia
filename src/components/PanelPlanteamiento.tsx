'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  Divider, FormControlLabel, LinearProgress, Stack, Tooltip, Typography,
} from '@mui/material';
import MapOutlined from '@mui/icons-material/MapOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import PlaylistAddOutlined from '@mui/icons-material/PlaylistAddOutlined';
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined';
import ChipSemantico from './ChipSemantico';
import Seccion from './SeccionColapsable';
import {
  aceptarPropuestaPlanteamiento, aceptarTareasSugeridas,
} from '@/lib/acciones/propuestasIa';
import type {
  RespuestaPlanteamientoProyecto, RespuestaTareasSugeridas,
} from '@/lib/ai/tipos';

interface RespuestaMotor<T> {
  analisis_id: number;
  datos: T;
  desde_cache: boolean;
  modo: 'real' | 'simulado';
  modelo: string;
  latencia_ms: number;
}

/**
 * Flujo crear-con-IA: genera el planteamiento (o las tareas según estado),
 * muestra la propuesta con checkboxes y SOLO inserta lo seleccionado.
 */
export default function PanelPlanteamiento({
  proyectoId,
  autoGenerar,
  inicial,
}: {
  proyectoId: number;
  /** true cuando se llega desde crear proyecto (?planteamiento=auto). */
  autoGenerar: boolean;
  inicial: { analisis_id: number; datos: RespuestaPlanteamientoProyecto; modelo: string } | null;
}) {
  const router = useRouter();
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [r, setR] = React.useState<RespuestaMotor<RespuestaPlanteamientoProyecto> | null>(
    inicial
      ? { ...inicial, desde_cache: true, modo: inicial.modelo === 'reglas-locales' ? 'simulado' : 'real', latencia_ms: 0 }
      : null,
  );

  // Selección de la propuesta: todo marcado por defecto.
  const [hitosMarcados, setHitosMarcados] = React.useState<Set<number>>(new Set());
  const [tareasMarcadas, setTareasMarcadas] = React.useState<Set<number>>(new Set());
  const [aplicarObjetivo, setAplicarObjetivo] = React.useState(true);
  // Marcado por defecto: antes venía apagado porque pisaba `descripcion`.
  const [aplicarResumen, setAplicarResumen] = React.useState(true);
  const [insertando, setInsertando] = React.useState(false);
  const [insertado, setInsertado] = React.useState<string | null>(null);

  // Sugerencia de tareas según el estado actual (segundo análisis del panel).
  const [st, setSt] = React.useState<RespuestaMotor<RespuestaTareasSugeridas> | null>(null);
  const [stMarcadas, setStMarcadas] = React.useState<Set<number>>(new Set());
  const [stCargando, setStCargando] = React.useState(false);
  const [stInsertando, setStInsertando] = React.useState(false);
  const [stInsertado, setStInsertado] = React.useState<string | null>(null);

  const marcarTodo = React.useCallback((datos: RespuestaPlanteamientoProyecto) => {
    setHitosMarcados(new Set(datos.hitos_propuestos.map((h) => h.ref)));
    setTareasMarcadas(new Set(datos.tareas_propuestas.map((_, i) => i)));
    setInsertado(null);
  }, []);

  React.useEffect(() => {
    if (inicial) marcarTodo(inicial.datos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generar(forzar: boolean) {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/ia/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId, tipo: 'planteamiento_proyecto', forzar }),
      });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error ?? 'Falló el planteamiento');
      setR(cuerpo);
      marcarTodo(cuerpo.datos);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }

  // Al llegar desde el formulario de creación, se dispara solo.
  const autoDisparado = React.useRef(false);
  React.useEffect(() => {
    if (autoGenerar && !inicial && !autoDisparado.current) {
      autoDisparado.current = true;
      void generar(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerar]);

  async function insertarSeleccion() {
    if (!r) return;
    setInsertando(true);
    setError(null);
    try {
      const resultado = await aceptarPropuestaPlanteamiento({
        analisisId: r.analisis_id,
        proyectoId,
        aplicarObjetivo,
        aplicarResumen,
        hitosRef: [...hitosMarcados],
        tareasIndices: [...tareasMarcadas],
      });
      if (!resultado.ok) throw new Error(resultado.mensaje ?? 'No se pudo insertar la propuesta');
      setInsertado(
        `Se crearon ${resultado.hitosCreados} hito(s) y ${resultado.tareasCreadas} tarea(s).` +
        (resultado.mensaje ? ` ${resultado.mensaje}` : ''),
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setInsertando(false);
    }
  }

  async function sugerir(forzar: boolean) {
    setStCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/ia/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId, tipo: 'tareas_sugeridas', forzar }),
      });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error ?? 'Falló la sugerencia de tareas');
      setSt(cuerpo);
      setStMarcadas(new Set((cuerpo.datos as RespuestaTareasSugeridas).tareas.map((_, i) => i)));
      setStInsertado(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setStCargando(false);
    }
  }

  async function insertarSugeridas() {
    if (!st) return;
    setStInsertando(true);
    setError(null);
    try {
      const resultado = await aceptarTareasSugeridas({
        analisisId: st.analisis_id,
        proyectoId,
        indices: [...stMarcadas],
      });
      if (!resultado.ok) throw new Error(resultado.mensaje ?? 'No se pudieron insertar las tareas');
      setStInsertado(`Se crearon ${resultado.tareasCreadas} tarea(s).`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setStInsertando(false);
    }
  }

  const alternar = (conjunto: Set<number>, valor: number, setter: (s: Set<number>) => void) => {
    const nuevo = new Set(conjunto);
    if (nuevo.has(valor)) nuevo.delete(valor);
    else nuevo.add(valor);
    setter(nuevo);
  };

  const d = r?.datos;
  const tareasPorHito = React.useMemo(() => {
    const mapa = new Map<number | null, { indice: number; tarea: RespuestaPlanteamientoProyecto['tareas_propuestas'][number] }[]>();
    d?.tareas_propuestas.forEach((tarea, indice) => {
      const clave = tarea.hito_ref;
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push({ indice, tarea });
    });
    return mapa;
  }, [d]);

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <MapOutlined sx={{ color: 'secondary.main' }} />
          <Typography variant="h4" sx={{ flexGrow: 1 }}>Planteamiento y roadmap</Typography>
          {r && (
            <Tooltip title={`${r.modelo}${r.latencia_ms ? ` · ${r.latencia_ms} ms` : ''}`}>
              <Chip size="small" variant="outlined"
                    label={r.modo === 'simulado' ? 'reglas locales' : r.modelo} />
            </Tooltip>
          )}
          <Button
            size="small"
            variant={r ? 'text' : 'contained'}
            color="secondary"
            startIcon={cargando ? <CircularProgress size={14} /> : r ? <RefreshOutlined /> : <MapOutlined />}
            onClick={() => generar(Boolean(r))}
            disabled={cargando}
          >
            {cargando ? 'Generando…' : r ? 'Volver a generar' : 'Generar planteamiento'}
          </Button>
          <Button
            size="small"
            startIcon={stCargando ? <CircularProgress size={14} /> : <TipsAndUpdatesOutlined />}
            onClick={() => sugerir(Boolean(st))}
            disabled={stCargando}
          >
            {stCargando ? 'Sugiriendo…' : 'Sugerir tareas según estado'}
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!r && !st && !cargando && !stCargando && (
          <Typography variant="body2" color="text.secondary">
            La IA lee la descripción del proyecto y propone el planteamiento, de qué trata,
            un roadmap de hitos y su primer desglose de tareas. Tú decides qué se inserta.
          </Typography>
        )}

        {(cargando && !d) || (stCargando && !st) ? <LinearProgress sx={{ mt: 1, mb: 2 }} /> : null}

        {d && (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="overline" color="text.secondary">De qué trata</Typography>
              <Typography variant="body2">{d.de_que_trata}</Typography>
            </Box>

            <Seccion titulo="Planteamiento">
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{d.planteamiento}</Typography>
              {d.supuestos.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  Supuestos: {d.supuestos.join(' · ')}
                </Typography>
              )}
            </Seccion>

            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.sutil' }}>
              <FormControlLabel
                control={<Checkbox size="small" checked={aplicarObjetivo}
                                   onChange={(e) => setAplicarObjetivo(e.target.checked)} />}
                label={
                  <Typography variant="body2">
                    <strong>Aplicar objetivo sugerido:</strong> {d.objetivo_sugerido}
                  </Typography>
                }
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={aplicarResumen}
                                   onChange={(e) => setAplicarResumen(e.target.checked)} />}
                label={
                  <Typography variant="body2">
                    <strong>Guardar el resumen «de qué trata»</strong>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {' '}· se guarda aparte, tu descripción no se toca
                    </Typography>
                  </Typography>
                }
              />
            </Box>

            {/* Roadmap propuesto: hitos con sus tareas anidadas */}
            <Box>
              <Typography variant="overline" color="text.secondary">
                Roadmap propuesto · marca qué insertar
              </Typography>
              <Stack spacing={1.25} sx={{ mt: 0.5 }}>
                {[...d.hitos_propuestos].sort((a, b) => a.orden - b.orden).map((h) => (
                  <Box key={h.ref}
                       sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider',
                             opacity: hitosMarcados.has(h.ref) ? 1 : 0.55 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Checkbox size="small" checked={hitosMarcados.has(h.ref)}
                                onChange={() => alternar(hitosMarcados, h.ref, setHitosMarcados)} />
                      <Typography variant="body2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                        {h.orden}. {h.nombre}
                      </Typography>
                      {h.duracion_dias_estimada !== null && (
                        <Chip size="small" variant="outlined" label={`~${h.duracion_dias_estimada} días`} />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
                      {h.descripcion} · Entregable: {h.entregable}
                    </Typography>
                    <Stack spacing={0.25} sx={{ mt: 0.75, ml: 4 }}>
                      {(tareasPorHito.get(h.ref) ?? []).map(({ indice, tarea }) => (
                        <Box key={indice} sx={{ display: 'flex', alignItems: 'center', gap: 0.5,
                                                opacity: tareasMarcadas.has(indice) ? 1 : 0.5 }}>
                          <Checkbox size="small" checked={tareasMarcadas.has(indice)}
                                    onChange={() => alternar(tareasMarcadas, indice, setTareasMarcadas)} />
                          <Typography variant="body2" sx={{ flexGrow: 1 }}>{tarea.titulo}</Typography>
                          <ChipSemantico grupo="prioridad" valor={tarea.prioridad} />
                          {tarea.estimacion_horas !== null && (
                            <Typography variant="caption" color="text.secondary">
                              {tarea.estimacion_horas} h
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                ))}

                {(tareasPorHito.get(null) ?? []).length > 0 && (
                  <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Tareas transversales</Typography>
                    <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                      {(tareasPorHito.get(null) ?? []).map(({ indice, tarea }) => (
                        <Box key={indice} sx={{ display: 'flex', alignItems: 'center', gap: 0.5,
                                                opacity: tareasMarcadas.has(indice) ? 1 : 0.5 }}>
                          <Checkbox size="small" checked={tareasMarcadas.has(indice)}
                                    onChange={() => alternar(tareasMarcadas, indice, setTareasMarcadas)} />
                          <Typography variant="body2" sx={{ flexGrow: 1 }}>{tarea.titulo}</Typography>
                          <ChipSemantico grupo="prioridad" valor={tarea.prioridad} />
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>

            {d.preguntas_por_resolver.length > 0 && (
              <Alert severity="info" variant="outlined">
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                  Preguntas por resolver
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {d.preguntas_por_resolver.map((q, i) => (
                    <Typography component="li" variant="caption" key={i}>{q}</Typography>
                  ))}
                </Box>
              </Alert>
            )}

            {insertado
              ? <Alert severity="success">{insertado}</Alert>
              : (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    {hitosMarcados.size} hito(s) y {tareasMarcadas.size} tarea(s) seleccionados ·
                    confianza {Math.round(d.confianza * 100)}%
                  </Typography>
                  <Button
                    variant="contained" disabled={insertando || (hitosMarcados.size === 0 && tareasMarcadas.size === 0 && !aplicarObjetivo && !aplicarResumen)}
                    startIcon={insertando ? <CircularProgress size={14} /> : <PlaylistAddOutlined />}
                    onClick={insertarSeleccion}
                  >
                    {insertando ? 'Insertando…' : 'Insertar seleccionados'}
                  </Button>
                </Box>
              )}
          </Stack>
        )}

        {/* Tareas sugeridas según el estado actual */}
        {st && (
          <Box sx={{ mt: d ? 3 : 0 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="overline" color="text.secondary">
              Tareas sugeridas según el estado
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>{st.datos.resumen_contexto}</Typography>
            <Stack spacing={1}>
              {st.datos.tareas.map((t, i) => (
                <Box key={i}
                     sx={{ p: 1.25, borderRadius: 2, border: 1, borderColor: 'divider',
                           bgcolor: 'background.sutil',
                           opacity: stMarcadas.has(i) ? 1 : 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <Checkbox size="small" checked={stMarcadas.has(i)}
                              onChange={() => alternar(stMarcadas, i, setStMarcadas)} />
                    <Typography variant="body2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                      {t.titulo}
                    </Typography>
                    <ChipSemantico grupo="prioridad" valor={t.prioridad} />
                    <Chip size="small" variant="outlined" label={t.tipo} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                    {t.descripcion}
                  </Typography>
                  <Typography variant="caption"
                              sx={{ display: 'block', ml: 4, mt: 0.25, fontStyle: 'italic',
                                    color: 'text.disabled' }}>
                    Por qué: {t.justificacion}
                  </Typography>
                </Box>
              ))}
              {st.datos.tareas.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No hay tareas nuevas que sugerir con el estado actual.
                </Typography>
              )}
            </Stack>
            {st.datos.tareas.length > 0 && (
              stInsertado
                ? <Alert severity="success" sx={{ mt: 1.5 }}>{stInsertado}</Alert>
                : (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                    <Button
                      variant="contained" size="small"
                      disabled={stInsertando || stMarcadas.size === 0}
                      startIcon={stInsertando ? <CircularProgress size={14} /> : <PlaylistAddOutlined />}
                      onClick={insertarSugeridas}
                    >
                      {stInsertando ? 'Insertando…' : `Insertar ${stMarcadas.size} tarea(s)`}
                    </Button>
                  </Box>
                )
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
