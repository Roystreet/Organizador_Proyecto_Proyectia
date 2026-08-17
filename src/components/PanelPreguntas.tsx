'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack,
  TextField, Tooltip, Typography,
} from '@mui/material';
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined';
import ChipSemantico from './ChipSemantico';
import { responderPreguntas } from '@/lib/acciones/preguntas';
import type { FilaPregunta } from '@/lib/consultas';

/**
 * Preguntas de encuadre con su respuesta.
 *
 * Se usa en el paso 2 del asistente y también en el detalle del proyecto: las
 * preguntas no caducan al terminar el asistente, y responder una más tarde
 * sigue mejorando el planteamiento.
 */
export default function PanelPreguntas({
  proyectoId,
  preguntas,
  autoGenerar,
  comoTarjeta = true,
  alTerminar,
}: {
  proyectoId: number;
  preguntas: FilaPregunta[];
  /** true en el paso 2 del asistente: genera solo si aún no hay ninguna. */
  autoGenerar?: boolean;
  comoTarjeta?: boolean;
  alTerminar?: () => void;
}) {
  const router = useRouter();
  const [cargando, setCargando] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [lectura, setLectura] = React.useState<string | null>(null);
  const [borrador, setBorrador] = React.useState<Record<number, string>>(
    () => Object.fromEntries(preguntas.map((q) => [q.id, q.respuesta ?? ''])),
  );

  React.useEffect(() => {
    setBorrador(Object.fromEntries(preguntas.map((q) => [q.id, q.respuesta ?? ''])));
  }, [preguntas]);

  const generar = React.useCallback(async (forzar: boolean) => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/ia/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId, tipo: 'preguntas_encuadre', forzar }),
      });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error ?? 'No se pudieron generar las preguntas');
      setLectura(cuerpo.datos?.lectura_inicial ?? null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }, [proyectoId, router]);

  // En el asistente se dispara solo, pero únicamente si no hay preguntas ya.
  const disparado = React.useRef(false);
  React.useEffect(() => {
    if (autoGenerar && preguntas.length === 0 && !disparado.current) {
      disparado.current = true;
      void generar(false);
    }
  }, [autoGenerar, preguntas.length, generar]);

  async function guardar(omitirIds: number[] = []) {
    setGuardando(true);
    setError(null);
    try {
      const res = await responderPreguntas({
        proyectoId,
        respuestas: preguntas.map((q) => ({
          id: q.id,
          respuesta: borrador[q.id] ?? null,
          omitir: omitirIds.includes(q.id),
        })),
      });
      if (!res.ok) throw new Error(res.mensaje ?? 'No se pudieron guardar las respuestas');
      setAviso(`${res.respondidas} respondida(s), ${res.omitidas} omitida(s).`);
      router.refresh();
      alTerminar?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setGuardando(false);
    }
  }

  const pendientes = preguntas.filter((q) => q.estado === 'pendiente').length;

  const contenido = (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        <HelpOutlineOutlined fontSize="small" color="primary" />
        <Typography variant="h4">Preguntas por resolver</Typography>
        {pendientes > 0 && (
          <Chip size="small" label={`${pendientes} sin responder`} sx={{ height: 20 }} />
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" variant="outlined" onClick={() => generar(preguntas.length > 0)}
                disabled={cargando}
                startIcon={cargando ? <CircularProgress size={14} /> : undefined}>
          {cargando ? 'Generando…' : preguntas.length > 0 ? 'Generar más' : 'Generar preguntas'}
        </Button>
      </Box>

      {lectura && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          <Typography variant="body2">{lectura}</Typography>
        </Alert>
      )}

      {preguntas.length === 0 && !cargando && (
        <Typography variant="body2" color="text.secondary">
          La IA lee lo que has escrito del proyecto y te devuelve las preguntas cuya
          respuesta cambia el plan. Responder aquí mejora el planteamiento y los perfiles
          que se proponen después.
        </Typography>
      )}

      <Stack spacing={2}>
        {preguntas.map((q) => (
          <Box key={q.id} sx={{ opacity: q.estado === 'omitida' ? 0.6 : 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <ChipSemantico grupo="prioridad" valor={q.importancia} />
              {q.tema && (
                <Chip size="small" variant="outlined" label={q.tema} sx={{ height: 19, fontSize: '0.65rem' }} />
              )}
              {q.estado === 'omitida' && (
                <Chip size="small" label="omitida" sx={{ height: 19, fontSize: '0.65rem' }} />
              )}
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>{q.pregunta}</Typography>
            {q.motivo && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Por qué importa: {q.motivo}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 0.75 }}>
              <TextField
                size="small" fullWidth multiline minRows={1}
                placeholder="Tu respuesta…"
                value={borrador[q.id] ?? ''}
                onChange={(e) => setBorrador((b) => ({ ...b, [q.id]: e.target.value }))}
              />
              <Tooltip title="Marcarla como no aplicable">
                <span>
                  <Button size="small" variant="text" color="inherit"
                          disabled={guardando} onClick={() => guardar([q.id])}>
                    Omitir
                  </Button>
                </span>
              </Tooltip>
            </Box>
          </Box>
        ))}
      </Stack>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {aviso && <Alert severity="success" sx={{ mt: 2 }}>{aviso}</Alert>}

      {preguntas.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button variant="contained" onClick={() => guardar()} disabled={guardando}
                  startIcon={guardando ? <CircularProgress size={16} /> : undefined}>
            {guardando ? 'Guardando…' : 'Guardar respuestas'}
          </Button>
        </Box>
      )}
    </>
  );

  if (!comoTarjeta) return <Box>{contenido}</Box>;
  return <Card><CardContent>{contenido}</CardContent></Card>;
}
