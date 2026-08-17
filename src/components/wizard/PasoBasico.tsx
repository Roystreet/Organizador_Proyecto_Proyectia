'use client';

import * as React from 'react';
import { useActionState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, MenuItem, TextField, Typography,
} from '@mui/material';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';
import { crearBorradorProyecto, actualizarBorradorProyecto } from '@/lib/acciones/wizard';
import { ESTADO_INICIAL } from '@/lib/acciones/tipos';
import { ETIQUETAS } from '@/theme/theme';

export interface ValoresBorrador {
  id: number;
  nombre: string;
  descripcion: string | null;
  categoria_id: number | null;
  empresa_id: number | null;
  responsable_id: number | null;
  prioridad: string;
  fecha_inicio: string | null;
  fecha_fin_estimada: string | null;
}

/** Paso 1: lo mínimo para poder empezar a preguntar. */
export default function PasoBasico({
  catalogos,
  borrador,
  sectoresMarcados = [],
}: {
  catalogos: {
    categorias: { id: number; nombre: string }[];
    empresas: { id: number; nombre: string }[];
    personas: { id: number; nombre_completo: string }[];
    sectores: { id: number; nombre: string }[];
  };
  borrador?: ValoresBorrador;
  sectoresMarcados?: number[];
}) {
  const accion = borrador
    ? actualizarBorradorProyecto.bind(null, borrador.id)
    : crearBorradorProyecto;
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
  const error = (campo: string) => estado.errores?.[campo];
  const [marcados, setMarcados] = React.useState<Set<number>>(new Set(sectoresMarcados));

  const alternar = (id: number) =>
    setMarcados((s) => {
      const c = new Set(s);
      if (c.has(id)) c.delete(id); else c.add(id);
      return c;
    });

  return (
    <Box component="form" action={enviar}
         sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
      <TextField
        name="nombre" label="Nombre del proyecto" required
        error={Boolean(error('nombre'))} helperText={error('nombre')}
        defaultValue={borrador?.nombre ?? ''}
        sx={{ gridColumn: '1 / -1' }}
      />

      <TextField
        name="descripcion" label="¿De qué trata?" multiline minRows={4}
        error={Boolean(error('descripcion'))}
        helperText={error('descripcion')
          ?? 'Escríbelo como se lo contarías a alguien: qué problema resuelve, para quién y qué esperas conseguir. De aquí salen las preguntas del paso siguiente.'}
        defaultValue={borrador?.descripcion ?? ''}
        sx={{ gridColumn: '1 / -1' }}
      />

      <Box sx={{ gridColumn: '1 / -1' }}>
        <Typography variant="overline" color="text.secondary">Sector</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
          En qué industria se enmarca. Condiciona la normativa aplicable y qué perfiles
          hacen falta; el primero que marques cuenta como principal.
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {catalogos.sectores.map((s) => (
            <Chip
              key={s.id} label={s.nombre} size="small"
              onClick={() => alternar(s.id)}
              color={marcados.has(s.id) ? 'primary' : 'default'}
              variant={marcados.has(s.id) ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
        {[...marcados].map((id) => (
          <input key={id} type="hidden" name="sectorIds" value={id} />
        ))}
        {error('sectorIds') && (
          <Typography variant="caption" color="error">{error('sectorIds')}</Typography>
        )}
      </Box>

      <TextField name="categoriaId" label="Categoría" select
                 defaultValue={borrador?.categoria_id ?? ''}>
        <MenuItem value="">Sin categoría</MenuItem>
        {catalogos.categorias.map((c) => (
          <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
        ))}
      </TextField>

      <TextField name="empresaId" label="Empresa / cliente" select
                 defaultValue={borrador?.empresa_id ?? ''}>
        <MenuItem value="">Sin empresa</MenuItem>
        {catalogos.empresas.map((e) => (
          <MenuItem key={e.id} value={e.id}>{e.nombre}</MenuItem>
        ))}
      </TextField>

      <TextField name="responsableId" label="Responsable" select
                 defaultValue={borrador?.responsable_id ?? ''}>
        <MenuItem value="">Sin responsable</MenuItem>
        {catalogos.personas.map((p) => (
          <MenuItem key={p.id} value={p.id}>{p.nombre_completo}</MenuItem>
        ))}
      </TextField>

      <TextField name="prioridad" label="Prioridad" select
                 defaultValue={borrador?.prioridad ?? 'media'}>
        {Object.entries(ETIQUETAS.prioridad).map(([v, t]) => (
          <MenuItem key={v} value={v}>{t}</MenuItem>
        ))}
      </TextField>

      <TextField name="fechaInicio" label="Fecha de inicio" type="date"
                 slotProps={{ inputLabel: { shrink: true } }}
                 error={Boolean(error('fechaInicio'))} helperText={error('fechaInicio')}
                 defaultValue={borrador?.fecha_inicio ?? ''} />

      <TextField name="fechaFinEstimada" label="Fecha de fin estimada" type="date"
                 slotProps={{ inputLabel: { shrink: true } }}
                 error={Boolean(error('fechaFinEstimada'))}
                 helperText={error('fechaFinEstimada') ?? 'Con las dos fechas, las fases se reparten solas'}
                 defaultValue={borrador?.fecha_fin_estimada ?? ''} />

      {estado.mensaje && !estado.ok && (
        <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>{estado.mensaje}</Alert>
      )}

      <Box sx={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="submit" variant="contained" disabled={enviando}
                endIcon={enviando ? <CircularProgress size={16} /> : <ArrowForwardOutlined />}>
          {enviando ? 'Guardando…' : 'Continuar'}
        </Button>
      </Box>
    </Box>
  );
}
