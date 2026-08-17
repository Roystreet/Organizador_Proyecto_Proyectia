/**
 * Tema de Material UI · Organizador de Proyectos
 *
 * Paleta dominante en verdes. La idea del sistema es que el color signifique
 * algo: el verde es la marca, pero los estados (salud, prioridad, severidad)
 * tienen su propia escala semántica para que el dashboard se lea de un vistazo
 * sin tener que leer texto.
 *
 * Uso:
 *   import { crearTema } from '@/theme/theme';
 *   const tema = crearTema('light');
 *   <ThemeProvider theme={tema}><CssBaseline />…</ThemeProvider>
 */
import { createTheme, alpha, type Theme, type PaletteMode } from '@mui/material/styles';

/* -------------------------------------------------------------------------- */
/*  1 · Escalas de color                                                       */
/* -------------------------------------------------------------------------- */

/** Verde de marca. Escala completa para poder usar tonos consistentes. */
export const verde = {
  50:  '#E8F5E9',
  100: '#C8E6C9',
  200: '#A5D6A7',
  300: '#81C784',
  400: '#66BB6A',
  500: '#4CAF50',
  600: '#43A047',
  700: '#388E3C',
  800: '#2E7D32',
  900: '#1B5E20',
} as const;

/** Verde azulado, usado como color secundario para acentos y datos. */
export const verdeAzulado = {
  50:  '#E0F2F1',
  100: '#B2DFDB',
  200: '#80CBC4',
  300: '#4DB6AC',
  400: '#26A69A',
  500: '#009688',
  600: '#00897B',
  700: '#00796B',
  800: '#00695C',
  900: '#004D40',
} as const;

/** Neutros con una pizca de verde: evita el gris azulado por defecto de MUI. */
export const neutro = {
  50:  '#F6F8F5',
  100: '#EDF1EB',
  200: '#DDE4DA',
  300: '#C2CCBE',
  400: '#9AA896',
  500: '#77856F',
  600: '#5B6755',
  700: '#414A3D',
  800: '#2A312A',
  900: '#171C17',
} as const;

/* -------------------------------------------------------------------------- */
/*  2 · Colores semánticos del dominio                                         */
/* -------------------------------------------------------------------------- */

export type ClaveSalud = 'verde' | 'amarillo' | 'rojo' | 'sin_datos';
export type ClavePrioridad = 'baja' | 'media' | 'alta' | 'critica';
export type ClaveEstadoProyecto =
  | 'idea' | 'planificacion' | 'en_progreso' | 'en_pausa'
  | 'en_revision' | 'completado' | 'cancelado';
export type ClaveEstadoTarea =
  | 'pendiente' | 'en_progreso' | 'en_revision' | 'bloqueada' | 'completada' | 'cancelada';
export type ClaveEstadoAsunto =
  | 'pendiente' | 'en_progreso' | 'en_espera' | 'resuelto' | 'cerrado' | 'descartado';
export type ClaveEstadoHito =
  | 'pendiente' | 'en_progreso' | 'completado' | 'atrasado' | 'cancelado';
export type ClaveTipoRelacion =
  | 'interno' | 'freelance' | 'cliente' | 'stakeholder' | 'proveedor' | 'candidato';
export type ClaveTipoEmpresa = 'cliente' | 'proveedor' | 'aliado' | 'interna' | 'prospecto';

export interface ColorSemantico {
  /** Color sólido: texto sobre fondo claro, punto de estado, borde. */
  main: string;
  /** Fondo suave para chips y filas resaltadas. */
  suave: string;
  /** Texto legible sobre `suave`. */
  contraste: string;
}

const construir = (main: string, suave: string, contraste: string): ColorSemantico =>
  ({ main, suave, contraste });

