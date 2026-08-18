'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Typography,
} from '@mui/material';

export interface ResumenBorrado {
  codigo: string;
  nombre: string;
  tareas: number;
  asuntos: number;
  hitos: number;
  reuniones: number;
  minutas: number;
  impactos: number;
}

/** «12 tareas · 4 reuniones», omitiendo lo que esté a cero. */
function inventario(r: ResumenBorrado): string {
  const partes: [number, string, string][] = [
    [r.tareas, 'tarea', 'tareas'],
    [r.asuntos, 'asunto', 'asuntos'],
    [r.hitos, 'fase', 'fases'],
    [r.reuniones, 'reunión', 'reuniones'],
    [r.minutas, 'minuta', 'minutas'],
    [r.impactos, 'riesgo u oportunidad', 'riesgos y oportunidades'],
  ];
  const texto = partes
    .filter(([n]) => n > 0)
    .map(([n, singular, plural]) => `${n} ${n === 1 ? singular : plural}`)
    .join(' · ');
  return texto || 'No tiene nada asociado todavía.';
}

export default function DialogoEliminarProyecto({
  abierto, alCerrar, proyectoId, resumen,
}: {
  abierto: boolean;
  alCerrar: () => void;
  proyectoId: number;
  resumen: ResumenBorrado;
}) {
  const router = useRouter();
  const [texto, setTexto] = React.useState('');
  const [error, setError] = React.useState<string>();
  const [borrando, setBorrando] = React.useState(false);

  React.useEffect(() => {
    if (abierto) { setTexto(''); setError(undefined); }
  }, [abierto]);

  const coincide = texto.trim() === resumen.codigo;

  async function borrar() {
    setBorrando(true);
    setError(undefined);
    try {
      // Se importa aquí para no arrastrar la acción al bundle hasta que se usa.
      const { eliminarProyecto } = await import('@/lib/acciones/proyectos');
      const r = await eliminarProyecto(proyectoId, texto.trim());
      if (!r.ok) { setError(r.mensaje); return; }
      alCerrar();
      router.replace('/proyectos');
      router.refresh();
    } finally {
      setBorrando(false);
    }
  }

  return (
    <Dialog open={abierto} onClose={borrando ? undefined : alCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Eliminar «{resumen.nombre}»</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
        <Alert severity="error">
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Esto no se puede deshacer.
          </Typography>
          <Typography variant="body2">Se borra también: {inventario(resumen)}.</Typography>
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Si solo quieres sacarlo de los listados, cierra esto y usa «Archivar»: es reversible.
        </Typography>
        <TextField
          label={`Escribe ${resumen.codigo} para confirmar`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
          error={texto.length > 0 && !coincide}
        />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={alCerrar} disabled={borrando}>Cancelar</Button>
        <Button color="error" variant="contained" disabled={!coincide || borrando} onClick={borrar}
                startIcon={borrando ? <CircularProgress size={16} /> : undefined}>
          {borrando ? 'Eliminando…' : 'Eliminar definitivamente'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
