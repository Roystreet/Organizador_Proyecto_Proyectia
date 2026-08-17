'use client';

import * as React from 'react';
import { useActionState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, MenuItem, TextField,
} from '@mui/material';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import { crearProyecto, actualizarProyecto } from '@/lib/acciones/proyectos';
import { ESTADO_INICIAL } from '@/lib/acciones/tipos';
import { ETIQUETAS } from '@/theme/theme';

export interface CatalogosProyecto {
  categorias: { id: number; nombre: string }[];
  empresas: { id: number; nombre: string }[];
  personas: { id: number; nombre_completo: string }[];
}

export interface ValoresProyecto {
  id: number;
  nombre: string;
  descripcion: string | null;
  objetivo: string | null;
  categoria_id: number | null;
  empresa_id: number | null;
  responsable_id: number | null;
  estado: string;
  prioridad: string;
  fecha_inicio: string | null;
  fecha_fin_estimada: string | null;
}

/**
 * Alta y edición de proyectos. Sin `proyecto` crea; con `proyecto` edita.
 * La descripción libre es la materia prima del planteamiento de la IA.
 */
export default function FormularioProyecto({
  catalogos,
  proyecto,
}: {
  catalogos: CatalogosProyecto;
  proyecto?: ValoresProyecto;
}) {
  const accion = proyecto ? actualizarProyecto.bind(null, proyecto.id) : crearProyecto;
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
  const error = (campo: string) => estado.errores?.[campo];

  return (
    <Card>
      <CardContent>
        <Box component="form" action={enviar}
             sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
          <TextField
            name="nombre" label="Nombre del proyecto" required
            defaultValue={proyecto?.nombre ?? ''}
            error={Boolean(error('nombre'))} helperText={error('nombre')}
            sx={{ gridColumn: '1 / -1' }}
          />

          <TextField
            name="descripcion" label="¿De qué trata?" multiline minRows={3}
            defaultValue={proyecto?.descripcion ?? ''}
            error={Boolean(error('descripcion'))}
            helperText={error('descripcion')
              ?? 'Describe libremente de qué trata; la IA lo usará para proponerte planteamiento, tareas y roadmap.'}
            sx={{ gridColumn: '1 / -1' }}
          />

          <TextField
            name="objetivo" label="Objetivo (qué se considera éxito)" multiline minRows={2}
            defaultValue={proyecto?.objetivo ?? ''}
            error={Boolean(error('objetivo'))} helperText={error('objetivo')}
            sx={{ gridColumn: '1 / -1' }}
          />

          <TextField select name="categoriaId" label="Categoría"
                     defaultValue={proyecto?.categoria_id ?? ''}>
            <MenuItem value="">Sin categoría</MenuItem>
            {catalogos.categorias.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
            ))}
          </TextField>

          <TextField select name="empresaId" label="Empresa / cliente"
                     defaultValue={proyecto?.empresa_id ?? ''}>
            <MenuItem value="">Sin empresa</MenuItem>
            {catalogos.empresas.map((e) => (
              <MenuItem key={e.id} value={e.id}>{e.nombre}</MenuItem>
            ))}
          </TextField>

          <TextField select name="responsableId" label="Responsable"
                     defaultValue={proyecto?.responsable_id ?? ''}>
            <MenuItem value="">Sin responsable</MenuItem>
            {catalogos.personas.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.nombre_completo}</MenuItem>
            ))}
          </TextField>

          <TextField select name="estado" label="Estado"
                     defaultValue={proyecto?.estado ?? 'planificacion'}>
            {Object.entries(ETIQUETAS.estadoProyecto).map(([valor, etiqueta]) => (
              <MenuItem key={valor} value={valor}>{etiqueta}</MenuItem>
            ))}
          </TextField>

          <TextField select name="prioridad" label="Prioridad"
                     defaultValue={proyecto?.prioridad ?? 'media'}>
            {Object.entries(ETIQUETAS.prioridad).map(([valor, etiqueta]) => (
              <MenuItem key={valor} value={valor}>{etiqueta}</MenuItem>
            ))}
          </TextField>

          <TextField
            name="fechaInicio" label="Fecha de inicio" type="date"
            defaultValue={proyecto?.fecha_inicio ?? ''}
            error={Boolean(error('fechaInicio'))} helperText={error('fechaInicio')}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <TextField
            name="fechaFinEstimada" label="Fecha de fin estimada" type="date"
            defaultValue={proyecto?.fecha_fin_estimada ?? ''}
            error={Boolean(error('fechaFinEstimada'))} helperText={error('fechaFinEstimada')}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          {estado.mensaje && !estado.ok && (
            <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>{estado.mensaje}</Alert>
          )}

          <Box sx={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit" variant="contained" disabled={enviando}
              startIcon={enviando ? <CircularProgress size={14} /> : <SaveOutlined />}
            >
              {enviando ? 'Guardando…' : proyecto ? 'Guardar cambios' : 'Crear proyecto'}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
