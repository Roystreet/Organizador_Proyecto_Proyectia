import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Box, Breadcrumbs, Stack, Typography } from '@mui/material';
import FormularioPersona from '@/components/formularios/FormularioPersona';
import { personaPorId, opcionesEmpresas } from '@/lib/consultas';

export const dynamic = 'force-dynamic';

export default async function EditarPersona({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personaId = Number(id);
  if (!Number.isInteger(personaId)) notFound();

  const [persona, empresas] = await Promise.all([
    personaPorId(personaId),
    opcionesEmpresas(),
  ]);
  if (!persona) notFound();

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 900 }}>
      <Box>
        <Breadcrumbs sx={{ mb: 0.5, fontSize: '0.8125rem' }}>
          <Link href="/personas" style={{ color: 'inherit' }}>Personas</Link>
          <Link href={`/personas/${persona.id}`} style={{ color: 'inherit' }}>
            {persona.nombre_completo}
          </Link>
          <Typography variant="body2" color="text.secondary">Editar</Typography>
        </Breadcrumbs>
        <Typography variant="h2">Editar persona</Typography>
      </Box>
      <FormularioPersona empresas={empresas} persona={persona} />
    </Stack>
  );
}
