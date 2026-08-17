'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider,
  FormControlLabel, LinearProgress, Stack, Tooltip, Typography,
} from '@mui/material';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import ChipSemantico from '../ChipSemantico';
import { aceptarPerfilesRequeridos } from '@/lib/acciones/perfilesProyecto';
import type { RespuestaPerfilesRequeridosValidada } from '@/lib/ai/validacion';

type Datos = RespuestaPerfilesRequeridosValidada;

/**
 * Qué perfiles hacen falta para el proyecto y quién del directorio encaja.
 *
 * La salida es accionable: las habilidades se registran como requeridas del
 * proyecto y los candidatos marcados se suman al equipo. Nada se escribe sin
 * que el usuario lo marque.
 */
export default function PasoPerfiles({
  proyectoId,
  nombrePorPersona,
  inicial,
}: {
  proyectoId: number;
  nombrePorPersona: Map<number, string>;
  inicial: { analisis_id: number; datos: Datos; modelo: string } | null;
}) {
  const router = useRouter();
  const [cargando, setCargando] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [guardado, setGuardado] = React.useState<string | null>(null);
  const [r, setR] = React.useState(inicial);
  const [perfiles, setPerfiles] = React.useState<Set<number>>(new Set());
  const [candidatos, setCandidatos] = React.useState<Set<string>>(new Set());
  const [crearNuevas, setCrearNuevas] = React.useState(false);

  const marcarTodo = React.useCallback((d: Datos) => {
    setPerfiles(new Set(d.perfiles.map((_, i) => i)));
    setCandidatos(new Set());   // sumar gente al equipo se decide a mano
    setGuardado(null);
  }, []);

  React.useEffect(() => {
    if (inicial) marcarTodo(inicial.datos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disparado = React.useRef(false);
  React.useEffect(() => {
    if (!inicial && !disparado.current) {
      disparado.current = true;
      void generar(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generar(forzar: boolean) {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/ia/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId, tipo: 'perfiles_requeridos', forzar }),
      });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error ?? 'No se pudieron generar los perfiles');
      setR(cuerpo);
      marcarTodo(cuerpo.datos);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }

  async function guardar() {
    if (!r) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await aceptarPerfilesRequeridos({
        analisisId: r.analisis_id,
        proyectoId,
        perfilesIndices: [...perfiles],
        candidatos: [...candidatos].map((k) => {
          const [i, p] = k.split(':').map(Number);
          return { perfilIndice: i, personaId: p };
        }),
        crearHabilidadesNuevas: crearNuevas,
      });
      if (!res.ok) throw new Error(res.mensaje ?? 'No se pudieron guardar los perfiles');
      setGuardado(
        `${res.habilidades} habilidad(es) registradas como requeridas`
        + (res.personas > 0 ? ` y ${res.personas} persona(s) sumadas al equipo.` : '.')
        + (res.mensaje ? ` ${res.mensaje}` : ''),
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setGuardando(false);
    }
  }

  const d = r?.datos;
  const alternar = <T,>(set: Set<T>, v: T, fn: (s: Set<T>) => void) => {
    const c = new Set(set);
    if (c.has(v)) c.delete(v); else c.add(v);
    fn(c);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        <GroupsOutlined fontSize="small" color="primary" />
        <Typography variant="h4">Perfiles que necesitas</Typography>
        {r && (
          <Chip size="small" variant="outlined"
                label={r.modelo === 'reglas-locales' ? 'reglas locales' : r.modelo} />
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" variant="outlined" onClick={() => generar(true)} disabled={cargando}>
          {cargando ? 'Analizando…' : 'Volver a analizar'}
        </Button>
      </Box>

      {cargando && !d && <LinearProgress />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {guardado && <Alert severity="success" sx={{ mb: 2 }}>{guardado}</Alert>}

      {d && (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">{d.resumen_necesidad}</Typography>

          {d.perfiles.map((p, i) => (
            <Box key={i} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider',
                               borderRadius: 2, opacity: perfiles.has(i) ? 1 : 0.55 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                <Checkbox size="small" checked={perfiles.has(i)}
                          onChange={() => alternar(perfiles, i, setPerfiles)} sx={{ mt: -0.5 }} />
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{p.rol}</Typography>
                    <Chip size="small" variant="outlined" label={p.seniority.replace('_', ' ')}
                          sx={{ height: 19, fontSize: '0.65rem' }} />
                    <Chip size="small" label={p.criticidad} sx={{ height: 19, fontSize: '0.65rem' }} />
                    {p.cantidad > 1 && (
                      <Chip size="small" label={`×${p.cantidad}`} sx={{ height: 19, fontSize: '0.65rem' }} />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">{p.proposito}</Typography>

                  {p.habilidades.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
                      {p.habilidades.map((h, j) => (
                        <Tooltip key={j} title={`Nivel mínimo ${h.nivel_minimo}/5 · ${h.criticidad}`}>
                          <Chip size="small" variant="outlined"
                                label={`${h.nombre} · ${h.nivel_minimo}`}
                                color={h.slug_existente === null ? 'warning' : 'default'} />
                        </Tooltip>
                      ))}
                    </Box>
                  )}

                  {p.candidatos.length > 0 ? (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="overline" color="text.secondary">
                        Del directorio
                      </Typography>
                      {p.candidatos.map((c) => {
                        const clave = `${i}:${c.persona_id}`;
                        return (
                          <Box key={clave} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Checkbox size="small" checked={candidatos.has(clave)}
                                      onChange={() => alternar(candidatos, clave, setCandidatos)} />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2">
                                {nombrePorPersona.get(c.persona_id) ?? `Persona ${c.persona_id}`}
                                <Typography component="span" variant="caption" color="text.secondary">
                                  {' '}· ajuste {c.puntaje_ajuste}/100 · carga {c.riesgo_sobrecarga}
                                </Typography>
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {c.por_que}
                                {c.brechas.length > 0 && ` — le falta: ${c.brechas.join('; ')}`}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                      Nadie del directorio encaja con este perfil.
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          ))}

          {d.perfiles.some((p) => p.habilidades.some((h) => h.slug_existente === null)) && (
            <FormControlLabel
              control={<Checkbox size="small" checked={crearNuevas}
                                 onChange={(e) => setCrearNuevas(e.target.checked)} />}
              label={
                <Typography variant="body2">
                  Crear en el catálogo las habilidades marcadas en ámbar
                  <Typography component="span" variant="caption" color="text.secondary">
                    {' '}· si no, se omiten
                  </Typography>
                </Typography>
              }
            />
          )}

          {d.brechas_del_directorio.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="overline" color="text.secondary">
                  Lo que el directorio no cubre
                </Typography>
                {d.brechas_del_directorio.map((b, i) => (
                  <Box key={i} sx={{ mt: 0.5 }}>
                    <Typography variant="body2">
                      <strong>{b.habilidad}</strong> (nivel {b.nivel_requerido}) — {b.situacion}
                    </Typography>
                    <ChipSemantico grupo="prioridad" valor="media" etiqueta={b.sugerencia} />
                  </Box>
                ))}
              </Box>
            </>
          )}

          {d.datos_faltantes.length > 0 && (
            <Alert severity="info" variant="outlined">
              {d.datos_faltantes.map((x, i) => (
                <Typography key={i} variant="caption" sx={{ display: 'block' }}>· {x}</Typography>
              ))}
            </Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={guardar}
                    disabled={guardando || perfiles.size === 0}
                    startIcon={guardando ? <CircularProgress size={16} /> : undefined}>
              {guardando ? 'Guardando…' : 'Guardar perfiles'}
            </Button>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
