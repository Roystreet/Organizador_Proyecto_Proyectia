import 'server-only';
import { createHash } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import { pool, filas, fila } from '@/db';
import {
  payloadSaludProyecto, payloadPlanteamientoProyecto, payloadTareasSugeridas,
  payloadPerfilCv, payloadPreguntasEncuadre, payloadPerfilesRequeridos,
} from './construirPayload';
import { promptSistema, mensajeUsuario, PROMPT_VERSION } from './prompts';
import { formatoRespuesta, type ClaveEsquema } from './esquemas';
import {
  zRespuestaSaludProyecto, sanearReferencias, type RespuestaSaludValidada,
  zRespuestaPlanteamiento, type RespuestaPlanteamientoValidada,
  zRespuestaTareasSugeridas, sanearTareasSugeridas, type RespuestaTareasSugeridasValidada,
  zRespuestaPerfilCv, sanearPerfilCv, type RespuestaPerfilCvValidada,
  zRespuestaPreguntasEncuadre, type RespuestaPreguntasEncuadreValidada,
  zRespuestaPerfilesRequeridos, sanearPerfilesRequeridos,
  type RespuestaPerfilesRequeridosValidada,
} from './validacion';
import {
  simularSaludProyecto, simularPlanteamientoProyecto, simularTareasSugeridas,
  simularPerfilCv, simularPreguntasEncuadre, simularPerfilesRequeridos,
} from './simulador';
import { modeloPara, razonamientoPara } from './modelos';
import type {
  PayloadIa, PayloadSaludProyecto, PayloadPlanteamientoProyecto, PayloadTareasSugeridas,
  PayloadPerfilCv, PayloadPreguntasEncuadre, PayloadPerfilesRequeridos, TipoAnalisis,
} from './tipos';

/** Sobre común de cualquier análisis ejecutado por el motor. */
export interface ResultadoIa<R> {
  analisis_id: number;
  datos: R;
  desde_cache: boolean;
  modo: 'real' | 'simulado';
  modelo: string;
  latencia_ms: number;
  referencias_descartadas: number;
}

export interface ResultadoSalud extends ResultadoIa<RespuestaSaludValidada> {
  /** Ids reales de recomendaciones_ia, en el mismo orden que datos.recomendaciones. */
  recomendacion_ids: number[];
}

/** Serialización con claves ordenadas: mismo estado ⇒ mismo hash. */
function estable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(estable).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${estable(o[k])}`).join(',')}}`;
}

export { ProyectoNoEncontrado, PersonaNoEncontrada } from './errores';

/**
 * Columnas de `analisis_ia` donde puede vivir el id analizado.
 *
 * Es una unión cerrada porque el nombre se interpola en el SQL: nunca proviene
 * de entrada de usuario, igual que el nombre de tabla en `asegurarSlugUnico`.
 */
const COLUMNAS_ENTIDAD = ['proyecto_id', 'persona_id'] as const;
type ColumnaEntidad = (typeof COLUMNAS_ENTIDAD)[number];

/** Guarda en tiempo de ejecución además del tipo, por si llega desde JSON. */
function columnaDe(def: { columnaEntidad: ColumnaEntidad }): ColumnaEntidad {
  if (!COLUMNAS_ENTIDAD.includes(def.columnaEntidad)) {
    throw new Error(`columnaEntidad inválida: ${String(def.columnaEntidad)}`);
  }
  return def.columnaEntidad;
}

/* -------------------------------------------------------------------------- */
/*  Motor genérico                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Todo lo que un tipo de análisis tiene de particular, declarado en un solo
 * objeto. El motor (caché → modelo/simulador → validación → saneo →
 * persistencia transaccional) es el mismo para todos.
 */
