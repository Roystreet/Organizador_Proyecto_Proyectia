'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Box, InputAdornment, MenuItem, TextField } from '@mui/material';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { ETIQUETAS } from '@/theme/theme';

/**
 * Filtros del directorio CRM. El estado vive en la URL (searchParams), así que
 * la página servidor re-consulta con cada cambio y los filtros son enlazables.
 */
export default function BarraFiltrosPersonas({
  empresas,
  habilidades,
  sectores,
}: {
  empresas: { id: number; nombre: string }[];
  habilidades: { id: number; nombre: string }[];
  sectores: { id: number; nombre: string }[];
}) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get('q') ?? '');

  const aplicar = React.useCallback((cambios: Record<string, string>) => {
    const query = new URLSearchParams(params.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) query.set(clave, valor);
      else query.delete(clave);
    }
    router.replace(query.size > 0 ? `${ruta}?${query}` : ruta);
  }, [params, router, ruta]);

  // La búsqueda de texto espera 400 ms de silencio antes de tocar la URL.
  React.useEffect(() => {
    const actual = params.get('q') ?? '';
    if (q === actual) return;
    const temporizador = setTimeout(() => aplicar({ q }), 400);
    return () => clearTimeout(temporizador);
  }, [q, params, aplicar]);

  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
      <TextField
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, email o rol…"
        sx={{ minWidth: 260, flexGrow: 1, maxWidth: 380 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <TextField select label="Tipo de relación" value={params.get('tipo') ?? ''}
                 onChange={(e) => aplicar({ tipo: e.target.value })} sx={{ minWidth: 170 }}>
        <MenuItem value="">Todos</MenuItem>
        {Object.entries(ETIQUETAS.tipoRelacion).map(([valor, etiqueta]) => (
          <MenuItem key={valor} value={valor}>{etiqueta}</MenuItem>
        ))}
      </TextField>

      <TextField select label="Empresa" value={params.get('empresa') ?? ''}
                 onChange={(e) => aplicar({ empresa: e.target.value })} sx={{ minWidth: 170 }}>
        <MenuItem value="">Todas</MenuItem>
        {empresas.map((e) => (
          <MenuItem key={e.id} value={String(e.id)}>{e.nombre}</MenuItem>
        ))}
      </TextField>

      <TextField select label="Habilidad" value={params.get('habilidad') ?? ''}
                 onChange={(e) => aplicar({ habilidad: e.target.value })} sx={{ minWidth: 170 }}>
        <MenuItem value="">Todas</MenuItem>
        {habilidades.map((h) => (
          <MenuItem key={h.id} value={String(h.id)}>{h.nombre}</MenuItem>
        ))}
      </TextField>

      <TextField select label="Sector" value={params.get('sector') ?? ''}
                 onChange={(e) => aplicar({ sector: e.target.value })} sx={{ minWidth: 170 }}>
        <MenuItem value="">Todos</MenuItem>
        {sectores.map((s) => (
          <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>
        ))}
      </TextField>
    </Box>
  );
}
