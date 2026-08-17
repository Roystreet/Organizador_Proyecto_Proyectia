/**
 * Schema de Drizzle ORM · base de datos `proyectos` (MySQL 8)
 * Espejo 1:1 de db/01_schema.sql.
 *
 * Si cambias el SQL, cambia esto también (o corre `drizzle-kit pull`).
 */
import {
  mysqlTable,
  int,
  bigint,
  smallint,
  tinyint,
  varchar,
  char,
  text,
  longtext,
  decimal,
  datetime,
  date,
  json,
  boolean,
  mysqlEnum,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';

/* -------------------------------------------------------------------------- */
/*  Enums reutilizables (mismos valores que el DDL)                            */
/* -------------------------------------------------------------------------- */

export const ESTADOS_PROYECTO = [
  'idea', 'planificacion', 'en_progreso', 'en_pausa', 'en_revision', 'completado', 'cancelado',
] as const;

export const ESTADOS_TAREA = [
  'pendiente', 'en_progreso', 'en_revision', 'bloqueada', 'completada', 'cancelada',
] as const;

export const ESTADOS_ASUNTO = [
  'pendiente', 'en_progreso', 'en_espera', 'resuelto', 'cerrado', 'descartado',
] as const;

export const PRIORIDADES = ['baja', 'media', 'alta', 'critica'] as const;
export const SALUD = ['verde', 'amarillo', 'rojo', 'sin_datos'] as const;
export const ENTIDADES = ['proyecto', 'tarea', 'asunto', 'persona', 'hito'] as const;

const ahora = sql`CURRENT_TIMESTAMP`;
/** DATETIME que se refresca solo en cada UPDATE (equivale a ON UPDATE CURRENT_TIMESTAMP). */
const ahoraAlActualizar = sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`;

/* -------------------------------------------------------------------------- */
/*  1 · CATÁLOGOS                                                              */
/* -------------------------------------------------------------------------- */

export const categorias = mysqlTable('categorias', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  nombre: varchar('nombre', { length: 80 }).notNull(),
  slug: varchar('slug', { length: 80 }).notNull(),
  descripcion: varchar('descripcion', { length: 255 }),
  colorHex: char('color_hex', { length: 7 }).notNull().default('#2E7D32'),
  icono: varchar('icono', { length: 50 }),
  orden: smallint('orden').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  creadoEn: datetime('creado_en').notNull().default(ahora),
  actualizadoEn: datetime('actualizado_en').notNull().default(ahoraAlActualizar),
}, (t) => ({
  slugUq: uniqueIndex('uq_categorias_slug').on(t.slug),
}));

export const etiquetas = mysqlTable('etiquetas', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  nombre: varchar('nombre', { length: 60 }).notNull(),
  slug: varchar('slug', { length: 60 }).notNull(),
  colorHex: char('color_hex', { length: 7 }).notNull().default('#66BB6A'),
  creadoEn: datetime('creado_en').notNull().default(ahora),
}, (t) => ({
  slugUq: uniqueIndex('uq_etiquetas_slug').on(t.slug),
}));

export const categoriasAsunto = mysqlTable('categorias_asunto', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  nombre: varchar('nombre', { length: 80 }).notNull(),
  slug: varchar('slug', { length: 80 }).notNull(),
  descripcion: varchar('descripcion', { length: 255 }),
  colorHex: char('color_hex', { length: 7 }).notNull().default('#EF6C00'),
  activo: boolean('activo').notNull().default(true),
}, (t) => ({
  slugUq: uniqueIndex('uq_categorias_asunto_slug').on(t.slug),
}));

export const habilidades = mysqlTable('habilidades', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  nombre: varchar('nombre', { length: 80 }).notNull(),
  slug: varchar('slug', { length: 80 }).notNull(),
  tipo: mysqlEnum('tipo', ['tecnica', 'herramienta', 'dominio', 'blanda', 'idioma', 'metodologia'])
    .notNull().default('tecnica'),
  descripcion: varchar('descripcion', { length: 255 }),
  creadoEn: datetime('creado_en').notNull().default(ahora),
}, (t) => ({
  slugUq: uniqueIndex('uq_habilidades_slug').on(t.slug),
  tipoIx: index('ix_habilidades_tipo').on(t.tipo),
}));

export const rolesProyecto = mysqlTable('roles_proyecto', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  nombre: varchar('nombre', { length: 60 }).notNull(),
  slug: varchar('slug', { length: 60 }).notNull(),
  esInterno: boolean('es_interno').notNull().default(true),
}, (t) => ({
  slugUq: uniqueIndex('uq_roles_proyecto_slug').on(t.slug),
}));

/* -------------------------------------------------------------------------- */
/*  2 · EMPRESAS Y PERSONAS                                                    */
/* -------------------------------------------------------------------------- */

export const empresas = mysqlTable('empresas', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  nombre: varchar('nombre', { length: 150 }).notNull(),
  slug: varchar('slug', { length: 150 }).notNull(),
  tipo: mysqlEnum('tipo', ['cliente', 'proveedor', 'aliado', 'interna', 'prospecto'])
    .notNull().default('cliente'),
  industria: varchar('industria', { length: 100 }),
  tamano: mysqlEnum('tamano', ['micro', 'pequena', 'mediana', 'grande', 'corporativo']),
  pais: varchar('pais', { length: 80 }),
  sitioWeb: varchar('sitio_web', { length: 255 }),
  contactoEmail: varchar('contacto_email', { length: 150 }),
  contactoTelefono: varchar('contacto_telefono', { length: 50 }),
  notas: text('notas'),
  activo: boolean('activo').notNull().default(true),
  creadoEn: datetime('creado_en').notNull().default(ahora),
  actualizadoEn: datetime('actualizado_en').notNull().default(ahoraAlActualizar),
}, (t) => ({
  slugUq: uniqueIndex('uq_empresas_slug').on(t.slug),
  tipoIx: index('ix_empresas_tipo').on(t.tipo),
  industriaIx: index('ix_empresas_industria').on(t.industria),
}));

export const personas = mysqlTable('personas', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  apellido: varchar('apellido', { length: 100 }),
  email: varchar('email', { length: 150 }),
  telefono: varchar('telefono', { length: 50 }),
  fotoUrl: varchar('foto_url', { length: 500 }),
  empresaId: int('empresa_id', { unsigned: true }).references(() => empresas.id, { onDelete: 'set null' }),
  tipoRelacion: mysqlEnum('tipo_relacion',
    ['interno', 'freelance', 'cliente', 'stakeholder', 'proveedor', 'candidato'])
    .notNull().default('interno'),
  rolPrincipal: varchar('rol_principal', { length: 100 }),
  seniority: mysqlEnum('seniority', ['junior', 'semi_senior', 'senior', 'lead', 'director']),
  aniosExperiencia: decimal('anios_experiencia', { precision: 4, scale: 1 }),
  disponibilidadHorasSemana: tinyint('disponibilidad_horas_semana', { unsigned: true }),
  zonaHoraria: varchar('zona_horaria', { length: 60 }).default('America/Caracas'),
  ubicacion: varchar('ubicacion', { length: 120 }),
  linkedinUrl: varchar('linkedin_url', { length: 255 }),
  portafolioUrl: varchar('portafolio_url', { length: 255 }),
  bio: text('bio'),
  /** Resumen del perfil generado por la IA a partir del CV */
  resumenIa: text('resumen_ia'),
  perfilActualizadoEn: datetime('perfil_actualizado_en'),
  activo: boolean('activo').notNull().default(true),
  creadoEn: datetime('creado_en').notNull().default(ahora),
  actualizadoEn: datetime('actualizado_en').notNull().default(ahoraAlActualizar),
}, (t) => ({
  emailUq: uniqueIndex('uq_personas_email').on(t.email),
  empresaIx: index('ix_personas_empresa').on(t.empresaId),
  tipoIx: index('ix_personas_tipo_relacion').on(t.tipoRelacion),
  activoIx: index('ix_personas_activo').on(t.activo),
}));

export const personaDocumentos = mysqlTable('persona_documentos', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  personaId: int('persona_id', { unsigned: true }).notNull()
    .references(() => personas.id, { onDelete: 'cascade' }),
  tipo: mysqlEnum('tipo', ['cv', 'portafolio', 'certificacion', 'notas', 'otro'])
    .notNull().default('cv'),
  nombreArchivo: varchar('nombre_archivo', { length: 255 }).notNull(),
  /** NULL cuando el insumo es texto pegado, sin archivo detrás. */
  rutaArchivo: varchar('ruta_archivo', { length: 500 }),
  mimeType: varchar('mime_type', { length: 100 }),
  tamanoBytes: int('tamano_bytes', { unsigned: true }),
  textoExtraido: longtext('texto_extraido'),
  estadoExtraccion: mysqlEnum('estado_extraccion', ['pendiente', 'procesando', 'procesado', 'error'])
    .notNull().default('pendiente'),
  errorExtraccion: varchar('error_extraccion', { length: 500 }),
  procesadoEn: datetime('procesado_en'),
  creadoEn: datetime('creado_en').notNull().default(ahora),
}, (t) => ({
  personaIx: index('ix_persona_documentos_persona').on(t.personaId),
  estadoIx: index('ix_persona_documentos_estado').on(t.estadoExtraccion),
}));

export const personaHabilidades = mysqlTable('persona_habilidades', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  personaId: int('persona_id', { unsigned: true }).notNull()
    .references(() => personas.id, { onDelete: 'cascade' }),
  habilidadId: int('habilidad_id', { unsigned: true }).notNull()
    .references(() => habilidades.id, { onDelete: 'cascade' }),
  /** 1 = básico … 5 = experto */
  nivel: tinyint('nivel', { unsigned: true }).notNull().default(3),
  aniosExperiencia: decimal('anios_experiencia', { precision: 4, scale: 1 }),
  esFortaleza: boolean('es_fortaleza').notNull().default(false),
  evidencia: varchar('evidencia', { length: 500 }),
  origen: mysqlEnum('origen', ['manual', 'ia_cv', 'ia_desempeno']).notNull().default('manual'),
  confianza: decimal('confianza', { precision: 3, scale: 2 }),
  validado: boolean('validado').notNull().default(false),
  creadoEn: datetime('creado_en').notNull().default(ahora),
  actualizadoEn: datetime('actualizado_en').notNull().default(ahoraAlActualizar),
}, (t) => ({
  uq: uniqueIndex('uq_persona_habilidad').on(t.personaId, t.habilidadId),
  habilidadIx: index('ix_persona_habilidades_habilidad').on(t.habilidadId),
  nivelIx: index('ix_persona_habilidades_nivel').on(t.nivel),
}));

export const personaExperiencias = mysqlTable('persona_experiencias', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  personaId: int('persona_id', { unsigned: true }).notNull()
    .references(() => personas.id, { onDelete: 'cascade' }),
  empresaNombre: varchar('empresa_nombre', { length: 150 }).notNull(),
  empresaId: int('empresa_id', { unsigned: true }).references(() => empresas.id, { onDelete: 'set null' }),
  cargo: varchar('cargo', { length: 150 }).notNull(),
  industria: varchar('industria', { length: 100 }),
  fechaInicio: date('fecha_inicio'),
  fechaFin: date('fecha_fin'),
  esActual: boolean('es_actual').notNull().default(false),
  descripcion: text('descripcion'),
  logros: text('logros'),
  origen: mysqlEnum('origen', ['manual', 'ia_cv']).notNull().default('ia_cv'),
  creadoEn: datetime('creado_en').notNull().default(ahora),
}, (t) => ({
  personaIx: index('ix_persona_experiencias_persona').on(t.personaId),
  industriaIx: index('ix_persona_experiencias_industria').on(t.industria),
}));

/** Fortalezas, aportes y preguntas sugeridas para cada persona. */
export const personaInsumos = mysqlTable('persona_insumos', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  personaId: int('persona_id', { unsigned: true }).notNull()
    .references(() => personas.id, { onDelete: 'cascade' }),
  tipo: mysqlEnum('tipo',
    ['fortaleza', 'aporte', 'pregunta_sugerida', 'area_mejora', 'interes', 'logro']).notNull(),
  titulo: varchar('titulo', { length: 200 }).notNull(),
  detalle: text('detalle'),
  contexto: varchar('contexto', { length: 255 }),
  origen: mysqlEnum('origen', ['manual', 'ia_cv', 'ia_desempeno']).notNull().default('ia_cv'),
  confianza: decimal('confianza', { precision: 3, scale: 2 }),
  validado: boolean('validado').notNull().default(false),
  creadoEn: datetime('creado_en').notNull().default(ahora),
}, (t) => ({
  personaTipoIx: index('ix_persona_insumos_persona_tipo').on(t.personaId, t.tipo),
}));

/* -------------------------------------------------------------------------- */
/*  3 · PROYECTOS                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Taxonomía de industrias. Aparte de `habilidades` a propósito: el sector es el
 * CONTEXTO donde alguien trabajó, no algo que sepa hacer. Ejes distintos.
 */
export const sectores = mysqlTable('sectores', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  nombre: varchar('nombre', { length: 80 }).notNull(),
  slug: varchar('slug', { length: 80 }).notNull(),
  descripcion: varchar('descripcion', { length: 255 }),
  colorHex: char('color_hex', { length: 7 }).notNull().default('#2E7D32'),
  orden: smallint('orden').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  creadoEn: datetime('creado_en').notNull().default(ahora),
}, (t) => ({
  slugUq: uniqueIndex('uq_sectores_slug').on(t.slug),
}));

export const personaSectores = mysqlTable('persona_sectores', {
  personaId: int('persona_id', { unsigned: true }).notNull()
    .references(() => personas.id, { onDelete: 'cascade' }),
  sectorId: int('sector_id', { unsigned: true }).notNull()
    .references(() => sectores.id, { onDelete: 'cascade' }),
  /** 1 = roce puntual … 5 = especialista del sector. */
  nivel: tinyint('nivel', { unsigned: true }).notNull().default(3),
  aniosExperiencia: decimal('anios_experiencia', { precision: 4, scale: 1 }),
  esPrincipal: boolean('es_principal').notNull().default(false),
  evidencia: varchar('evidencia', { length: 500 }),
  origen: mysqlEnum('origen', ['manual', 'ia_cv']).notNull().default('manual'),
  confianza: decimal('confianza', { precision: 3, scale: 2 }),
  validado: boolean('validado').notNull().default(false),
  creadoEn: datetime('creado_en').notNull().default(ahora),
  actualizadoEn: datetime('actualizado_en').notNull().default(ahoraAlActualizar),
}, (t) => ({
  pk: primaryKey({ columns: [t.personaId, t.sectorId] }),
  sectorIx: index('ix_persona_sectores_sector').on(t.sectorId),
}));

export const proyectos = mysqlTable('proyectos', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  codigo: varchar('codigo', { length: 20 }).notNull(),
  nombre: varchar('nombre', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 200 }).notNull(),
  /** Lo que escribió el usuario. Materia prima: nada la sobrescribe. */
  descripcion: text('descripcion'),
  /** «De qué trata» redactado por la IA. Vive aparte para no pisar `descripcion`. */
  resumenIa: text('resumen_ia'),
  resumenIaActualizadoEn: datetime('resumen_ia_actualizado_en'),
  /** Qué se considera éxito. Es el ancla del análisis de IA. */
  objetivo: text('objetivo'),
  categoriaId: int('categoria_id', { unsigned: true })
    .references(() => categorias.id, { onDelete: 'set null' }),
  empresaId: int('empresa_id', { unsigned: true })
    .references(() => empresas.id, { onDelete: 'set null' }),
  responsableId: int('responsable_id', { unsigned: true })
    .references(() => personas.id, { onDelete: 'set null' }),
  estado: mysqlEnum('estado', ESTADOS_PROYECTO).notNull().default('idea'),
  prioridad: mysqlEnum('prioridad', PRIORIDADES).notNull().default('media'),
  salud: mysqlEnum('salud', SALUD).notNull().default('sin_datos'),
  saludOrigen: mysqlEnum('salud_origen', ['manual', 'calculada', 'ia']).notNull().default('calculada'),
  progresoPct: tinyint('progreso_pct', { unsigned: true }).notNull().default(0),
  progresoOrigen: mysqlEnum('progreso_origen', ['manual', 'calculado']).notNull().default('calculado'),
  fechaInicio: date('fecha_inicio'),
  fechaFinEstimada: date('fecha_fin_estimada'),
  fechaFinReal: date('fecha_fin_real'),
  repositorioUrl: varchar('repositorio_url', { length: 255 }),
  urlProduccion: varchar('url_produccion', { length: 255 }),
  notas: text('notas'),
  /** Última actividad real. Alimenta la detección de proyectos estancados. */
  ultimoMovimientoEn: datetime('ultimo_movimiento_en'),
  archivado: boolean('archivado').notNull().default(false),
  /** Paso del asistente de creación. NULL = proyecto publicado. */
  wizardPaso: tinyint('wizard_paso', { unsigned: true }),
  creadoEn: datetime('creado_en').notNull().default(ahora),
  actualizadoEn: datetime('actualizado_en').notNull().default(ahoraAlActualizar),
}, (t) => ({
  codigoUq: uniqueIndex('uq_proyectos_codigo').on(t.codigo),
  slugUq: uniqueIndex('uq_proyectos_slug').on(t.slug),
  estadoIx: index('ix_proyectos_estado').on(t.estado),
  categoriaIx: index('ix_proyectos_categoria').on(t.categoriaId),
  empresaIx: index('ix_proyectos_empresa').on(t.empresaId),
  saludIx: index('ix_proyectos_salud').on(t.salud),
  dashboardIx: index('ix_proyectos_dashboard').on(t.archivado, t.estado, t.prioridad),
}));

export const proyectoEtiquetas = mysqlTable('proyecto_etiquetas', {
  proyectoId: int('proyecto_id', { unsigned: true }).notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  etiquetaId: int('etiqueta_id', { unsigned: true }).notNull()
    .references(() => etiquetas.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.proyectoId, t.etiquetaId] }),
}));

export const proyectoPersonas = mysqlTable('proyecto_personas', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  proyectoId: int('proyecto_id', { unsigned: true }).notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  personaId: int('persona_id', { unsigned: true }).notNull()
    .references(() => personas.id, { onDelete: 'cascade' }),
  rolId: int('rol_id', { unsigned: true })
    .references(() => rolesProyecto.id, { onDelete: 'set null' }),
  asignacionPct: tinyint('asignacion_pct', { unsigned: true }),
  fechaIngreso: date('fecha_ingreso'),
  fechaSalida: date('fecha_salida'),
  esPrincipal: boolean('es_principal').notNull().default(false),
  activo: boolean('activo').notNull().default(true),
  notas: varchar('notas', { length: 500 }),
  creadoEn: datetime('creado_en').notNull().default(ahora),
}, (t) => ({
  uq: uniqueIndex('uq_proyecto_persona_rol').on(t.proyectoId, t.personaId, t.rolId),
  personaIx: index('ix_pp_persona').on(t.personaId),
}));

export const proyectoHabilidadesRequeridas = mysqlTable('proyecto_habilidades_requeridas', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  proyectoId: int('proyecto_id', { unsigned: true }).notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  habilidadId: int('habilidad_id', { unsigned: true }).notNull()
    .references(() => habilidades.id, { onDelete: 'cascade' }),
  nivelMinimo: tinyint('nivel_minimo', { unsigned: true }).notNull().default(3),
  criticidad: mysqlEnum('criticidad', ['deseable', 'importante', 'indispensable'])
    .notNull().default('importante'),
}, (t) => ({
  uq: uniqueIndex('uq_proyecto_habilidad').on(t.proyectoId, t.habilidadId),
}));

/* -------------------------------------------------------------------------- */
/*  4 · HITOS Y SPRINTS                                                        */
/* -------------------------------------------------------------------------- */

/** Sector del proyecto: la otra mitad del match persona ↔ proyecto. */
export const proyectoSectores = mysqlTable('proyecto_sectores', {
  proyectoId: int('proyecto_id', { unsigned: true }).notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  sectorId: int('sector_id', { unsigned: true }).notNull()
    .references(() => sectores.id, { onDelete: 'cascade' }),
  esPrincipal: boolean('es_principal').notNull().default(false),
}, (t) => ({
  pk: primaryKey({ columns: [t.proyectoId, t.sectorId] }),
  sectorIx: index('ix_proyecto_sectores_sector').on(t.sectorId),
}));

/**
 * Preguntas de encuadre generadas por la IA, con su respuesta.
 *
 * Tabla propia y no `comentarios`: una respuesta se edita como tal, y el
 * UNIQUE por (proyecto, pregunta) hace que regenerar preguntas refresque el
 * enunciado sin borrar lo ya respondido.
 */
export const proyectoPreguntas = mysqlTable('proyecto_preguntas', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  proyectoId: int('proyecto_id', { unsigned: true }).notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  analisisId: int('analisis_id', { unsigned: true }),
  pregunta: varchar('pregunta', { length: 500 }).notNull(),
  motivo: varchar('motivo', { length: 500 }),
  tema: varchar('tema', { length: 80 }),
  importancia: mysqlEnum('importancia', PRIORIDADES).notNull().default('media'),
  respuesta: text('respuesta'),
  estado: mysqlEnum('estado', ['pendiente', 'respondida', 'omitida']).notNull().default('pendiente'),
  orden: smallint('orden').notNull().default(0),
  creadoEn: datetime('creado_en').notNull().default(ahora),
  actualizadoEn: datetime('actualizado_en').notNull().default(ahoraAlActualizar),
}, (t) => ({
  proyectoEstadoIx: index('ix_ppr_proyecto_estado').on(t.proyectoId, t.estado),
}));

export const hitos = mysqlTable('hitos', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  proyectoId: int('proyecto_id', { unsigned: true }).notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  nombre: varchar('nombre', { length: 200 }).notNull(),
  descripcion: text('descripcion'),
  /** Arranque de la fase. NULL = se deriva de la fase anterior al pintar. */
  fechaInicio: date('fecha_inicio'),
  fechaObjetivo: date('fecha_objetivo'),
  fechaCompletado: date('fecha_completado'),
  estado: mysqlEnum('estado', ['pendiente', 'en_progreso', 'completado', 'atrasado', 'cancelado'])
    .notNull().default('pendiente'),
  orden: smallint('orden').notNull().default(0),
  creadoEn: datetime('creado_en').notNull().default(ahora),
  actualizadoEn: datetime('actualizado_en').notNull().default(ahoraAlActualizar),
}, (t) => ({
  proyectoIx: index('ix_hitos_proyecto').on(t.proyectoId),
  fechaIx: index('ix_hitos_fecha_objetivo').on(t.fechaObjetivo),
}));

export const sprints = mysqlTable('sprints', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  proyectoId: int('proyecto_id', { unsigned: true }).notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  nombre: varchar('nombre', { length: 120 }).notNull(),
  objetivo: text('objetivo'),
  fechaInicio: date('fecha_inicio').notNull(),
  fechaFin: date('fecha_fin').notNull(),
  estado: mysqlEnum('estado', ['planificado', 'activo', 'cerrado']).notNull().default('planificado'),
  creadoEn: datetime('creado_en').notNull().default(ahora),
}, (t) => ({
  proyectoIx: index('ix_sprints_proyecto').on(t.proyectoId),
  estadoIx: index('ix_sprints_estado').on(t.estado),
}));

/* -------------------------------------------------------------------------- */
/*  5 · TAREAS                                                                 */
/* -------------------------------------------------------------------------- */

export const tareas = mysqlTable('tareas', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  proyectoId: int('proyecto_id', { unsigned: true }).notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  hitoId: int('hito_id', { unsigned: true }).references(() => hitos.id, { onDelete: 'set null' }),
  sprintId: int('sprint_id', { unsigned: true }).references(() => sprints.id, { onDelete: 'set null' }),
  tareaPadreId: int('tarea_padre_id', { unsigned: true }),
  titulo: varchar('titulo', { length: 255 }).notNull(),
  descripcion: text('descripcion'),
  tipo: mysqlEnum('tipo',
    ['feature', 'mejora', 'correccion', 'investigacion', 'documentacion', 'reunion', 'administrativa'])
    .notNull().default('feature'),
  estado: mysqlEnum('estado', ESTADOS_TAREA).notNull().default('pendiente'),
  prioridad: mysqlEnum('prioridad', PRIORIDADES).notNull().default('media'),
  responsableId: int('responsable_id', { unsigned: true })
    .references(() => personas.id, { onDelete: 'set null' }),
  fechaInicio: date('fecha_inicio'),
  fechaVencimiento: date('fecha_vencimiento'),
  fechaCompletada: datetime('fecha_completada'),
  estimacionHoras: decimal('estimacion_horas', { precision: 6, scale: 2 }),
  progresoPct: tinyint('progreso_pct', { unsigned: true }).notNull().default(0),
  motivoBloqueo: varchar('motivo_bloqueo', { length: 500 }),
  bloqueadaDesde: datetime('bloqueada_desde'),
  orden: int('orden').notNull().default(0),
  creadoEn: datetime('creado_en').notNull().default(ahora),
  actualizadoEn: datetime('actualizado_en').notNull().default(ahoraAlActualizar),
}, (t) => ({
  proyectoEstadoIx: index('ix_tareas_proyecto_estado').on(t.proyectoId, t.estado),
  responsableIx: index('ix_tareas_responsable').on(t.responsableId),
  vencimientoIx: index('ix_tareas_vencimiento').on(t.fechaVencimiento),
  sprintIx: index('ix_tareas_sprint').on(t.sprintId),
  hitoIx: index('ix_tareas_hito').on(t.hitoId),
  padreIx: index('ix_tareas_padre').on(t.tareaPadreId),
}));

export const tareaDependencias = mysqlTable('tarea_dependencias', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  /** La tarea que espera */
  tareaId: int('tarea_id', { unsigned: true }).notNull()
    .references(() => tareas.id, { onDelete: 'cascade' }),
  /** La tarea que debe terminar antes */
  dependeDeId: int('depende_de_id', { unsigned: true }).notNull()
    .references(() => tareas.id, { onDelete: 'cascade' }),
  tipo: mysqlEnum('tipo', ['bloquea', 'relacionada', 'duplica']).notNull().default('bloquea'),
  creadoEn: datetime('creado_en').notNull().default(ahora),
}, (t) => ({
  uq: uniqueIndex('uq_tarea_dependencia').on(t.tareaId, t.dependeDeId),
  dependeIx: index('ix_td_depende_de').on(t.dependeDeId),
}));

export const tareaEtiquetas = mysqlTable('tarea_etiquetas', {
  tareaId: int('tarea_id', { unsigned: true }).notNull()
    .references(() => tareas.id, { onDelete: 'cascade' }),
  etiquetaId: int('etiqueta_id', { unsigned: true }).notNull()
    .references(() => etiquetas.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.tareaId, t.etiquetaId] }),
}));

export const tareaHabilidadesRequeridas = mysqlTable('tarea_habilidades_requeridas', {
  tareaId: int('tarea_id', { unsigned: true }).notNull()
    .references(() => tareas.id, { onDelete: 'cascade' }),
  habilidadId: int('habilidad_id', { unsigned: true }).notNull()
    .references(() => habilidades.id, { onDelete: 'cascade' }),
  nivelMinimo: tinyint('nivel_minimo', { unsigned: true }).notNull().default(3),
}, (t) => ({
  pk: primaryKey({ columns: [t.tareaId, t.habilidadId] }),
}));

/* -------------------------------------------------------------------------- */
/*  6 · ASUNTOS                                                                */
/* -------------------------------------------------------------------------- */

export const asuntos = mysqlTable('asuntos', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  proyectoId: int('proyecto_id', { unsigned: true }).notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  tareaId: int('tarea_id', { unsigned: true }).references(() => tareas.id, { onDelete: 'set null' }),
  categoriaAsuntoId: int('categoria_asunto_id', { unsigned: true })
    .references(() => categoriasAsunto.id, { onDelete: 'set null' }),
  codigo: varchar('codigo', { length: 24 }),
  titulo: varchar('titulo', { length: 255 }).notNull(),
  descripcion: text('descripcion'),
  tipo: mysqlEnum('tipo',
    ['bug', 'incidencia', 'riesgo', 'bloqueo', 'deuda_tecnica', 'solicitud_cambio', 'pregunta'])
    .notNull().default('incidencia'),
  severidad: mysqlEnum('severidad', PRIORIDADES).notNull().default('media'),
  impacto: mysqlEnum('impacto', ['bajo', 'medio', 'alto']).notNull().default('medio'),
  estado: mysqlEnum('estado', ESTADOS_ASUNTO).notNull().default('pendiente'),
  reportadoPorId: int('reportado_por_id', { unsigned: true })
    .references(() => personas.id, { onDelete: 'set null' }),
  asignadoAId: int('asignado_a_id', { unsigned: true })
    .references(() => personas.id, { onDelete: 'set null' }),
  esRecurrente: boolean('es_recurrente').notNull().default(false),
  causaRaiz: varchar('causa_raiz', { length: 500 }),
  resolucion: text('resolucion'),
  fechaReporte: datetime('fecha_reporte').notNull().default(ahora),
  fechaObjetivo: date('fecha_objetivo'),
  fechaResolucion: datetime('fecha_resolucion'),
  creadoEn: datetime('creado_en').notNull().default(ahora),
  actualizadoEn: datetime('actualizado_en').notNull().default(ahoraAlActualizar),
}, (t) => ({
  codigoUq: uniqueIndex('uq_asuntos_codigo').on(t.codigo),
  proyectoEstadoIx: index('ix_asuntos_proyecto_estado').on(t.proyectoId, t.estado),
  severidadIx: index('ix_asuntos_severidad').on(t.severidad),
  tipoIx: index('ix_asuntos_tipo').on(t.tipo),
  asignadoIx: index('ix_asuntos_asignado').on(t.asignadoAId),
}));

export const asuntoEtiquetas = mysqlTable('asunto_etiquetas', {
  asuntoId: int('asunto_id', { unsigned: true }).notNull()
    .references(() => asuntos.id, { onDelete: 'cascade' }),
  etiquetaId: int('etiqueta_id', { unsigned: true }).notNull()
    .references(() => etiquetas.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.asuntoId, t.etiquetaId] }),
}));

/* -------------------------------------------------------------------------- */
/*  7 · COMENTARIOS, BITÁCORA Y ADJUNTOS                                       */
/* -------------------------------------------------------------------------- */

export const comentarios = mysqlTable('comentarios', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  entidadTipo: mysqlEnum('entidad_tipo', ENTIDADES).notNull(),
  entidadId: int('entidad_id', { unsigned: true }).notNull(),
  autorId: int('autor_id', { unsigned: true }).references(() => personas.id, { onDelete: 'set null' }),
  contenido: text('contenido').notNull(),
  /** Marca decisiones. La IA les da más peso que a un comentario cualquiera. */
  esDecision: boolean('es_decision').notNull().default(false),
  creadoEn: datetime('creado_en').notNull().default(ahora),
  actualizadoEn: datetime('actualizado_en').notNull().default(ahoraAlActualizar),
}, (t) => ({
  entidadIx: index('ix_comentarios_entidad').on(t.entidadTipo, t.entidadId, t.creadoEn),
  autorIx: index('ix_comentarios_autor').on(t.autorId),
}));

export const bitacora = mysqlTable('bitacora', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  entidadTipo: mysqlEnum('entidad_tipo',
    ['proyecto', 'tarea', 'asunto', 'persona', 'hito', 'sprint', 'empresa']).notNull(),
  entidadId: int('entidad_id', { unsigned: true }).notNull(),
  proyectoId: int('proyecto_id', { unsigned: true })
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  accion: mysqlEnum('accion',
    ['crear', 'actualizar', 'cambio_estado', 'asignar', 'comentar', 'eliminar']).notNull(),
  campo: varchar('campo', { length: 60 }),
  valorAnterior: varchar('valor_anterior', { length: 500 }),
  valorNuevo: varchar('valor_nuevo', { length: 500 }),
  actorId: int('actor_id', { unsigned: true }),
  creadoEn: datetime('creado_en').notNull().default(ahora),
}, (t) => ({
  entidadIx: index('ix_bitacora_entidad').on(t.entidadTipo, t.entidadId, t.creadoEn),
  proyectoIx: index('ix_bitacora_proyecto_fecha').on(t.proyectoId, t.creadoEn),
}));

export const adjuntos = mysqlTable('adjuntos', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  entidadTipo: mysqlEnum('entidad_tipo', ENTIDADES).notNull(),
  entidadId: int('entidad_id', { unsigned: true }).notNull(),
  nombreArchivo: varchar('nombre_archivo', { length: 255 }).notNull(),
  rutaArchivo: varchar('ruta_archivo', { length: 500 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  tamanoBytes: int('tamano_bytes', { unsigned: true }),
  descripcion: varchar('descripcion', { length: 255 }),
  creadoEn: datetime('creado_en').notNull().default(ahora),
}, (t) => ({
  entidadIx: index('ix_adjuntos_entidad').on(t.entidadTipo, t.entidadId),
}));

/* -------------------------------------------------------------------------- */
/*  8 · MOTOR DE IA                                                            */
/* -------------------------------------------------------------------------- */

export const analisisIa = mysqlTable('analisis_ia', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  tipoAnalisis: mysqlEnum('tipo_analisis',
    ['salud_proyecto', 'cuellos_botella', 'match_persona_tarea',
     'patrones_globales', 'priorizacion_diaria', 'perfil_cv',
     'planteamiento_proyecto', 'tareas_sugeridas',
     'preguntas_encuadre', 'perfiles_requeridos']).notNull(),
  alcance: mysqlEnum('alcance', ['proyecto', 'global', 'persona', 'tarea']).notNull(),
  proyectoId: int('proyecto_id', { unsigned: true })
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  personaId: int('persona_id', { unsigned: true })
    .references(() => personas.id, { onDelete: 'cascade' }),
  modelo: varchar('modelo', { length: 80 }).notNull(),
  promptVersion: varchar('prompt_version', { length: 20 }).notNull().default('v1'),
  /** SHA-256 del payload: si no cambió nada, no se vuelve a pagar el análisis. */
  payloadHash: char('payload_hash', { length: 64 }),
  payloadJson: json('payload_json').notNull(),
  respuestaJson: json('respuesta_json'),
  resumen: text('resumen'),
  puntajeSalud: tinyint('puntaje_salud', { unsigned: true }),
  estado: mysqlEnum('estado', ['pendiente', 'ok', 'error']).notNull().default('pendiente'),
  errorMensaje: varchar('error_mensaje', { length: 1000 }),
  tokensEntrada: int('tokens_entrada', { unsigned: true }),
  tokensSalida: int('tokens_salida', { unsigned: true }),
  costoUsd: decimal('costo_usd', { precision: 10, scale: 6 }),
  latenciaMs: int('latencia_ms', { unsigned: true }),
  creadoEn: datetime('creado_en').notNull().default(ahora),
}, (t) => ({
  proyectoIx: index('ix_analisis_proyecto_fecha').on(t.proyectoId, t.creadoEn),
  tipoIx: index('ix_analisis_tipo').on(t.tipoAnalisis, t.creadoEn),
  hashIx: index('ix_analisis_hash').on(t.payloadHash),
}));

export const recomendacionesIa = mysqlTable('recomendaciones_ia', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  analisisId: int('analisis_id', { unsigned: true }).notNull()
    .references(() => analisisIa.id, { onDelete: 'cascade' }),
  proyectoId: int('proyecto_id', { unsigned: true })
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  tipo: mysqlEnum('tipo', ['accion', 'alerta', 'riesgo', 'mejora', 'asignacion', 'pregunta'])
    .notNull().default('accion'),
  titulo: varchar('titulo', { length: 255 }).notNull(),
  descripcion: text('descripcion'),
  justificacion: text('justificacion'),
  prioridad: mysqlEnum('prioridad', PRIORIDADES).notNull().default('media'),
  impactoEstimado: mysqlEnum('impacto_estimado', ['bajo', 'medio', 'alto']).notNull().default('medio'),
  esfuerzoEstimado: mysqlEnum('esfuerzo_estimado', ['bajo', 'medio', 'alto']).notNull().default('medio'),
  entidadTipo: mysqlEnum('entidad_tipo', ['proyecto', 'tarea', 'asunto', 'persona']),
  entidadId: int('entidad_id', { unsigned: true }),
  personaSugeridaId: int('persona_sugerida_id', { unsigned: true })
    .references(() => personas.id, { onDelete: 'set null' }),
  estado: mysqlEnum('estado', ['nueva', 'aceptada', 'en_progreso', 'implementada', 'descartada'])
    .notNull().default('nueva'),
  /** El feedback es lo que con el tiempo permite afinar los prompts. */
  feedbackUsuario: varchar('feedback_usuario', { length: 500 }),
  creadoEn: datetime('creado_en').notNull().default(ahora),
  actualizadoEn: datetime('actualizado_en').notNull().default(ahoraAlActualizar),
}, (t) => ({
  analisisIx: index('ix_reco_analisis').on(t.analisisId),
  proyectoEstadoIx: index('ix_reco_proyecto_estado').on(t.proyectoId, t.estado),
  prioridadIx: index('ix_reco_prioridad').on(t.prioridad),
}));

export const patronesDetectados = mysqlTable('patrones_detectados', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  clave: varchar('clave', { length: 120 }).notNull(),
  nombre: varchar('nombre', { length: 200 }).notNull(),
  descripcion: text('descripcion'),
  tipo: mysqlEnum('tipo',
    ['riesgo_recurrente', 'antipatron', 'buena_practica', 'correlacion_exito', 'brecha_skill']).notNull(),
  ambito: mysqlEnum('ambito', ['categoria', 'empresa', 'persona', 'global']).notNull().default('global'),
  evidenciaJson: json('evidencia_json'),
  frecuencia: smallint('frecuencia', { unsigned: true }).notNull().default(1),
  confianza: decimal('confianza', { precision: 3, scale: 2 }),
  recomendacion: text('recomendacion'),
  estado: mysqlEnum('estado', ['activo', 'mitigado', 'descartado']).notNull().default('activo'),
  primeraDeteccion: datetime('primera_deteccion').notNull().default(ahora),
  ultimaDeteccion: datetime('ultima_deteccion').notNull().default(ahoraAlActualizar),
}, (t) => ({
  claveUq: uniqueIndex('uq_patrones_clave').on(t.clave),
  tipoIx: index('ix_patrones_tipo').on(t.tipo, t.estado),
}));

export const metricasSnapshot = mysqlTable('metricas_snapshot', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  proyectoId: int('proyecto_id', { unsigned: true }).notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  fecha: date('fecha').notNull(),
  progresoPct: tinyint('progreso_pct', { unsigned: true }).notNull().default(0),
  tareasTotal: smallint('tareas_total', { unsigned: true }).notNull().default(0),
  tareasCompletadas: smallint('tareas_completadas', { unsigned: true }).notNull().default(0),
  tareasBloqueadas: smallint('tareas_bloqueadas', { unsigned: true }).notNull().default(0),
  tareasVencidas: smallint('tareas_vencidas', { unsigned: true }).notNull().default(0),
  asuntosAbiertos: smallint('asuntos_abiertos', { unsigned: true }).notNull().default(0),
  asuntosCriticos: smallint('asuntos_criticos', { unsigned: true }).notNull().default(0),
  diasSinMovimiento: smallint('dias_sin_movimiento', { unsigned: true }).notNull().default(0),
  salud: mysqlEnum('salud', SALUD).notNull().default('sin_datos'),
  creadoEn: datetime('creado_en').notNull().default(ahora),
}, (t) => ({
  uq: uniqueIndex('uq_metricas_proyecto_fecha').on(t.proyectoId, t.fecha),
}));

/* -------------------------------------------------------------------------- */
/*  RELACIONES (para el query builder relacional de Drizzle)                   */
/* -------------------------------------------------------------------------- */

export const proyectosRelations = relations(proyectos, ({ one, many }) => ({
  categoria: one(categorias, { fields: [proyectos.categoriaId], references: [categorias.id] }),
  empresa: one(empresas, { fields: [proyectos.empresaId], references: [empresas.id] }),
  responsable: one(personas, { fields: [proyectos.responsableId], references: [personas.id] }),
  tareas: many(tareas),
  asuntos: many(asuntos),
  hitos: many(hitos),
  sprints: many(sprints),
  involucrados: many(proyectoPersonas),
  etiquetas: many(proyectoEtiquetas),
  habilidadesRequeridas: many(proyectoHabilidadesRequeridas),
  analisis: many(analisisIa),
  snapshots: many(metricasSnapshot),
}));

export const personasRelations = relations(personas, ({ one, many }) => ({
  empresa: one(empresas, { fields: [personas.empresaId], references: [empresas.id] }),
  habilidades: many(personaHabilidades),
  experiencias: many(personaExperiencias),
  insumos: many(personaInsumos),
  documentos: many(personaDocumentos),
  participaciones: many(proyectoPersonas),
}));

export const tareasRelations = relations(tareas, ({ one, many }) => ({
  proyecto: one(proyectos, { fields: [tareas.proyectoId], references: [proyectos.id] }),
  responsable: one(personas, { fields: [tareas.responsableId], references: [personas.id] }),
  hito: one(hitos, { fields: [tareas.hitoId], references: [hitos.id] }),
  sprint: one(sprints, { fields: [tareas.sprintId], references: [sprints.id] }),
  asuntos: many(asuntos),
  etiquetas: many(tareaEtiquetas),
  habilidadesRequeridas: many(tareaHabilidadesRequeridas),
}));

export const asuntosRelations = relations(asuntos, ({ one, many }) => ({
  proyecto: one(proyectos, { fields: [asuntos.proyectoId], references: [proyectos.id] }),
  tarea: one(tareas, { fields: [asuntos.tareaId], references: [tareas.id] }),
  categoria: one(categoriasAsunto, {
    fields: [asuntos.categoriaAsuntoId], references: [categoriasAsunto.id],
  }),
  asignadoA: one(personas, { fields: [asuntos.asignadoAId], references: [personas.id] }),
  etiquetas: many(asuntoEtiquetas),
}));

export const proyectoPersonasRelations = relations(proyectoPersonas, ({ one }) => ({
  proyecto: one(proyectos, { fields: [proyectoPersonas.proyectoId], references: [proyectos.id] }),
  persona: one(personas, { fields: [proyectoPersonas.personaId], references: [personas.id] }),
  rol: one(rolesProyecto, { fields: [proyectoPersonas.rolId], references: [rolesProyecto.id] }),
}));

export const personaHabilidadesRelations = relations(personaHabilidades, ({ one }) => ({
  persona: one(personas, { fields: [personaHabilidades.personaId], references: [personas.id] }),
  habilidad: one(habilidades, { fields: [personaHabilidades.habilidadId], references: [habilidades.id] }),
}));

export const analisisIaRelations = relations(analisisIa, ({ one, many }) => ({
  proyecto: one(proyectos, { fields: [analisisIa.proyectoId], references: [proyectos.id] }),
  recomendaciones: many(recomendacionesIa),
}));

export const recomendacionesIaRelations = relations(recomendacionesIa, ({ one }) => ({
  analisis: one(analisisIa, { fields: [recomendacionesIa.analisisId], references: [analisisIa.id] }),
  proyecto: one(proyectos, { fields: [recomendacionesIa.proyectoId], references: [proyectos.id] }),
  personaSugerida: one(personas, {
    fields: [recomendacionesIa.personaSugeridaId], references: [personas.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/*  TIPOS INFERIDOS                                                            */
/* -------------------------------------------------------------------------- */

export type Proyecto = typeof proyectos.$inferSelect;
export type NuevoProyecto = typeof proyectos.$inferInsert;
export type Persona = typeof personas.$inferSelect;
export type NuevaPersona = typeof personas.$inferInsert;
export type Tarea = typeof tareas.$inferSelect;
export type NuevaTarea = typeof tareas.$inferInsert;
export type Asunto = typeof asuntos.$inferSelect;
export type NuevoAsunto = typeof asuntos.$inferInsert;
export type AnalisisIa = typeof analisisIa.$inferSelect;
export type RecomendacionIa = typeof recomendacionesIa.$inferSelect;
