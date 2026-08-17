import Link from 'next/link';
import { Box, Breadcrumbs, Stack, Typography } from '@mui/material';
import FormularioProyecto from '@/components/formularios/FormularioProyecto';
import { listaCategorias, opcionesEmpresas, opcionesPersonas } from '@/lib/consultas';

export const dynamic = 'force-dynamic';

export default async function NuevoProyecto() {
  const [categorias, empresas, personas] = await Promise.all([
    listaCategorias(),
    opcionesEmpresas(),
    opcionesPersonas(),
  ]);

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 900 }}>
      <Box>
        <Breadcrumbs sx={{ mb: 0.5, fontSize: '0.8125rem' }}>
          <Link href="/proyectos" style={{ color: 'inherit' }}>Proyectos</Link>
          <Typography variant="body2" color="text.secondary">Nuevo</Typography>
        </Breadcrumbs>
        <Typography variant="h2">Nuevo proyecto</Typography>
        <Typography color="text.secondary" variant="body2">
          Al crearlo, la IA te propondrá el planteamiento, tareas y un roadmap a partir
          de la descripción; tú decides qué insertar.
        </Typography>
      </Box>
      <FormularioProyecto catalogos={{ categorias, empresas, personas }} />
    </Stack>
  );
}
