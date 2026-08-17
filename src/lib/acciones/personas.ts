'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { PoolConnection } from 'mysql2/promise';
import { pool, fila } from '@/db';
import { registrarEnBitacora } from '@/lib/bitacora';
import { texto, entero, numero, erroresDeZod, esDuplicado } from './util';
import type { EstadoFormulario } from './tipos';

const TIPOS_RELACION = ['interno', 'freelance', 'cliente', 'stakeholder', 'proveedor', 'candidato'] as const;
const SENIORITY = ['junior', 'semi_senior', 'senior', 'lead', 'director'] as const;

const zPersona = z.object({
  nombre: z.string({ error: 'El nombre es obligatorio' })
    .min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  apellido: z.string().max(100, 'Máximo 100 caracteres').nullable(),
  email: z.email('Email inválido').max(150).nullable(),
  telefono: z.string().max(50).nullable(),
  empresaId: z.number().int().positive().nullable(),
  tipoRelacion: z.enum(TIPOS_RELACION),
  rolPrincipal: z.string().max(100).nullable(),
  seniority: z.enum(SENIORITY).nullable(),
  aniosExperiencia: z.number().min(0, 'No puede ser negativa').max(60).nullable(),
  disponibilidadHorasSemana: z.number().int().min(0).max(120, 'Máximo 120 h/semana').nullable(),
  ubicacion: z.string().max(120).nullable(),
  bio: z.string().max(5000).nullable(),
  linkedinUrl: z.string().max(255, 'Máximo 255 caracteres').nullable(),
  portafolioUrl: z.string().max(255, 'Máximo 255 caracteres').nullable(),
  sectorIds: z.array(z.number().int().positive()).max(10, 'Máximo 10 sectores'),
});

function leerFormulario(datos: FormData) {
  const seniority = texto(datos, 'seniority');
  return zPersona.safeParse({
    nombre: texto(datos, 'nombre') ?? '',
    apellido: texto(datos, 'apellido'),
    email: texto(datos, 'email'),
    telefono: texto(datos, 'telefono'),
    empresaId: entero(datos, 'empresaId'),
    tipoRelacion: texto(datos, 'tipoRelacion') ?? 'interno',
    rolPrincipal: texto(datos, 'rolPrincipal'),
    seniority: seniority === null ? null : seniority,
    aniosExperiencia: numero(datos, 'aniosExperiencia'),
    disponibilidadHorasSemana: entero(datos, 'disponibilidadHorasSemana'),
    ubicacion: texto(datos, 'ubicacion'),
    bio: texto(datos, 'bio'),
    linkedinUrl: texto(datos, 'linkedinUrl'),
    portafolioUrl: texto(datos, 'portafolioUrl'),
    // Checkboxes con el mismo name: getAll devuelve todos los marcados.
    sectorIds: datos.getAll('sectorIds')
      .map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0),
  });
}

async function emailOcupado(email: string | null, ignorarId?: number): Promise<boolean> {
  if (!email) return false;
  const r = await fila<{ id: number }>(
    `SELECT id FROM personas WHERE email = ?${ignorarId ? ' AND id <> ?' : ''} LIMIT 1`,
    ignorarId ? [email, ignorarId] : [email],
  );
  return r !== null;
}

/**
 * Deja `persona_sectores` igual a lo marcado en el formulario.
 *
 * Solo toca lo capturado a mano (`origen = 'manual'`): lo que puso la IA vive
 * en el mismo sitio pero con otro origen, y desmarcar una casilla del
 * formulario no debe borrar lo que el perfilado dedujo y se aceptó aparte.
 */
async function sincronizarSectores(
  conexion: PoolConnection, personaId: number, sectorIds: number[],
) {
  await conexion.query(
    `DELETE FROM persona_sectores WHERE persona_id = ? AND origen = 'manual'`,
    [personaId],
  );
  for (const sectorId of sectorIds) {
    await conexion.query(
      `INSERT INTO persona_sectores (persona_id, sector_id, nivel, origen, validado)
       VALUES (?,?,3,'manual',1)
       ON DUPLICATE KEY UPDATE origen = 'manual', validado = 1`,
      [personaId, sectorId],
    );
  }
}