interface DefinicionAnalisis<P extends PayloadIa, R> {
  tipo: TipoAnalisis;
  alcance: 'proyecto' | 'global' | 'persona' | 'tarea';
  /**
   * Columna de `analisis_ia` donde vive el id analizado. Cierra a la vez el
   * WHERE de la caché y el INSERT: con la columna equivocada, el análisis se
   * guarda huérfano y la caché nunca acierta (`NULL = NULL` es UNKNOWN).
   */
  columnaEntidad: ColumnaEntidad;
  claveEsquema: ClaveEsquema;
  /** 0.2 para análisis sobre métricas; más alto para redacción. */
  temperatura: number;
  construirPayload: (entidadId: number) => Promise<P>;
  /**
   * Qué parte del payload define el hash de caché. Por defecto, el payload
   * completo. Salud lo necesita para excluir sus propias recomendaciones
   * recién insertadas (si no, cada análisis invalidaría su propia caché).
   */
  paraHash?: (p: P) => unknown;
  /** Valida el contrato (rangos incluidos). Lanza si no cumple. */
  validar: (cruda: unknown) => R;
  /** Anula o filtra referencias a ids que no existen en el payload. */
  sanear?: (r: R, p: P) => { datos: R; descartadas: number };
  /** Respaldo determinista para IA_MODO=simulado o sin API key. */
  simular: (p: P) => R;
  resumenDe?: (r: R) => string | null;
  puntajeDe?: (r: R) => number | null;
  /** Escrituras adicionales dentro de la MISMA transacción del INSERT. */
  guardarExtra?: (
    conexion: PoolConnection, analisisId: number, entidadId: number, datos: R,
  ) => Promise<void>;
}

export async function ejecutarAnalisis<P extends PayloadIa, R>(
  def: DefinicionAnalisis<P, R>,
  entidadId: number,
  opciones: { forzar?: boolean } = {},
): Promise<ResultadoIa<R>> {
  const payload = await def.construirPayload(entidadId);
  const hash = createHash('sha256')
    .update(estable(def.paraHash ? def.paraHash(payload) : payload))
    .digest('hex');
  const horasCache = Number(process.env.IA_CACHE_HORAS ?? 6);

  /* 1 · Caché: si nada cambió en el proyecto, no hay nada nuevo que analizar. */
  const col = columnaDe(def);

  if (!opciones.forzar) {
    const previo = await fila<{ id: number; respuesta_json: unknown; modelo: string }>(
      `SELECT id, respuesta_json, modelo FROM analisis_ia
        WHERE ${col} = ? AND tipo_analisis = ?
          AND payload_hash = ? AND estado = 'ok'
          AND creado_en >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        ORDER BY creado_en DESC LIMIT 1`,
      [entidadId, def.tipo, hash, horasCache],
    );
    if (previo) {
      return {
        analisis_id: previo.id,
        datos: normalizarJson(previo.respuesta_json) as R,
        desde_cache: true,
        modo: previo.modelo === 'reglas-locales' ? 'simulado' : 'real',
        modelo: previo.modelo,
        latencia_ms: 0,
        referencias_descartadas: 0,
      };
    }
  }

  /* 2 · Análisis */
  const modo: 'real' | 'simulado' =
    process.env.IA_MODO === 'simulado' || !process.env.OPENAI_API_KEY ? 'simulado' : 'real';

  const inicio = Date.now();
  let cruda: unknown;
  let modelo: string;
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;

  if (modo === 'simulado') {
    modelo = 'reglas-locales';
    cruda = def.simular(payload);
  } else {
    modelo = modeloPara(def.tipo);
    const esfuerzo = razonamientoPara(def.tipo, modelo);
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const r = await openai.responses.create({
      model: modelo,
      instructions: promptSistema(def.tipo),
      input: mensajeUsuario(payload),
      text: { format: formatoRespuesta(def.claveEsquema) },
      ...(esfuerzo
        ? { reasoning: { effort: esfuerzo } }
        : { temperature: def.temperatura }),
    });
    const texto = r.output_text;
    if (!texto) throw new Error('El modelo devolvió una respuesta vacía');
    cruda = JSON.parse(texto);
    tokensIn = r.usage?.input_tokens ?? null;
    tokensOut = r.usage?.output_tokens ?? null;
  }

  const latencia = Date.now() - inicio;

  /* 3 · Validación de rangos y de referencias */
  let validada: R;
  try {
    validada = def.validar(cruda);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    await registrarError(def, entidadId, payload, hash, modelo, mensaje, latencia);
    throw new Error(`La respuesta del modelo no cumple el contrato: ${mensaje}`);
  }

  const { datos, descartadas } = def.sanear
    ? def.sanear(validada, payload)
    : { datos: validada, descartadas: 0 };

  /* 4 · Persistencia transaccional */
  const analisisId = await guardar(def, entidadId, payload, hash, modelo, datos, {
    tokensIn, tokensOut, latencia,
  });

  return {
    analisis_id: analisisId,
    datos,
    desde_cache: false,
    modo,
    modelo,
    latencia_ms: latencia,
    referencias_descartadas: descartadas,
  };
}

