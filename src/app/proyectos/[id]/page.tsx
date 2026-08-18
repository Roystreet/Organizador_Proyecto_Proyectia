import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Box, Breadcrumbs, Button, Skeleton, Stack, Typography } from '@mui/material';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ChipSemantico from '@/components/ChipSemantico';
import PuntoSalud from '@/components/PuntoSalud';
import Kpi from '@/components/Kpi';
import PestanasProyecto from '@/components/proyecto/PestanasProyecto';
import MenuProyecto from '@/components/proyecto/MenuProyecto';
import AvisoArchivado from '@/components/proyecto/AvisoArchivado';
import { contadoresProyecto, proyectoPorId, resumenBorradoProyecto } from '@/lib/consultas';
import { calcularSalud, fmtDias, fmtFecha } from '@/lib/formato';
import VistaResumen from './_vistas/VistaResumen';
import VistaAnalisis from './_vistas/VistaAnalisis';
import VistaPlan from './_vistas/VistaPlan';
import VistaTareas from './_vistas/VistaTareas';
import VistaReuniones from './_vistas/VistaReuniones';
import VistaRiesgos from './_vistas/VistaRiesgos';

export const dynamic = 'force-dynamic';

const VISTAS = ['resumen', 'ia', 'plan', 'tareas', 'reuniones', 'riesgos'] as const;
type Vista = (typeof VISTAS)[number];

const esVista = (v: string | undefined): v is Vista =>
  VISTAS.includes(v as Vista);

/**
 * Ficha de proyecto.
 *
 * La cabecera (identidad + KPIs) se queda fija y el resto vive en pestañas.
 * La pestaña activa va en `?vista=`, así que el servidor solo consulta lo que
 * esa pestaña necesita: abrir un proyecto ya no arrastra el roadmap, el kanban
 * y el grafo entero cuando lo único que se quiere es leer de qué trata.
 */
