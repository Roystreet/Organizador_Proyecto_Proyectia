'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined';
import { actualizarReunion, crearReunion, eliminarReunion } from '@/lib/acciones/reuniones';
import type { EntradaReunion } from '@/lib/acciones/reuniones';
import type { FilaReunion } from '@/lib/operacion';
import type { OpcionPersona } from './tipos';

/** Un participante mientras se edita: interno (con id) o externo (sin él). */
interface Asistente {
  personaId: number | null;
  nombreExterno: string | null;
  emailExterno: string | null;
  /** Solo para pintar la lista; no viaja al servidor. */
  etiqueta: string;
}

const MODALIDADES = [
  ['virtual', 'Virtual'], ['presencial', 'Presencial'], ['hibrida', 'Híbrida'],
] as const;

const RECURRENCIAS = [
  ['unica', 'No se repite'], ['semanal', 'Cada semana'],
  ['quincenal', 'Cada dos semanas'], ['mensual', 'Cada mes'],
] as const;

/** Zonas del sistema; si el navegador es viejo, al menos la de la reunión. */
function zonasHorarias(actual: string): string[] {
  const soportadas = (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  const lista = soportadas ? soportadas('timeZone') : [actual];
  return lista.includes(actual) ? lista : [actual, ...lista];
}

const zonaDelNavegador = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Caracas';

/** `2026-08-20T10:00:00` → `2026-08-20T10:00`, que es lo que pide el input. */
const paraInput = (iso: string) => iso.slice(0, 16);

export default function DialogoReunion({
  abierto, alCerrar, proyectoId, reunion, personas,
}: {
  abierto: boolean;
  alCerrar: () => void;
  proyectoId: number;
  /** Sin reunión el diálogo crea; con ella, edita la serie completa. */
  reunion?: FilaReunion;
  personas: OpcionPersona[];
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const [guardando, setGuardando] = React.useState(false);
  const [borrando, setBorrando] = React.useState(false);
  const [confirmaBorrar, setConfirmaBorrar] = React.useState(false);

  const [asistentes, setAsistentes] = React.useState<Asistente[]>([]);
  const [zona, setZona] = React.useState(zonaDelNavegador());
  const [invitado, setInvitado] = React.useState({ nombre: '', email: '' });

  // Cada vez que se abre, el estado local se resiembra desde la reunión.
  React.useEffect(() => {
    if (!abierto) return;
    setError(undefined);
    setConfirmaBorrar(false);
    setInvitado({ nombre: '', email: '' });
    setZona(reunion?.zona_horaria || zonaDelNavegador());
    setAsistentes(
      (reunion?.participantes ?? []).map((p) => ({
        personaId: p.persona_id,
        nombreExterno: p.persona_id ? null : p.nombre,
        emailExterno: p.email,
        etiqueta: p.nombre ?? p.email ?? 'Sin nombre',
      })),
    );
  }, [abierto, reunion]);

  const internos = asistentes.filter((a) => a.personaId !== null);
  const externos = asistentes.filter((a) => a.personaId === null);

  function cambiarInternos(seleccion: OpcionPersona[]) {
    setAsistentes([
      ...seleccion.map((p) => ({
        personaId: p.id, nombreExterno: null, emailExterno: null, etiqueta: p.nombre_completo,
      })),
      ...externos,
    ]);
  }

  function agregarInvitado() {
    const nombre = invitado.nombre.trim();
    if (!nombre) return;
    setAsistentes((v) => [...v, {
      personaId: null,
      nombreExterno: nombre,
      emailExterno: invitado.email.trim() || null,
      etiqueta: nombre,
    }]);
    setInvitado({ nombre: '', email: '' });
  }

  async function enviar(datos: FormData) {
    const texto = (campo: string) => {
      const v = datos.get(campo);
      const limpio = typeof v === 'string' ? v.trim() : '';
      return limpio === '' ? null : limpio;
    };

    const entrada: EntradaReunion = {
      titulo: String(datos.get('titulo') ?? ''),
      objetivo: texto('objetivo'),
      agenda: texto('agenda'),
      organizadorId: Number(datos.get('organizadorId')) || null,
      modalidad: String(datos.get('modalidad')) as EntradaReunion['modalidad'],
      ubicacion: texto('ubicacion'),
      enlace: texto('enlace'),
      zonaHoraria: zona,
      inicio: String(datos.get('inicio') ?? ''),
      duracionMinutos: Number(datos.get('duracion')) || 60,
      recurrencia: String(datos.get('recurrencia')) as EntradaReunion['recurrencia'],
      recurrenciaHasta: texto('hasta'),
      // Los participantes NO viajan por el FormData: un select múltiple de MUI
      // emite un solo campo con los ids unidos por coma y se perdían todos.
      participantes: asistentes.map(({ personaId, nombreExterno, emailExterno }) =>
        ({ personaId, nombreExterno, emailExterno })),
    };

    setGuardando(true);
    setError(undefined);
    try {
      const r = reunion
        ? await actualizarReunion(reunion.id, entrada)
        : await crearReunion(proyectoId, entrada);
      if (!r.ok) { setError(r.mensaje); return; }
      alCerrar();
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!reunion) return;
    setBorrando(true);
    try {
      const r = await eliminarReunion(reunion.id);
      if (!r.ok) { setError(r.mensaje); return; }
      alCerrar();
      router.refresh();
    } finally {
      setBorrando(false);
    }
  }

  const campo = { gridColumn: '1 / -1' };

  return (
    <Dialog open={abierto} onClose={alCerrar} maxWidth="md" fullWidth>
      <DialogTitle>{reunion ? 'Editar reunión' : 'Pautar reunión'}</DialogTitle>
      <Box component="form" action={enviar}>
        <DialogContent sx={{
          display: 'grid', gap: 2, pt: '12px !important',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        }}>
          <TextField name="titulo" label="Título" required autoFocus
                     defaultValue={reunion?.titulo ?? ''} sx={campo} />
          <TextField name="objetivo" label="Objetivo · qué queremos sacar de aquí"
                     defaultValue={reunion?.objetivo ?? ''} sx={campo} />
          <TextField name="agenda" label="Agenda" multiline minRows={3}
                     defaultValue={reunion?.agenda ?? ''} sx={campo} />

          <TextField name="inicio" label="Inicio" type="datetime-local" required
                     slotProps={{ inputLabel: { shrink: true } }}
                     defaultValue={reunion ? paraInput(reunion.inicio) : ''} />
          <TextField name="duracion" label="Duración (minutos)" type="number"
                     slotProps={{ htmlInput: { min: 15, max: 1440, step: 15 } }}
                     defaultValue={reunion?.duracion_minutos ?? 60} />

          <Autocomplete
            options={zonasHorarias(zona)}
            value={zona}
            onChange={(_, v) => setZona(v ?? zonaDelNavegador())}
            disableClearable
            renderInput={(props) => (
              <TextField {...props} label="Zona horaria"
                         helperText="La hora se guarda tal cual y se lee en esta zona" />
            )}
          />
          <TextField name="organizadorId" label="Organizador" select
                     defaultValue={reunion?.organizador_id ?? ''}>
            <MenuItem value="">Sin organizador</MenuItem>
            {personas.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.nombre_completo}</MenuItem>
            ))}
          </TextField>

          <TextField name="modalidad" label="Modalidad" select
                     defaultValue={reunion?.modalidad ?? 'virtual'}>
            {MODALIDADES.map(([v, t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}
          </TextField>
          <TextField name="ubicacion" label="Ubicación" defaultValue={reunion?.ubicacion ?? ''} />
          <TextField name="enlace" label="Enlace de la videollamada" type="url"
                     defaultValue={reunion?.enlace ?? ''} sx={campo} />

          <TextField name="recurrencia" label="Repetición" select
                     defaultValue={reunion?.recurrencia ?? 'unica'}>
            {RECURRENCIAS.map(([v, t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}
          </TextField>
          <TextField name="hasta" label="Repetir hasta" type="date"
                     slotProps={{ inputLabel: { shrink: true } }}
                     defaultValue={reunion?.recurrencia_hasta ?? ''}
                     helperText="Vacío = una sola vez o un año por delante" />

          <Divider sx={campo} />

          <Box sx={campo}>
            <Typography variant="overline" color="text.secondary">Participantes</Typography>
            <Autocomplete
              multiple disableCloseOnSelect
              options={personas}
              value={personas.filter((p) => internos.some((a) => a.personaId === p.id))}
              onChange={(_, v) => cambiarInternos(v)}
              getOptionLabel={(p) => p.nombre_completo}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderOption={({ key, ...props }, opcion, { selected }) => (
                <li key={key} {...props}>
                  <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                  {opcion.nombre_completo}
                </li>
              )}
              renderInput={(props) => <TextField {...props} label="Del sistema" />}
              sx={{ mt: 1 }}
            />

            {externos.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
                {externos.map((a) => (
                  <Chip
                    key={`${a.nombreExterno}|${a.emailExterno ?? ''}`}
                    label={a.emailExterno ? `${a.nombreExterno} · ${a.emailExterno}` : a.nombreExterno}
                    onDelete={() => setAsistentes((v) => v.filter((x) => x !== a))}
                    variant="outlined"
                  />
                ))}
              </Stack>
            )}

            <Box sx={{
              display: 'grid', gap: 1, mt: 1.5, alignItems: 'start',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' },
            }}>
              <TextField label="Invitado externo" value={invitado.nombre}
                         onChange={(e) => setInvitado((v) => ({ ...v, nombre: e.target.value }))} />
              <TextField label="Email" type="email" value={invitado.email}
                         onChange={(e) => setInvitado((v) => ({ ...v, email: e.target.value }))} />
              <IconButton onClick={agregarInvitado} disabled={!invitado.nombre.trim()}
                          color="primary" aria-label="Añadir invitado externo" sx={{ mt: 0.5 }}>
                <PersonAddAltOutlined />
              </IconButton>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={campo}>{error}</Alert>}

          {confirmaBorrar && reunion && (
            <Alert severity="warning" sx={campo}>
              Se borra la serie «{reunion.titulo}» con todas sus fechas y minutas.
              Para quitar solo una fecha, usa «Cancelar esta fecha».
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          {reunion && (
            <Button color="error" variant={confirmaBorrar ? 'contained' : 'text'}
                    startIcon={borrando ? <CircularProgress size={16} /> : <DeleteOutlineOutlined />}
                    disabled={borrando}
                    onClick={() => (confirmaBorrar ? borrar() : setConfirmaBorrar(true))}>
              {confirmaBorrar ? 'Confirmar borrado' : 'Eliminar serie'}
            </Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={alCerrar}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={guardando}
                  startIcon={guardando ? <CircularProgress size={16} /> : undefined}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