const semanticosClaro = {
  salud: {
    verde:     construir('#2E7D32', '#E8F5E9', '#1B5E20'),
    amarillo:  construir('#F9A825', '#FFF8E1', '#7A4F01'),
    rojo:      construir('#C62828', '#FFEBEE', '#8E0000'),
    sin_datos: construir('#9AA896', '#F1F3F0', '#414A3D'),
  } satisfies Record<ClaveSalud, ColorSemantico>,

  prioridad: {
    baja:    construir('#7CB342', '#F1F8E9', '#33691E'),
    media:   construir('#0288D1', '#E1F5FE', '#01579B'),
    alta:    construir('#EF6C00', '#FFF3E0', '#983500'),
    critica: construir('#C62828', '#FFEBEE', '#8E0000'),
  } satisfies Record<ClavePrioridad, ColorSemantico>,

  estadoProyecto: {
    idea:          construir('#78909C', '#ECEFF1', '#37474F'),
    planificacion: construir('#00897B', '#E0F2F1', '#00695C'),
    en_progreso:   construir('#2E7D32', '#E8F5E9', '#1B5E20'),
    en_pausa:      construir('#F9A825', '#FFF8E1', '#7A4F01'),
    en_revision:   construir('#6A1B9A', '#F3E5F5', '#4A148C'),
    completado:    construir('#1B5E20', '#DCEDC8', '#0F3D12'),
    cancelado:     construir('#757575', '#F5F5F5', '#424242'),
  } satisfies Record<ClaveEstadoProyecto, ColorSemantico>,

  estadoTarea: {
    pendiente:   construir('#78909C', '#ECEFF1', '#37474F'),
    en_progreso: construir('#2E7D32', '#E8F5E9', '#1B5E20'),
    en_revision: construir('#6A1B9A', '#F3E5F5', '#4A148C'),
    bloqueada:   construir('#C62828', '#FFEBEE', '#8E0000'),
    completada:  construir('#43A047', '#DCEDC8', '#1B5E20'),
    cancelada:   construir('#9E9E9E', '#F5F5F5', '#424242'),
  } satisfies Record<ClaveEstadoTarea, ColorSemantico>,

  estadoAsunto: {
    pendiente:   construir('#EF6C00', '#FFF3E0', '#983500'),
    en_progreso: construir('#0288D1', '#E1F5FE', '#01579B'),
    en_espera:   construir('#6A1B9A', '#F3E5F5', '#4A148C'),
    resuelto:    construir('#2E7D32', '#E8F5E9', '#1B5E20'),
    cerrado:     construir('#546E7A', '#ECEFF1', '#263238'),
    descartado:  construir('#9E9E9E', '#F5F5F5', '#424242'),
  } satisfies Record<ClaveEstadoAsunto, ColorSemantico>,

  estadoHito: {
    pendiente:   construir('#78909C', '#ECEFF1', '#37474F'),
    en_progreso: construir('#2E7D32', '#E8F5E9', '#1B5E20'),
    completado:  construir('#43A047', '#DCEDC8', '#1B5E20'),
    atrasado:    construir('#C62828', '#FFEBEE', '#8E0000'),
    cancelado:   construir('#9E9E9E', '#F5F5F5', '#424242'),
  } satisfies Record<ClaveEstadoHito, ColorSemantico>,

  tipoRelacion: {
    interno:     construir('#2E7D32', '#E8F5E9', '#1B5E20'),
    freelance:   construir('#00897B', '#E0F2F1', '#00695C'),
    cliente:     construir('#0288D1', '#E1F5FE', '#01579B'),
    stakeholder: construir('#6A1B9A', '#F3E5F5', '#4A148C'),
    proveedor:   construir('#EF6C00', '#FFF3E0', '#983500'),
    candidato:   construir('#78909C', '#ECEFF1', '#37474F'),
  } satisfies Record<ClaveTipoRelacion, ColorSemantico>,

  tipoEmpresa: {
    cliente:   construir('#0288D1', '#E1F5FE', '#01579B'),
    proveedor: construir('#EF6C00', '#FFF3E0', '#983500'),
    aliado:    construir('#00897B', '#E0F2F1', '#00695C'),
    interna:   construir('#2E7D32', '#E8F5E9', '#1B5E20'),
    prospecto: construir('#78909C', '#ECEFF1', '#37474F'),
  } satisfies Record<ClaveTipoEmpresa, ColorSemantico>,
};