export default async function DetalleProyecto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string; planteamiento?: string }>;
}) {
  const [{ id }, consulta] = await Promise.all([params, searchParams]);
  const proyectoId = Number(id);
  if (!Number.isInteger(proyectoId)) notFound();

  const p = await proyectoPorId(proyectoId);
  if (!p) notFound();

  const vista: Vista = esVista(consulta.vista) ? consulta.vista : 'resumen';

  // La vista ya trae los agregados de tareas y asuntos; solo faltan estos dos.
  const [contadores, borrado] = await Promise.all([
    contadoresProyecto(proyectoId),
    resumenBorradoProyecto(proyectoId),
  ]);

  const salud = p.salud === 'sin_datos' ? calcularSalud(p) : p.salud;
  const avance = p.tareas_total > 0
    ? Math.round((p.tareas_completadas / p.tareas_total) * 100)
    : p.progreso_pct;

  const base = `/proyectos/${proyectoId}`;

  return (
    <Stack spacing={2.5}>
      {/* Cabecera pegajosa: la identidad del proyecto no se pierde al bajar. */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 2,
        bgcolor: 'background.default',
        pt: { xs: 1, md: 2 }, mt: { xs: -1, md: -2 },
      }}>
        <Breadcrumbs sx={{ mb: 0.5, fontSize: '0.8125rem' }}>
          <Link href="/proyectos" style={{ color: 'inherit' }}>Proyectos</Link>
          <Typography variant="body2" color="text.secondary">{p.codigo}</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <PuntoSalud salud={salud} tam={14} />
          <Typography variant="h2">{p.nombre}</Typography>
          <ChipSemantico grupo="estadoProyecto" valor={p.estado} />
          <ChipSemantico grupo="prioridad" valor={p.prioridad} />
          <Box sx={{ flexGrow: 1 }} />
          <Button component={Link} href={`${base}/editar`}
                  size="small" variant="outlined" startIcon={<EditOutlined />}>
            Editar
          </Button>
          {borrado && (
            <MenuProyecto proyectoId={proyectoId} archivado={Boolean(p.archivado)} resumen={borrado} />
          )}
        </Box>

        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          {[p.categoria, p.empresa, p.responsable && `Responsable: ${p.responsable}`]
            .filter(Boolean).join(' · ')}
        </Typography>
        {p.objetivo && (
          <Typography variant="body2" sx={{ mt: 1, maxWidth: 900 }}>
            <Typography component="span" variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              OBJETIVO ·{' '}
            </Typography>
            {p.objetivo}
          </Typography>
        )}

        <Box sx={{
          display: 'grid', gap: 1.5, mt: 2,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
        }}>
          <Kpi etiqueta="Avance" valor={`${avance}%`}
               detalle={`${p.tareas_completadas} de ${p.tareas_total} tareas`} />
          <Kpi etiqueta="Bloqueadas" valor={p.tareas_bloqueadas}
               tono={p.tareas_bloqueadas > 0 ? 'critico' : 'normal'} />
          <Kpi etiqueta="Vencidas" valor={p.tareas_vencidas}
               tono={p.tareas_vencidas > 0 ? 'alerta' : 'normal'} />
          <Kpi etiqueta="Asuntos abiertos" valor={p.asuntos_abiertos}
               detalle={p.asuntos_criticos > 0 ? `${p.asuntos_criticos} críticos` : undefined}
               tono={p.asuntos_criticos > 0 ? 'critico' : 'normal'} />
          <Kpi etiqueta="Entrega" valor={p.fecha_fin_estimada ? fmtDias(p.dias_restantes) : '—'}
               detalle={fmtFecha(p.fecha_fin_estimada)}
               tono={p.dias_restantes !== null && p.dias_restantes < 15 ? 'alerta' : 'normal'} />
        </Box>

        <Box sx={{ mt: 2 }}>
          <PestanasProyecto base={base} activa={vista} pestanas={[
            { clave: 'resumen', etiqueta: 'Resumen', contador: p.asuntos_abiertos },
            { clave: 'ia', etiqueta: 'Análisis IA' },
            { clave: 'plan', etiqueta: 'Plan' },
            { clave: 'tareas', etiqueta: 'Tareas', contador: p.tareas_total },
            { clave: 'reuniones', etiqueta: 'Reuniones', contador: contadores?.reuniones_proximas },
            { clave: 'riesgos', etiqueta: 'Riesgos', contador: contadores?.impactos_abiertos },
          ]} />
        </Box>
      </Box>

      {Boolean(p.archivado) && <AvisoArchivado proyectoId={proyectoId} />}

      {/* La clave por vista reinicia el Suspense: la cabecera no parpadea. */}
      <Suspense key={vista} fallback={<EsqueletoVista />}>
        {vista === 'resumen' && (
          <VistaResumen proyectoId={proyectoId} descripcion={p.descripcion}
                        resumenIa={p.resumen_ia} resumenIaFecha={p.resumen_ia_actualizado_en} />
        )}
        {vista === 'ia' && (
          <VistaAnalisis proyectoId={proyectoId} autoGenerar={consulta.planteamiento === 'auto'} />
        )}
        {vista === 'plan' && (
          <VistaPlan proyectoId={proyectoId} codigo={p.codigo} nombre={p.nombre}
                     fechaInicio={p.fecha_inicio} fechaFinEstimada={p.fecha_fin_estimada} />
        )}
        {vista === 'tareas' && <VistaTareas proyectoId={proyectoId} />}
        {vista === 'reuniones' && <VistaReuniones proyectoId={proyectoId} />}
        {vista === 'riesgos' && <VistaRiesgos proyectoId={proyectoId} />}
      </Suspense>
    </Stack>
  );
}

function EsqueletoVista() {
  return (
    <Stack spacing={2}>
      <Skeleton variant="rounded" height={140} />
      <Skeleton variant="rounded" height={220} />
    </Stack>
  );
}
