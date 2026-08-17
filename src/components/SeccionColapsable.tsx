'use client';

import * as React from 'react';
import { Box, Collapse, Typography } from '@mui/material';
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined';

/**
 * Encabezado clicable + contenido plegable.
 *
 * Estaba duplicado literalmente en PanelIa y PanelPlanteamiento; ahora que un
 * tercer sitio lo necesita (la tarjeta «De qué trata»), vive en un solo lugar.
 */
export default function SeccionColapsable({
  titulo,
  children,
  inicial = true,
}: {
  titulo: string;
  children: React.ReactNode;
  /** false para que arranque plegada: útil cuando el contenido es secundario. */
  inicial?: boolean;
}) {
  const [abierto, setAbierto] = React.useState(inicial);
  return (
    <Box>
      <Box
        onClick={() => setAbierto((v) => !v)}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none' }}
      >
        <Typography variant="overline" color="text.secondary">{titulo}</Typography>
        <ExpandMoreOutlined
          fontSize="small"
          sx={{ color: 'text.disabled', transform: abierto ? 'rotate(180deg)' : 'none', transition: '.2s' }}
        />
      </Box>
      <Collapse in={abierto}>{children}</Collapse>
    </Box>
  );
}
