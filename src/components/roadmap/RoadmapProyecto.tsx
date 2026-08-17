'use client';

import * as React from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Box, Button, Card, CardContent, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import EjeTiempo, { LineaHoy } from './EjeTiempo';
import FilaFase, { ANCHO_ETIQUETA } from './FilaFase';
import BloqueSinFecha from './BloqueSinFecha';
import DialogoFase, { type ValoresFase } from './DialogoFase';
import PanelPlanificar from './PanelPlanificar';
import {
  aTiempo, crearEscala, granularidadSugerida, planificarTareas, ventanasDeFases,
  type Granularidad,
} from '@/lib/roadmap';
import { fmtFecha } from '@/lib/formato';
import type { FilaHitoRoadmap, FilaSprint, FilaTareaRoadmap } from '@/lib/consultas';

interface Props {
  proyectoId: number;
  codigoProyecto: string;
  nombreProyecto: string;
  hitos: FilaHitoRoadmap[];
  sprints: FilaSprint[];
  tareas: FilaTareaRoadmap[];
  fechaInicio: string | null;
  fechaFinEstimada: string | null;
}

/**
 * Roadmap del proyecto: una fila por fase, con su extensión real sobre el eje.
 *
 * Las barras se posicionan por fracción del ancho, no por columna de grilla:
 * así el eje puede mostrarse por mes o por trimestre sin que cambie la
 * geometría, y la precisión sigue siendo de un día.
 *
 * Lo que no tiene fecha se lista aparte, nunca se le inventa una posición.
 */
