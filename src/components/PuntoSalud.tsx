'use client';

import { Box, Tooltip, useTheme } from '@mui/material';
import { colorDe, ETIQUETAS } from '@/theme/theme';
import type { Salud } from '@/lib/ai/tipos';

export default function PuntoSalud({ salud, tam = 10 }: { salud: Salud; tam?: number }) {
  const tema = useTheme();
  const c = colorDe(tema, 'salud', salud);
  return (
    <Tooltip title={ETIQUETAS.salud[salud]}>
      <Box
        component="span"
        aria-label={ETIQUETAS.salud[salud]}
        sx={{
          width: tam, height: tam, borderRadius: '50%', bgcolor: c.main,
          display: 'inline-block', flexShrink: 0,
          boxShadow: `0 0 0 3px ${c.main}22`,
        }}
      />
    </Tooltip>
  );
}