export async function crearPersona(
  _prev: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseo = leerFormulario(datos);
  if (!parseo.success) return erroresDeZod(parseo.error);
  const p = parseo.data;

  if (await emailOcupado(p.email)) {
    return { ok: false, errores: { email: 'Ya existe una persona con este email' } };
  }

  let personaId = 0;
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [res] = await conexion.query(
      `INSERT INTO personas
         (nombre, apellido, email, telefono, empresa_id, tipo_relacion, rol_principal,
          seniority, anios_experiencia, disponibilidad_horas_semana, ubicacion, bio,
          linkedin_url, portafolio_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        p.nombre, p.apellido, p.email, p.telefono, p.empresaId, p.tipoRelacion,
        p.rolPrincipal, p.seniority, p.aniosExperiencia, p.disponibilidadHorasSemana,
        p.ubicacion, p.bio, p.linkedinUrl, p.portafolioUrl,
      ],
    );
    personaId = (res as { insertId: number }).insertId;
    await sincronizarSectores(conexion, personaId, p.sectorIds);
    await registrarEnBitacora(conexion, {
      entidadTipo: 'persona', entidadId: personaId,
      accion: 'crear', valorNuevo: [p.nombre, p.apellido].filter(Boolean).join(' '),
    });
    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    if (esDuplicado(e)) return { ok: false, errores: { email: 'Ya existe una persona con este email' } };
    throw e;
  } finally {
    conexion.release();
  }

  revalidatePath('/personas');
  // `?perfil=auto` abre el panel de perfil con IA al llegar al detalle, igual
  // que `?planteamiento=auto` hace al crear un proyecto.
  redirect(`/personas/${personaId}?perfil=auto`);
}

export async function actualizarPersona(
  id: number,
  _prev: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseo = leerFormulario(datos);
  if (!parseo.success) return erroresDeZod(parseo.error);
  const p = parseo.data;

  const actual = await fila<{ id: number }>(`SELECT id FROM personas WHERE id = ?`, [id]);
  if (!actual) return { ok: false, mensaje: `No existe la persona ${id}.` };

  if (await emailOcupado(p.email, id)) {
    return { ok: false, errores: { email: 'Ya existe otra persona con este email' } };
  }

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query(
      `UPDATE personas SET
         nombre = ?, apellido = ?, email = ?, telefono = ?, empresa_id = ?,
         tipo_relacion = ?, rol_principal = ?, seniority = ?, anios_experiencia = ?,
         disponibilidad_horas_semana = ?, ubicacion = ?, bio = ?,
         linkedin_url = ?, portafolio_url = ?
       WHERE id = ?`,
      [
        p.nombre, p.apellido, p.email, p.telefono, p.empresaId, p.tipoRelacion,
        p.rolPrincipal, p.seniority, p.aniosExperiencia, p.disponibilidadHorasSemana,
        p.ubicacion, p.bio, p.linkedinUrl, p.portafolioUrl, id,
      ],
    );
    await sincronizarSectores(conexion, id, p.sectorIds);
    await registrarEnBitacora(conexion, {
      entidadTipo: 'persona', entidadId: id,
      accion: 'actualizar', valorNuevo: [p.nombre, p.apellido].filter(Boolean).join(' '),
    });
    await conexion.commit();
  } catch (e) {
    await conexion.rollback();
    if (esDuplicado(e)) return { ok: false, errores: { email: 'Ya existe otra persona con este email' } };
    throw e;
  } finally {
    conexion.release();
  }

  revalidatePath('/personas');
  revalidatePath(`/personas/${id}`);
  redirect(`/personas/${id}`);
}
