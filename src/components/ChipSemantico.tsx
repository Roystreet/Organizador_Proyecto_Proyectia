'use client';

import { Chip, useTheme, type ChipProps } from '@mui/material';
import { colorDe, ETIQUETAS } from '@/theme/theme';

type Grupo = keyof typeof ETIQUETAS;

interface Props extends Omit<ChipProps, 'color' | 'label'> {
  grupo: Grupo;
  valor: string;
  etiqueta?: string;
}

/**
 * Chip pintado con la escala semántica del tema. Toda la app pinta estados a
 * través de este componente, así que cambiar un color se hace en un solo sitio.
 */
export default function ChipSemantico({ grupo, valor, etiqueta, sx, ...resto }: Props) {
  const tema = useTheme();
  const mapa = ETIQUETAS[grupo] as Record<string, string>;
  const c = colorDe(tema, grupo, valor as never);

  return (
    <Chip
      size="small"
      label={etiqueta ?? mapa?.[valor] ?? valor}
      sx={{ bgcolor: c.suave, color: c.contraste, border: `1px solid ${c.main}33`, ...sx }}
      {...resto}
    />
  );
}
