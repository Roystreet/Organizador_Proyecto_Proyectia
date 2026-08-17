'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  Divider, FormControlLabel, LinearProgress, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import PsychologyOutlined from '@mui/icons-material/PsychologyOutlined';
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import Seccion from './SeccionColapsable';
import { generarPerfilPersona, aceptarPerfilPersona } from '@/lib/acciones/perfilPersona';
import type { RespuestaPerfilCvValidada } from '@/lib/ai/validacion';

type Datos = RespuestaPerfilCvValidada;

/** Sets de índices marcados, uno por sección de la propuesta. */
interface Seleccion {
  habilidades: Set<number>;
  sectores: Set<number>;
  experiencias: Set<number>;
  fortalezas: Set<number>;
  aportes: Set<number>;
  preguntas: Set<number>;
  mejoras: Set<number>;
}

const todos = (n: number) => new Set(Array.from({ length: n }, (_, i) => i));

/**
 * Construye el perfil de una persona con IA a partir de texto pegado.
 *
 * Mismo contrato de confianza que el panel de planteamiento: la IA propone, el
 * usuario marca y solo entonces se escribe. Nada se guarda automáticamente.
 */
export default function PanelPerfilPersona({
  personaId,
  autoAbrir,
  inicial,
}: {
  personaId: number;
  /** true al llegar desde crear persona (?perfil=auto): abre el panel listo para pegar. */
  autoAbrir: boolean;
  inicial: { analisis_id: number; datos: Datos; modelo: string } | null;
}) {
  const router = useRouter();

  const [texto, setTexto] = React.useState('');
  const [notas, setNotas] = React.useState('');
  const [abierto, setAbierto] = React.useState(autoAbrir || Boolean(inicial));
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [guardando, setGuardando] = React.useState(false);
  const [guardado, setGuardado] = React.useState<string | null>(null);

  const [r, setR] = React.useState<{ analisis_id: number; datos: Datos; modelo: string } | null>(inicial);
  const [sel, setSel] = React.useState<Seleccion | null>(null);
  const [crearHabilidades, setCrearHabilidades] = React.useState(false);
  const [crearSectores, setCrearSectores] = React.useState(false);
  const [aplicarResumen, setAplicarResumen] = React.useState(true);
  const [aplicarBasicos, setAplicarBasicos] = React.useState(true);

  const marcarTodo = React.useCallback((d: Datos) => {
    setSel({
      habilidades: todos(d.habilidades.length),
      sectores: todos(d.sectores.length),
      experiencias: todos(d.experiencias.length),
      fortalezas: todos(d.fortalezas.length),
      aportes: todos(d.aportes.length),
      preguntas: todos(d.preguntas_sugeridas.length),
      mejoras: todos(d.areas_mejora.length),
    });
    setGuardado(null);
  }, []);

  React.useEffect(() => {
    if (inicial) marcarTodo(inicial.datos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alternar = (clave: keyof Seleccion, i: number) => {
    setSel((s) => {
      if (!s) return s;
      const copia = new Set(s[clave]);
      if (copia.has(i)) copia.delete(i); else copia.add(i);
      return { ...s, [clave]: copia };
    });
  };

  async function analizar(forzar: boolean) {
    setCargando(true);
    setError(null);
    try {
      const res = await generarPerfilPersona({ personaId, texto, notas, forzar });
      if (!res.ok || !res.datos || !res.analisis_id) {
        throw new Error(res.mensaje ?? 'No se pudo construir el perfil');
      }
      setR({ analisis_id: res.analisis_id, datos: res.datos, modelo: res.modelo ?? '' });
      marcarTodo(res.datos);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }

  async function guardar() {
    if (!r || !sel) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await aceptarPerfilPersona({
        analisisId: r.analisis_id,
        personaId,
        aplicarResumen,
        aplicarDatosBasicos: aplicarBasicos,
        habilidadesIndices: [...sel.habilidades],
        sectoresIndices: [...sel.sectores],
        experienciasIndices: [...sel.experiencias],
        fortalezasIndices: [...sel.fortalezas],
        aportesIndices: [...sel.aportes],
        preguntasIndices: [...sel.preguntas],
        mejorasIndices: [...sel.mejoras],
        crearHabilidadesNuevas: crearHabilidades,
        crearSectoresNuevos: crearSectores,
      });
      if (!res.ok) throw new Error(res.mensaje ?? 'No se pudo guardar el perfil');
      setGuardado(
        `Guardado: ${res.habilidades} habilidad(es), ${res.sectores} sector(es), ` +
        `${res.experiencias} experiencia(s), ${res.insumos} insumo(s).` +
        (res.mensaje ? ` ${res.mensaje}` : ''),
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setGuardando(false);
    }
  }

  const d = r?.datos;
  const simulado = r?.modelo === 'reglas-locales';

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
          <PsychologyOutlined fontSize="small" color="primary" />
          <Typography variant="h4">Perfil con IA</Typography>
          {r && (
            <Tooltip title={simulado ? 'Reglas locales, sin llamar al modelo' : `Modelo: ${r.modelo}`}>
              <Chip size="small" variant="outlined"
                    label={simulado ? 'reglas locales' : r.modelo} />
            </Tooltip>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {!abierto && (
            <Button size="small" variant="outlined" startIcon={<AutoAwesomeOutlined />}
                    onClick={() => setAbierto(true)}>
              {r ? 'Volver a perfilar' : 'Construir perfil'}
            </Button>
          )}
        </Box>

        {!abierto && !r && (
          <Typography variant="body2" color="text.secondary">
            Pega el CV o describe a esta persona y la IA arma su perfil: habilidades con
            nivel, sectores que cubre, experiencia, qué puede aportar y qué conviene
            preguntarle. Tú decides qué se guarda.
          </Typography>
        )}

        {abierto && (
          <Stack spacing={1.5}>
            <TextField
              label="Pega el CV o describe a la persona"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              multiline minRows={8} fullWidth
              placeholder="Puede ser un CV completo, un perfil de LinkedIn, o simplemente lo que sepas de esta persona: dónde ha trabajado, qué sabe hacer, en qué sector se mueve…"
              helperText="No hace falta que sea de tecnología: química, farmacia, logística, salud, legal… el vocabulario del texto manda."
            />
            <TextField
              label="Notas adicionales (opcional)"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              multiline minRows={2} fullWidth
              placeholder="Contexto que no está en el CV: cómo trabaja, con quién encaja, qué le interesa…"
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" onClick={() => analizar(Boolean(r))}
                      disabled={cargando || texto.trim().length < 40}
                      startIcon={cargando ? <CircularProgress size={16} /> : <AutoAwesomeOutlined />}>
                {cargando ? 'Analizando…' : r ? 'Volver a analizar' : 'Analizar'}
              </Button>
              {r && <Button variant="text" onClick={() => setAbierto(false)}>Ocultar</Button>}
            </Box>
          </Stack>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {guardado && <Alert severity="success" sx={{ mt: 2 }}>{guardado}</Alert>}
        {cargando && !d && <LinearProgress sx={{ mt: 2 }} />}

        {d && sel && (
          <Stack spacing={2} sx={{ mt: 2.5 }}>
            <Divider />

            <Box>
              <Typography variant="overline" color="text.secondary">Resumen</Typography>
              <Typography variant="body2">{d.perfil.resumen}</Typography>
            </Box>

            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.sutil' }}>
              <FormControlLabel
                control={<Checkbox size="small" checked={aplicarResumen}
                                   onChange={(e) => setAplicarResumen(e.target.checked)} />}
                label={<Typography variant="body2">Guardar este resumen en el perfil</Typography>}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={aplicarBasicos}
                                   onChange={(e) => setAplicarBasicos(e.target.checked)} />}
                label={
                  <Typography variant="body2">
                    Completar rol, seniority, años y ubicación
                    <Typography component="span" variant="caption" color="text.secondary">
                      {' '}· solo donde estén vacíos
                    </Typography>
                  </Typography>
                }
              />
            </Box>

            <ListaMarcable
              titulo={`Sectores que cubre (${d.sectores.length})`}
              elementos={d.sectores.map((s) => ({
                clave: s.nombre,
                principal: `${s.nombre} · nivel ${s.nivel}/5${s.es_principal ? ' · principal' : ''}`,
                secundario: s.evidencia,
                nuevo: s.slug_existente === null,
              }))}
              marcados={sel.sectores}
              alAlternar={(i) => alternar('sectores', i)}
            />

            <ListaMarcable
              titulo={`Habilidades (${d.habilidades.length})`}
              elementos={d.habilidades.map((h) => ({
                clave: h.nombre,
                principal: `${h.nombre} · nivel ${h.nivel}/5 · ${h.tipo}${h.es_fortaleza ? ' · fortaleza' : ''}`,
                secundario: h.evidencia,
                nuevo: h.slug_existente === null,
              }))}
              marcados={sel.habilidades}
              alAlternar={(i) => alternar('habilidades', i)}
            />

            {(d.sectores.some((s) => s.slug_existente === null)
              || d.habilidades.some((h) => h.slug_existente === null)) && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.sutil' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Lo marcado como «nuevo» no existe en el catálogo. Si no lo autorizas, se omite.
                </Typography>
                <FormControlLabel
                  control={<Checkbox size="small" checked={crearHabilidades}
                                     onChange={(e) => setCrearHabilidades(e.target.checked)} />}
                  label={<Typography variant="body2">Crear las habilidades nuevas en el catálogo</Typography>}
                />
                <FormControlLabel
                  control={<Checkbox size="small" checked={crearSectores}
                                     onChange={(e) => setCrearSectores(e.target.checked)} />}
                  label={<Typography variant="body2">Crear los sectores nuevos en el catálogo</Typography>}
                />
              </Box>
            )}

            {d.experiencias.length > 0 && (
              <ListaMarcable
                titulo={`Experiencia (${d.experiencias.length})`}
                elementos={d.experiencias.map((e) => ({
                  clave: `${e.empresa}-${e.cargo}`,
                  principal: `${e.cargo} · ${e.empresa}${e.es_actual ? ' · actual' : ''}`,
                  secundario: [e.industria, e.fecha_inicio, e.fecha_fin].filter(Boolean).join(' · ') || null,
                  nuevo: false,
                }))}
                marcados={sel.experiencias}
                alAlternar={(i) => alternar('experiencias', i)}
              />
            )}

            {d.fortalezas.length > 0 && (
              <ListaMarcable
                titulo={`Fortalezas (${d.fortalezas.length})`}
                elementos={d.fortalezas.map((f) => ({
                  clave: f.titulo, principal: f.titulo, secundario: f.detalle, nuevo: false,
                }))}
                marcados={sel.fortalezas}
                alAlternar={(i) => alternar('fortalezas', i)}
              />
            )}

            {d.aportes.length > 0 && (
              <ListaMarcable
                titulo={`Qué puede aportar (${d.aportes.length})`}
                elementos={d.aportes.map((a) => ({
                  clave: a.titulo, principal: a.titulo, secundario: a.detalle, nuevo: false,
                }))}
                marcados={sel.aportes}
                alAlternar={(i) => alternar('aportes', i)}
              />
            )}

            {d.preguntas_sugeridas.length > 0 && (
              <ListaMarcable
                titulo={`Qué preguntarle (${d.preguntas_sugeridas.length})`}
                elementos={d.preguntas_sugeridas.map((q) => ({
                  clave: q.pregunta, principal: q.pregunta, secundario: q.motivo, nuevo: false,
                }))}
                marcados={sel.preguntas}
                alAlternar={(i) => alternar('preguntas', i)}
              />
            )}

            {d.areas_mejora.length > 0 && (
              <ListaMarcable
                titulo={`A desarrollar (${d.areas_mejora.length})`}
                elementos={d.areas_mejora.map((m) => ({
                  clave: m.titulo, principal: m.titulo, secundario: m.detalle, nuevo: false,
                }))}
                marcados={sel.mejoras}
                alAlternar={(i) => alternar('mejoras', i)}
              />
            )}

            {d.datos_faltantes.length > 0 && (
              <Alert severity="info" variant="outlined">
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                  Lo que habría mejorado este perfil
                </Typography>
                {d.datos_faltantes.map((x, i) => (
                  <Typography key={i} variant="caption" sx={{ display: 'block' }}>· {x}</Typography>
                ))}
              </Alert>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                Confianza {Math.round(d.confianza_global * 100)}%
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Button variant="contained" onClick={guardar} disabled={guardando}
                      startIcon={guardando ? <CircularProgress size={16} /> : undefined}>
                {guardando ? 'Guardando…' : 'Guardar seleccionados'}
              </Button>
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

/** Lista de una sección con checkbox por elemento. */
function ListaMarcable({
  titulo, elementos, marcados, alAlternar,
}: {
  titulo: string;
  elementos: { clave: string; principal: string; secundario: string | null; nuevo: boolean }[];
  marcados: Set<number>;
  alAlternar: (i: number) => void;
}) {
  if (elementos.length === 0) return null;
  return (
    <Seccion titulo={titulo}>
      <Stack spacing={0.25} sx={{ mt: 0.5 }}>
        {elementos.map((e, i) => (
          <Box key={`${e.clave}-${i}`}
               sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5,
                     opacity: marcados.has(i) ? 1 : 0.55 }}>
            <Checkbox size="small" checked={marcados.has(i)} onChange={() => alAlternar(i)}
                      sx={{ mt: -0.25 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {e.principal}
                {e.nuevo && (
                  <Chip size="small" label="nuevo" variant="outlined" color="warning"
                        sx={{ ml: 0.75, height: 18, fontSize: '0.65rem' }} />
                )}
              </Typography>
              {e.secundario && (
                <Typography variant="caption" color="text.secondary">{e.secundario}</Typography>
              )}
            </Box>
          </Box>
        ))}
      </Stack>
    </Seccion>
  );
}
