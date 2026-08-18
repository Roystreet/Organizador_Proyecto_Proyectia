# Contrato de datos con la IA

Cómo se arma lo que se le manda al modelo, qué devuelve y cómo eso vuelve a la base de datos.

Archivos relacionados:

- `src/lib/ai/tipos.ts` — tipos TypeScript del payload y de las respuestas
- `src/lib/ai/esquemas.ts` — JSON Schemas estrictos para Structured Outputs
- `src/lib/ai/prompts.ts` — prompts de sistema por tipo de análisis

---

## 1. El principio que sostiene todo el diseño

**No se le manda la base de datos al modelo. Se le manda un informe ya digerido.**

Todo lo que se puede contar en SQL se cuenta en SQL: cuántas tareas hay abiertas, cuántos días lleva un asunto sin tocar, qué porcentaje del calendario se consumió. En MySQL eso es exacto e instantáneo. Si se lo dejas al modelo, es caro, lento y a veces se equivoca contando.

El modelo se reserva para lo que sí sabe hacer: interpretar, relacionar y recomendar.

De ahí salen cinco reglas:

1. **Métricas precalculadas, no filas crudas.** El payload lleva `tareas_bloqueadas: 4`, no las cuatro tareas para que las cuente.
2. **Top-N ordenado, no listas completas.** Las diez tareas más críticas, no las doscientas del proyecto.
3. **IDs reales en cada elemento.** Sin `id`, la respuesta es un texto que no se puede enlazar a ningún registro. Con `id`, cada recomendación se convierte en una fila de `recomendaciones_ia` que apunta a algo concreto.
4. **Vocabulario cerrado.** Los mismos valores que los `ENUM` de MySQL. Si en la base el estado es `en_progreso`, en el payload es `en_progreso`, y en la respuesta también.
5. **Fecha explícita.** `meta.fecha_referencia` es "hoy". El modelo no tiene reloj y no debe inventarse uno.

---

## 2. Estructura del payload

Todos los payloads comparten el mismo sobre:

```jsonc
{
  "meta": {
    "contrato": "v1",
    "tipo_analisis": "salud_proyecto",
    "fecha_referencia": "2026-08-17",
    "zona_horaria": "America/Caracas",
    "ventana_dias": 30,
    "idioma_respuesta": "es"
  },
  "organizacion": {
    "nombre": "…",
    "proyectos_activos": 12,
    "personas_activas": 7,
    "capacidad_semanal_horas": 160,
    "prioridades_declaradas": ["Cerrar Portal Acme antes de octubre"]
  }
  // … el resto depende del tipo de análisis
}
```

`organizacion` parece decorativo y no lo es: sin saber que hay 12 proyectos activos, el modelo no puede juzgar si tres en rojo es una crisis o el ruido normal del portafolio.

### 2.1 Bloque de proyecto (`salud_proyecto`)

El bloque más grande. Ordenado de lo general a lo específico:

| Sección | Qué lleva | Para qué le sirve al modelo |
|---|---|---|
| identificación | `id`, `codigo`, `nombre`, `categoria`, `cliente`, `etiquetas` | Contexto de dominio: un proyecto de Fintech no se juzga igual que uno de Marketing |
| `objetivo` | Texto libre: qué se considera éxito | Es el ancla. Sin objetivo, "va bien" no significa nada |
| `fechas` | inicio, fin estimada, días transcurridos, días restantes, `tiempo_consumido_pct` | Mitad del diagnóstico de atraso |
| `progreso` | `declarado_pct`, `calculado_pct`, `desviacion_pct` | La otra mitad. Cuando el declarado y el calculado difieren mucho, eso ya es un hallazgo |
| `metricas.tareas` | totales por estado, bloqueadas, vencidas, sin responsable, ciclo promedio, velocidad | El pulso operativo |
| `metricas.asuntos` | abiertos por severidad y categoría, recurrentes, edad promedio | Dónde se acumula la deuda |
| `metricas.actividad` | días sin movimiento, eventos por ventana, tendencia de velocidad | Detecta el proyecto que "existe" pero nadie toca |
| `equipo` | por persona: carga en este proyecto **y en todos los demás** | Sin la carga total no se detecta sobrecarga real |
| `tareas_criticas` | top-N con `bloquea_a` y `depende_de` | Cadenas de bloqueo |
| `asuntos_abiertos` | top-N por severidad | |
| `hitos` | próximos, con días al objetivo | |
| `eventos_recientes` | bitácora resumida de la ventana | Narrativa: qué pasó últimamente |
| `decisiones` | comentarios marcados `es_decision` | Contexto que no está en ninguna métrica |
| `tendencia` | serie de `metricas_snapshot` | Permite decir "empeoró", no solo "está mal" |

