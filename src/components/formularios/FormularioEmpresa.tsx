'use client';

import * as React from 'react';
import { useActionState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, MenuItem, TextField,
} from '@mui/material';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import { crearEmpresa, actualizarEmpresa } from '@/lib/acciones/empresas';
import { ESTADO_INICIAL } from '@/lib/acciones/tipos';
import { ETIQUETAS } from '@/theme/theme';

const TAMANOS: Record<string, string> = {
  micro: 'Micro', pequena: 'Pequeña', mediana: 'Mediana',
  grande: 'Grande', corporativo: 'Corporativo',
};

export interface ValoresEmpresa {
  id: number;
  nombre: string;
  tipo: string;
  industria: string | null;
  tamano: string | null;
  pais: string | null;
  sitio_web: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  notas: string | null;
}

/** Alta y edición de empresas (clientes, proveedores, aliados, prospectos). */
export default function FormularioEmpresa({ empresa }: { empresa?: ValoresEmpresa }) {
  const accion = empresa ? actualizarEmpresa.bind(null, empresa.id) : crearEmpresa;
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
  const error = (campo: string) => estado.errores?.[campo];

  return (
    <Card>
      <CardContent>
        <Box component="form" action={enviar}
             sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
          <TextField
            name="nombre" label="Nombre" required
            defaultValue={empresa?.nombre ?? ''}
            error={Boolean(error('nombre'))} helperText={error('nombre')}
          />

          <TextField select name="tipo" label="Tipo"
                     defaultValue={empresa?.tipo ?? 'cliente'}>
            {Object.entries(ETIQUETAS.tipoEmpresa).map(([valor, etiqueta]) => (
              <MenuItem key={valor} value={valor}>{etiqueta}</MenuItem>
            ))}
          </TextField>

          <TextField
            name="industria" label="Industria"
            defaultValue={empresa?.industria ?? ''}
          />

          <TextField select name="tamano" label="Tamaño"
                     defaultValue={empresa?.tamano ?? ''}>
            <MenuItem value="">Sin definir</MenuItem>
            {Object.entries(TAMANOS).map(([valor, etiqueta]) => (
              <MenuItem key={valor} value={valor}>{etiqueta}</MenuItem>
            ))}
          </TextField>

          <TextField
            name="pais" label="País"
            defaultValue={empresa?.pais ?? ''}
          />
          <TextField
            name="sitioWeb" label="Sitio web"
            defaultValue={empresa?.sitio_web ?? ''}
          />

          <TextField
            name="contactoEmail" label="Email de contacto" type="email"
            defaultValue={empresa?.contacto_email ?? ''}
            error={Boolean(error('contactoEmail'))} helperText={error('contactoEmail')}
          />
          <TextField
            name="contactoTelefono" label="Teléfono de contacto"
            defaultValue={empresa?.contacto_telefono ?? ''}
          />

          <TextField
            name="notas" label="Notas" multiline minRows={3}
            defaultValue={empresa?.notas ?? ''}
            sx={{ gridColumn: '1 / -1' }}
          />

          {estado.mensaje && !estado.ok && (
            <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>{estado.mensaje}</Alert>
          )}

          <Box sx={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit" variant="contained" disabled={enviando}
              startIcon={enviando ? <CircularProgress size={14} /> : <SaveOutlined />}
            >
              {enviando ? 'Guardando…' : empresa ? 'Guardar cambios' : 'Agregar empresa'}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
