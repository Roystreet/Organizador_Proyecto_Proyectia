'use client';

import * as React from 'react';
import { useDeferredValue, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, LinearProgress, MenuItem, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ChipSemantico from './ChipSemantico';
import { cambiarEstadoTarea, guardarTarea } from '@/lib/acciones/tareas';
import { ETIQUETAS } from '@/theme/theme';
import type { FilaMiembro, FilaTarea } from '@/lib/consultas';

/** Columnas del Kanban. `cancelada` no tiene columna a propósito: es una salida, no una etapa. */
const ESTADOS = ['pendiente', 'en_progreso', 'en_revision', 'bloqueada', 'completada'] as const;
/** Lo que sí ofrece el selector y el diálogo: todas las etapas más la cancelación. */
const SELECCIONABLES = [...ESTADOS, 'cancelada'] as const;
const NOMBRES: Record<string, string> = ETIQUETAS.estadoTarea;

/**
 * Cambia el estado sin abrir el editor. Se ve como el chip de siempre, así que
 * la tabla y el Kanban se leen igual que antes; lo nuevo es que se puede pulsar.
 *
 * `stopPropagation` porque en la tabla la fila entera abre el diálogo de edición
 * y desplegar el estado no debe abrirlo.
 */
function SelectorEstado({ tarea, cambiar }: { tarea: FilaTarea; cambiar: (estado: string) => void }) {
  return (
    <Select
      value={tarea.estado}
      onChange={(e) => cambiar(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      variant="standard"
      aria-label={`Estado de ${tarea.titulo}`}
      renderValue={(v) => <ChipSemantico grupo="estadoTarea" valor={v} sx={{ cursor: 'pointer' }} />}
      sx={{
        '&::before, &::after': { display: 'none' },
        '& .MuiSelect-select': { p: 0, pr: '18px !important', minHeight: 0, display: 'flex' },
        '& .MuiSelect-icon': { right: -2 },
      }}
    >
      {SELECCIONABLES.map((e) => <MenuItem key={e} value={e} dense>{NOMBRES[e]}</MenuItem>)}
    </Select>
  );
}

function Tarjeta({ tarea, abrir, cambiar }: { tarea: FilaTarea; abrir: () => void; cambiar: (estado: string) => void }) {
  const { ref, handleRef } = useDraggable({ id: String(tarea.id), data: { tarea } });
  return <Card ref={ref} variant="outlined" sx={{ mb: 1 }}><CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
    <Box ref={handleRef} tabIndex={0} aria-label={`Mover ${tarea.titulo}`} sx={{ cursor: 'grab' }} onDoubleClick={abrir}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{tarea.titulo}</Typography>
      <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}><ChipSemantico grupo="prioridad" valor={tarea.prioridad} />{tarea.responsable && <Chip size="small" label={tarea.responsable} />}</Stack>
    </Box>
    {/* Fuera del `handleRef`: dentro, arrastrar y desplegar se pelearían por el puntero. */}
    <Box sx={{ mt: 0.75 }}><SelectorEstado tarea={tarea} cambiar={cambiar} /></Box>
  </CardContent></Card>;
}

function Columna({ estado, tareas, abrir, cambiar }: { estado: string; tareas: FilaTarea[]; abrir: (t: FilaTarea) => void; cambiar: (id: number, estado: string) => void }) {
  const { ref, isDropTarget } = useDroppable({ id: estado });
  return <Box ref={ref} sx={{ minWidth: 240, flex: '1 0 240px', bgcolor: isDropTarget ? 'action.hover' : 'background.sutil', borderRadius: 2, p: 1 }}>
    <Typography variant="subtitle2" sx={{ mb: 1 }}>{NOMBRES[estado]} · {tareas.length}</Typography>
    {tareas.map((t) => <Tarjeta key={t.id} tarea={t} abrir={() => abrir(t)} cambiar={(e) => cambiar(t.id, e)} />)}
  </Box>;
}

export default function TareasProyecto({ proyectoId, iniciales, equipo }: { proyectoId: number; iniciales: FilaTarea[]; equipo: FilaMiembro[] }) {
  const router = useRouter(); const [pendiente, iniciar] = useTransition();
  const [vista, setVista] = React.useState<'kanban'|'tabla'>('kanban'); const [tareas, setTareas] = React.useState(iniciales);
  const [q, setQ] = React.useState(''); const qd = useDeferredValue(q); const [estadoFiltro, setEstadoFiltro] = React.useState('activas');
  const [editando, setEditando] = React.useState<FilaTarea | null | undefined>(undefined); const [error, setError] = React.useState<string>();
  React.useEffect(() => setTareas(iniciales), [iniciales]);
  const visibles = tareas.filter((t) => (estadoFiltro === 'todas' || (estadoFiltro === 'activas' ? t.estado !== 'cancelada' : t.estado === estadoFiltro)) && (!qd || `${t.titulo} ${t.descripcion ?? ''}`.toLowerCase().includes(qd.toLowerCase())));

  const mover = (id: number, estado: string) => {
    const t = tareas.find((x) => x.id === id); if (!t || t.estado === estado) return;
    if (estado === 'bloqueada') { setEditando({ ...t, estado: 'bloqueada' }); return; }
    const antes = tareas; setTareas((xs) => xs.map((x) => x.id === id ? { ...x, estado: estado as FilaTarea['estado'], version: x.version + 1, progreso_pct: estado === 'completada' ? 100 : x.progreso_pct } : x));
    iniciar(async () => { const r = await cambiarEstadoTarea(id, proyectoId, t.version, estado as any); if (!r.ok) { setTareas(antes); setError(r.mensaje); } else router.refresh(); });
  };

  async function enviar(form: FormData) {
    const t = editando ?? null;
    const r = await guardarTarea({ proyectoId, id: t?.id, version: t?.version, titulo: String(form.get('titulo') ?? ''), descripcion: String(form.get('descripcion') ?? '') || null,
      tipo: String(form.get('tipo') ?? 'feature') as any, estado: String(form.get('estado') ?? 'pendiente') as any, prioridad: String(form.get('prioridad') ?? 'media') as any,
      responsableId: Number(form.get('responsableId')) || null, hitoId: t?.hito_id ?? null, sprintId: t?.sprint_id ?? null, tareaPadreId: t?.tarea_padre_id ?? null,
      fechaInicio: String(form.get('fechaInicio') ?? '') || null, fechaVencimiento: String(form.get('fechaVencimiento') ?? '') || null,
      estimacionHoras: Number(form.get('estimacionHoras')) || null, progresoPct: Number(form.get('progresoPct')) || 0, motivoBloqueo: String(form.get('motivoBloqueo') ?? '') || null,
      dependeDeIds: t?.depende_de?.split(',').filter(Boolean).map(Number) ?? [] });
    if (!r.ok) { setError(r.mensaje); return; } setEditando(undefined); router.refresh();
  }

  return <Card><CardContent>
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}><Typography variant="h4">Trabajo</Typography><Box sx={{ flexGrow: 1 }} />
      <TextField size="small" label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
      <TextField size="small" select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} sx={{ minWidth: 130 }}><MenuItem value="activas">Activas</MenuItem><MenuItem value="todas">Todas</MenuItem>{SELECCIONABLES.map((e) => <MenuItem key={e} value={e}>{NOMBRES[e]}</MenuItem>)}</TextField>
      <ToggleButtonGroup size="small" exclusive value={vista} onChange={(_, v) => v && setVista(v)}><ToggleButton value="kanban">Kanban</ToggleButton><ToggleButton value="tabla">Tabla</ToggleButton></ToggleButtonGroup>
      <Button variant="contained" size="small" startIcon={<AddOutlined />} onClick={() => setEditando(null)}>Nueva tarea</Button></Box>
    {error && <Alert severity="error" onClose={() => setError(undefined)} sx={{ mb: 1 }}>{error}</Alert>}{pendiente && <LinearProgress sx={{ mb: 1 }} />}
    {vista === 'kanban' ? <DragDropProvider onDragEnd={(e) => { if (!e.canceled && e.operation.target?.id) mover(Number(e.operation.source?.id), String(e.operation.target.id)); }}>
      <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>{ESTADOS.map((e) => <Columna key={e} estado={e} tareas={visibles.filter((t) => t.estado === e)} abrir={setEditando} cambiar={mover} />)}</Box>
    </DragDropProvider> : <Table size="small"><TableHead><TableRow><TableCell>Tarea</TableCell><TableCell>Estado</TableCell><TableCell>Prioridad</TableCell><TableCell>Responsable</TableCell><TableCell>Vence</TableCell><TableCell>Avance</TableCell></TableRow></TableHead><TableBody>{visibles.map((t) => <TableRow key={t.id} hover onClick={() => setEditando(t)} sx={{ cursor: 'pointer' }}><TableCell>{t.titulo}</TableCell><TableCell><SelectorEstado tarea={t} cambiar={(e) => mover(t.id, e)} /></TableCell><TableCell><ChipSemantico grupo="prioridad" valor={t.prioridad} /></TableCell><TableCell>{t.responsable ?? '—'}</TableCell><TableCell>{t.fecha_vencimiento ?? '—'}</TableCell><TableCell>{t.progreso_pct}%</TableCell></TableRow>)}</TableBody></Table>}
    <Dialog open={editando !== undefined} onClose={() => setEditando(undefined)} maxWidth="md" fullWidth><Box component="form" action={enviar}><DialogTitle>{editando ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle><DialogContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)' }, gap: 2, pt: '12px !important' }}>
      <TextField name="titulo" label="Título" required defaultValue={editando?.titulo ?? ''} sx={{ gridColumn: '1/-1' }} /><TextField name="descripcion" label="Descripción" multiline defaultValue={editando?.descripcion ?? ''} sx={{ gridColumn: '1/-1' }} />
      <TextField name="tipo" label="Tipo" select defaultValue={editando?.tipo ?? 'feature'}>{['feature','mejora','correccion','investigacion','documentacion','reunion','administrativa'].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>
      <TextField name="estado" label="Estado" select defaultValue={editando?.estado ?? 'pendiente'}>{SELECCIONABLES.map((x) => <MenuItem key={x} value={x}>{NOMBRES[x]}</MenuItem>)}</TextField>
      <TextField name="prioridad" label="Prioridad" select defaultValue={editando?.prioridad ?? 'media'}>{['baja','media','alta','critica'].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>
      <TextField name="responsableId" label="Responsable" select defaultValue={editando?.responsable_id ?? ''}><MenuItem value="">Sin asignar</MenuItem>{equipo.map((m) => <MenuItem key={m.persona_id} value={m.persona_id}>{m.nombre}</MenuItem>)}</TextField>
      <TextField name="fechaInicio" label="Inicio" type="date" defaultValue={editando?.fecha_inicio ?? ''} slotProps={{ inputLabel: { shrink: true } }} /><TextField name="fechaVencimiento" label="Vencimiento" type="date" defaultValue={editando?.fecha_vencimiento ?? ''} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField name="estimacionHoras" label="Estimación (h)" type="number" defaultValue={editando?.estimacion_horas ?? ''} /><TextField name="progresoPct" label="Avance %" type="number" defaultValue={editando?.progreso_pct ?? 0} slotProps={{ htmlInput: { min: 0, max: 100 } }} />
      <TextField name="motivoBloqueo" label="Motivo de bloqueo" defaultValue={editando?.motivo_bloqueo ?? ''} sx={{ gridColumn: '1/-1' }} />
    </DialogContent><DialogActions><Button onClick={() => setEditando(undefined)}>Cancelar</Button><Button type="submit" variant="contained">Guardar</Button></DialogActions></Box></Dialog>
  </CardContent></Card>;
}