/* -------------------------------------------------------------------------- */
/*  Persistencia                                                               */
/* -------------------------------------------------------------------------- */

async function guardar<P extends PayloadIa, R>(
  def: DefinicionAnalisis<P, R>,
  entidadId: number,
  payload: P,
  hash: string,
  modelo: string,
  datos: R,
  uso: { tokensIn: number | null; tokensOut: number | null; latencia: number },
): Promise<number> {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    const [res] = await conexion.query(
      `INSERT INTO analisis_ia
         (tipo_analisis, alcance, ${columnaDe(def)}, modelo, prompt_version, payload_hash,
          payload_json, respuesta_json, resumen, puntaje_salud, estado,
          tokens_entrada, tokens_salida, latencia_ms)
       VALUES (?,?,?,?,?,?,?,?,?,?,'ok',?,?,?)`,
      [
        def.tipo, def.alcance, entidadId, modelo, PROMPT_VERSION, hash,
        JSON.stringify(payload), JSON.stringify(datos),
        def.resumenDe?.(datos) ?? null, def.puntajeDe?.(datos) ?? null,
        uso.tokensIn, uso.tokensOut, uso.latencia,
      ],
    );
    const analisisId = (res as { insertId: number }).insertId;

    if (def.guardarExtra) await def.guardarExtra(conexion, analisisId, entidadId, datos);

    await conexion.commit();
    return analisisId;
  } catch (e) {
    await conexion.rollback();
    throw e;
  } finally {
    conexion.release();
  }
}

async function registrarError<P extends PayloadIa, R>(
  def: DefinicionAnalisis<P, R>, entidadId: number, payload: unknown, hash: string,
  modelo: string, mensaje: string, latencia: number,
) {
  await pool.query(
    `INSERT INTO analisis_ia
       (tipo_analisis, alcance, ${columnaDe(def)}, modelo, prompt_version, payload_hash,
        payload_json, estado, error_mensaje, latencia_ms)
     VALUES (?,?,?,?,?,?,?,'error',?,?)`,
    [def.tipo, def.alcance, entidadId, modelo, PROMPT_VERSION, hash,
     JSON.stringify(payload), mensaje.slice(0, 1000), latencia],
  );
}

/** Ids de las recomendaciones de un análisis, en el orden en que se guardaron. */
export async function idsRecomendaciones(analisisId: number): Promise<number[]> {
  const r = await filas<{ id: number }>(
    `SELECT id FROM recomendaciones_ia WHERE analisis_id = ? ORDER BY id`,
    [analisisId],
  );
  return r.map((x) => x.id);
}

/** MySQL puede devolver JSON como objeto o como string según el driver. */
export function normalizarJson(v: unknown): unknown {
  return typeof v === 'string' ? JSON.parse(v) : v;
}

/* -------------------------------------------------------------------------- */
/*  Definiciones por tipo de análisis                                          */
/* -------------------------------------------------------------------------- */

