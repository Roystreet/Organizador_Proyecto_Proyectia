import Link from 'next/link';
import { Box, Breadcrumbs, Stack, Typography } from '@mui/material';
import FormularioPersona from '@/components/formularios/FormularioPersona';
import { opcionesEmpresas } from '@/lib/consultas';

export const dynamic = 'force-dynamic';

export default async function NuevaPersona() {
  const empresas = await opcionesEmpresas();

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 900 }}>
      <Box>
        <Breadcrumbs sx={{ mb: 0.5, fontSize: '0.8125rem' }}>
          <Link href="/personas" style={{ color: 'inherit' }}>Personas</Link>
          <Typography variant="body2" color="text.secondary">Nueva</Typography>
        </Breadcrumbs>
        <Typography variant="h2">Nueva persona</Typography>
        <Typography color="text.secondary" variant="body2">
          Agrega a alguien al directorio: interno, freelance, cliente o cualquier involucrado.
        </Typography>
      </Box>
      <FormularioPersona empresas={empresas} />
    </Stack>
  );
}
