'use client';

/**
 * Proveedor de tema para el App Router de Next.js.
 * Guarda la preferencia claro/oscuro en memoria y respeta la del sistema
 * en el primer render.
 *
 *   // app/layout.tsx
 *   <ThemeRegistry>{children}</ThemeRegistry>
 */
import * as React from 'react';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { crearTema } from './theme';

type Modo = 'light' | 'dark';

const ContextoModo = React.createContext<{ modo: Modo; alternar: () => void }>({
  modo: 'light',
  alternar: () => {},
});

export const useModoColor = () => React.useContext(ContextoModo);

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const prefiereOscuro = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: false });
  const [modo, setModo] = React.useState<Modo>('light');

  React.useEffect(() => {
    setModo(prefiereOscuro ? 'dark' : 'light');
  }, [prefiereOscuro]);

  const tema = React.useMemo(() => crearTema(modo), [modo]);
  const valor = React.useMemo(
    () => ({ modo, alternar: () => setModo((m) => (m === 'light' ? 'dark' : 'light')) }),
    [modo],
  );

  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <ContextoModo.Provider value={valor}>
        <ThemeProvider theme={tema}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </ContextoModo.Provider>
    </AppRouterCacheProvider>
  );
}
