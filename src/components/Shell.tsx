'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AppBar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, Toolbar, Typography, Tooltip,
} from '@mui/material';
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import BusinessOutlined from '@mui/icons-material/BusinessOutlined';
import EventOutlined from '@mui/icons-material/EventOutlined';
import HubOutlined from '@mui/icons-material/HubOutlined';
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import { useModoColor } from '@/theme/ThemeRegistry';

const ANCHO = 232;

const NAV = [
  { href: '/',          etiqueta: 'Dashboard', Icono: SpaceDashboardOutlined },
  { href: '/proyectos', etiqueta: 'Proyectos', Icono: FolderOutlined },
  { href: '/personas',  etiqueta: 'Personas',  Icono: GroupsOutlined },
  { href: '/empresas',  etiqueta: 'Empresas',  Icono: BusinessOutlined },
  { href: '/agenda', etiqueta: 'Agenda', Icono: EventOutlined },
  { href: '/aprendizajes', etiqueta: 'Aprendizajes', Icono: LightbulbOutlined },
  { href: '/grafo', etiqueta: 'Grafo', Icono: HubOutlined },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  const { modo, alternar } = useModoColor();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: ANCHO,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: ANCHO, boxSizing: 'border-box' },
        }}
      >
        <Toolbar sx={{ px: 2.5 }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.15 }}>
              Organizador
            </Typography>
            <Typography variant="caption" color="text.secondary">
              de Proyectos
            </Typography>
          </Box>
        </Toolbar>

        <List sx={{ pt: 1 }}>
          {NAV.map(({ href, etiqueta, Icono }) => {
            const activo = href === '/' ? ruta === '/' : ruta.startsWith(href);
            return (
              <ListItemButton
                key={href}
                component={Link}
                href={href}
                selected={activo}
                sx={{ mb: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 38 }}><Icono fontSize="small" /></ListItemIcon>
                <ListItemText
                  primary={etiqueta}
                  slotProps={{ primary: { sx: { fontSize: '0.875rem', fontWeight: activo ? 700 : 500 } } }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>

      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky">
          <Toolbar sx={{ gap: 1 }}>
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title={modo === 'light' ? 'Modo oscuro' : 'Modo claro'}>
              <IconButton onClick={alternar} size="small">
                {modo === 'light'
                  ? <DarkModeOutlined fontSize="small" />
                  : <LightModeOutlined fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ p: { xs: 2, md: 3 }, flexGrow: 1 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
