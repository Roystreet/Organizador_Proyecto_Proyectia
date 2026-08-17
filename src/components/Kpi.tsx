'use client';

import { Card, CardContent, Typography, Box } from '@mui/material';

interface Props {
  etiqueta: string;
  valor: number | string;
  detalle?: string;
  /** Color del valor. Se usa solo cuando el número en sí es una alerta. */
  tono?: 'normal' | 'alerta' | 'critico';
  icono?: React.ReactNode;
}

export default function Kpi({ etiqueta, valor, detalle, tono = 'normal', icono }: Props) {
  const color =
    tono === 'critico' ? 'error.main' : tono === 'alerta' ? 'warning.main' : 'text.primary';

  return (
    <Card>
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            {etiqueta}
          </Typography>
          {icono && <Box sx={{ color: 'text.disabled', display: 'flex' }}>{icono}</Box>}
        </Box>
        <Typography sx={{ fontSize: '1.9rem', fontWeight: 700, lineHeight: 1.1, color }}>
          {valor}
        </Typography>
        {detalle && (
          <Typography variant="caption" color="text.secondary">{detalle}</Typography>
        )}
      </CardContent>
    </Card>
  );
}