### 2.2 Memoria: lo que hace que el sistema mejore

Dos secciones que la mayoría de las integraciones de IA se saltan y que aquí son el diferencial:

**`patrones_conocidos`** — patrones ya detectados en corridas anteriores. El modelo los ve y refuerza el existente (misma `clave`) en vez de reportar el mismo hallazgo como nuevo cada semana. Así `patrones_detectados.frecuencia` sube y la confianza se vuelve significativa.

**`recomendaciones_previas`** — recomendaciones anteriores con su estado y tu feedback. Cuando el modelo ve que descartaste "contratar un QA" con el comentario "no hay presupuesto este trimestre", deja de proponerlo. Es aprendizaje sin reentrenar nada.

### 2.3 Presupuesto de tamaño

Límites sugeridos por sección, para que el payload no se dispare:

| Sección | Tope |
|---|---|
| `tareas_criticas` | 15 |
| `asuntos_abiertos` | 15 |
| `eventos_recientes` | 30 |
| `decisiones` | 10 |
| `tendencia` | 12 puntos (12 semanas) |
| `proyectos` (análisis global) | 40 en formato compacto |
| `insumo.texto` (CV o descripción) | 25 000 caracteres, con bandera `truncado` |
| `personas_disponibles` (perfiles) | 40, internos primero, habilidades de nivel ≥ 2 |

Con esos topes, un `salud_proyecto` se queda entre 4 000 y 9 000 tokens de entrada.

---

## 3. Los diez análisis

| Tipo | Alcance | Entra | Sale |
|---|---|---|---|
| `salud_proyecto` | 1 proyecto | Bloque completo | Puntaje 0–100, semáforo, diagnóstico, riesgos, cuellos de botella, recomendaciones, plan de mejora, preguntas para el equipo |
| `cuellos_botella` | Portafolio | Proyectos compactos + cadenas de bloqueo + equipo | Qué desatascar y en qué orden |
| `match_persona_tarea` | 1 tarea o proyecto | Requerimiento + candidatos con experticia, carga e historial | Ranking con puntaje de ajuste, brechas y riesgo de sobrecarga |
| `patrones_globales` | Portafolio | Agregados cruzados + patrones conocidos | Patrones con clave estable, evidencia y confianza |
| `priorizacion_diaria` | Portafolio | Capacidad del día + tareas y asuntos candidatos | Máximo 7 acciones, foco del día, qué NO hacer hoy |
| `perfil_cv` | 1 persona | Texto pegado (CV o descripción) + catálogos de habilidades y sectores + lo ya registrado de esa persona | Perfil, habilidades con nivel, **sectores que cubre**, experiencias, fortalezas, aportes y preguntas sugeridas |
| `planteamiento_proyecto` | 1 proyecto | `descripcion_libre` (lo que el usuario escribió al crear), objetivo, fechas, equipo, hitos y tareas existentes | Planteamiento, `de_que_trata`, objetivo sugerido, supuestos, hitos propuestos (con `ref` local) y tareas propuestas (con `hito_ref`), preguntas por resolver |
| `tareas_sugeridas` | 1 proyecto | Estado ACTUAL: métricas de tareas, hitos y tareas existentes con ids reales, equipo | Hasta 10 tareas que faltan para avanzar, con justificación, `hito_id` y `responsable_sugerido_id` reales |
| `preguntas_encuadre` | 1 proyecto | Lo poco que hay al crear: descripción libre, objetivo, fechas, sectores, y las preguntas ya respondidas | Entre 4 y 8 preguntas cuya respuesta cambia el plan, con su motivo, tema e importancia, más los supuestos que se tomarán si quedan sin responder |
| `perfiles_requeridos` | 1 proyecto | Proyecto con sectores e hitos + respuestas a las preguntas + catálogos + hasta 40 personas reales con su experticia y carga | Perfiles con rol, seniority, sector, cantidad, habilidades con nivel y criticidad, y candidatos reales del directorio con puntaje y brechas |

