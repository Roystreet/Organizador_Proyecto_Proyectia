'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button } from '@mui/material';
import { archivarProyecto } from '@/lib/acciones/proyectos';

/** Un proyecto archivado sigue siendo visitable; solo sale de los listados. */
export default function AvisoArchivado({ proyectoId }: { proyectoId: number }) {
  const router = useRouter();
  const [restaurando, setRestaurando] = React.useState(false);

  async function restaurar() {
    setRestaurando(true);
    try {
      await archivarProyecto(proyectoId, false);
      router.refresh();
    } finally {
      setRestaurando(false);
    }
  }

  return (
    <Alert severity="info" action={
      <Button size="small" onClick={restaurar} disabled={restaurando}>
        {restaurando ? 'Restaurando…' : 'Restaurar'}
      </Button>
    }>
      Este proyecto está archivado: no aparece en los listados ni en el dashboard.
    </Alert>
  );
}
