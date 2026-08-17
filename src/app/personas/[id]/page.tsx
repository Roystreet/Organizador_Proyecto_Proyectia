import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Avatar, Box, Breadcrumbs, Button, Card, CardContent, Chip, Divider, Stack,
  Tooltip, Typography,
} from '@mui/material';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ChipSemantico from '@/components/ChipSemantico';
import PuntoSalud from '@/components/PuntoSalud';
import {
  personaPorId, habilidadesDePersona, insumosDePersona,
  experienciasDePersona, proyectosDePersona,
} from '@/lib/consultas';
import { fmtFecha } from '@/lib/formato';
import type { Salud } from '@/lib/ai/tipos';

export const dynamic = 'force-dynamic';

const ICONO_INSUMO: Record<string, string> = {
  fortaleza: 'Fortaleza',
  aporte: 'Puede aportar',
  pregunta_sugerida: 'Preguntarle',
  area_mejora: 'A desarrollar',
  logro: 'Logro',
  interes: 'Interés',
};

const iniciales = (n: string) =>
  n.split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

export default async function DetallePersona({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personaId = Number(id);
  if (!Number.isInteger(personaId)) notFound();

  const persona = await personaPorId(personaId);
  if (!persona) notFound();

  const [habilidades, insumos, experiencias, proyectos] = await Promise.all([
    habilidadesDePersona(personaId),
    insumosDePersona(personaId),
    experienciasDePersona(personaId),
    proyectosDePersona(personaId),
  ]);

  const fortalezas = habilidades.filter((h) => h.es_fortaleza);
  const otras = habilidades.filter((h) => !h.es_fortaleza);
  const preguntas = insumos.filter((i) => i.tipo === 'pregunta_sugerida');
  const aportes = insumos.filter((i) => i.tipo !== 'pregunta_sugerida');

  return (
    <Stack spacing={3}>
      {/* Cabecera */}
      <Box>
        <Breadcrumbs sx={{ mb: 0.5, fontSize: '0.8125rem' }}>
          <Link href="/personas" style={{ color: 'inherit' }}>Personas</Link>
          <Typography variant="body2" color="text.secondary">{persona.nombre_completo}</Typography>
        </Breadcrumbs>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56,
                        fontSize: '1.2rem', fontWeight: 700 }}>
            {iniciales(persona.nombre_completo)}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 220 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h2">{persona.nombre_completo}</Typography>
              <ChipSemantico grupo="tipoRelacion" valor={persona.tipo_relacion} />
            </Box>
            <Typography color="text.secondary" variant="body2">
              {[persona.rol_principal, persona.seniority?.replace('_', ' '),
                persona.anios_experiencia && `${persona.anios_experiencia} años de experiencia`,
                persona.empresa].filter(Boolean).join(' · ') || 'Sin rol registrado'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {[persona.email, persona.telefono, persona.ubicacion,
                persona.disponibilidad_horas_semana && `${persona.disponibilidad_horas_semana} h/semana`]
                .filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          <Button component={Link} href={`/personas/${persona.id}/editar`}
                  variant="outlined" startIcon={<EditOutlined />}>
            Editar
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
        {/* Columna principal */}
        <Stack spacing={2}>
          {(persona.resumen_ia || persona.bio) && (
            <Card>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 1 }}>Perfil</Typography>
                {persona.resumen_ia && (
                  <Typography variant="body2" sx={{ mb: persona.bio ? 1 : 0 }}>
                    {persona.resumen_ia}
                  </Typography>
                )}
                {persona.bio && (
                  <Typography variant="body2" color="text.secondary">{persona.bio}</Typography>
                )}
              </CardContent>
            </Card>
          )}

          {experiencias.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 1 }}>Experiencia</Typography>
                <Stack divider={<Divider />}>
                  {experiencias.map((e, i) => (
                    <Box key={i} sx={{ py: 1.25 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
                          {e.cargo} · {e.empresa_nombre}
                        </Typography>
                        {Boolean(e.es_actual) && <Chip size="small" color="success" label="Actual" />}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {[e.industria,
                          [fmtFecha(e.fecha_inicio), e.es_actual ? 'hoy' : fmtFecha(e.fecha_fin)]
                            .join(' → ')].filter(Boolean).join(' · ')}
                      </Typography>
                      {e.logros && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'primary.main' }}>
                          {e.logros}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {aportes.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 1 }}>Insumos</Typography>
                <Stack spacing={1.25}>
                  {aportes.map((i, k) => (
                    <Box key={k}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                        {ICONO_INSUMO[i.tipo] ?? i.tipo}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{i.titulo}</Typography>
                      {i.detalle && (
                        <Typography variant="caption" color="text.secondary">{i.detalle}</Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {preguntas.length > 0 && (
            <Card>
              <CardContent sx={{ bgcolor: 'background.sutil' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  QUÉ PREGUNTARLE
                </Typography>
                {preguntas.map((q, k) => (
                  <Box key={k} sx={{ mt: 0.75 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>«{q.titulo}»</Typography>
                    {q.detalle && (
                      <Typography variant="caption" color="text.secondary">{q.detalle}</Typography>
                    )}
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}
        </Stack>

        {/* Columna lateral */}
        <Stack spacing={2}>
          {habilidades.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 1 }}>Habilidades</Typography>
                {fortalezas.length > 0 && (
                  <Box sx={{ mb: 1.25 }}>
                    <Typography variant="overline" color="text.secondary">Fuerte en</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {fortalezas.map((h) => (
                        <Tooltip key={h.nombre} title={h.evidencia ?? `Nivel ${h.nivel}/5`}>
                          <Chip size="small" label={`${h.nombre} · ${h.nivel}`}
                                sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }} />
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>
                )}
                {otras.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {otras.map((h) => (
                      <Chip key={h.nombre} size="small" variant="outlined"
                            label={`${h.nombre} · ${h.nivel}`} />
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1 }}>Proyectos</Typography>
              <Stack divider={<Divider />}>
                {proyectos.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                    No participa en ningún proyecto.
                  </Typography>
                )}
                {proyectos.map((p) => (
                  <Box key={p.proyecto_id} sx={{ py: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PuntoSalud salud={p.salud as Salud} tam={9} />
                      <Typography component={Link} href={`/proyectos/${p.proyecto_id}`}
                                  variant="body2"
                                  sx={{ fontWeight: 600, flexGrow: 1, color: 'inherit',
                                        textDecoration: 'none',
                                        '&:hover': { color: 'primary.main' } }}>
                        {p.nombre}
                      </Typography>
                      <ChipSemantico grupo="estadoProyecto" valor={p.estado} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {[p.codigo, p.rol || null,
                        p.asignacion_pct !== null && `${p.asignacion_pct}%`,
                        `${p.tareas_abiertas} tareas abiertas`].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Stack>
  );
}
