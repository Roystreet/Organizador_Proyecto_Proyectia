import Link from 'next/link';
import {
  Box, Button, Card, CardContent, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from '@mui/material';
import AddBusinessOutlined from '@mui/icons-material/AddBusinessOutlined';
import ChipSemantico from '@/components/ChipSemantico';
import { listaEmpresas } from '@/lib/consultas';

export const dynamic = 'force-dynamic';

export default async function Empresas() {
  const empresas = await listaEmpresas();

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h2">Empresas</Typography>
          <Typography color="text.secondary" variant="body2">
            {empresas.length} en cartera · clientes, proveedores, aliados y prospectos
          </Typography>
        </Box>
        <Button component={Link} href="/empresas/nueva" variant="contained"
                startIcon={<AddBusinessOutlined />}>
          Nueva empresa
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Empresa</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Industria</TableCell>
                <TableCell>Contacto</TableCell>
                <TableCell align="right">Contactos</TableCell>
                <TableCell align="right">Proyectos activos</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {empresas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      Todavía no hay empresas registradas.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {empresas.map((e) => (
                <TableRow key={e.id} hover>
                  <TableCell>
                    <Typography component={Link} href={`/empresas/${e.id}`} variant="body2"
                                sx={{ fontWeight: 600, color: 'inherit', textDecoration: 'none',
                                      '&:hover': { color: 'primary.main' } }}>
                      {e.nombre}
                    </Typography>
                    {e.pais && (
                      <Typography variant="caption" color="text.secondary"
                                  sx={{ display: 'block' }}>
                        {e.pais}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell><ChipSemantico grupo="tipoEmpresa" valor={e.tipo} /></TableCell>
                  <TableCell>
                    <Typography variant="body2">{e.industria ?? '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {e.contacto_email ?? e.contacto_telefono ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{e.contactos}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {e.proyectos_activos}
                      <Typography component="span" variant="caption" color="text.secondary">
                        {' '}/ {e.proyectos_total}
                      </Typography>
                    </Typography>
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
