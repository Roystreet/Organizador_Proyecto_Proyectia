import { fila, filas } from '@/db';

/**
 * Exporta una reunión a iCalendar.
 *
 * Con `?instancia=<id>` sale solo esa ocurrencia; sin él, la serie completa.
 * Las canceladas nunca se exportan.
 *
 * Las horas se guardan como reloj de pared (ver `acciones/reuniones.ts`) y el
 * pool lee los DATETIME con `timezone: 'Z'`, así que el `Date` que llega tiene
 * en UTC los mismos componentes que se tecleraron. Por eso el evento va como
 * hora local con `TZID` y no como instante en UTC: sin la zona, el calendario
 * del destinatario desplazaría la reunión según dónde esté.
 */

const esc = (v: string | null) =>
  String(v ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (x) => `\\${x}`);

/** `Date` → `20260820T100000`, sin sufijo Z: es hora local de la zona TZID. */
const local = (v: Date | string) =>
  new Date(v).toISOString().slice(0, 19).replace(/[-:]/g, '');

/** Marca de tiempo del propio archivo: esta sí es un instante real en UTC. */
const utc = (v: Date) => `${v.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reunionId = Number(id);
  if (!Number.isInteger(reunionId)) return new Response('Reunión inválida', { status: 400 });

  const instanciaId = Number(new URL(req.url).searchParams.get('instancia')) || null;

  const r = await fila<{
    id: number; titulo: string; objetivo: string | null; agenda: string | null;
    ubicacion: string | null; enlace: string | null; zona_horaria: string; proyecto: string;
  }>(
    `SELECT r.*, p.nombre proyecto FROM reuniones r
       JOIN proyectos p ON p.id = r.proyecto_id WHERE r.id = ?`,
    [reunionId],
  );
  if (!r) return new Response('No encontrada', { status: 404 });

  const instancias = await filas<{ id: number; inicio: Date; fin: Date }>(
    `SELECT * FROM reunion_instancias
      WHERE reunion_id = ? AND (? IS NULL OR id = ?) AND estado <> 'cancelada'
      ORDER BY inicio`,
    [reunionId, instanciaId, instanciaId],
  );

  const asistentes = await filas<{ email: string | null; nombre: string | null }>(
    `SELECT COALESCE(pe.email, rp.email_externo) email,
            -- NULLIF: CONCAT_WS con todo NULL devuelve '', no NULL, y el
            -- COALESCE se quedaba con la cadena vacía en vez del externo.
            COALESCE(NULLIF(CONCAT_WS(' ', pe.nombre, pe.apellido), ''), rp.nombre_externo) nombre
       FROM reunion_participantes rp
       LEFT JOIN personas pe ON pe.id = rp.persona_id
      WHERE rp.reunion_id = ?`,
    [reunionId],
  );

  const tz = r.zona_horaria || 'America/Caracas';
  const sello = utc(new Date());

  const eventos = instancias.map((i) => [
    'BEGIN:VEVENT',
    `UID:reunion-${r.id}-${i.id}@organizador.local`,
    `DTSTAMP:${sello}`,
    `DTSTART;TZID=${tz}:${local(i.inicio)}`,
    `DTEND;TZID=${tz}:${local(i.fin)}`,
    `SUMMARY:${esc(r.titulo)}`,
    `DESCRIPTION:${esc([r.objetivo, r.agenda, r.enlace].filter(Boolean).join('\n\n'))}`,
    `LOCATION:${esc(r.ubicacion ?? r.enlace)}`,
    ...asistentes
      .filter((a) => a.email)
      .map((a) => `ATTENDEE;CN=${esc(a.nombre)}:mailto:${a.email}`),
    'END:VEVENT',
  ].join('\r\n')).join('\r\n');

  const cuerpo = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Organizador de Proyectos//ES',
    'CALSCALE:GREGORIAN',
    eventos,
    'END:VCALENDAR',
    '',
  ].join('\r\n');

  return new Response(cuerpo, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="reunion-${r.id}.ics"`,
    },
  });
}
