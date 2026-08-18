import Link from 'next/link';
import { Box, Button, Stack, Typography } from '@mui/material';
import CreateNewFolderOutlined from '@mui/icons-material/CreateNewFolderOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import TarjetaProyecto from '@/components/TarjetaProyecto';
import { resumenProyectos } from '@/lib/consultas';
import { calcularSalud } from '@/lib/formato';

export const dynamic = 'force-dynamic';

export default async function Proyectos({
  searchParams,
}: {
  searchParams: Promise<{ archivados?: string }>;
}) {
  const { archivados } = await searchParams;
  const conArchivados = archivados === '1';
  const proyectos = await resumenProyectos(conArchivados);
  const cuantosArchivados = proyectos.filter((p) => p.archivado).length;

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h2">Proyectos</Typography>
          <Typography color="text.secondary" variant="body2">
            {proyectos.length - cuantosArchivados} proyectos en el portafolio
            {conArchivados && cuantosArchivados > 0 && ` · ${cuantosArchivados} archivados`}
          </Typography>
        </Box>
        <Button component={Link} href={conArchivados ? '/proyectos' : '/proyectos?archivados=1'}
                size="small" variant="outlined" startIcon={<Inventory2Outlined />}>
          {conArchivados ? 'Ocultar archivados' : 'Mostrar archivados'}
        </Button>
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
