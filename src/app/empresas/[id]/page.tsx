import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Box, Breadcrumbs, Button, Card, CardContent, Divider, LinearProgress, Stack,
  Typography,
} from '@mui/material';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ChipSemantico from '@/components/ChipSemantico';
import PuntoSalud from '@/components/PuntoSalud';
import { empresaPorId, personasDeEmpresa, proyectosDeEmpresa } from '@/lib/consultas';
import { fmtFecha } from '@/lib/formato';
import type { Salud } from '@/lib/ai/tipos';

export const dynamic = 'force-dynamic';

export default async function DetalleEmpresa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empresaId = Number(id);
  if (!Number.isInteger(empresaId)) notFound();

  const empresa = await empresaPorId(empresaId);
  if (!empresa) notFound();

  const [contactos, proyectos] = await Promise.all([
    personasDeEmpresa(empresaId),
    proyectosDeEmpresa(empresaId),
  ]);

  return (
    <Stack spacing={3}>
      {/* Cabecera */}
      <Box>
        <Breadcrumbs sx={{ mb: 0.5, fontSize: '0.8125rem' }}>
          <Link href="/empresas" style={{ color: 'inherit' }}>Empresas</Link>
          <Typography variant="body2" color="text.secondary">{empresa.nombre}</Typography>
        </Breadcrumbs>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="h2">{empresa.nombre}</Typography>
          <ChipSemantico grupo="tipoEmpresa" valor={empresa.tipo} />
          <Box sx={{ flexGrow: 1 }} />
          <Button component={Link} href={`/empresas/${empresa.id}/editar`}
                  variant="outlined" startIcon={<EditOutlined />}>
            Editar
          </Button>
        </Box>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          {[empresa.industria, empresa.tamano, empresa.pais,
            empresa.contacto_email, empresa.contacto_telefono, empresa.sitio_web]
            .filter(Boolean).join(' · ') || 'Sin datos de contacto'}
        </Typography>
        {empresa.notas && (
          <Typography variant="body2" sx={{ mt: 1.5, maxWidth: 900 }}>{empresa.notas}</Typography>
        )}
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
        {/* Proyectos */}
        <Card>
          <CardContent>
            <Typography variant="h4" sx={{ mb: 1 }}>Proyectos</Typography>
            <Stack divider={<Divider />}>
              {proyectos.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No hay proyectos con esta empresa.
                </Typography>
              )}
              {proyectos.map((p) => (
                <Box key={p.id} sx={{ py: 1.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <PuntoSalud salud={p.salud as Salud} tam={10} />
                    <Typography component={Link} href={`/proyectos/${p.id}`} variant="body2"
                                sx={{ fontWeight: 600, flexGrow: 1, color: 'inherit',
                                      textDecoration: 'none',
                                      '&:hover': { color: 'primary.main' } }}>
                      {p.nombre}
                    </Typography>
                    <ChipSemantico grupo="estadoProyecto" valor={p.estado} />
                    <ChipSemantico grupo="prioridad" valor={p.prioridad} />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
                    <LinearProgress variant="determinate" value={p.progreso_pct}
                                    sx={{ flexGrow: 1, maxWidth: 220 }} />
                    <Typography variant="caption" color="text.secondary">
                      {p.progreso_pct}% · {p.codigo}
                      {p.fecha_fin_estimada && ` · entrega ${fmtFecha(p.fecha_fin_estimada)}`}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Contactos */}
        <Card>
          <CardContent>
            <Typography variant="h4" sx={{ mb: 1 }}>Contactos</Typography>
            <Stack divider={<Divider />}>
              {contactos.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No hay personas vinculadas a esta empresa.
                </Typography>
              )}
              {contactos.map((c) => (
                <Box key={c.id} sx={{ py: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography component={Link} href={`/personas/${c.id}`} variant="body2"
                                sx={{ fontWeight: 600, flexGrow: 1, color: 'inherit',
                                      textDecoration: 'none',
                                      '&:hover': { color: 'primary.main' } }}>
                      {c.nombre_completo}
                    </Typography>
                    <ChipSemantico grupo="tipoRelacion" valor={c.tipo_relacion} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {[c.rol_principal, c.email, c.telefono].filter(Boolean).join(' · ') || '—'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
