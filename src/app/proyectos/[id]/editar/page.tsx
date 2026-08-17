import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Box, Breadcrumbs, Stack, Typography } from '@mui/material';
import FormularioProyecto from '@/components/formularios/FormularioProyecto';
import {
  proyectoParaEditar, listaCategorias, opcionesEmpresas, opcionesPersonas,
} from '@/lib/consultas';

export const dynamic = 'force-dynamic';

export default async function EditarProyecto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proyectoId = Number(id);
  if (!Number.isInteger(proyectoId)) notFound();

  const [proyecto, categorias, empresas, personas] = await Promise.all([
    proyectoParaEditar(proyectoId),
    listaCategorias(),
    opcionesEmpresas(),
    opcionesPersonas(),
  ]);
  if (!proyecto) notFound();

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 900 }}>
      <Box>
        <Breadcrumbs sx={{ mb: 0.5, fontSize: '0.8125rem' }}>
          <Link href="/proyectos" style={{ color: 'inherit' }}>Proyectos</Link>
          <Link href={`/proyectos/${proyecto.id}`} style={{ color: 'inherit' }}>
            {proyecto.nombre}
          </Link>
          <Typography variant="body2" color="text.secondary">Editar</Typography>
        </Breadcrumbs>
        <Typography variant="h2">Editar proyecto</Typography>
      </Box>
      <FormularioProyecto
        catalogos={{ categorias, empresas, personas }}
        proyecto={proyecto}
      />
    </Stack>
  );
}
