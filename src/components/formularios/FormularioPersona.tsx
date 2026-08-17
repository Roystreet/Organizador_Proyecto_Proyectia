'use client';

import * as React from 'react';
import { useActionState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, MenuItem, TextField,
} from '@mui/material';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import { crearPersona, actualizarPersona } from '@/lib/acciones/personas';
import { ESTADO_INICIAL } from '@/lib/acciones/tipos';
import { ETIQUETAS } from '@/theme/theme';

const SENIORITY: Record<string, string> = {
  junior: 'Junior', semi_senior: 'Semi senior', senior: 'Senior',
  lead: 'Lead', director: 'Director',
};

export interface ValoresPersona {
  id: number;
  nombre: string;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  empresa_id: number | null;
  tipo_relacion: string;
  rol_principal: string | null;
  seniority: string | null;
  anios_experiencia: number | null;
  disponibilidad_horas_semana: number | null;
  ubicacion: string | null;
  bio: string | null;
}

/** Alta y edición de personas del directorio CRM. */
export default function FormularioPersona({
  empresas,
  persona,
}: {
  empresas: { id: number; nombre: string }[];
  persona?: ValoresPersona;
}) {
  const accion = persona ? actualizarPersona.bind(null, persona.id) : crearPersona;
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
  const error = (campo: string) => estado.errores?.[campo];

  return (
    <Card>
      <CardContent>
        <Box component="form" action={enviar}
             sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
          <TextField
            name="nombre" label="Nombre" required
            defaultValue={persona?.nombre ?? ''}
            error={Boolean(error('nombre'))} helperText={error('nombre')}
          />
          <TextField
            name="apellido" label="Apellido"
            defaultValue={persona?.apellido ?? ''}
            error={Boolean(error('apellido'))} helperText={error('apellido')}
          />

          <TextField
            name="email" label="Email" type="email"
            defaultValue={persona?.email ?? ''}
            error={Boolean(error('email'))} helperText={error('email')}
          />
          <TextField
            name="telefono" label="Teléfono"
            defaultValue={persona?.telefono ?? ''}
          />

          <TextField select name="tipoRelacion" label="Tipo de relación"
                     defaultValue={persona?.tipo_relacion ?? 'interno'}>
            {Object.entries(ETIQUETAS.tipoRelacion).map(([valor, etiqueta]) => (
              <MenuItem key={valor} value={valor}>{etiqueta}</MenuItem>
            ))}
          </TextField>

          <TextField select name="empresaId" label="Empresa"
                     defaultValue={persona?.empresa_id ?? ''}>
            <MenuItem value="">Sin empresa</MenuItem>
            {empresas.map((e) => (
              <MenuItem key={e.id} value={e.id}>{e.nombre}</MenuItem>
            ))}
          </TextField>

          <TextField
            name="rolPrincipal" label="Rol principal"
            defaultValue={persona?.rol_principal ?? ''}
            helperText="Ej. Diseñadora UX, Desarrollador full-stack"
          />

          <TextField select name="seniority" label="Seniority"
                     defaultValue={persona?.seniority ?? ''}>
            <MenuItem value="">Sin definir</MenuItem>
            {Object.entries(SENIORITY).map(([valor, etiqueta]) => (
              <MenuItem key={valor} value={valor}>{etiqueta}</MenuItem>
            ))}
          </TextField>

          <TextField
            name="aniosExperiencia" label="Años de experiencia" type="number"
            defaultValue={persona?.anios_experiencia ?? ''}
            error={Boolean(error('aniosExperiencia'))} helperText={error('aniosExperiencia')}
            slotProps={{ htmlInput: { min: 0, max: 60, step: 0.5 } }}
          />
          <TextField
            name="disponibilidadHorasSemana" label="Disponibilidad (h/semana)" type="number"
            defaultValue={persona?.disponibilidad_horas_semana ?? ''}
            error={Boolean(error('disponibilidadHorasSemana'))}
            helperText={error('disponibilidadHorasSemana')}
            slotProps={{ htmlInput: { min: 0, max: 120 } }}
          />

          <TextField
            name="ubicacion" label="Ubicación"
            defaultValue={persona?.ubicacion ?? ''}
            sx={{ gridColumn: '1 / -1' }}
          />

          <TextField
            name="bio" label="Bio / notas" multiline minRows={3}
            defaultValue={persona?.bio ?? ''}
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
              {enviando ? 'Guardando…' : persona ? 'Guardar cambios' : 'Agregar persona'}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
