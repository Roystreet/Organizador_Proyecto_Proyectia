'use client';

import * as React from 'react';
import { Box, Typography } from '@mui/material';
import type { Escala } from '@/lib/roadmap';

/**
 * Cabecera del eje y línea de HOY.
 *
 * Se dibuja sobre una pista `position: relative` de ancho completo; todo se
 * posiciona por fracción, así que no depende de la granularidad elegida.
 */
export default function EjeTiempo({ escala, hoy }: { escala: Escala; hoy: number }) {
  const hayHoy = hoy >= escala.inicio && hoy <= escala.fin;

  return (
    <Box sx={{ position: 'relative', height: 26, mb: 0.5 }}>
      {escala.cabeceras.map((c, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            left: `${c.desde * 100}%`,
            width: `${(c.hasta - c.desde) * 100}%`,
            top: 0,
            bottom: 0,
            borderLeft: i === 0 ? 'none' : '1px solid',
            borderColor: c.inicioDeAnio ? 'text.disabled' : 'divider',
            pl: 0.75,
            display: 'flex',
            alignItems: 'flex-end',
            overflow: 'hidden',
          }}
        >
          <Typography
            variant="caption"
            noWrap
            sx={{
              color: 'text.secondary',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontSize: '0.65rem',
            }}
          >
            {c.etiqueta}
          </Typography>
        </Box>
      ))}

      {hayHoy && (
        <Box
          sx={{
            position: 'absolute',
            left: `${escala.fraccion(hoy) * 100}%`,
            top: 2,
            transform: 'translateX(-50%)',
            px: 0.6,
            borderRadius: 5,
            bgcolor: 'error.main',
            color: '#fff',
            fontSize: '0.6rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            lineHeight: 1.6,
            zIndex: 3,
            pointerEvents: 'none',
          }}
        >
          HOY
        </Box>
      )}
    </Box>
  );
}

/** La línea vertical de HOY, que cruza todos los carriles. */
export function LineaHoy({ escala, hoy }: { escala: Escala; hoy: number }) {
  if (hoy < escala.inicio || hoy > escala.fin) return null;
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        left: `${escala.fraccion(hoy) * 100}%`,
        top: 0,
        bottom: 0,
        borderLeft: '2px dashed',
        borderColor: 'error.main',
        opacity: 0.55,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  );
}
