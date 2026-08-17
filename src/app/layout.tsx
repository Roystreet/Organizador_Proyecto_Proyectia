import type { Metadata } from 'next';
import ThemeRegistry from '@/theme/ThemeRegistry';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Organizador de Proyectos',
  description: 'Gestión de proyectos con análisis asistido por IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>
        <ThemeRegistry>
          <Shell>{children}</Shell>
        </ThemeRegistry>
      </body>
    </html>
  );
}
