'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { aprobarMatchTarea, guardarMinuta, sugerirTareasDesdeMinuta } from '@/lib/acciones/reuniones';
import type { EntradaElemento } from '@/lib/acciones/reuniones';
import type { FilaReunion } from '@/lib/operacion';

const TIPOS = [
  ['aprendizaje', 'Aprendizaje'], ['decision', 'Decisión'], ['resultado', 'Resultado'],
  ['bloqueo', 'Bloqueo'], ['proximo_paso', 'Próximo paso'],
] as const;

const POLARIDADES = [
  ['positiva', 'Positiva'], ['neutral', 'Neutral'], ['negativa', 'Negativa'],
] as const;

type Sugerencia = Awaited<ReturnType<typeof sugerirTareasDesdeMinuta>>[number];

export default function DialogoMinuta({
  reunion, alCerrar,
}: {
  /** La ocurrencia sobre la que se escribe. `undefined` cierra el diálogo. */
  reunion?: FilaReunion;
  alCerrar: () => void;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const [guardando, setGuardando] = React.useState(false);
  const [buscando, setBuscando] = React.useState(false);
  const [sugerencias, setSugerencias] = React.useState<Sugerencia[]>([]);

  React.useEffect(() => {
    setError(undefined);
    setSugerencias([]);
  }, [reunion]);

  async function enviar(datos: FormData) {
    if (!reunion) return;
    const titulo = String(datos.get('elementoTitulo') ?? '').trim();
    const elementos: EntradaElemento[] = titulo ? [{
      tipo: String(datos.get('elementoTipo')) as EntradaElemento['tipo'],
      titulo,
      detalle: String(datos.get('elementoDetalle') ?? '').trim() || null,
      polaridad: String(datos.get('polaridad')) as EntradaElemento['polaridad'],
      responsableId: null,
      fechaObjetivo: null,
    }] : [];

    setGuardando(true);
    setError(undefined);
    try {
      const r = await guardarMinuta({
        instanciaId: reunion.instancia_id,
        notas: String(datos.get('notas') ?? ''),
        resumen: String(datos.get('resumen') ?? ''),
        publicada: Boolean(datos.get('publicada')),
        elementos,
      });
      if (!r.ok) { setError(r.mensaje); return; }
      alCerrar();
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  async function buscarTareas() {
    if (!reunion) return;
    setBuscando(true);
    try {
      setSugerencias(await sugerirTareasDesdeMinuta(reunion.instancia_id));
    } finally {
      setBuscando(false);
    }
  }

  async function vincular(s: Sugerencia) {
    if (!reunion) return;
    const r = await aprobarMatchTarea(reunion.instancia_id, s.id, s.evidencia);
    if (!r.ok) { setError(r.mensaje); return; }
    setSugerencias((v) => v.filter((x) => x.id !== s.id));
  }

  return (
    <Dialog open={Boolean(reunion)} onClose={alCerrar} maxWidth="md" fullWidth>
      <DialogTitle>Minuta · {reunion?.titulo}</DialogTitle>
      <Box component="form" action={enviar}>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
          <TextField name="notas" label="Notas originales" multiline minRows={4}
                     defaultValue={reunion?.notas ?? ''} />
          <TextField name="resumen" label="Resumen" multiline minRows={2}
                     defaultValue={reunion?.resumen ?? ''} />

          <Typography variant="overline" color="text.secondary">
            Elemento estructurado · lo que alimenta Aprendizajes
          </Typography>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '180px 1fr 150px' } }}>
            <TextField name="elementoTipo" label="Tipo" select defaultValue="aprendizaje">
              {TIPOS.map(([v, t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}
            </TextField>
            <TextField name="elementoTitulo" label="Título" />
            <TextField name="polaridad" label="Polaridad" select defaultValue="neutral">
              {POLARIDADES.map(([v, t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}
            </TextField>
          </Box>
          <TextField name="elementoDetalle" label="Detalle o evidencia" />

          <FormControlLabel
            control={<Checkbox name="publicada" defaultChecked={reunion?.minuta_estado === 'publicada'} />}
            label="Publicar y marcar la reunión como realizada"
          />

          {sugerencias.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Tareas pendientes relacionadas
              </Typography>
              {sugerencias.map((s) => (
                <Alert key={s.id} severity="info" action={
                  <Button size="small" onClick={() => vincular(s)}>Vincular</Button>
                }>
                  {s.puntaje}% · {s.titulo} ({s.proyecto}) — {s.evidencia}
                </Alert>
              ))}
            </Stack>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={buscarTareas} disabled={buscando}
                  startIcon={buscando ? <CircularProgress size={16} /> : undefined}>
            {buscando ? 'Buscando…' : 'Buscar tareas pendientes'}
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={alCerrar}>Cerrar</Button>
          <Button type="submit" variant="contained" disabled={guardando}
                  startIcon={guardando ? <CircularProgress size={16} /> : undefined}>
            {guardando ? 'Guardando…' : 'Guardar minuta'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
