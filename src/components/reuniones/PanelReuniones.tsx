'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, Menu, MenuItem, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import EventOutlined from '@mui/icons-material/EventOutlined';
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import { cancelarInstancia, reprogramarInstancia } from '@/lib/acciones/reuniones';
import type { FilaReunion } from '@/lib/operacion';
import DialogoReunion from './DialogoReunion';
import DialogoMinuta from './DialogoMinuta';
import type { OpcionPersona } from './tipos';

/** Colores de estado de una ocurrencia. El tema no tiene grupo para esto. */
const COLOR_ESTADO: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
  pautada: 'info', realizada: 'success', reprogramada: 'warning', cancelada: 'default',
};

const fmtFechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-VE', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

export default function PanelReuniones({
  proyectoId, reuniones, personas,
}: {
  /** Sin proyecto (la agenda global) no se pueden pautar reuniones nuevas. */
  proyectoId?: number;
  reuniones: FilaReunion[];
  personas: OpcionPersona[];
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const [rango, setRango] = React.useState<'proximas' | 'pasadas'>('proximas');
  const [editando, setEditando] = React.useState<FilaReunion>();
  const [creando, setCreando] = React.useState(false);
  const [minuta, setMinuta] = React.useState<FilaReunion>();
  const [menu, setMenu] = React.useState<{ ancla: HTMLElement; fila: FilaReunion }>();
  const [reprogramando, setReprogramando] = React.useState<FilaReunion>();

  // `inicio` viene sin zona: es reloj de pared, y así se compara con «ahora».
  const ahora = React.useMemo(() => new Date().toISOString().slice(0, 19), []);
  const visibles = React.useMemo(
    () => reuniones
      .filter((r) => (rango === 'proximas' ? r.inicio >= ahora : r.inicio < ahora))
      .sort((a, b) => (rango === 'proximas' ? a.inicio.localeCompare(b.inicio) : b.inicio.localeCompare(a.inicio))),
    [reuniones, rango, ahora],
  );

  async function accion(fn: () => Promise<{ ok: boolean; mensaje?: string }>) {
    setMenu(undefined);
    const r = await fn();
    if (!r.ok) setError(r.mensaje);
    else { setError(undefined); router.refresh(); }
  }

  async function reprogramar(datos: FormData) {
    if (!reprogramando) return;
    const destino = reprogramando;
    setReprogramando(undefined);
    await accion(() => reprogramarInstancia(destino.instancia_id, String(datos.get('inicio') ?? '')));
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
          <EventOutlined color="primary" />
          <Typography variant="h4">Reuniones</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <ToggleButtonGroup size="small" exclusive value={rango}
                             onChange={(_, v) => v && setRango(v)}>
            <ToggleButton value="proximas">Próximas</ToggleButton>
            <ToggleButton value="pasadas">Pasadas</ToggleButton>
          </ToggleButtonGroup>
          {proyectoId && (
            <Button variant="contained" size="small" onClick={() => setCreando(true)}>
              Pautar reunión
            </Button>
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(undefined)}>{error}</Alert>}

        <Stack divider={<Divider />}>
          {visibles.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {rango === 'proximas'
                ? 'No hay reuniones pautadas. Usa «Pautar reunión» para agendar la primera.'
                : 'Todavía no hay reuniones pasadas.'}
            </Typography>
          )}

          {visibles.map((r) => (
            <Box key={r.instancia_id} sx={{ py: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 220, flexGrow: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.titulo}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {[
                    fmtFechaHora(r.inicio),
                    r.zona_horaria,
                    `${r.duracion_minutos} min`,
                    r.modalidad,
                    !proyectoId && r.proyecto,
                  ].filter(Boolean).join(' · ')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {[
                    r.organizador && `Organiza: ${r.organizador}`,
                    r.participantes?.length
                      ? `${r.participantes.length} participante(s): ${r.participantes.map((p) => p.nombre).filter(Boolean).join(', ')}`
                      : 'Sin participantes',
                  ].filter(Boolean).join(' · ')}
                </Typography>
              </Box>

              <Chip size="small" label={r.estado} color={COLOR_ESTADO[r.estado] ?? 'default'}
                    variant={r.estado === 'cancelada' ? 'outlined' : 'filled'} />
              {r.recurrencia !== 'unica' && <Chip size="small" variant="outlined" label={r.recurrencia} />}

              <Button size="small" onClick={() => setMinuta(r)}>
                {r.minuta_id ? 'Ver minuta' : 'Registrar minuta'}
              </Button>
              <Tooltip title="Descargar para el calendario">
                <IconButton size="small" component="a"
                            href={`/api/reuniones/${r.id}/ics?instancia=${r.instancia_id}`}>
                  <DownloadOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton size="small" aria-label="Más acciones"
                          onClick={(e) => setMenu({ ancla: e.currentTarget, fila: r })}>
                <MoreVertOutlined fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Stack>
      </CardContent>

      <Menu open={Boolean(menu)} anchorEl={menu?.ancla} onClose={() => setMenu(undefined)}>
        <MenuItem onClick={() => { const f = menu!.fila; setMenu(undefined); setEditando(f); }}>
          Editar reunión
        </MenuItem>
        <MenuItem onClick={() => { const f = menu!.fila; setMenu(undefined); setReprogramando(f); }}>
          Reprogramar esta fecha
        </MenuItem>
        <MenuItem disabled={menu?.fila.estado === 'cancelada'}
                  onClick={() => accion(() => cancelarInstancia(menu!.fila.instancia_id))}>
          Cancelar esta fecha
        </MenuItem>
      </Menu>

      {/* Editar y crear comparten diálogo; sin `proyectoId` solo se puede editar. */}
      <DialogoReunion
        abierto={creando || Boolean(editando)}
        alCerrar={() => { setCreando(false); setEditando(undefined); }}
        proyectoId={proyectoId ?? editando?.proyecto_id ?? 0}
        reunion={editando}
        personas={personas}
      />

      <DialogoMinuta reunion={minuta} alCerrar={() => setMinuta(undefined)} />

      <Dialog open={Boolean(reprogramando)} onClose={() => setReprogramando(undefined)} maxWidth="xs" fullWidth>
        <DialogTitle>Reprogramar esta fecha</DialogTitle>
        <Box component="form" action={reprogramar}>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Solo se mueve esta ocurrencia de «{reprogramando?.titulo}». El resto de la serie
              se queda como está.
            </Typography>
            <TextField name="inicio" label="Nuevo inicio" type="datetime-local" required fullWidth
                       slotProps={{ inputLabel: { shrink: true } }}
                       defaultValue={reprogramando?.inicio.slice(0, 16) ?? ''} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setReprogramando(undefined)}>Cancelar</Button>
            <Button type="submit" variant="contained">Reprogramar</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Card>
  );
}
