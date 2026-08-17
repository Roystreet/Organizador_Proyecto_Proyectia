import Link from 'next/link';
import { Box, Button, Stack, Typography } from '@mui/material';
import CreateNewFolderOutlined from '@mui/icons-material/CreateNewFolderOutlined';
import TarjetaProyecto from '@/components/TarjetaProyecto';
import { resumenProyectos } from '@/lib/consultas';
import { calcularSalud } from '@/lib/formato';

export const dynamic = 'force-dynamic';

export default async function Proyectos() {
  const proyectos = await resumenProyectos();

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h2">Proyectos</Typography>
          <Typography color="text.secondary" variant="body2">
            {proyectos.length} proyectos en el portafolio
          </Typography>
        </Box>
        <Button component={Link} href="/proyectos/nuevo" variant="contained"
                startIcon={<CreateNewFolderOutlined />}>
          Nuevo proyecto
        </Button>
      </Box>
      <Box sx={{
        display: 'grid', gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
      }}>
        {proyectos.map((p) => (
          <TarjetaProyecto key={p.id} p={p}
                           salud={p.salud === 'sin_datos' ? calcularSalud(p) : p.salud} />
        ))}
      </Box>
    </Stack>
  );
}
