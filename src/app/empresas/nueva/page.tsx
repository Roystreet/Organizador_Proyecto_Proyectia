import Link from 'next/link';
import { Box, Breadcrumbs, Stack, Typography } from '@mui/material';
import FormularioEmpresa from '@/components/formularios/FormularioEmpresa';

export const dynamic = 'force-dynamic';

export default function NuevaEmpresa() {
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 900 }}>
      <Box>
        <Breadcrumbs sx={{ mb: 0.5, fontSize: '0.8125rem' }}>
          <Link href="/empresas" style={{ color: 'inherit' }}>Empresas</Link>
          <Typography variant="body2" color="text.secondary">Nueva</Typography>
        </Breadcrumbs>
        <Typography variant="h2">Nueva empresa</Typography>
        <Typography color="text.secondary" variant="body2">
          Cliente, proveedor, aliado o prospecto: la cartera de relaciones del portafolio.
        </Typography>
      </Box>
      <FormularioEmpresa />
    </Stack>
  );
}
