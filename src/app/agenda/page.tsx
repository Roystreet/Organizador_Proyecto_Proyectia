import { Box, Stack, Typography } from '@mui/material';
import PanelReuniones from '@/components/reuniones/PanelReuniones';
import { reunionesAgenda } from '@/lib/operacion';
import { opcionesPersonas } from '@/lib/consultas';

export const dynamic = 'force-dynamic';

export default async function Agenda() {
  const [reuniones, personas] = await Promise.all([reunionesAgenda(), opcionesPersonas()]);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h2">Agenda</Typography>
        <Typography color="text.secondary" variant="body2">
          Reuniones de todo el portafolio, sus minutas y exportaciones de calendario.
        </Typography>
      </Box>
      {/* Sin `proyectoId` el panel no ofrece pautar: una reunión siempre cuelga
          de un proyecto, así que se crea desde su ficha. */}
      <PanelReuniones reuniones={reuniones} personas={personas} />
    </Stack>
  );
}
