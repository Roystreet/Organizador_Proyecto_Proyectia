'use client';

import * as React from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import { Box, Card, CardContent, Chip, Stack, Tooltip, Typography } from '@mui/material';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import ChipSemantico from './ChipSemantico';
import { colorDe, ETIQUETAS } from '@/theme/theme';
import { fmtFecha } from '@/lib/formato';
import type { FilaHitoRoadmap, FilaSprint, FilaTareaRoadmap } from '@/lib/consultas';

const DIA_MS = 86_400_000;
const ANCHO_ETIQUETA = 190;

interface Props {
  hitos: FilaHitoRoadmap[];
  sprints: FilaSprint[];
  tareas: FilaTareaRoadmap[];
  fechaInicio: string | null;
  fechaFinEstimada: string | null;
}

const aTiempo = (v: string | null) => (v ? new Date(`${v}T00:00:00`).getTime() : null);

/** Lunes de la semana de una fecha (los carriles van en semanas). */
function inicioDeSemana(t: number): number {
  const d = new Date(t);
  const dia = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dia);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Roadmap del proyecto sin librerías: CSS grid semanal vía `sx`.
 * Carriles: sprints como barras, hitos como marcadores, tareas con fechas como
 * barras por estado. Lo que no tiene fechas se lista aparte: fechas falsas no.
 */
