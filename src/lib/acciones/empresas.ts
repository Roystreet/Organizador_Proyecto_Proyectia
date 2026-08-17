'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { pool, fila } from '@/db';
import { generarSlug, asegurarSlugUnico } from '@/lib/identificadores';
import { registrarEnBitacora } from '@/lib/bitacora';
import { texto, erroresDeZod, esDuplicado } from './util';
import type { EstadoFormulario } from './tipos';

const TIPOS_EMPRESA = ['cliente', 'proveedor', 'aliado', 'interna', 'prospecto'] as const;
const TAMANOS = ['micro', 'pequena', 'mediana', 'grande', 'corporativo'] as const;

const zEmpresa = z.object({
  nombre: z.string({ error: 'El nombre es obligatorio' })
    .min(2, 'Mínimo 2 caracteres').max(150, 'Máximo 150 caracteres'),
  tipo: z.enum(TIPOS_EMPRESA),
  industria: z.string().max(100).nullable(),
  tamano: z.enum(TAMANOS).nullable(),
  pais: z.string().max(80).nullable(),
  sitioWeb: z.string().max(255).nullable(),
  contactoEmail: z.email('Email inválido').max(150).nullable(),
  contactoTelefono: z.string().max(50).nullable(),
  notas: z.string().max(5000).nullable(),
});

function leerFormulario(datos: FormData) {
  const tamano = texto(datos, 'tamano');
  return zEmpresa.safeParse({
    nombre: texto(datos, 'nombre') ?? '',
    tipo: texto(datos, 'tipo') ?? 'cliente',
    industria: texto(datos, 'industria'),
    tamano: tamano === null ? null : tamano,
    pais: texto(datos, 'pais'),
    sitioWeb: texto(datos, 'sitioWeb'),
    contactoEmail: texto(datos, 'contactoEmail'),
    contactoTelefono: texto(datos, 'contactoTelefono'),
    notas: texto(datos, 'notas'),
  });
}

export async function crearEmpresa(
  _prev: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseo = leerFormulario(datos);
  if (!parseo.success) return erroresDeZod(parseo.error);
  const e = parseo.data;

  const slug = await asegurarSlugUnico(generarSlug(e.nombre), 'empresas');

  let empresaId = 0;
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [res] = await conexion.query(
      `INSERT INTO empresas
         (nombre, slug, tipo, industria, tamano, pais, sitio_web,
          contacto_email, contacto_telefono, notas)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        e.nombre, slug, e.tipo, e.industria, e.tamano, e.pais, e.sitioWeb,
        e.contactoEmail, e.contactoTelefono, e.notas,
      ],
    );
    empresaId = (res as { insertId: number }).insertId;
    await registrarEnBitacora(conexion, {
      entidadTipo: 'empresa', entidadId: empresaId,
      accion: 'crear', valorNuevo: e.nombre,
    });
    await conexion.commit();
  } catch (err) {
    await conexion.rollback();
    if (esDuplicado(err)) return { ok: false, errores: { nombre: 'Ya existe una empresa con un nombre equivalente' } };
    throw err;
  } finally {
    conexion.release();
  }

  revalidatePath('/empresas');
  redirect(`/empresas/${empresaId}`);
}

export async function actualizarEmpresa(
  id: number,
  _prev: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const parseo = leerFormulario(datos);
  if (!parseo.success) return erroresDeZod(parseo.error);
  const e = parseo.data;

  const actual = await fila<{ id: number; nombre: string }>(
    `SELECT id, nombre FROM empresas WHERE id = ?`, [id],
  );
  if (!actual) return { ok: false, mensaje: `No existe la empresa ${id}.` };

  // El slug solo se regenera si cambió el nombre, para no romper referencias.
  const slug = actual.nombre === e.nombre
    ? null
    : await asegurarSlugUnico(generarSlug(e.nombre), 'empresas', id);

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query(
      `UPDATE empresas SET
         nombre = ?, ${slug ? 'slug = ?,' : ''} tipo = ?, industria = ?, tamano = ?,
         pais = ?, sitio_web = ?, contacto_email = ?, contacto_telefono = ?, notas = ?
       WHERE id = ?`,
      slug
        ? [e.nombre, slug, e.tipo, e.industria, e.tamano, e.pais, e.sitioWeb,
           e.contactoEmail, e.contactoTelefono, e.notas, id]
        : [e.nombre, e.tipo, e.industria, e.tamano, e.pais, e.sitioWeb,
           e.contactoEmail, e.contactoTelefono, e.notas, id],
    );
    await registrarEnBitacora(conexion, {
      entidadTipo: 'empresa', entidadId: id,
      accion: 'actualizar', valorNuevo: e.nombre,
    });
    await conexion.commit();
  } catch (err) {
    await conexion.rollback();
    if (esDuplicado(err)) return { ok: false, errores: { nombre: 'Ya existe una empresa con un nombre equivalente' } };
    throw err;
  } finally {
    conexion.release();
  }

  revalidatePath('/empresas');
  revalidatePath(`/empresas/${id}`);
  redirect(`/empresas/${id}`);
}