/** En oscuro se sube la luminosidad del sólido y el "suave" pasa a ser translúcido. */
const semanticosOscuro: typeof semanticosClaro = {
  salud: {
    verde:     construir('#66BB6A', alpha('#66BB6A', 0.16), '#A5D6A7'),
    amarillo:  construir('#FFCA28', alpha('#FFCA28', 0.16), '#FFE082'),
    rojo:      construir('#EF5350', alpha('#EF5350', 0.16), '#EF9A9A'),
    sin_datos: construir('#9AA896', alpha('#9AA896', 0.16), '#C2CCBE'),
  },
  prioridad: {
    baja:    construir('#9CCC65', alpha('#9CCC65', 0.16), '#C5E1A5'),
    media:   construir('#29B6F6', alpha('#29B6F6', 0.16), '#81D4FA'),
    alta:    construir('#FFA726', alpha('#FFA726', 0.16), '#FFCC80'),
    critica: construir('#EF5350', alpha('#EF5350', 0.16), '#EF9A9A'),
  },
  estadoProyecto: {
    idea:          construir('#B0BEC5', alpha('#B0BEC5', 0.16), '#CFD8DC'),
    planificacion: construir('#4DB6AC', alpha('#4DB6AC', 0.16), '#80CBC4'),
    en_progreso:   construir('#66BB6A', alpha('#66BB6A', 0.16), '#A5D6A7'),
    en_pausa:      construir('#FFCA28', alpha('#FFCA28', 0.16), '#FFE082'),
    en_revision:   construir('#BA68C8', alpha('#BA68C8', 0.16), '#CE93D8'),
    completado:    construir('#81C784', alpha('#81C784', 0.16), '#C8E6C9'),
    cancelado:     construir('#BDBDBD', alpha('#BDBDBD', 0.16), '#E0E0E0'),
  },
  estadoTarea: {
    pendiente:   construir('#B0BEC5', alpha('#B0BEC5', 0.16), '#CFD8DC'),
    en_progreso: construir('#66BB6A', alpha('#66BB6A', 0.16), '#A5D6A7'),
    en_revision: construir('#BA68C8', alpha('#BA68C8', 0.16), '#CE93D8'),
    bloqueada:   construir('#EF5350', alpha('#EF5350', 0.16), '#EF9A9A'),
    completada:  construir('#81C784', alpha('#81C784', 0.16), '#C8E6C9'),
    cancelada:   construir('#BDBDBD', alpha('#BDBDBD', 0.16), '#E0E0E0'),
  },
  estadoAsunto: {
    pendiente:   construir('#FFA726', alpha('#FFA726', 0.16), '#FFCC80'),
    en_progreso: construir('#29B6F6', alpha('#29B6F6', 0.16), '#81D4FA'),
    en_espera:   construir('#BA68C8', alpha('#BA68C8', 0.16), '#CE93D8'),
    resuelto:    construir('#66BB6A', alpha('#66BB6A', 0.16), '#A5D6A7'),
    cerrado:     construir('#90A4AE', alpha('#90A4AE', 0.16), '#B0BEC5'),
    descartado:  construir('#BDBDBD', alpha('#BDBDBD', 0.16), '#E0E0E0'),
  },
  estadoHito: {
    pendiente:   construir('#B0BEC5', alpha('#B0BEC5', 0.16), '#CFD8DC'),
    en_progreso: construir('#66BB6A', alpha('#66BB6A', 0.16), '#A5D6A7'),
    completado:  construir('#81C784', alpha('#81C784', 0.16), '#C8E6C9'),
    atrasado:    construir('#EF5350', alpha('#EF5350', 0.16), '#EF9A9A'),
    cancelado:   construir('#BDBDBD', alpha('#BDBDBD', 0.16), '#E0E0E0'),
  },
  tipoRelacion: {
    interno:     construir('#66BB6A', alpha('#66BB6A', 0.16), '#A5D6A7'),
    freelance:   construir('#4DB6AC', alpha('#4DB6AC', 0.16), '#80CBC4'),
    cliente:     construir('#29B6F6', alpha('#29B6F6', 0.16), '#81D4FA'),
    stakeholder: construir('#BA68C8', alpha('#BA68C8', 0.16), '#CE93D8'),
    proveedor:   construir('#FFA726', alpha('#FFA726', 0.16), '#FFCC80'),
    candidato:   construir('#B0BEC5', alpha('#B0BEC5', 0.16), '#CFD8DC'),
  },
  tipoEmpresa: {
    cliente:   construir('#29B6F6', alpha('#29B6F6', 0.16), '#81D4FA'),
    proveedor: construir('#FFA726', alpha('#FFA726', 0.16), '#FFCC80'),
    aliado:    construir('#4DB6AC', alpha('#4DB6AC', 0.16), '#80CBC4'),
    interna:   construir('#66BB6A', alpha('#66BB6A', 0.16), '#A5D6A7'),
    prospecto: construir('#B0BEC5', alpha('#B0BEC5', 0.16), '#CFD8DC'),
  },
};

