'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Stack, Typography,
} from '@mui/material';
import { aplicarFechasTareas } from '@/lib/acciones/roadmap';
import { fmtFecha } from '@/lib/formato';
import type { AsignacionFecha } from '@/lib/roadmap';

/**
 * Revisión de las fechas propuestas antes de escribirlas.
 *
 * El reparto es determinista, pero eso no lo hace correcto: nunca se aplica
 * sin que alguien lo mire. Y el UPDATE del servidor solo toca tareas que
 * siguen sin fecha, así que aplicar dos veces no pisa nada.
 */
export default function PanelPlanificar({
  abierto,
  proyectoId,
  asignaciones,
  nombrePorHito,
  alCerrar,
}: {
  abierto: boolean;
  proyectoId: number;
  asignaciones: AsignacionFecha[];
  nombrePorHito: Map<number, string>;
  alCerrar: () => void;
}) {
  const router = useRouter();
  const [marcadas, setMarcadas] = React.useState<Set<number>>(new Set());
  const [aplicando, setAplicando] = React.useState(false);
  const [resultado, setResultado] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (abierto) {
      setMarcadas(new Set(asignaciones.map((a) => a.tareaId)));
      setResultado(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, asignaciones.length]);

  const alternar = (id: number) =>
    setMarcadas((s) => {
      const c = new Set(s);
      if (c.has(id)) c.delete(id); else c.add(id);
      return c;
    });

  const porHito = React.useMemo(() => {
    const m = new Map<number, AsignacionFecha[]>();
    for (const a of asignaciones) {
      const l = m.get(a.hitoId) ?? [];
      l.push(a);
      m.set(a.hitoId, l);
    }
    return m;
  }, [asignaciones]);

  async function aplicar() {
    setAplicando(true);
    setError(null);
    try {
      const r = await aplicarFechasTareas({
        proyectoId,
        asignaciones: asignaciones
          .filter((a) => marcadas.has(a.tareaId))
          .map(({ tareaId, fechaInicio, fechaVencimiento }) => ({ tareaId, fechaInicio, fechaVencimiento })),
      });
      if (!r.ok) throw new Error(r.mensaje ?? 'No se pudieron aplicar las fechas');
      setResultado(
        `${r.aplicadas} tarea(s) planificadas${r.omitidas > 0 ? `, ${r.omitidas} omitida(s)` : ''}.`
        + (r.mensaje ? ` ${r.mensaje}` : ''),
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setAplicando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={alCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Planificar tareas sin fecha</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Cada tarea se reparte dentro de la ventana de su fase, en orden y en proporción
          a sus horas estimadas. Nada empieza antes de hoy. Desmarca lo que no quieras.
        </Typography>

        {asignaciones.length === 0 && (
          <Alert severity="info">
            No hay tareas que planificar: o ya tienen fecha, o no están asignadas a
            ninguna fase con fechas.
          </Alert>
        )}

        <Stack spacing={1.5}>
          {[...porHito].map(([hitoId, lista]) => (
            <Box key={hitoId}>
              <Typography variant="overline" color="text.secondary">
                {nombrePorHito.get(hitoId) ?? `Fase ${hitoId}`}
              </Typography>
              {lista.map((a) => (
                <Box key={a.tareaId}
                     sx={{ display: 'flex', alignItems: 'center', gap: 0.5,
                           opacity: marcadas.has(a.tareaId) ? 1 : 0.5 }}>
                  <Checkbox size="small" checked={marcadas.has(a.tareaId)}
                            onChange={() => alternar(a.tareaId)} />
                  <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                    {a.titulo}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {fmtFecha(a.fechaInicio)} → {fmtFecha(a.fechaVencimiento)}
                  </Typography>
                </Box>
              ))}
            </Box>
          ))}
        </Stack>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {resultado && <Alert severity="success" sx={{ mt: 2 }}>{resultado}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
          {marcadas.size} de {asignaciones.length} seleccionadas
        </Typography>
        <Button onClick={alCerrar}>Cerrar</Button>
        <Button variant="contained" onClick={aplicar}
                disabled={aplicando || marcadas.size === 0}
                startIcon={aplicando ? <CircularProgress size={16} /> : undefined}>
          {aplicando ? 'Aplicando…' : 'Aplicar fechas'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
