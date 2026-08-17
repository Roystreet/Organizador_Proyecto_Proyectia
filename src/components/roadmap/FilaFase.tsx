'use client';

import * as React from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { colorDe, ETIQUETAS } from '@/theme/theme';
import { fmtFecha } from '@/lib/formato';
import type { Escala, VentanaFase } from '@/lib/roadmap';
import type { FilaHitoRoadmap } from '@/lib/consultas';

export const ANCHO_ETIQUETA = 230;

/**
 * Una fase del roadmap: cuadradito de color, nombre, contador de tareas y la
 * barra con su extensión real, rematada por el rombo del hito.
 *
 * El relleno sólido de la izquierda es el avance (tareas completadas sobre el
 * total de la fase); el resto va en el tono suave. Una fase cuyo inicio se
 * dedujo lleva el borde izquierdo punteado: es una estimación, y se dice.
 */
export default function FilaFase({
  hito,
  ventana,
  escala,
  alEditar,
}: {
  hito: FilaHitoRoadmap;
  ventana: VentanaFase | undefined;
  escala: Escala;
  alEditar: (id: number) => void;
}) {
  const tema = useTheme();
  const c = colorDe(tema, 'estadoHito', hito.estado as never);
  const total = hito.tareas_total;
  const hechas = hito.tareas_completadas;
  const avance = total > 0 ? hechas / total : 0;
  const etiquetaEstado = ETIQUETAS.estadoHito[hito.estado as keyof typeof ETIQUETAS.estadoHito] ?? hito.estado;

  const izquierda = ventana ? escala.fraccion(ventana.inicio) : 0;
  const derecha = ventana ? escala.fraccion(ventana.fin) : 0;
  const ancho = Math.max(derecha - izquierda, 0.012);   // mínimo visible

  return (
    <>
      {/* Columna de etiqueta: se queda fija al hacer scroll horizontal */}
      <Box
        sx={{
          position: 'sticky', left: 0, zIndex: 3,
          bgcolor: 'background.paper',
          display: 'flex', alignItems: 'center', gap: 1,
          pr: 1.5, minWidth: 0, height: 34,
          cursor: 'pointer',
        }}
        onClick={() => alEditar(hito.id)}
      >
        <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: c.main, flexShrink: 0 }} />
        <Typography variant="body2" noWrap sx={{ fontWeight: 600, flexGrow: 1, minWidth: 0 }}>
          {hito.nombre}
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          label={`${hechas}/${total}`}
          sx={{ height: 19, fontSize: '0.65rem', flexShrink: 0 }}
        />
      </Box>

      {/* Pista temporal */}
      <Box sx={{ position: 'relative', height: 34, display: 'flex', alignItems: 'center' }}>
        {ventana ? (
          <Tooltip
            title={
              `${hito.nombre} · ${etiquetaEstado} · ${hechas}/${total} tareas · `
              + `${fmtFecha(new Date(ventana.inicio))} → ${fmtFecha(new Date(ventana.fin))}`
              + (ventana.inicioDerivado ? ' · inicio estimado desde la fase anterior' : '')
            }
          >
            <Box
              sx={{
                position: 'absolute',
                left: `${izquierda * 100}%`,
                width: `${ancho * 100}%`,
                height: 22,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  flexGrow: 1,
                  height: '100%',
                  bgcolor: c.suave,
                  border: `1px solid ${alpha(c.main, 0.55)}`,
                  borderLeft: ventana.inicioDerivado
                    ? `2px dashed ${alpha(c.main, 0.7)}`
                    : `1px solid ${alpha(c.main, 0.55)}`,
                  borderRadius: '6px 0 0 6px',
                  overflow: 'hidden',
                }}
              >
                {avance > 0 && (
                  <Box sx={{ width: `${avance * 100}%`, height: '100%', bgcolor: c.main }} />
                )}
              </Box>
              {/* El rombo es el hito en sí: el instante que se compromete */}
              <Box
                sx={{
                  width: 11, height: 11, flexShrink: 0,
                  bgcolor: c.main,
                  transform: 'rotate(45deg)',
                  borderRadius: '2px',
                  ml: '-6px',
                }}
              />
            </Box>
          </Tooltip>
        ) : (
          <Typography variant="caption" color="text.disabled" sx={{ pl: 0.5 }}>
            sin fecha objetivo — ponle una para verla en la línea de tiempo
          </Typography>
        )}
      </Box>
    </>
  );
}