### 3.1 Flujo revisar-y-aceptar (`planteamiento_proyecto` y `tareas_sugeridas`)

Estos dos análisis no escriben nada por sí mismos: la propuesta queda guardada en
`analisis_ia` como cualquier análisis (caché por hash incluida) y la interfaz la
muestra con checkboxes. Al aceptar, la Server Action
(`src/lib/acciones/propuestasIa.ts`) **relee `respuesta_json` del servidor**
(nunca confía en JSON reenviado por el cliente), la revalida con Zod y
materializa SOLO lo seleccionado en `hitos` y `tareas`, mapeando `ref → id`
insertado y registrando cada alta en `bitacora`.

Particularidad de referencias: en `planteamiento_proyecto` los hitos propuestos
no existen todavía, así que llevan un `ref` local (1..n) que las tareas citan en
`hito_ref`; la coherencia interna la valida Zod (`superRefine`). En
`tareas_sugeridas` los ids sí son reales y se sanean contra los Sets del payload
(igual que `sanearReferencias` en salud), y se re-validan contra la base al
aceptar.

---

## 4. Salida estructurada

Se usa **Structured Outputs** de OpenAI con `strict: true`. El modelo no puede devolver una forma distinta a la del esquema; no hay que parsear texto ni reintentar por JSON mal formado.

Tres reglas del modo estricto que hay que respetar al escribir los esquemas:

1. Todo objeto lleva `"additionalProperties": false`.
2. **Todas** las propiedades van en `required`. Un campo opcional se modela como requerido y anulable: `"type": ["string", "null"]`.
3. No se admiten `minimum`, `maximum`, `minItems` ni `pattern`. Los rangos se explican en `description` y se validan con Zod al guardar.

Ejemplo de invocación:

```ts
import OpenAI from 'openai';
import { formatoRespuesta } from '@/lib/ai/esquemas';
import { promptSistema, mensajeUsuario, PROMPT_VERSION } from '@/lib/ai/prompts';

const openai = new OpenAI();

const respuesta = await openai.responses.create({
  model: process.env.OPENAI_MODEL!,
  reasoning: { effort: 'max' },
  instructions: promptSistema('salud_proyecto'),
  input: mensajeUsuario(payload),
  text: { format: formatoRespuesta('salud_proyecto') },
});

const datos = JSON.parse(respuesta.output_text);
```

### Campos que aparecen en casi todas las respuestas

- **`justificacion`** en cada recomendación: obliga al modelo a citar el dato del payload que la sustenta. Es el mejor freno contra las alucinaciones y, de paso, es lo que se muestra en la UI cuando el usuario pregunta "¿por qué me recomiendas esto?".
- **`confianza`** (0–1): baja sola cuando el payload trae poca información.
- **`datos_faltantes`**: qué habría mejorado el análisis. Con el tiempo esta lista dice qué campos hay que empezar a llenar en el sistema.

---

## 5. Flujo completo

```
  Usuario pulsa "Analizar"
          │
          ▼
  ┌───────────────────────────┐
  │ construirPayload(tipo, id)│  consultas SQL + vistas
  │  → objeto tipado          │  (v_resumen_proyectos, v_carga_personas, …)
  └───────────┬───────────────┘
              │
              ▼
     sha256(JSON ordenado)  ── ¿hash ya existe en analisis_ia
              │                 y tiene menos de N horas?
              │                        │
              │                        └── sí → devolver el análisis guardado
              ▼
  ┌───────────────────────────┐
  │ OpenAI · Structured Output│  system = promptSistema(tipo)
  │ temperature 0.2           │  user   = payload JSON
  └───────────┬───────────────┘
              │
              ▼
   validar con Zod  ── si falla: se guarda estado='error' y se lanza
              │
              ▼
  ┌───────────────────────────┐
  │ Guardar en MySQL          │
  │  analisis_ia (payload,    │
  │   respuesta, tokens, $)   │
  │  recomendaciones_ia (N)   │
  │  proyectos.salud ← puntaje│
  └───────────┬───────────────┘
              │
              ▼
   Dashboard muestra semáforo, recomendaciones y alertas
              │
              ▼
   Usuario acepta o descarta cada recomendación
              │
              └──► feedback vuelve al siguiente payload
```

