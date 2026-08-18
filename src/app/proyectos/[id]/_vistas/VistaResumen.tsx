import Link from 'next/link';
import { Box, Card, CardContent, Chip, Divider, Stack, Tooltip, Typography } from '@mui/material';
import ChipSemantico from '@/components/ChipSemantico';
import SeccionColapsable from '@/components/SeccionColapsable';
import { asuntosDeProyecto, equipoDeProyecto, habilidadesRequeridas } from '@/lib/consultas';
import { fmtFecha } from '@/lib/formato';

/** Lo que se responde de un vistazo: de qué trata, qué duele y quién está. */
export default async function VistaResumen({
  proyectoId, descripcion, resumenIa, resumenIaFecha,
}: {
  proyectoId: number;
  descripcion: string | null;
  resumenIa: string | null;
  resumenIaFecha: Date | null;
}) {
  const [asuntos, equipo, skills] = await Promise.all([
    asuntosDeProyecto(proyectoId),
    equipoDeProyecto(proyectoId),
    habilidadesRequeridas(proyectoId),
  ]);

  const abiertos = asuntos.filter((a) => !['resuelto', 'cerrado', 'descartado'].includes(a.estado));

  return (
    <Stack spacing={2.5}>
      {(resumenIa || descripcion) && (
        <Card>
          <CardContent>
            <Typography variant="overline" color="text.secondary">De qué trata</Typography>
            {resumenIa ? (
              <>
                <Typography variant="body1" sx={{ maxWidth: 900, mt: 0.5 }}>{resumenIa}</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                  Redactado por la IA{resumenIaFecha ? ` · ${fmtFecha(resumenIaFecha)}` : ''}
                </Typography>
                {descripcion && (
                  <Box sx={{ mt: 2 }}>
                    <SeccionColapsable titulo="Descripción original" inicial={false}>
                      <Typography variant="body2" color="text.secondary"
                                  sx={{ whiteSpace: 'pre-line', maxWidth: 900, mt: 0.5 }}>
                        {descripcion}
                      </Typography>
                    </SeccionColapsable>
                  </Box>
                )}
              </>
            ) : (
              <>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line', maxWidth: 900, mt: 0.5 }}>
                  {descripcion}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                  Todavía sin resumen. Genera el planteamiento en «Análisis IA» para tener una
                  versión que se entienda de un vistazo.
                </Typography>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
        <Card>
          <CardContent>
            <Typography variant="h4" sx={{ mb: 1 }}>Asuntos</Typography>
            <Stack divider={<Divider />}>
              {abiertos.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No hay asuntos abiertos.
                </Typography>
              )}
              {abiertos.map((a) => (
                <Box key={a.id} sx={{ py: 1.25 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ChipSemantico grupo="prioridad" valor={a.severidad}
                                   etiqueta={a.severidad === 'critica' ? 'crítica' : a.severidad} />
                    <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>{a.titulo}</Typography>
                    <ChipSemantico grupo="estadoAsunto" valor={a.estado} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {[a.codigo, a.categoria, `${a.dias_abierto} días abierto`,
                      a.asignado_a && `→ ${a.asignado_a}`].filter(Boolean).join(' · ')}
                    {Boolean(a.es_recurrente) && ' · recurrente'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1 }}>Involucrados</Typography>
              <Stack divider={<Divider />}>
                {equipo.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Nadie asignado todavía.
                  </Typography>
                )}
                {equipo.map((m) => (
                  <Box key={m.persona_id} sx={{ py: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        <Link href={`/personas/${m.persona_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {m.nombre}
                        </Link>
                      </Typography>
                      <Tooltip title="Tareas abiertas aquí / en todo el portafolio">
                        <Typography variant="caption" color="text.secondary">
                          {m.tareas_abiertas} / {m.carga_total_proyectos}
                        </Typography>
                      </Tooltip>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {[m.rol, m.asignacion_pct !== null && `${m.asignacion_pct}%`]
                        .filter(Boolean).join(' · ')}
                    </Typography>
                    {m.fortalezas && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'primary.main' }}>
                        {m.fortalezas}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          {skills.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 1 }}>Habilidades requeridas</Typography>
                <Stack spacing={0.75}>
                  {skills.map((s) => (
                    <Box key={s.nombre} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 7, height: 7, borderRadius: '50%',
                        bgcolor: s.cubierta ? 'success.main' : 'error.main',
                      }} />
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>{s.nombre}</Typography>
                      <Chip size="small" variant="outlined" label={`nivel ${s.nivel_minimo}`} />
                      <Typography variant="caption" color="text.secondary">{s.criticidad}</Typography>
                    </Box>
                  ))}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Verde = alguien del equipo la cubre al nivel pedido.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}