const DEF_SALUD: DefinicionAnalisis<PayloadSaludProyecto, RespuestaSaludValidada> = {
  tipo: 'salud_proyecto',
  alcance: 'proyecto',
  columnaEntidad: 'proyecto_id',
  claveEsquema: 'salud_proyecto',
  temperatura: 0.2,                        // análisis, no creatividad
  construirPayload: payloadSaludProyecto,
  /**
   * Hash del ESTADO DEL PROYECTO, no del payload completo: si se incluyeran
   * las recomendaciones en estado `nueva`, cada análisis invalidaría su propia
   * caché al insertar las suyas. Solo el feedback del usuario invalida.
   */
  paraHash: (p) => ({
    ...p,
    recomendaciones_previas: p.recomendaciones_previas
      .filter((r) => r.estado !== 'nueva')
      .map(({ id, estado, feedback_usuario }) => ({ id, estado, feedback_usuario })),
  }),
  validar: (cruda) => {
    const parseo = zRespuestaSaludProyecto.safeParse(cruda);
    if (!parseo.success) throw new Error(parseo.error.issues[0]?.message ?? parseo.error.message);
    return parseo.data;
  },
  sanear: (r, p) => sanearReferencias(r, {
    proyecto: p.proyecto.id,
    tareas: new Set(p.proyecto.tareas_criticas.map((t) => t.id)),
    asuntos: new Set(p.proyecto.asuntos_abiertos.map((a) => a.id)),
    personas: new Set(p.proyecto.equipo.map((e) => e.persona_id)),
  }),
  simular: simularSaludProyecto,
  resumenDe: (r) => r.resumen_ejecutivo,
  puntajeDe: (r) => r.puntaje_salud,
  guardarExtra: async (conexion, analisisId, proyectoId, datos) => {
    for (const r of datos.recomendaciones) {
      await conexion.query(
        `INSERT INTO recomendaciones_ia
           (analisis_id, proyecto_id, tipo, titulo, descripcion, justificacion, prioridad,
            impacto_estimado, esfuerzo_estimado, entidad_tipo, entidad_id, persona_sugerida_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          analisisId, proyectoId, r.tipo, r.titulo, r.descripcion, r.justificacion,
          r.prioridad, r.impacto_estimado, r.esfuerzo_estimado,
          r.entidad_tipo, r.entidad_id, r.persona_sugerida_id,
        ],
      );
    }
    // El semáforo del dashboard pasa a ser el que dictaminó el análisis.
    await conexion.query(
      `UPDATE proyectos SET salud = ?, salud_origen = 'ia' WHERE id = ?`,
      [datos.semaforo, proyectoId],
    );
  },
};

const DEF_PLANTEAMIENTO: DefinicionAnalisis<PayloadPlanteamientoProyecto, RespuestaPlanteamientoValidada> = {
  tipo: 'planteamiento_proyecto',
  alcance: 'proyecto',
  columnaEntidad: 'proyecto_id',
  claveEsquema: 'planteamiento_proyecto',
  temperatura: 0.4,                        // redacción sobre una descripción
  construirPayload: payloadPlanteamientoProyecto,
  validar: (cruda) => {
    const parseo = zRespuestaPlanteamiento.safeParse(cruda);
    if (!parseo.success) throw new Error(parseo.error.issues[0]?.message ?? parseo.error.message);
    return parseo.data;
  },
  // Los hitos/tareas propuestos no citan ids reales; los refs locales ya los
  // valida el superRefine de Zod. No hay referencias que sanear.
  simular: simularPlanteamientoProyecto,
  resumenDe: (r) => r.de_que_trata,
};

const DEF_TAREAS_SUGERIDAS: DefinicionAnalisis<PayloadTareasSugeridas, RespuestaTareasSugeridasValidada> = {
  tipo: 'tareas_sugeridas',
  alcance: 'proyecto',
  columnaEntidad: 'proyecto_id',
  claveEsquema: 'tareas_sugeridas',
  temperatura: 0.3,
  construirPayload: payloadTareasSugeridas,
  validar: (cruda) => {
    const parseo = zRespuestaTareasSugeridas.safeParse(cruda);
    if (!parseo.success) throw new Error(parseo.error.issues[0]?.message ?? parseo.error.message);
    return parseo.data;
  },
  sanear: (r, p) => sanearTareasSugeridas(r, {
    hitos: new Set(p.proyecto.hitos.map((h) => h.id)),
    personas: new Set(p.proyecto.equipo.map((e) => e.persona_id)),
  }),
  simular: simularTareasSugeridas,
  resumenDe: (r) => r.resumen_contexto,
};

/* -------------------------------------------------------------------------- */
/*  API pública por tipo                                                       */
/* -------------------------------------------------------------------------- */

export async function analizarSaludProyecto(
  proyectoId: number,
  opciones: { forzar?: boolean } = {},
): Promise<ResultadoSalud> {
  const r = await ejecutarAnalisis(DEF_SALUD, proyectoId, opciones);
  return { ...r, recomendacion_ids: await idsRecomendaciones(r.analisis_id) };
}

export function generarPlanteamiento(
  proyectoId: number,
  opciones: { forzar?: boolean } = {},
): Promise<ResultadoIa<RespuestaPlanteamientoValidada>> {
  return ejecutarAnalisis(DEF_PLANTEAMIENTO, proyectoId, opciones);
}

export function sugerirTareas(
  proyectoId: number,
  opciones: { forzar?: boolean } = {},
): Promise<ResultadoIa<RespuestaTareasSugeridasValidada>> {
  return ejecutarAnalisis(DEF_TAREAS_SUGERIDAS, proyectoId, opciones);
}

/**
 * Perfilado de una persona a partir de texto pegado.
 *
 * A diferencia de los demás, este análisis necesita un insumo que no está en la
 * base todavía, así que la definición se construye por llamada cerrando sobre
 * el texto. El insumo entra en el payload y por tanto en el hash: cambiar el
 * texto invalida la caché sola, que es justo lo que se quiere.
 */
function defPerfilCv(insumo: { texto: string; notas: string | null }) {
  const def: DefinicionAnalisis<PayloadPerfilCv, RespuestaPerfilCvValidada> = {
    tipo: 'perfil_cv',
    alcance: 'persona',
    columnaEntidad: 'persona_id',
    claveEsquema: 'perfil_cv',
    temperatura: 0.3,
    construirPayload: (personaId) => payloadPerfilCv(personaId, insumo),
    validar: (cruda) => {
      const parseo = zRespuestaPerfilCv.safeParse(cruda);
      if (!parseo.success) throw new Error(parseo.error.issues[0]?.message ?? parseo.error.message);
      return parseo.data;
    },
    sanear: (r, p) => sanearPerfilCv(r, {
      habilidades: new Set(p.catalogo_habilidades.map((h) => h.slug)),
      sectores: new Set(p.catalogo_sectores.map((s) => s.slug)),
    }),
    simular: simularPerfilCv,
    resumenDe: (r) => r.perfil.resumen,
    // Sin `guardarExtra`: nada se escribe solo. El perfil se revisa y se acepta.
  };
  return def;
}

const DEF_PREGUNTAS: DefinicionAnalisis<PayloadPreguntasEncuadre, RespuestaPreguntasEncuadreValidada> = {
  tipo: 'preguntas_encuadre',
  alcance: 'proyecto',
  columnaEntidad: 'proyecto_id',
  claveEsquema: 'preguntas_encuadre',
  temperatura: 0.4,
  construirPayload: payloadPreguntasEncuadre,
  validar: (cruda) => {
    const parseo = zRespuestaPreguntasEncuadre.safeParse(cruda);
    if (!parseo.success) throw new Error(parseo.error.issues[0]?.message ?? parseo.error.message);
    return parseo.data;
  },
  simular: simularPreguntasEncuadre,
  resumenDe: (r) => r.lectura_inicial,
  /*
   * Las preguntas se materializan con el análisis, en la misma transacción
   * (igual que salud → recomendaciones_ia). El UNIQUE (proyecto, pregunta)
   * hace que regenerar refresque el enunciado SIN tocar `respuesta` ni
   * `estado`: lo ya contestado nunca se pierde.
   */
  guardarExtra: async (conexion, analisisId, proyectoId, datos) => {
    for (const [i, q] of datos.preguntas.entries()) {
      await conexion.query(
        `INSERT INTO proyecto_preguntas
           (proyecto_id, analisis_id, pregunta, motivo, tema, importancia, orden)
         VALUES (?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           analisis_id = VALUES(analisis_id),
           motivo      = VALUES(motivo),
           tema        = VALUES(tema),
           importancia = VALUES(importancia),
           orden       = VALUES(orden)`,
        [proyectoId, analisisId, q.pregunta.slice(0, 500), q.motivo?.slice(0, 500) ?? null,
         q.tema?.slice(0, 80) ?? null, q.importancia, i + 1],
      );
    }
  },
};

const DEF_PERFILES: DefinicionAnalisis<PayloadPerfilesRequeridos, RespuestaPerfilesRequeridosValidada> = {
  tipo: 'perfiles_requeridos',
  alcance: 'proyecto',
  columnaEntidad: 'proyecto_id',
  claveEsquema: 'perfiles_requeridos',
  temperatura: 0.3,
  construirPayload: payloadPerfilesRequeridos,
  validar: (cruda) => {
    const parseo = zRespuestaPerfilesRequeridos.safeParse(cruda);
    if (!parseo.success) throw new Error(parseo.error.issues[0]?.message ?? parseo.error.message);
    return parseo.data;
  },
  sanear: (r, p) => sanearPerfilesRequeridos(r, {
    personas: new Set(p.personas_disponibles.map((x) => x.persona_id)),
    sectores: new Set(p.catalogo_sectores.map((s) => s.slug)),
    habilidades: new Set(p.catalogo_habilidades.map((h) => h.slug)),
  }),
  simular: simularPerfilesRequeridos,
  resumenDe: (r) => r.resumen_necesidad,
  // Sin guardarExtra: los perfiles se revisan y se aceptan, como el planteamiento.
};

export function generarPreguntasEncuadre(
  proyectoId: number,
  opciones: { forzar?: boolean } = {},
): Promise<ResultadoIa<RespuestaPreguntasEncuadreValidada>> {
  return ejecutarAnalisis(DEF_PREGUNTAS, proyectoId, opciones);
}

export function generarPerfilesRequeridos(
  proyectoId: number,
  opciones: { forzar?: boolean } = {},
): Promise<ResultadoIa<RespuestaPerfilesRequeridosValidada>> {
  return ejecutarAnalisis(DEF_PERFILES, proyectoId, opciones);
}

export function analizarPerfilPersona(
  personaId: number,
  insumo: { texto: string; notas: string | null },
  opciones: { forzar?: boolean } = {},
): Promise<ResultadoIa<RespuestaPerfilCvValidada>> {
  return ejecutarAnalisis(defPerfilCv(insumo), personaId, opciones);
}

/* -------------------------------------------------------------------------- */
/*  Feedback: lo que cierra el ciclo de aprendizaje                            */
/* -------------------------------------------------------------------------- */

export async function actualizarRecomendacion(
  id: number,
  estado: 'nueva' | 'aceptada' | 'en_progreso' | 'implementada' | 'descartada',
  feedback?: string,
) {
  await pool.query(
    `UPDATE recomendaciones_ia SET estado = ?, feedback_usuario = COALESCE(?, feedback_usuario)
      WHERE id = ?`,
    [estado, feedback ?? null, id],
  );
}

export async function historialAnalisis(proyectoId: number) {
  return filas<{ id: number; puntaje_salud: number | null; modelo: string; creado_en: string }>(
    `SELECT id, puntaje_salud, modelo, creado_en FROM analisis_ia
      WHERE proyecto_id = ? AND estado = 'ok' ORDER BY creado_en DESC LIMIT 10`,
    [proyectoId],
  );
}
