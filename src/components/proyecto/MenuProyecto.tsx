'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert, Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Snackbar, Tooltip,
} from '@mui/material';
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ArchiveOutlined from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlined from '@mui/icons-material/UnarchiveOutlined';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import { archivarProyecto } from '@/lib/acciones/proyectos';
import DialogoEliminarProyecto, { type ResumenBorrado } from './DialogoEliminarProyecto';

/**
 * Acciones de baja de la ficha. Archivar es reversible y sale de los listados;
 * eliminar arrastra todo el árbol del proyecto y pide teclear el código.
 */
export default function MenuProyecto({
  proyectoId, archivado, resumen,
}: {
  proyectoId: number;
  archivado: boolean;
  resumen: ResumenBorrado;
}) {
  const router = useRouter();
  const [ancla, setAncla] = React.useState<HTMLElement | null>(null);
  const [borrando, setBorrando] = React.useState(false);
  const [error, setError] = React.useState<string>();

  async function archivar() {
    setAncla(null);
    const r = await archivarProyecto(proyectoId, !archivado);
    if (!r.ok) setError(r.mensaje);
    else router.refresh();
  }

  return (
    <>
      <Tooltip title="Más acciones">
        <IconButton size="small" aria-label="Más acciones del proyecto"
                    onClick={(e) => setAncla(e.currentTarget)}>
          <MoreVertOutlined />
        </IconButton>
      </Tooltip>

      <Menu open={Boolean(ancla)} anchorEl={ancla} onClose={() => setAncla(null)}>
        <MenuItem component={Link} href={`/proyectos/${proyectoId}/editar`}>
          <ListItemIcon><EditOutlined fontSize="small" /></ListItemIcon>
          <ListItemText>Editar</ListItemText>
        </MenuItem>
        <MenuItem onClick={archivar}>
          <ListItemIcon>
            {archivado ? <UnarchiveOutlined fontSize="small" /> : <ArchiveOutlined fontSize="small" />}
          </ListItemIcon>
          <ListItemText
            primary={archivado ? 'Restaurar proyecto' : 'Archivar proyecto'}
            secondary={archivado ? 'Vuelve a los listados' : 'Reversible, no borra nada'}
          />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setAncla(null); setBorrando(true); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteOutlineOutlined fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Eliminar definitivamente</ListItemText>
        </MenuItem>
      </Menu>

      <DialogoEliminarProyecto
        abierto={borrando}
        alCerrar={() => setBorrando(false)}
        proyectoId={proyectoId}
        resumen={resumen}
      />

      <Snackbar open={Boolean(error)} autoHideDuration={6000} onClose={() => setError(undefined)}>
        <Alert severity="error" onClose={() => setError(undefined)}>{error}</Alert>
      </Snackbar>
    </>
  );
}
