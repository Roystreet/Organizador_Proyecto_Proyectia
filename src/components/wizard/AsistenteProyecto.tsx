'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Step, StepButton,
  Stepper, Typography,
} from '@mui/material';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import { avanzarPaso, publicarProyecto, descartarBorrador } from '@/lib/acciones/wizard';
import { PASOS_TOTAL, TITULOS_PASOS } from '@/lib/wizard';

/**
 * Cáscara del asistente: cabecera, pasos y navegación.
 *
 * El paso vive en la URL (`?id=N&paso=K`), no en estado de cliente: así el
 * botón atrás del navegador y recargar funcionan sin trucos, y el borrador se
 * puede retomar desde `/proyectos` días después.
 */
export default function AsistenteProyecto({
  proyectoId,
  paso,
  pasoMaximo,
  children,
}: {
  proyectoId: number | null;
  paso: number;
  /** Hasta dónde llegó el usuario: no se puede saltar más allá. */
  pasoMaximo: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [trabajando, setTrabajando] = React.useState(false);
  const [confirmaDescartar, setConfirmaDescartar] = React.useState(false);

  const ir = (destino: number) => {
    if (!proyectoId) return;
    router.push(`/proyectos/nuevo?id=${proyectoId}&paso=${destino}`);
  };

  async function siguiente() {
    if (!proyectoId) return;
    setTrabajando(true);
    try {
      const destino = Math.min(PASOS_TOTAL, paso + 1);
      await avanzarPaso(proyectoId, destino);
      ir(destino);
    } finally {
      setTrabajando(false);
    }
  }

  async function finalizar() {
    if (!proyectoId) return;
    setTrabajando(true);
    try {
      await publicarProyecto(proyectoId);
    } finally {
      setTrabajando(false);
    }
  }

  async function descartar() {
    if (!proyectoId) return;
    setTrabajando(true);
    try {
      await descartarBorrador(proyectoId);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <Stepper nonLinear activeStep={paso - 1} sx={{ mb: 3 }}>
          {TITULOS_PASOS.map((t, i) => (
            <Step key={t} completed={proyectoId !== null && i + 1 < pasoMaximo}>
              <StepButton
                onClick={() => ir(i + 1)}
                disabled={proyectoId === null || i + 1 > pasoMaximo}
              >
                {t}
              </StepButton>
            </Step>
          ))}
        </Stepper>

        {children}

        {proyectoId !== null && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3, flexWrap: 'wrap' }}>
              <Button
                color="error"
                variant={confirmaDescartar ? 'contained' : 'text'}
                size="small"
                startIcon={<DeleteOutlineOutlined />}
                disabled={trabajando}
                onClick={() => (confirmaDescartar ? descartar() : setConfirmaDescartar(true))}
              >
                {confirmaDescartar ? 'Confirmar descarte' : 'Descartar borrador'}
              </Button>
              <Box sx={{ flexGrow: 1 }} />
              {paso > 1 && (
                <Button onClick={() => ir(paso - 1)} disabled={trabajando}>Atrás</Button>
              )}
              {paso < PASOS_TOTAL ? (
                <Button variant="contained" onClick={siguiente} disabled={trabajando}
                        endIcon={trabajando ? <CircularProgress size={16} /> : undefined}>
                  Siguiente
                </Button>
              ) : (
                <Button variant="contained" onClick={finalizar} disabled={trabajando}
                        startIcon={trabajando
                          ? <CircularProgress size={16} />
                          : <CheckCircleOutlineOutlined />}>
                  Finalizar y abrir el proyecto
                </Button>
              )}
            </Box>

            {confirmaDescartar && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Se borra el borrador y todo lo generado en él: preguntas, análisis,
                  fases y tareas. No se puede deshacer.
                </Typography>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
