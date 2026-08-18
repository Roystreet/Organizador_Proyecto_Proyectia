'use client';

import Link from 'next/link';
import { Box, Chip, Tab, Tabs } from '@mui/material';

export interface Pestana {
  clave: string;
  etiqueta: string;
  /** Se pinta al lado del nombre. Se omite cuando es 0. */
  contador?: number;
}

/**
 * Las pestañas son enlaces reales, no estado de cliente: la vista activa vive
 * en `?vista=` y el servidor consulta solo lo de esa pestaña. Así la URL se
 * comparte, sobrevive a F5 y el botón atrás del navegador funciona.
 */
export default function PestanasProyecto({
  base, activa, pestanas,
}: {
  /** Ruta de la ficha, p. ej. `/proyectos/7`. */
  base: string;
  activa: string;
  pestanas: Pestana[];
}) {
  return (
    <Tabs
      value={activa}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 44 }}
    >
      {pestanas.map((p) => (
        <Tab
          key={p.clave}
          value={p.clave}
          component={Link}
          href={p.clave === 'resumen' ? base : `${base}?vista=${p.clave}`}
          scroll={false}
          sx={{ minHeight: 44, py: 1 }}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {p.etiqueta}
              {Boolean(p.contador) && (
                <Chip size="small" label={p.contador} sx={{ height: 18, fontSize: '0.6875rem' }} />
              )}
            </Box>
          }
        />
      ))}
    </Tabs>
  );
}