export default function RoadmapProyecto({
  hitos, sprints, tareas, fechaInicio, fechaFinEstimada,
}: Props) {
  const tema = useTheme();

  const fechas: number[] = [];
  for (const h of hitos) {
    const o = aTiempo(h.fecha_objetivo); if (o) fechas.push(o);
    const c = aTiempo(h.fecha_completado); if (c) fechas.push(c);
  }
  for (const s of sprints) {
    const i = aTiempo(s.fecha_inicio); if (i) fechas.push(i);
    const f = aTiempo(s.fecha_fin); if (f) fechas.push(f);
  }
  for (const t of tareas) {
    const i = aTiempo(t.fecha_inicio); if (i) fechas.push(i);
    const v = aTiempo(t.fecha_vencimiento); if (v) fechas.push(v);
  }
  const pInicio = aTiempo(fechaInicio); if (pInicio) fechas.push(pInicio);
  const pFin = aTiempo(fechaFinEstimada); if (pFin) fechas.push(pFin);

  if (hitos.length === 0 && sprints.length === 0 && tareas.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        Este proyecto todavía no tiene hitos ni sprints. Genera el roadmap con el panel
        «Planteamiento y roadmap» y acepta los hitos propuestos para verlo aquí.
      </Typography>
    );
  }

  /* Sin ninguna fecha no hay eje temporal: se muestra la lista ordenada. */
  if (fechas.length === 0) {
    return (
      <Stack spacing={1}>
        {hitos.map((h) => (
          <Box key={h.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlagOutlined sx={{ fontSize: 16, color: colorDe(tema, 'estadoHito', h.estado as never).main }} />
            <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>{h.nombre}</Typography>
            <ChipSemantico grupo="estadoHito" valor={h.estado} />
            <Typography variant="caption" color="text.secondary">
              {h.tareas_completadas}/{h.tareas_total} tareas
            </Typography>
          </Box>
        ))}
        <Typography variant="caption" color="text.secondary">
          Sin fechas registradas: agrega fechas objetivo a los hitos para ver la línea de tiempo.
        </Typography>
      </Stack>
    );
  }

  const inicio = inicioDeSemana(Math.min(...fechas));
  const fin = inicioDeSemana(Math.max(...fechas)) + 7 * DIA_MS;
  const nSemanas = Math.max(1, Math.round((fin - inicio) / (7 * DIA_MS)));

  /** Columna de la grilla (1..nSemanas) para un instante. */
  const columna = (t: number) =>
    Math.min(nSemanas, Math.max(1, Math.floor((t - inicio) / (7 * DIA_MS)) + 1));

  const hoy = Date.now();
  const hayHoy = hoy >= inicio && hoy <= fin;

  /* Etiquetas de mes: una por primera semana de cada mes visible. */
  const meses: { col: number; etiqueta: string }[] = [];
  let mesAnterior = -1;
  for (let s = 0; s < nSemanas; s++) {
    const d = new Date(inicio + s * 7 * DIA_MS);
    if (d.getMonth() !== mesAnterior) {
      mesAnterior = d.getMonth();
      meses.push({
        col: s + 1,
        etiqueta: d.toLocaleDateString('es-VE', { month: 'short', year: '2-digit' }),
      });
    }
  }

  const tareasConFechas = tareas.filter((t) => t.fecha_inicio || t.fecha_vencimiento);
  const tareasSinFechas = tareas.filter((t) => !t.fecha_inicio && !t.fecha_vencimiento
    && t.estado !== 'completada');

  const ordenHito = new Map<number, number>(hitos.map((h) => [h.id, h.orden]));
  const tareasOrdenadas = [...tareasConFechas].sort((a, b) => {
    const oa = a.hito_id !== null ? ordenHito.get(a.hito_id) ?? 99 : 99;
    const ob = b.hito_id !== null ? ordenHito.get(b.hito_id) ?? 99 : 99;
    if (oa !== ob) return oa - ob;
    return (aTiempo(a.fecha_inicio) ?? aTiempo(a.fecha_vencimiento) ?? 0)
      - (aTiempo(b.fecha_inicio) ?? aTiempo(b.fecha_vencimiento) ?? 0);
  });

  const grafico = tema.palette.graficos;

  /* Cada fila = [celda de etiqueta] + [celdas de semanas]. Todo en UNA grilla
     para que la línea de "hoy" pueda cruzar todas las filas con gridRow 1/-1. */
  const filas: React.ReactNode[] = [];
  let fila = 1;

  // Fila 1 · meses
  meses.forEach((m, i) => {
    const colFin = i + 1 < meses.length ? meses[i + 1].col : nSemanas + 1;
    filas.push(
      <Typography key={`mes-${m.col}`} variant="caption" color="text.secondary"
                  sx={{ gridRow: fila, gridColumn: `${m.col + 1} / ${colFin + 1}`,
                        borderLeft: 1, borderColor: 'divider', pl: 0.5, pb: 0.5 }}>
        {m.etiqueta}
      </Typography>,
    );
  });
  fila++;

  // Fila 2 · sprints
  if (sprints.length > 0) {
    filas.push(
      <Typography key="lbl-sprints" variant="caption" color="text.secondary"
                  sx={{ gridRow: fila, gridColumn: 1, pr: 1.5, alignSelf: 'center' }}>
        Sprints
      </Typography>,
    );
    sprints.forEach((s, i) => {
      const c1 = columna(aTiempo(s.fecha_inicio)!);
      const c2 = columna(aTiempo(s.fecha_fin)!) + 1;
      const color = grafico[i % grafico.length];
      filas.push(
        <Tooltip key={`sprint-${s.id}`}
                 title={`${s.nombre} · ${fmtFecha(s.fecha_inicio)} → ${fmtFecha(s.fecha_fin)} · ${s.estado}`}>
          <Box sx={{ gridRow: fila, gridColumn: `${c1 + 1} / ${c2 + 1}`,
                     bgcolor: alpha(color, 0.22), border: `1px solid ${alpha(color, 0.55)}`,
                     borderRadius: 1.5, height: 20, alignSelf: 'center',
                     display: 'flex', alignItems: 'center', px: 0.75, overflow: 'hidden' }}>
            <Typography variant="caption" noWrap sx={{ fontWeight: 600, fontSize: '0.65rem' }}>
              {s.nombre}
            </Typography>
          </Box>
        </Tooltip>,
      );
    });
    fila++;
  }

  // Filas de hitos: marcador en su fecha objetivo
  for (const h of hitos) {
    const objetivo = aTiempo(h.fecha_completado) ?? aTiempo(h.fecha_objetivo);
    const color = colorDe(tema, 'estadoHito', h.estado as never);
    filas.push(
      <Box key={`lbl-hito-${h.id}`}
           sx={{ gridRow: fila, gridColumn: 1, pr: 1.5, alignSelf: 'center',
                 display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <FlagOutlined sx={{ fontSize: 14, color: color.main, flexShrink: 0 }} />
        <Typography variant="caption" noWrap sx={{ fontWeight: 700 }}>{h.nombre}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          {h.tareas_completadas}/{h.tareas_total}
        </Typography>
      </Box>,
    );
    if (objetivo) {
      filas.push(
        <Tooltip key={`hito-${h.id}`}
                 title={`${h.nombre} · ${ETIQUETAS.estadoHito[h.estado as keyof typeof ETIQUETAS.estadoHito] ?? h.estado} · ${fmtFecha(h.fecha_completado ?? h.fecha_objetivo)}`}>
          <Box sx={{ gridRow: fila, gridColumn: `${columna(objetivo) + 1} / span 1`,
                     width: 12, height: 12, alignSelf: 'center', justifySelf: 'start',
                     bgcolor: color.main, transform: 'rotate(45deg)', borderRadius: 0.5 }} />
        </Tooltip>,
      );
    } else {
      filas.push(
        <Typography key={`hito-${h.id}`} variant="caption" color="text.disabled"
                    sx={{ gridRow: fila, gridColumn: `2 / span 3`, alignSelf: 'center' }}>
          sin fecha objetivo
        </Typography>,
      );
    }
    fila++;
  }

  // Filas de tareas con fechas: barra por estado
  for (const t of tareasOrdenadas) {
    const ini = aTiempo(t.fecha_inicio) ?? aTiempo(t.fecha_vencimiento)!;
    const venc = aTiempo(t.fecha_vencimiento) ?? aTiempo(t.fecha_inicio)!;
    const c1 = columna(Math.min(ini, venc));
    const c2 = columna(Math.max(ini, venc)) + 1;
    const color = colorDe(tema, 'estadoTarea', t.estado as never);
    filas.push(
      <Typography key={`lbl-tarea-${t.id}`} variant="caption" noWrap color="text.secondary"
                  sx={{ gridRow: fila, gridColumn: 1, pr: 1.5, pl: 2.5, alignSelf: 'center' }}>
        {t.titulo}
      </Typography>,
    );
    filas.push(
      <Tooltip key={`tarea-${t.id}`}
               title={`${t.titulo} · ${ETIQUETAS.estadoTarea[t.estado]} · ${fmtFecha(t.fecha_inicio)} → ${fmtFecha(t.fecha_vencimiento)}${t.responsable ? ` · ${t.responsable}` : ''}`}>
        <Box sx={{ gridRow: fila, gridColumn: `${c1 + 1} / ${c2 + 1}`,
                   bgcolor: color.suave, border: `1px solid ${color.main}`,
                   borderRadius: 1, height: 12, alignSelf: 'center', overflow: 'hidden' }}>
          <Box sx={{ width: `${t.progreso_pct}%`, height: '100%', bgcolor: alpha(color.main, 0.55) }} />
        </Box>
      </Tooltip>,
    );
    fila++;
  }

  return (
    <Box>
      <Box sx={{ overflowX: 'auto', pb: 1 }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: `${ANCHO_ETIQUETA}px repeat(${nSemanas}, minmax(26px, 1fr))`,
          rowGap: 0.75,
          minWidth: ANCHO_ETIQUETA + nSemanas * 26,
          position: 'relative',
        }}>
          {filas}
          {hayHoy && (
            <Tooltip title={`Hoy · ${fmtFecha(new Date().toISOString().slice(0, 10))}`}>
              <Box sx={{ gridRow: '1 / -1', gridColumn: `${columna(hoy) + 1} / span 1`,
                         borderLeft: '2px dashed', borderColor: 'error.main',
                         opacity: 0.6, pointerEvents: 'auto' }} />
            </Tooltip>
          )}
        </Box>
      </Box>

      {tareasSinFechas.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            Sin fechas ({tareasSinFechas.length}):
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {tareasSinFechas.map((t) => (
              <Chip key={t.id} size="small" variant="outlined" label={t.titulo} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