El hash del payload es lo que evita pagar dos veces por el mismo análisis: si nada cambió en el proyecto, no hay nada nuevo que analizar.

### Cuándo se dispara cada análisis

| Análisis | Disparo |
|---|---|
| `salud_proyecto` | Manual, o al cerrar un hito, o cada lunes por proyecto activo |
| `priorizacion_diaria` | Automático, cada mañana |
| `cuellos_botella` | Manual, o cuando una tarea lleva más de N días bloqueada |
| `patrones_globales` | Semanal o mensual: necesita volumen para tener sentido |
| `match_persona_tarea` | Bajo demanda, al crear o reasignar una tarea |
| `perfil_cv` | Al crear una persona (redirect con `?perfil=auto`) y bajo demanda desde su ficha |
| `preguntas_encuadre` | Paso 2 del asistente de creación, y bajo demanda desde el detalle |
| `perfiles_requeridos` | Paso 4 del asistente de creación |
| `planteamiento_proyecto` | Automático al crear un proyecto (redirect con `?planteamiento=auto`), y bajo demanda desde el detalle |
| `tareas_sugeridas` | Bajo demanda, botón «Sugerir tareas según estado» en el detalle |

---

## 6. Costos y control

Se guardan `tokens_entrada`, `tokens_salida`, `costo_usd` y `latencia_ms` en cada fila de `analisis_ia`. Con eso se puede responder "cuánto me costó la IA este mes" sin salir del sistema, y detectar qué análisis se está pasando de presupuesto.

La selección de modelo por tipo está implementada en `src/lib/ai/modelos.ts` (`modeloPara(tipo)`):

| Análisis | Variable | Racional |
|---|---|---|
| `salud_proyecto`, `cuellos_botella`, `match_persona_tarea`, `patrones_globales`, `perfil_cv` | `OPENAI_MODEL` | Mucho contexto numérico y razonamiento cruzado |
| `planteamiento_proyecto`, `tareas_sugeridas` | `OPENAI_MODEL_TEXTO` | Solo texto: redacción sobre una descripción |
| `priorizacion_diaria` | `OPENAI_MODEL_BARATO` | Corre todos los días y es más mecánico |

Las variables específicas caen en `OPENAI_MODEL` si están vacías. El esfuerzo
se configura de la misma manera con `OPENAI_REASONING_EFFORT` y sus variantes
`_TEXTO` y `_BARATO`.


---

## 7. El bucle de las preguntas de encuadre

`proyecto_preguntas` no es un registro pasivo: las respuestas viajan en el
payload de `planteamiento_proyecto` y de `perfiles_requeridos`. Eso significa
que **responder una pregunta invalida la caché de esos análisis por sí solo**,
igual que dar feedback a una recomendación invalida la de `salud_proyecto`. No
hay que acordarse de forzar nada: el siguiente análisis ya sale mejor.

El `UNIQUE (proyecto_id, pregunta(180))` hace que regenerar preguntas sea
idempotente: el `ON DUPLICATE KEY UPDATE` refresca motivo, tema e importancia y
**nunca toca `respuesta` ni `estado`**. Volver a pulsar «generar» no borra lo
que ya contestaste.

## 8. Análisis con alcance de persona

`ejecutarAnalisis` recibe un `entidadId` y cada definición declara en qué
columna de `analisis_ia` vive ese id (`columnaEntidad`: `proyecto_id` o
`persona_id`). Cierra a la vez el `WHERE` de la caché y el `INSERT`: con la
columna equivocada el análisis se guardaría huérfano y la caché no acertaría
nunca, porque en SQL `NULL = NULL` es UNKNOWN, no true.
