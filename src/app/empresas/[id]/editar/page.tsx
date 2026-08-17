import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Box, Breadcrumbs, Stack, Typography } from '@mui/material';
import FormularioEmpresa from '@/components/formularios/FormularioEmpresa';
import { empresaPorId } from '@/lib/consultas';

export const dynamic = 'force-dynamic';

export default async function EditarEmpresa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empresaId = Number(id);
  if (!Number.isInteger(empresaId)) notFound();

  const empresa = await empresaPorId(empresaId);
  if (!empresa) notFound();

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 900 }}>
      <Box>
        <Breadcrumbs sx={{ mb: 0.5, fontSize: '0.8125rem' }}>
          <Link href="/empresas" style={{ color: 'inherit' }}>Empresas</Link>
          <Link href={`/empresas/${empresa.id}`} style={{ color: 'inherit' }}>
            {empresa.nombre}
          </Link>
          <Typography variant="body2" color="text.secondary">Editar</Typography>
        </Breadcrumbs>
        <Typography variant="h2">Editar empresa</Typography>
      </Box>
      <FormularioEmpresa empresa={empresa} />
    </Stack>
  );
}
