'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, TextField, Typography,
} from '@mui/material';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import { crearHito, actualizarHito, eliminarHito } from '@/lib/acciones/roadmap';
import { ESTADO_INICIAL } from '@/lib/acciones/tipos';
import { ETIQUETAS } from '@/theme/theme';

export interface ValoresFase {
  id: number;
  nombre: string;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_objetivo: string | null;
  estado: string;
  orden: number;
  tareas: number;
}

/** Alta y edición de una fase del roadmap. */
export default function DialogoFase({
  abierto,
  proyectoId,
  fase,
  alCerrar,
}: {
  abierto: boolean;
  proyectoId: number;
  /** undefined = crear una fase nueva. */
  fase?: ValoresFase;
  alCerrar: () => void;
}) {
  const router = useRouter();
  const accion = fase ? actualizarHito.bind(null, fase.id) : crearHito.bind(null, proyectoId);
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
  const [borrando, setBorrando] = React.useState(false);
  const [confirmaBorrar, setConfirmaBorrar] = React.useState(false);
  const error = (campo: string) => estado.errores?.[campo];

  // La acción devuelve ok cuando terminó: cerrar y refrescar el servidor.
  React.useEffect(() => {
    if (estado.ok) {
      alCerrar();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.ok]);

  React.useEffect(() => {
    if (!abierto) setConfirmaBorrar(false);
  }, [abierto]);

  async function borrar() {
    if (!fase) return;
    setBorrando(true);
    try {
      await eliminarHito(fase.id);
      alCerrar();
      router.refresh();
    } finally {
      setBorrando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={alCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>{fase ? 'Editar fase' : 'Añadir fase'}</DialogTitle>
      <Box component="form" action={enviar}>
        <DialogContent sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
          <TextField
            name="nombre" label="Nombre de la fase" required autoFocus
            error={Boolean(error('nombre'))} helperText={error('nombre')}
            defaultValue={fase?.nombre ?? ''}
            sx={{ gridColumn: '1 / -1' }}
          />
          <TextField
            name="descripcion" label="Qué se logra en esta fase" multiline minRows={2}
            error={Boolean(error('descripcion'))} helperText={error('descripcion')}
            defaultValue={fase?.descripcion ?? ''}
            sx={{ gridColumn: '1 / -1' }}
          />
          <TextField
            name="fechaInicio" label="Inicio" type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            error={Boolean(error('fechaInicio'))} helperText={error('fechaInicio')}
            defaultValue={fase?.fecha_inicio ?? ''}
          />
          <TextField
            name="fechaObjetivo" label="Objetivo (fin de la fase)" type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            error={Boolean(error('fechaObjetivo'))}
            helperText={error('fechaObjetivo') ?? 'Sin esta fecha la fase no se dibuja'}
            defaultValue={fase?.fecha_objetivo ?? ''}
          />
          <TextField
            name="estado" label="Estado" select defaultValue={fase?.estado ?? 'pendiente'}
          >
            {Object.entries(ETIQUETAS.estadoHito).map(([v, t]) => (
              <MenuItem key={v} value={v}>{t}</MenuItem>
            ))}
          </TextField>
          <TextField
            name="orden" label="Orden" type="number"
            slotProps={{ htmlInput: { min: 0, max: 999 } }}
            error={Boolean(error('orden'))} helperText={error('orden')}
            defaultValue={fase?.orden ?? ''}
          />

          {estado.mensaje && !estado.ok && (
            <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>{estado.mensaje}</Alert>
          )}

          {confirmaBorrar && fase && (
            <Alert severity="warning" sx={{ gridColumn: '1 / -1' }}>
              <Typography variant="body2">
                Se borra la fase «{fase.nombre}».
                {fase.tareas > 0
                  ? ` Sus ${fase.tareas} tarea(s) NO se borran: quedan sin fase y pasan a «sin fecha».`
                  : ' No tiene tareas asociadas.'}
              </Typography>
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          {fase && (
            <Button
              color="error" variant={confirmaBorrar ? 'contained' : 'text'}
              startIcon={borrando ? <CircularProgress size={16} /> : <DeleteOutlineOutlined />}
              disabled={borrando}
              onClick={() => (confirmaBorrar ? borrar() : setConfirmaBorrar(true))}
            >
              {confirmaBorrar ? 'Confirmar borrado' : 'Eliminar'}
            </Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={alCerrar}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={enviando}
                  startIcon={enviando ? <CircularProgress size={16} /> : undefined}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