export default function RoadmapProyecto({
  proyectoId, codigoProyecto, nombreProyecto,
  hitos, sprints, tareas, fechaInicio, fechaFinEstimada,
}: Props) {
  const tema = useTheme();
  const [granularidad, setGranularidad] = React.useState<Granularidad | null>(null);
  const [faseEnEdicion, setFaseEnEdicion] = React.useState<ValoresFase | undefined>();
  const [dialogoAbierto, setDialogoAbierto] = React.useState(false);
  const [planificando, setPlanificando] = React.useState(false);

  const hoy = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const ventanas = React.useMemo(
    () => ventanasDeFases(hitos, { fecha_inicio: fechaInicio }),
    [hitos, fechaInicio],
  );

  /** Todo lo fechado, para saber qué rango tiene que cubrir el eje. */
  const rango = React.useMemo(() => {
    const t: number[] = [];
    for (const v of ventanas.values()) { t.push(v.inicio, v.fin); }
    for (const s of sprints) {
      const a = aTiempo(s.fecha_inicio); if (a) t.push(a);
      const b = aTiempo(s.fecha_fin); if (b) t.push(b);
    }
    for (const x of tareas) {
      const a = aTiempo(x.fecha_inicio); if (a) t.push(a);
      const b = aTiempo(x.fecha_vencimiento); if (b) t.push(b);
    }
    const pi = aTiempo(fechaInicio); if (pi) t.push(pi);
    const pf = aTiempo(fechaFinEstimada); if (pf) t.push(pf);
    if (t.length === 0) return null;
    // Hoy entra en el rango para que la línea se vea aunque quede en el borde.
    t.push(hoy);
    return { desde: Math.min(...t), hasta: Math.max(...t) };
  }, [ventanas, sprints, tareas, fechaInicio, fechaFinEstimada, hoy]);

  const sugerida = React.useMemo(
    () => (rango ? granularidadSugerida(rango.desde, rango.hasta) : 'mes'),
    [rango],
  );

  const escala = React.useMemo(() => {
    if (!rango) return null;
    return crearEscala(granularidad ?? sugerida, rango.desde, rango.hasta);
  }, [rango, granularidad, sugerida]);

  const sinFecha = React.useMemo(
    () => tareas.filter((t) => !t.fecha_inicio && !t.fecha_vencimiento && t.estado !== 'completada'),
    [tareas],
  );

  const propuestas = React.useMemo(
    () => planificarTareas({
      tareas: sinFecha.map((t) => ({
        id: t.id, titulo: t.titulo, hito_id: t.hito_id,
        orden: t.orden, prioridad: t.prioridad, estimacion_horas: t.estimacion_horas,
      })),
      ventanas,
      hoy,
    }),
    [sinFecha, ventanas, hoy],
  );

  const nombrePorHito = React.useMemo(
    () => new Map(hitos.map((h) => [h.id, h.nombre])),
    [hitos],
  );

  const abrirFase = (id: number) => {
    const h = hitos.find((x) => x.id === id);
    if (!h) return;
    setFaseEnEdicion({
      id: h.id, nombre: h.nombre, descripcion: h.descripcion,
      fecha_inicio: h.fecha_inicio, fecha_objetivo: h.fecha_objetivo,
      estado: h.estado, orden: h.orden,
      tareas: h.tareas_total,
    });
    setDialogoAbierto(true);
  };

  const abrirNueva = () => { setFaseEnEdicion(undefined); setDialogoAbierto(true); };

  const cabecera = (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" color="text.secondary" noWrap>
          {codigoProyecto} · {nombreProyecto}
        </Typography>
        <Typography variant="h4">Roadmap</Typography>
      </Box>
      <Box sx={{ flexGrow: 1 }} />
      {escala && (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={escala.granularidad}
          onChange={(_, v: Granularidad | null) => v && setGranularidad(v)}
        >
          {/* La semana solo se ofrece en proyectos cortos, donde aporta; en uno
              de meses son decenas de columnas que solo añaden scroll. */}
          {sugerida === 'semana' && <ToggleButton value="semana">Semana</ToggleButton>}
          <ToggleButton value="mes">Mes</ToggleButton>
          <ToggleButton value="trimestre">Trimestre</ToggleButton>
        </ToggleButtonGroup>
      )}
      <Button size="small" variant="outlined" startIcon={<AddOutlined />} onClick={abrirNueva}>
        Añadir fase
      </Button>
    </Box>
  );

  const dialogos = (
    <>
      <DialogoFase
        abierto={dialogoAbierto}
        proyectoId={proyectoId}
        fase={faseEnEdicion}
        alCerrar={() => setDialogoAbierto(false)}
      />
      <PanelPlanificar
        abierto={planificando}
        proyectoId={proyectoId}
        asignaciones={propuestas}
        nombrePorHito={nombrePorHito}
        alCerrar={() => setPlanificando(false)}
      />
    </>
  );

  /* Sin nada que dibujar */
  if (hitos.length === 0 && sprints.length === 0 && tareas.length === 0) {
    return (
      <Card>
        <CardContent>
          {cabecera}
          <Typography variant="body2" color="text.secondary">
            Este proyecto todavía no tiene fases. Genera el planteamiento con el panel
            «Planteamiento y roadmap» y acepta las fases propuestas, o añade una a mano.
          </Typography>
          {dialogos}
        </CardContent>
      </Card>
    );
  }

  /* Hay elementos pero ninguno con fecha: lista, sin eje temporal inventado */
  if (!escala) {
    return (
      <Card>
        <CardContent>
          {cabecera}
          <Box sx={{ display: 'grid', gap: 0.5 }}>
            {hitos.map((h) => (
              <Box key={h.id} sx={{ display: 'grid', gridTemplateColumns: `${ANCHO_ETIQUETA}px 1fr` }}>
                <FilaFase hito={h} ventana={undefined}
                          escala={{ granularidad: 'mes', inicio: 0, fin: 1, anchoMinimo: 0,
                                    fraccion: () => 0, cabeceras: [] }}
                          alEditar={abrirFase} />
              </Box>
            ))}
          </Box>
          <BloqueSinFecha
            tareas={sinFecha}
            puedePlanificar={false}
            motivoDeshabilitado="Ponle una fecha objetivo a alguna fase primero"
            alPlanificar={() => setPlanificando(true)}
          />
          {dialogos}
        </CardContent>
      </Card>
    );
  }

  const oscuro = tema.palette.mode === 'dark';

  return (
    <Card>
      <CardContent>
        {cabecera}

        <Box sx={{ overflowX: 'auto', pb: 1 }}>
          <Box sx={{
            minWidth: ANCHO_ETIQUETA + escala.anchoMinimo,
            display: 'grid',
            gridTemplateColumns: `${ANCHO_ETIQUETA}px 1fr`,
            rowGap: 0.5,
            position: 'relative',
          }}>
            {/* Cabecera del eje: la celda de etiquetas queda vacía */}
            <Box sx={{ position: 'sticky', left: 0, zIndex: 3, bgcolor: 'background.paper' }} />
            <EjeTiempo escala={escala} hoy={hoy} />

            {/* Sprints, si los hay */}
            {sprints.length > 0 && (
              <>
                <Box sx={{ position: 'sticky', left: 0, zIndex: 3, bgcolor: 'background.paper',
                           display: 'flex', alignItems: 'center', pr: 1.5, height: 26 }}>
                  <Typography variant="caption" color="text.secondary">Sprints</Typography>
                </Box>
                <Box sx={{ position: 'relative', height: 26 }}>
                  {sprints.map((s, i) => {
                    const a = aTiempo(s.fecha_inicio);
                    const b = aTiempo(s.fecha_fin);
                    if (a === null || b === null) return null;
                    const color = tema.palette.graficos[i % tema.palette.graficos.length];
                    const izq = escala.fraccion(a);
                    const der = escala.fraccion(b);
                    return (
                      <Tooltip key={s.id}
                               title={`${s.nombre} · ${fmtFecha(s.fecha_inicio)} → ${fmtFecha(s.fecha_fin)} · ${s.estado}`}>
                        <Box sx={{
                          position: 'absolute',
                          left: `${izq * 100}%`,
                          width: `${Math.max(der - izq, 0.01) * 100}%`,
                          top: 3, bottom: 3,
                          // La paleta de gráficos no tiene variante oscura: sin
                          // subir el alfa, estos verdes desaparecen sobre #161F1A.
                          bgcolor: alpha(color, oscuro ? 0.34 : 0.22),
                          border: `1px solid ${alpha(color, oscuro ? 0.85 : 0.55)}`,
                          borderRadius: 1.5,
                          display: 'flex', alignItems: 'center', px: 0.75, overflow: 'hidden',
                        }}>
                          <Typography variant="caption" noWrap
                                      sx={{ fontWeight: 600, fontSize: '0.65rem' }}>
                            {s.nombre}
                          </Typography>
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              </>
            )}

            {/* Una fila por fase */}
            {hitos.map((h) => (
              <FilaFase
                key={h.id}
                hito={h}
                ventana={ventanas.get(h.id)}
                escala={escala}
                alEditar={abrirFase}
              />
            ))}

            {/* Cruza todos los carriles menos la columna de etiquetas */}
            <Box sx={{ gridColumn: 2, gridRow: '1 / -1', position: 'relative', pointerEvents: 'none' }}>
              <LineaHoy escala={escala} hoy={hoy} />
            </Box>
          </Box>
        </Box>

        <BloqueSinFecha
          tareas={sinFecha}
          puedePlanificar={propuestas.length > 0}
          motivoDeshabilitado={
            ventanas.size === 0
              ? 'Ponle una fecha objetivo a alguna fase primero'
              : 'Estas tareas no están asignadas a ninguna fase con fechas'
          }
          alPlanificar={() => setPlanificando(true)}
        />

        {dialogos}
      </CardContent>
    </Card>
  );
}
