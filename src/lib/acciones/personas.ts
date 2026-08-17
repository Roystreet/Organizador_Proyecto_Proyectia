'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
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
          seniority, anios_experiencia, disponibilidad_horas_semana, ubicacion, bio)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        p.nombre, p.apellido, p.email, p.telefono, p.empresaId, p.tipoRelacion,
        p.rolPrincipal, p.seniority, p.aniosExperiencia, p.disponibilidadHorasSemana,
        p.ubicacion, p.bio,
      ],
    );
    personaId = (res as { insertId: number }).insertId;
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
  redirect(`/personas/${personaId}`);
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
         disponibilidad_horas_semana = ?, ubicacion = ?, bio = ?
       WHERE id = ?`,
      [
        p.nombre, p.apellido, p.email, p.telefono, p.empresaId, p.tipoRelacion,
        p.rolPrincipal, p.seniority, p.aniosExperiencia, p.disponibilidadHorasSemana,
        p.ubicacion, p.bio, id,
      ],
    );
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
