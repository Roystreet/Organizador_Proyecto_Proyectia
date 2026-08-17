import Link from 'next/link';
import {
  Avatar, Box, Button, Card, CardContent, Chip, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import PersonAddOutlined from '@mui/icons-material/PersonAddOutlined';
import ChipSemantico from '@/components/ChipSemantico';
import BarraFiltrosPersonas from '@/components/BarraFiltrosPersonas';
import { listaPersonas, opcionesEmpresas, listaHabilidades, listaSectores } from '@/lib/consultas';

export const dynamic = 'force-dynamic';

const iniciales = (n: string) =>
  n.split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

export default async function Personas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; empresa?: string; habilidad?: string; sector?: string }>;
}) {
  const filtros = await searchParams;
  const [personas, empresas, habilidades, sectores] = await Promise.all([
    listaPersonas({
      q: filtros.q,
      tipoRelacion: filtros.tipo,
      empresaId: filtros.empresa ? Number(filtros.empresa) : undefined,
      habilidadId: filtros.habilidad ? Number(filtros.habilidad) : undefined,
      sectorId: filtros.sector ? Number(filtros.sector) : undefined,
    }),
    opcionesEmpresas(),
    listaHabilidades(),
    listaSectores(),
  ]);

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h2">Personas</Typography>
          <Typography color="text.secondary" variant="body2">
            {personas.length} en el directorio · experticia, relación y carga actual
          </Typography>
        </Box>
        <Button component={Link} href="/personas/nueva" variant="contained"
                startIcon={<PersonAddOutlined />}>
          Nueva persona
        </Button>
      </Box>

      <BarraFiltrosPersonas empresas={empresas} habilidades={habilidades} sectores={sectores} />

      <Card>
        <CardContent sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Persona</TableCell>
                <TableCell>Relación</TableCell>
                <TableCell>Empresa</TableCell>
                <TableCell>Fortalezas</TableCell>
                <TableCell align="right">Proyectos</TableCell>
                <TableCell align="right">Tareas abiertas</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {personas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      Nadie coincide con los filtros.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {personas.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Avatar sx={{ bgcolor: 'primary.main', width: 34, height: 34,
                                    fontSize: '0.8rem', fontWeight: 700 }}>
                        {iniciales(p.nombre_completo)}
                      </Avatar>
                      <Box>
                        <Typography component={Link} href={`/personas/${p.id}`}
                                    variant="body2"
                                    sx={{ fontWeight: 600, color: 'inherit',
                                          textDecoration: 'none',
                                          '&:hover': { color: 'primary.main' } }}>
                          {p.nombre_completo}
                        </Typography>
                        <Typography variant="caption" color="text.secondary"
                                    sx={{ display: 'block' }}>
                          {[p.rol_principal, p.seniority?.replace('_', ' ')]
                            .filter(Boolean).join(' · ') || '—'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <ChipSemantico grupo="tipoRelacion" valor={p.tipo_relacion} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{p.empresa ?? '—'}</Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 260 }}>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {p.fortalezas
                        ? p.fortalezas.split(', ').slice(0, 3).map((f) => (
                            <Chip key={f} size="small" variant="outlined" label={f} />
                          ))
                        : <Typography variant="caption" color="text.secondary">—</Typography>}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{p.proyectos_activos}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{p.tareas_abiertas}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}