/** Paleta categórica para gráficos. Ordenada por distinguibilidad, no por tono. */
export const paletaGraficos = [
  '#2E7D32', '#00897B', '#7CB342', '#00ACC1',
  '#558B2F', '#26A69A', '#9CCC65', '#0097A7',
] as const;

/* -------------------------------------------------------------------------- */
/*  3 · Ampliación de tipos de MUI                                             */
/* -------------------------------------------------------------------------- */

declare module '@mui/material/styles' {
  interface Palette {
    semantico: typeof semanticosClaro;
    graficos: readonly string[];
  }
  interface PaletteOptions {
    semantico?: typeof semanticosClaro;
    graficos?: readonly string[];
  }
  interface TypeBackground {
    sutil: string;
  }
}

/* -------------------------------------------------------------------------- */
/*  4 · Fábrica del tema                                                       */
/* -------------------------------------------------------------------------- */

export function crearTema(modo: PaletteMode = 'light'): Theme {
  const esClaro = modo === 'light';
  const semantico = esClaro ? semanticosClaro : semanticosOscuro;

  const base = createTheme({
    palette: {
      mode: modo,
      primary: esClaro
        ? { main: verde[800], light: verde[500], dark: verde[900], contrastText: '#FFFFFF' }
        : { main: verde[400], light: verde[300], dark: verde[700], contrastText: '#0B120E' },
      secondary: esClaro
        ? { main: verdeAzulado[700], light: verdeAzulado[400], dark: verdeAzulado[900], contrastText: '#FFFFFF' }
        : { main: verdeAzulado[300], light: verdeAzulado[200], dark: verdeAzulado[600], contrastText: '#0B120E' },
      success: { main: esClaro ? verde[700] : verde[400] },
      warning: { main: esClaro ? '#F9A825' : '#FFCA28' },
      error:   { main: esClaro ? '#C62828' : '#EF5350' },
      info:    { main: esClaro ? '#0277BD' : '#29B6F6' },
      background: esClaro
        ? { default: neutro[50], paper: '#FFFFFF', sutil: neutro[100] }
        : { default: '#0E1512', paper: '#161F1A', sutil: '#1C2721' },
      text: esClaro
        ? { primary: neutro[900], secondary: neutro[600], disabled: neutro[400] }
        : { primary: '#E8EFE9', secondary: '#A9B8AC', disabled: '#6E7C71' },
      divider: esClaro ? alpha(neutro[400], 0.28) : alpha('#A9B8AC', 0.18),
      semantico,
      graficos: paletaGraficos,
    },

    shape: { borderRadius: 10 },

    typography: {
      fontFamily: [
        'Inter', 'Roboto', '-apple-system', 'BlinkMacSystemFont',
        '"Segoe UI"', 'Arial', 'sans-serif',
      ].join(','),
      h1: { fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.015em' },
      h3: { fontSize: '1.375rem', fontWeight: 600 },
      h4: { fontSize: '1.125rem', fontWeight: 600 },
      h5: { fontSize: '1rem',     fontWeight: 600 },
      h6: { fontSize: '0.9375rem', fontWeight: 600 },
      subtitle2: { fontWeight: 600, letterSpacing: '0.01em' },
      body2: { lineHeight: 1.6 },
      // Etiquetas de sección: mayúsculas pequeñas, para encabezados de tarjeta.
      overline: { fontWeight: 700, letterSpacing: '0.08em', fontSize: '0.6875rem' },
      button: { textTransform: 'none', fontWeight: 600 },
    },

    spacing: 8,
  });

  /* Overrides de componentes. Se hacen en un segundo createTheme para poder
     leer `base.palette` dentro de los estilos. */
  return createTheme(base, {
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: base.palette.background.default,
            // Barra de scroll discreta, en verde.
            scrollbarColor: `${alpha(base.palette.primary.main, 0.45)} transparent`,
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: alpha(base.palette.primary.main, 0.45),
              borderRadius: 8,
            },
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },

      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${base.palette.divider}`,
            borderRadius: 14,
            transition: 'border-color .18s ease, box-shadow .18s ease',
            '&:hover': {
              borderColor: alpha(base.palette.primary.main, 0.45),
              boxShadow: `0 4px 18px ${alpha(base.palette.primary.main, 0.10)}`,
            },
          },
        },
      },

      MuiCardHeader: {
        styleOverrides: {
          title: { fontSize: '1rem', fontWeight: 600 },
          subheader: { fontSize: '0.8125rem' },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 9, paddingInline: 16 },
          containedPrimary: {
            '&:hover': { backgroundColor: base.palette.primary.dark },
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: 7 },
          sizeSmall: { height: 22, fontSize: '0.75rem' },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: {
            height: 7,
            borderRadius: 4,
            backgroundColor: alpha(base.palette.primary.main, 0.14),
          },
          bar: { borderRadius: 4 },
        },
      },

      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'inherit' },
        styleOverrides: {
          root: {
            backgroundColor: base.palette.background.paper,
            borderBottom: `1px solid ${base.palette.divider}`,
          },
        },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: base.palette.background.paper,
            borderRight: `1px solid ${base.palette.divider}`,
          },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            marginInline: 8,
            '&.Mui-selected': {
              backgroundColor: alpha(base.palette.primary.main, 0.12),
              color: base.palette.primary.main,
              '& .MuiListItemIcon-root': { color: base.palette.primary.main },
              '&:hover': { backgroundColor: alpha(base.palette.primary.main, 0.18) },
            },
          },
        },
      },

      MuiTextField: {
        defaultProps: { size: 'small', variant: 'outlined' },
      },

      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: base.palette.text.secondary,
            backgroundColor: base.palette.background.sutil,
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: alpha(neutro[900], 0.94),
            fontSize: '0.75rem',
            borderRadius: 7,
          },
        },
      },

      MuiTabs: {
        styleOverrides: {
          indicator: { height: 3, borderRadius: 3 },
        },
      },
    },
  });
}

/* -------------------------------------------------------------------------- */
/*  5 · Helpers para pintar estados en los componentes                          */
/* -------------------------------------------------------------------------- */

/**
 * Devuelve los tres colores de un valor semántico.
 *   const c = colorDe(theme, 'salud', proyecto.salud);
 *   <Chip sx={{ bgcolor: c.suave, color: c.contraste }} />
 */
export function colorDe<G extends keyof typeof semanticosClaro>(
  tema: Theme,
  grupo: G,
  clave: keyof (typeof semanticosClaro)[G],
): ColorSemantico {
  return tema.palette.semantico[grupo][clave] as ColorSemantico;
}

/** Etiquetas legibles para la UI. Mantener sincronizadas con los ENUM del SQL. */
export const ETIQUETAS = {
  salud: {
    verde: 'Saludable', amarillo: 'En riesgo', rojo: 'Crítico', sin_datos: 'Sin datos',
  },
  prioridad: { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' },
  estadoProyecto: {
    idea: 'Idea', planificacion: 'Planificación', en_progreso: 'En progreso',
    en_pausa: 'En pausa', en_revision: 'En revisión', completado: 'Completado',
    cancelado: 'Cancelado',
  },
  estadoTarea: {
    pendiente: 'Pendiente', en_progreso: 'En progreso', en_revision: 'En revisión',
    bloqueada: 'Bloqueada', completada: 'Completada', cancelada: 'Cancelada',
  },
  estadoAsunto: {
    pendiente: 'Pendiente', en_progreso: 'En progreso', en_espera: 'En espera',
    resuelto: 'Resuelto', cerrado: 'Cerrado', descartado: 'Descartado',
  },
  estadoHito: {
    pendiente: 'Pendiente', en_progreso: 'En progreso', completado: 'Completado',
    atrasado: 'Atrasado', cancelado: 'Cancelado',
  },
  tipoRelacion: {
    interno: 'Interno', freelance: 'Freelance', cliente: 'Cliente',
    stakeholder: 'Stakeholder', proveedor: 'Proveedor', candidato: 'Candidato',
  },
  tipoEmpresa: {
    cliente: 'Cliente', proveedor: 'Proveedor', aliado: 'Aliado',
    interna: 'Interna', prospecto: 'Prospecto',
  },
} as const;

export const temaClaro = crearTema('light');
export const temaOscuro = crearTema('dark');
