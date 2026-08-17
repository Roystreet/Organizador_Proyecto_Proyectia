# Organizador de Proyectos
## Documento de producto

> Sistema de gestión de proyectos con análisis asistido por IA.
> Versión del documento: 1.0 · Agosto 2026

---

## Índice

1. [El problema y la propuesta](#1-el-problema-y-la-propuesta)
2. [Estado actual](#2-estado-actual)
3. [Decisiones tomadas](#3-decisiones-tomadas)
4. [Arquitectura](#4-arquitectura)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Sistema de diseño](#6-sistema-de-diseño)
7. [Motor de IA](#7-motor-de-ia)
8. [Pantallas](#8-pantallas)
9. [API](#9-api)
10. [Instalación y operación](#10-instalación-y-operación)
11. [Verificaciones realizadas](#11-verificaciones-realizadas)
12. [Problemas encontrados y resueltos](#12-problemas-encontrados-y-resueltos)
13. [Limitaciones conocidas](#13-limitaciones-conocidas)
14. [Roadmap](#14-roadmap)
15. [Vocabulario controlado](#15-vocabulario-controlado)

---

## 1. El problema y la propuesta

### El problema

Demasiados proyectos en marcha al mismo tiempo. Se pierde el control del estado de cada uno, no hay una visión panorámica y las decisiones se toman por lo que se recuerda, no por lo que los datos dicen.

Los síntomas concretos:

- No hay forma de responder "¿cuál de mis doce proyectos necesita atención hoy?" sin abrir doce cosas distintas.
- Los bloqueos se descubren tarde, cuando ya arrastraron a otras tareas.
- La misma falla se repite proyecto tras proyecto sin que nadie lo note, porque nadie compara entre proyectos.
- El conocimiento de quién sabe qué vive en la cabeza de una persona, no en un sistema.

### La propuesta

Un sistema donde la información operativa (proyectos, tareas, asuntos, personas) se estructura de modo que un motor de IA pueda leerla y devolver **datos accionables**, no texto bonito: diagnósticos con evidencia, alertas de cuellos de botella, recomendaciones enlazadas a registros reales y planes de mejora concretos.

### Los cinco requerimientos originales

| # | Requerimiento | Cómo se resuelve |
|---|---|---|
| 1 | Dashboard de visión global | Pantalla principal con KPIs de portafolio, semáforo por proyecto, cuellos de botella y carga del equipo |
| 2 | Gestión de involucrados | Directorio de personas con experticia por nivel, empresas, y relación con proyectos y tareas |
| 3 | Tareas y asuntos | Tareas con dependencias, subtareas, hitos y sprints; asuntos con tipo, categoría, severidad y estado |
| 4 | Módulo de IA | Seis tipos de análisis con payload estructurado, salida en JSON estricto y persistencia auditable |
| 5 | Extras | Extracción de perfil desde CV, detección de patrones entre proyectos, match persona ↔ tarea, y ciclo de feedback que hace que el sistema mejore con el uso |

---

## 2. Estado actual

### Funcionando

- Base de datos completa: **30 tablas, 3 vistas, 2 triggers, 45 claves foráneas, 318 columnas**.
- Catálogos poblados: 10 categorías de proyecto, 10 categorías de asunto, 35 habilidades, 12 roles.
- Aplicación Next.js con tres pantallas leyendo datos reales.
- Motor de IA de punta a punta: construcción del payload desde SQL, llamada al modelo, validación, persistencia y visualización.
- Modo sin API key (`IA_MODO=simulado`) con un analista por reglas equivalente.
- Ciclo de feedback cerrado: aceptar o descartar recomendaciones y que eso afecte al siguiente análisis.
- Datos de demostración: 7 proyectos, 8 personas, 24 tareas con dependencias, 12 asuntos, bitácora e histórico de métricas.
- Formularios de alta y edición de proyectos, personas y empresas (Server Actions + Zod), con registro en `bitacora` desde la aplicación.
- Directorio CRM: tabla de personas con búsqueda y filtros, detalle `/personas/[id]`, y gestión de empresas con sus contactos y proyectos.
- Flujo crear-proyecto-con-IA: al crear un proyecto con su descripción, el análisis `planteamiento_proyecto` propone planteamiento, hitos y tareas; el usuario marca qué insertar (revisar-y-aceptar). `tareas_sugeridas` propone tareas según el estado actual.
- Selección de modelo por tipo de análisis (`src/lib/ai/modelos.ts`): los análisis de solo texto usan `OPENAI_MODEL_TEXTO`.
- Roadmap visual por proyecto: hitos, sprints y tareas sobre una grilla semanal, sin librerías de charts.

### Todavía no

- Formularios de tareas y asuntos (proyectos, personas y empresas ya tienen).
- Endpoint de carga de CV (el esquema y el prompt ya existen; falta la extracción de texto del PDF).
- Los análisis `cuellos_botella`, `match_persona_tarea`, `patrones_globales` y `priorizacion_diaria` tienen contrato y prompt escritos, pero no están conectados a la interfaz (`salud_proyecto`, `planteamiento_proyecto` y `tareas_sugeridas` sí lo están).
- Autenticación (decidida fuera de alcance: un solo usuario).
- Registro de horas y costos (decidido fuera de alcance).

---

## 3. Decisiones tomadas

| Punto | Decisión | Por qué |
|---|---|---|
| Gestor de paquetes | pnpm 9, con `packageManager` fijado en `package.json` |
| Framework | Next.js 15 (App Router) + TypeScript | Server Components permiten consultar MySQL directo desde la página, sin capa de API intermedia para lecturas |
| UI | Material UI v9 con tema propio en verdes | Componentes maduros y un sistema de color semántico encima |
| Base de datos | MySQL 8 local, esquema `proyectos` | Ya era el entorno de trabajo |
| Acceso a datos | Drizzle ORM + mysql2 | Tipado fuerte y cercanía al SQL; las consultas agregadas se escriben en SQL crudo, que es donde son claras |
| Usuarios | Un solo usuario, sin login | Simplicidad. Las personas del directorio son registros de datos, no cuentas |
| Motor de IA | OpenAI con Structured Outputs (`strict: true`) | Garantiza la forma de la respuesta sin parsear texto ni reintentar por JSON mal formado |
| Categorías | Catálogo administrable + etiquetas libres | El catálogo da consistencia para comparar; las etiquetas dan flexibilidad |
| Perfiles | Subir CV y que la IA extraiga habilidades, experiencia y fortalezas | Menos captura manual; el usuario valida lo extraído |
| Fuera de alcance | Horas, costos, multiusuario | No aportan al problema central hoy |

---

## 4. Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│  NAVEGADOR                                                   │
│  React 19 · Material UI · tema verde claro/oscuro            │
└───────────────┬──────────────────────────┬───────────────────┘
                │ HTML del servidor        │ fetch (solo IA)
                ▼                          ▼
┌──────────────────────────────┐  ┌────────────────────────────┐
│  SERVER COMPONENTS           │  │  ROUTE HANDLERS            │
│  Dashboard, proyectos,       │  │  POST /api/ia/analizar     │
│  personas                    │  │  PATCH /api/ia/recomend..  │
│  → src/lib/consultas.ts      │  │  → src/lib/ai/cliente.ts   │
└───────────────┬──────────────┘  └─────────┬──────────────────┘
                │                            │
                ▼                            ▼
        ┌───────────────────────────────────────────┐
        │  MySQL 8 · esquema `proyectos`            │
        │  30 tablas · 3 vistas · 2 triggers        │
        └───────────────────────────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │  OpenAI                  │
                              │  Structured Outputs      │
                              │  (o reglas locales)      │
                              └──────────────────────────┘
```

**Principio de reparto:** las lecturas del dashboard van directo de Server Component a MySQL, sin API. Las mutaciones de formularios (proyectos, personas, empresas, aceptar propuestas de la IA) son **Server Actions** (`src/lib/acciones/`) con Zod, transacción, bitácora y `revalidatePath`. Los route handlers quedan solo para el flujo interactivo de la IA (`POST /api/ia/analizar` con `tipo`, `PATCH /api/ia/recomendaciones/[id]`), donde la respuesta vive en estado de cliente. Menos capas, menos código que mantener.

### Mapa de archivos

```
db/
  01_schema.sql              DDL: tablas, vistas, triggers, índices
  02_seed.sql                Catálogos base
  03_demo.sql                Portafolio de demostración
src/
  app/
    layout.tsx               Raíz + ThemeRegistry + Shell
    page.tsx                 Dashboard
    proyectos/page.tsx       Lista de proyectos
    proyectos/nuevo/         Alta de proyecto
    proyectos/[id]/page.tsx  Detalle: planteamiento IA, roadmap, tareas
    proyectos/[id]/editar/   Edición de proyecto
    personas/page.tsx        Directorio CRM (tabla con filtros)
    personas/nueva/          Alta de persona
    personas/[id]/           Detalle de persona (+ /editar)
    empresas/                Lista, alta, detalle y edición de empresas
    api/ia/analizar/         POST · dispara análisis (param `tipo`)
    api/ia/recomendaciones/  PATCH · feedback
  components/
    Shell.tsx                Navegación lateral + barra superior
    Kpi.tsx                  Tarjeta de indicador
    TarjetaProyecto.tsx      Tarjeta del dashboard
    ChipSemantico.tsx        Chip de estado con color del tema
    PuntoSalud.tsx           Punto de semáforo
    PanelIa.tsx              Panel de análisis de salud (cliente)
    PanelPlanteamiento.tsx   Planteamiento + roadmap IA, revisar-y-aceptar
    RoadmapProyecto.tsx      Línea de tiempo semanal de hitos/sprints/tareas
    BarraFiltrosPersonas.tsx Filtros del directorio (estado en la URL)
    formularios/             FormularioProyecto, FormularioPersona, FormularioEmpresa
  db/
    schema.ts                Schema de Drizzle, espejo del DDL
    index.ts                 Pool, cliente Drizzle, helpers de consulta
  theme/
    theme.ts                 Tema MUI: escalas, semántica, overrides
    ThemeRegistry.tsx        Provider para App Router
  lib/
    consultas.ts             Todas las lecturas SQL
    formato.ts               Fechas y cálculo determinista del semáforo
    identificadores.ts       Slug y código de proyecto únicos
    bitacora.ts              Registro de bitácora desde la aplicación
    acciones/                Server Actions: proyectos, personas, empresas,
                             propuestasIa (aceptar hitos/tareas de la IA)
    ai/
      tipos.ts               Contrato: payloads y respuestas
      esquemas.ts            JSON Schemas para Structured Outputs
      prompts.ts             Prompts de sistema por análisis
      modelos.ts             Selección de modelo por tipo de análisis
      construirPayload.ts    Ensambla el payload desde SQL
      consultasIa.ts         Consultas propias del motor
      simulador.ts           Analista por reglas
      validacion.ts          Zod + saneamiento de referencias
      cliente.ts             Motor genérico ejecutarAnalisis(), caché, persistencia
      errores.ts             Errores tipados
docs/
  PRODUCTO.md                Este documento
  00-guia.md                 Guía de decisiones
  03-contrato-ia.md          Contrato con la IA en detalle
```

---

## 5. Modelo de datos

Base `proyectos`, MySQL 8, InnoDB, `utf8mb4`. Nueve bloques temáticos.

### 5.1 Catálogos

Vocabulario controlado. Sin esto, la IA compara peras con manzanas.

| Tabla | Para qué |
|---|---|
| `categorias` | Categoría principal del proyecto: Desarrollo Web, Datos e IA, Marketing… Con color e icono para la interfaz |
| `etiquetas` | Tags libres, transversales a proyectos, tareas y asuntos |
| `categorias_asunto` | Tipos de problema: Bug funcional, Bloqueo externo, Deuda técnica, Riesgo de plazo… |
| `habilidades` | Catálogo maestro de experticia, clasificado en técnica, herramienta, dominio, blanda, idioma y metodología |
| `roles_proyecto` | Roles que una persona ocupa en un proyecto, marcando si es interno o externo |

### 5.2 Directorio

| Tabla | Para qué |
|---|---|
| `empresas` | Clientes, proveedores, aliados y prospectos, con industria y tamaño |
| `personas` | Directorio central. Rol, seniority, disponibilidad semanal, zona horaria, bio y `resumen_ia` |
| `persona_documentos` | CV y otros documentos, con el texto ya extraído y el estado del procesamiento |
| `persona_habilidades` | Nivel 1–5 por habilidad, años, evidencia textual, y `origen` que distingue lo capturado a mano de lo inferido por la IA |
| `persona_experiencias` | Historial laboral con industria y logros |
| `persona_insumos` | Fortalezas, aportes, **preguntas sugeridas**, áreas de mejora |

`persona_insumos` responde directamente a "qué me puede aportar cada colaborador y qué le puedo preguntar". El tipo `pregunta_sugerida` guarda preguntas concretas que conviene hacerle a esa persona para extraer conocimiento que la organización no tiene documentado.

### 5.3 Proyectos

| Tabla | Para qué |
|---|---|
| `proyectos` | Núcleo. Código, objetivo, estado, prioridad, salud, progreso, fechas y `ultimo_movimiento_en` |
| `proyecto_personas` | Involucrados con su rol y porcentaje de asignación |
| `proyecto_etiquetas` | Relación N:M con etiquetas |
| `proyecto_habilidades_requeridas` | Qué experticia exige el proyecto y a qué nivel |

Dos campos que parecen menores y no lo son:

- **`objetivo`** — qué se considera éxito. Es el ancla de todo el análisis; sin él, "va bien" no significa nada.
- **`ultimo_movimiento_en`** — última actividad real. Es lo que permite detectar el proyecto que existe pero nadie toca.

`salud_origen` distingue si el semáforo lo fijó una persona, lo calculó la fórmula o lo puso la IA.

### 5.4 Planificación

| Tabla | Para qué |
|---|---|
| `hitos` | Milestones con fecha objetivo y estado |
| `sprints` | Iteraciones con objetivo y ventana de fechas |

### 5.5 Tareas

| Tabla | Para qué |
|---|---|
| `tareas` | Tareas y subtareas, con estado, prioridad, estimación, `motivo_bloqueo` y `bloqueada_desde` |
| `tarea_dependencias` | Qué tarea depende de cuál. **Sin esto, "cuello de botella" es una opinión** |
| `tarea_etiquetas` | Relación N:M |
| `tarea_habilidades_requeridas` | Experticia que exige una tarea concreta, para el match fino |

### 5.6 Asuntos

| Tabla | Para qué |
|---|---|
| `asuntos` | Bugs, incidencias, riesgos, bloqueos, deuda técnica, cambios de alcance y preguntas |
| `asunto_etiquetas` | Relación N:M |

Campos clave: `severidad`, `impacto`, `es_recurrente` y `causa_raiz`. La combinación de recurrente + causa raíz es lo que alimenta la detección de patrones entre proyectos.

### 5.7 Trazabilidad

| Tabla | Para qué |
|---|---|
| `comentarios` | Polimórfico. `es_decision` marca los que registran una decisión; la IA les da más peso |
| `bitacora` | Historial de cambios. Es la serie temporal que permite decir "se frenó hace tres semanas" en vez de "va lento" |
| `adjuntos` | Archivos asociados a cualquier entidad |

### 5.8 Motor de IA

| Tabla | Para qué |
|---|---|
| `analisis_ia` | Cada análisis con su payload, su respuesta, el modelo, la versión del prompt, tokens, costo y latencia |
| `recomendaciones_ia` | Salidas accionables normalizadas, con `justificacion`, estado y `feedback_usuario` |
| `patrones_detectados` | Patrones transversales con `clave` estable, frecuencia acumulada y confianza |

Guardar el payload enviado junto a la respuesta permite auditar, comparar versiones de prompt y reproducir cualquier análisis. `costo_usd` responde "cuánto me costó la IA este mes" sin salir del sistema.

### 5.9 Series temporales

| Tabla | Para qué |
|---|---|
| `metricas_snapshot` | Instantánea periódica por proyecto. Permite graficar tendencias y darle a la IA el "antes" contra el cual comparar |

### 5.10 Vistas

| Vista | Qué devuelve |
|---|---|
| `v_resumen_proyectos` | Una fila por proyecto con todos los contadores agregados. Es la consulta del dashboard |
| `v_carga_personas` | Carga real por persona **sumando todos sus proyectos**. Sin eso no se detecta sobrecarga real |
| `v_cuellos_botella` | Tareas abiertas que frenan a otras **y además están realmente detenidas** |

La condición de `v_cuellos_botella` importa: una tarea con dependientes que simplemente está pendiente y no vencida no es un cuello de botella. Se exige que esté bloqueada, vencida, o sin movimiento en 7 días. Los días detenida se miden contra la bitácora, no contra `actualizado_en`, que cambia con cualquier edición menor.

### 5.11 Reglas de integridad

- **45 claves foráneas** con `ON DELETE CASCADE` donde el hijo no tiene sentido sin el padre, y `SET NULL` donde sí.
- **Borrado lógico** (`activo`, `archivado`) donde el histórico importa, porque el motor de IA necesita la serie completa.
- **2 triggers** sobre `tarea_dependencias` que impiden que una tarea dependa de sí misma. Es un trigger y no un `CHECK` porque MySQL 8 no permite `CHECK` sobre columnas que participan en una FK con acción referencial.
- `CHECK` de rango en porcentajes y niveles donde sí es posible.

---

## 6. Sistema de diseño

Archivo: `src/theme/theme.ts`

### Tres escalas de color

| Escala | Uso |
|---|---|
| `verde` (50–900) | Color de marca. `#2E7D32` en claro, `#66BB6A` en oscuro |
| `verdeAzulado` (50–900) | Secundario, para acentos y datos |
| `neutro` (50–900) | Grises con una pizca de verde, para que no se vean azulados junto al verde |

### La capa semántica

Es la parte que hace que el dashboard se lea de un vistazo. Cada estado del dominio tiene su propia terna de colores, en claro y en oscuro:

```ts
theme.palette.semantico.salud.rojo            // { main, suave, contraste }
theme.palette.semantico.prioridad.critica
theme.palette.semantico.estadoProyecto.en_pausa
theme.palette.semantico.estadoTarea.bloqueada
theme.palette.semantico.estadoAsunto.en_espera
```

- `main` — punto de estado, borde, texto sobre fondo claro
- `suave` — fondo de chip o fila resaltada
- `contraste` — texto legible sobre `suave`

Como las tres versiones existen en ambos modos, un componente se escribe una vez y funciona en claro y oscuro sin condicionales:

```tsx
const c = colorDe(theme, 'salud', proyecto.salud);
<Chip label={ETIQUETAS.salud[proyecto.salud]}
      sx={{ bgcolor: c.suave, color: c.contraste }} />
```

**El verde es la marca; los estados tienen su propia escala.** Si todo fuera verde, el dashboard no comunicaría nada de un vistazo — que es justo el problema a resolver.

### Otros elementos

- `paletaGraficos`: ocho colores categóricos ordenados por distinguibilidad para las gráficas.
- `ETIQUETAS`: textos legibles para cada valor de enum, sincronizados con el SQL.
- Tipografía Inter/Roboto, botones sin mayúsculas forzadas, radio de 10–14 px.
- Overrides de Card, Button, Chip, LinearProgress, AppBar, Drawer, ListItemButton, TableCell, Tooltip y la barra de scroll.
- Módulo `ThemeRegistry` que respeta la preferencia de modo del sistema y permite alternarla.

Todo el color de estado pasa por el componente `ChipSemantico`, así que cambiar un color se hace en un solo sitio.

---

## 7. Motor de IA

Detalle completo en `docs/03-contrato-ia.md`.

### 7.1 El principio que sostiene el diseño

**Al modelo no se le manda la base de datos. Se le manda un informe ya digerido.**

Todo lo que se puede contar en SQL se cuenta en SQL: cuántas tareas hay abiertas, cuántos días lleva un asunto sin tocar, qué porcentaje del calendario se consumió. En MySQL eso es exacto e instantáneo; en el modelo es caro, lento y a veces se equivoca contando.

De ahí salen cinco reglas:

1. **Métricas precalculadas, no filas crudas.** El payload lleva `tareas_bloqueadas: 4`, no las cuatro tareas para que las cuente.
2. **Top-N ordenado, no listas completas.** Las quince tareas más críticas, no las doscientas del proyecto.
3. **IDs reales en cada elemento.** Sin `id`, la respuesta es texto que no se enlaza a nada. Con `id`, cada recomendación se convierte en una fila que apunta a un registro concreto.
4. **Vocabulario cerrado.** Los mismos valores que los `ENUM` de MySQL, de punta a punta.
5. **Fecha explícita.** `meta.fecha_referencia` es "hoy". El modelo no tiene reloj y no debe inventarse uno.

### 7.2 Estructura del payload

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
    "personas_activas": 8,
    "capacidad_semanal_horas": 190,
    "prioridades_declaradas": []
  }
}
```

`organizacion` parece decorativo y no lo es: sin saber que hay 12 proyectos activos, el modelo no puede juzgar si tres en rojo es una crisis o el ruido normal del portafolio.

#### Bloque de proyecto

| Sección | Contenido | Para qué sirve |
|---|---|---|
| Identificación | código, nombre, categoría, cliente, etiquetas | Contexto de dominio |
| `objetivo` | qué se considera éxito | El ancla del análisis |
| `fechas` | inicio, fin estimada, días transcurridos y restantes, `tiempo_consumido_pct` | Mitad del diagnóstico de atraso |
| `progreso` | declarado, calculado, `desviacion_pct` | La otra mitad. Que difieran mucho ya es un hallazgo |
| `metricas.tareas` | totales por estado, bloqueadas, vencidas, sin responsable, ciclo promedio | Pulso operativo |
| `metricas.asuntos` | abiertos por severidad y categoría, recurrentes, edad promedio | Dónde se acumula la deuda |
| `metricas.actividad` | días sin movimiento, eventos por ventana, velocidad y su tendencia | Detecta el proyecto estancado |
| `equipo` | por persona: carga aquí **y en todos los demás proyectos** | Sin la carga total no hay sobrecarga real |
| `tareas_criticas` | top-15 con `bloquea_a` y `depende_de` | Cadenas de bloqueo |
| `asuntos_abiertos` | top-15 por severidad | |
| `hitos` | próximos, con días al objetivo | |
| `eventos_recientes` | bitácora resumida | Narrativa de lo que pasó |
| `decisiones` | comentarios marcados `es_decision` | Contexto que no está en ninguna métrica |
| `tendencia` | hasta 12 snapshots | Permite decir "empeoró", no solo "está mal" |

#### Las dos secciones que cierran el ciclo

- **`patrones_conocidos`** — patrones ya detectados. El modelo refuerza el existente (misma `clave`) en vez de reportar lo mismo como nuevo cada semana.
- **`recomendaciones_previas`** — recomendaciones anteriores con su estado y el feedback del usuario. Cuando el modelo ve que se descartó "contratar un QA" con el comentario "no hay presupuesto este trimestre", deja de proponerlo. Es aprendizaje sin reentrenar nada.

#### Presupuesto de tamaño

| Sección | Tope |
|---|---|
| `tareas_criticas` | 15 |
| `asuntos_abiertos` | 15 |
| `eventos_recientes` | 30 |
| `decisiones` | 10 |
| `tendencia` | 12 puntos |
| Proyectos en análisis global | 40, en formato compacto |
| Texto de CV | 25.000 caracteres, con bandera `truncado` |

Con esos topes, un `salud_proyecto` queda entre 4.000 y 9.000 tokens de entrada.

### 7.3 Los seis análisis

| Tipo | Alcance | Entra | Sale | Estado |
|---|---|---|---|---|
| `salud_proyecto` | 1 proyecto | Bloque completo | Puntaje 0–100, semáforo, diagnóstico, riesgos, cuellos de botella, recomendaciones, plan de mejora, preguntas para el equipo | **Conectado** |
| `cuellos_botella` | Portafolio | Proyectos compactos + cadenas de bloqueo + equipo | Qué desatascar y en qué orden | Contrato listo |
| `match_persona_tarea` | 1 tarea o proyecto | Requerimiento + candidatos con experticia, carga e historial | Ranking con puntaje de ajuste, brechas y riesgo de sobrecarga | Contrato listo |
| `patrones_globales` | Portafolio | Agregados cruzados + patrones conocidos | Patrones con clave estable, evidencia y confianza | Contrato listo |
| `priorizacion_diaria` | Portafolio | Capacidad del día + candidatos | Máximo 7 acciones, foco del día, qué NO hacer hoy | Contrato listo |
| `perfil_cv` | 1 documento | Texto del CV + catálogo de habilidades + necesidades | Perfil, habilidades con nivel, experiencias, fortalezas, aportes y preguntas sugeridas | Contrato listo |

### 7.4 Salida estructurada

Se usa **Structured Outputs** de OpenAI con `strict: true`: el modelo no puede devolver una forma distinta a la del esquema. No hay que parsear texto ni reintentar por JSON mal formado.

Tres reglas del modo estricto que hay que respetar al escribir los esquemas:

1. Todo objeto lleva `"additionalProperties": false`.
2. **Todas** las propiedades van en `required`. Un campo opcional se modela como requerido y anulable: `"type": ["string", "null"]`.
3. No se admiten `minimum`, `maximum`, `minItems` ni `pattern`. Los rangos se explican en `description` y se validan con Zod al guardar.

```ts
const respuesta = await openai.chat.completions.create({
  model: process.env.OPENAI_MODEL!,
  temperature: 0.2,                 // análisis, no creatividad
  messages: [
    { role: 'system', content: promptSistema('salud_proyecto') },
    { role: 'user',   content: mensajeUsuario(payload) },
  ],
  response_format: formatoRespuesta('salud_proyecto'),
});
```

### 7.5 Tres campos que aparecen en casi todas las respuestas

- **`justificacion`** en cada recomendación: obliga al modelo a citar el dato del payload que la sustenta. Es el mejor freno contra las alucinaciones y, de paso, es lo que se muestra cuando el usuario pregunta "¿por qué me recomiendas esto?".
- **`confianza`** (0–1): baja sola cuando el payload trae poca información.
- **`datos_faltantes`**: qué habría mejorado el análisis. Con el tiempo, esta lista dice qué campos hay que empezar a llenar.

### 7.6 Validación en tres capas

1. **Structured Outputs** garantiza la forma.
2. **Zod** valida los rangos: un puntaje de 140 o una confianza de 3 pasan el esquema JSON y rompen la interfaz.
3. **Saneamiento de referencias**: cada `entidad_id` que devuelve el modelo se contrasta contra los ids que efectivamente iban en el payload. Si inventa uno, se anula en vez de guardar un enlace roto.

Si Zod falla, el análisis se guarda con `estado = 'error'` y el mensaje, para poder diagnosticar después.

### 7.7 Caché por hash

Antes de llamar al modelo se calcula un SHA-256 del estado del proyecto. Si existe un análisis con el mismo hash dentro de la ventana de `IA_CACHE_HORAS`, se devuelve ese y no se paga nada.

**Detalle no obvio:** el hash se calcula sobre el payload **excluyendo las recomendaciones que siguen en estado `nueva`**. Si se incluyeran, cada análisis invalidaría su propia caché al insertar sus recomendaciones, el hash nunca coincidiría y se pagaría de nuevo en cada clic. En cambio, dar feedback a una recomendación **sí** invalida la caché, porque eso sí es información nueva.

### 7.8 Modo simulado

Con `IA_MODO=simulado` (o sin `OPENAI_API_KEY`), el análisis lo hace un analista por reglas en `src/lib/ai/simulador.ts` que aplica la misma lógica que el prompt le pide al modelo, pero por código. Detecta:

- Desviación entre calendario y avance real
- Cadenas de bloqueo, con arrastre
- Asuntos críticos y recurrencia
- Estancamiento por días sin movimiento
- Concentración de carga en una persona
- Habilidades requeridas no cubiertas
- Tareas vencidas
- Riesgo de incumplimiento de fecha
- Refuerzo de patrones ya conocidos

Sirve para tres cosas: desarrollar sin gastar tokens, tener un piso de calidad cuando la API falla, y **medir qué aporta el modelo por encima de lo que las reglas ya deducen**. Todo lo que el simulador resuelve solo, no hace falta pagárselo a un LLM.

### 7.9 El semáforo tiene dos fuentes

`proyectos.salud_origen` distingue de dónde viene el color:

- `calculada` — fórmula determinista en `src/lib/formato.ts` que pesa asuntos críticos, bloqueos, tareas vencidas, días sin movimiento y la combinación peligrosa de fecha cerca con avance bajo. Corre siempre, sin costo.
- `ia` — la sobrescribe el análisis cuando se ejecuta.

Así el dashboard nunca muestra "sin datos" habiendo datos, y la IA solo se paga cuando aporta algo por encima de la fórmula.

### 7.10 Flujo completo

```
Usuario pulsa "Analizar"
        │
        ▼
construirPayload(proyecto)  ← consultas SQL + vistas
        │
        ▼
sha256(payload ordenado) ── ¿hash ya analizado y reciente?
        │                          └── sí → devolver el guardado
        ▼
OpenAI · Structured Outputs   (o reglas locales)
        │
        ▼
Zod + saneamiento de referencias ── falla → estado='error'
        │
        ▼
Transacción:
  analisis_ia       (payload, respuesta, tokens, costo, latencia)
  recomendaciones_ia (N filas, ids devueltos al cliente)
  proyectos.salud ← semáforo del análisis
        │
        ▼
Interfaz muestra puntaje, diagnóstico, riesgos, plan y preguntas
        │
        ▼
Usuario acepta o descarta cada recomendación
        │
        └──► el feedback entra en el payload del siguiente análisis
```

### 7.11 Cuándo disparar cada análisis

| Análisis | Disparo sugerido |
|---|---|
| `salud_proyecto` | Manual, al cerrar un hito, o cada lunes por proyecto activo |
| `priorizacion_diaria` | Automático, cada mañana |
| `cuellos_botella` | Manual, o cuando una tarea lleva N días bloqueada |
| `patrones_globales` | Semanal o mensual: necesita volumen para tener sentido |
| `match_persona_tarea` | Bajo demanda, al crear o reasignar |
| `perfil_cv` | Al subir un documento |

### 7.12 Costos

Se guardan `tokens_entrada`, `tokens_salida`, `costo_usd` y `latencia_ms` en cada análisis.

Recomendación práctica: modelo grande para `salud_proyecto`, `patrones_globales` y `perfil_cv`; modelo pequeño y barato para `priorizacion_diaria`, que corre todos los días y es más mecánico.

---

## 8. Pantallas

### Dashboard (`/`)

- **Fila de KPIs**: proyectos activos, tareas abiertas, bloqueadas, vencidas, asuntos críticos y personas. Los números que son una alerta se pintan en color; el resto queda neutro.
- **Tarjetas de proyecto**: punto de semáforo, código, prioridad, nombre, categoría y cliente, barra de avance **real** (calculado sobre tareas completadas, no sobre el porcentaje declarado a mano), y cuatro contadores con icono que se apagan en gris cuando valen cero.
- **Cuellos de botella**: tareas abiertas que frenan a otras, con cuántas arrastran, días detenidas, responsable y motivo.
- **Carga del equipo**: tareas abiertas por persona sumando todos los proyectos, con barra relativa y marca de vencidas.
- **Patrones detectados**: lo que se repite entre proyectos, con número de casos, confianza y la contramedida sugerida.

### Detalle de proyecto (`/proyectos/[id]`)

- Cabecera con semáforo, estado, prioridad y **objetivo** destacado.
- Cinco KPIs: avance, bloqueadas, vencidas, asuntos abiertos y entrega.
- **Panel de análisis de IA**: puntaje sobre 100, resumen ejecutivo, confianza, recomendaciones con botones de aceptar y descartar, diagnóstico por área, riesgos con mitigación, plan de mejora numerado, preguntas para el equipo, y el aviso de qué datos habrían mejorado el análisis.
- **Tabla de tareas** marcando cuáles están bloqueadas y cuántas otras frenan.
- **Asuntos** ordenados por severidad, con categoría, días abierto y marca de recurrente.
- **Involucrados** con su carga en este proyecto y en el portafolio, y sus fortalezas.
- **Habilidades requeridas** con punto verde o rojo según las cubra alguien del equipo al nivel pedido.

### Personas (`/personas`)

Directorio en tarjetas: avatar, rol, seniority, años, empresa, proyectos activos y tareas abiertas; habilidades destacadas en verde sólido y el resto en contorno, cada una con su nivel; fortalezas y aportes; y un bloque **"Qué preguntarle"** con las preguntas sugeridas y su motivo.

---

## 9. API

### `POST /api/ia/analizar`

```json
{ "proyecto_id": 1, "forzar": false }
```

Respuesta:

```json
{
  "analisis_id": 7,
  "recomendacion_ids": [12, 13, 14],
  "datos": { "puntaje_salud": 29, "semaforo": "rojo", "…": "…" },
  "desde_cache": false,
  "modo": "simulado",
  "modelo": "reglas-locales",
  "latencia_ms": 4,
  "referencias_descartadas": 0
}
```

`recomendacion_ids` va alineado con `datos.recomendaciones`, para poder dar feedback sobre cada una.

| Código | Cuándo |
|---|---|
| `200` | Análisis completo |
| `400` | Falta `proyecto_id` o no es entero |
| `404` | El proyecto no existe |
| `500` | Fallo del modelo o de la base |

### `PATCH /api/ia/recomendaciones/[id]`

```json
{ "estado": "descartada", "feedback": "No hay presupuesto este trimestre" }
```

Estados válidos: `nueva`, `aceptada`, `en_progreso`, `implementada`, `descartada`.

---

## 10. Instalación y operación

### Un solo comando

Con MySQL corriendo:

```bash
pnpm install
pnpm db:up     # opcional: levanta MySQL 8 con Docker Compose
pnpm dev
```

`pnpm dev` ejecuta `scripts/preparar.mjs` antes de arrancar el servidor. Ese script:

1. Crea `.env.local` desde `.env.example` si no existe.
2. Comprueba que MySQL responda, y si no, explica cómo arrancarlo según el sistema.
3. Crea la base indicada en `DB_NAME` si falta.
4. Aplica `01_schema.sql` solo si no hay tablas.
5. Carga `02_seed.sql` solo si los catálogos están vacíos.
6. Carga `03_demo.sql` solo la primera vez.

Es idempotente. Cada paso se salta si ya está hecho, así que correrlo diez veces
seguidas no duplica ni rompe nada.

**Detalle técnico:** `mysql2` ejecuta una sentencia a la vez y no entiende
`DELIMITER`, que es una directiva del cliente de terminal y no de SQL. Por eso
`scripts/lib-sql.mjs` incluye un partidor que sí la entiende: es lo que permite
que los dos triggers de `01_schema.sql` se creen desde Node igual que desde la
línea de comandos. El partidor también omite las sentencias `CREATE DATABASE` y
`USE`, porque traen el nombre escrito a mano en el archivo y el script ya está
conectado a la base de `DB_NAME`; sin eso, usar otro nombre crearía en silencio
la base equivocada.

### Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Prepara la base si hace falta y arranca en desarrollo |
| `pnpm dev:rapido` | Arranca sin verificar la base |
| `pnpm setup` | Solo la preparación |
| `pnpm db:up` / `db:down` / `db:logs` | MySQL con Docker Compose |
| `pnpm db:reset` | Borra la base y la reconstruye |
| `pnpm build` | Build de producción |
| `pnpm start` | Prepara y arranca el build de producción |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:studio` | Explorador visual de la base |

### Variables de entorno

| Variable | Para qué |
|---|---|
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | Conexión a MySQL. La base se crea sola con el nombre de `DB_NAME` |
| `SEED_DEMO` | `true` carga el portafolio de ejemplo la primera vez |
| `IA_MODO` | `real` llama a OpenAI · `simulado` usa las reglas locales |
| `OPENAI_API_KEY` | Clave de la API. Sin ella se cae a modo simulado en vez de fallar |
| `OPENAI_MODEL` | Modelo para los análisis pesados (salud, patrones, perfil de CV) |
| `OPENAI_MODEL_TEXTO` | Modelo para los análisis de solo texto (`planteamiento_proyecto`, `tareas_sugeridas`). Vacío → cae en `OPENAI_MODEL` |
| `OPENAI_MODEL_BARATO` | Modelo para los análisis diarios (`priorizacion_diaria`). Vacío → cae en `OPENAI_MODEL` |
| `ORG_NOMBRE` | Nombre de la organización que viaja en el contexto de los análisis |
| `IA_PROMPT_VERSION` | Versión de prompt que se registra en cada análisis |
| `IA_CACHE_HORAS` | Vigencia de un análisis con el mismo hash |
| `UPLOADS_DIR` | Carpeta de CV y adjuntos |

### MySQL

Credenciales por defecto: usuario `root`, contraseña `root1234`, base `proyectos`.

El `docker-compose.yml` incluido levanta MySQL 8 con esa misma contraseña, la
base creada, `utf8mb4` configurado, volumen persistente y healthcheck. Es
opcional: si ya hay un MySQL en la máquina, se ignora.

El script de arranque **reintenta la conexión durante 40 segundos** antes de
rendirse. Sin eso, `pnpm db:up && pnpm dev` fallaría casi siempre en la primera
corrida, porque MySQL recién levantado tarda decenas de segundos en inicializar
y rechaza conexiones mientras tanto. Solo se reintenta lo que se arregla
esperando: una contraseña incorrecta falla de inmediato, porque no mejora con el
tiempo.

### Requisitos

- Node 20.9 o superior
- pnpm 9 (`corepack enable` lo activa sin instalar nada)
- MySQL 8, propio o vía el `docker-compose.yml` incluido

## 11. Verificaciones realizadas

- Esquema y seeds ejecutados contra **MySQL 8.0.46 real**, no revisados a ojo.
- `drizzle-kit push` genera las mismas **30 tablas y 318 columnas** que el DDL, comparado por diferencia contra `information_schema`.
- Las tres vistas devuelven valores correctos con datos de prueba.
- El trigger anti-autodependencia dispara con `SQLSTATE 45000`.
- `npm run build` y `tsc --noEmit` sin errores.
- Rutas `/`, `/proyectos`, `/proyectos/[id]`, `/personas` devuelven 200 con datos reales.
- `POST /api/ia/analizar`: 200 con análisis, 400 sin `proyecto_id`, 404 con id inexistente.
- Segunda y tercera llamada consecutiva sirven desde caché; tras dar feedback a una recomendación, vuelve a analizar.
- `PATCH /api/ia/recomendaciones/[id]` persiste estado y feedback.
- Capturas de pantalla revisadas en las tres pantallas para confirmar el render.
- **Arranque desde cero simulando una máquina limpia**: se borraron `node_modules`
  y la base entera, y con `pnpm install` + `pnpm dev` el sistema quedó operativo
  solo — base creada, 30 tablas, 3 vistas, 2 triggers, 45 claves foráneas,
  catálogos y demo cargados, acentos correctos, y las cuatro rutas en 200.
- Repetido con la contraseña definitiva `root1234`, incluido el análisis de IA.
- Reintento de conexión probado apagando MySQL, lanzando `pnpm dev` y
  arrancando MySQL a mitad de la espera: el script aguantó y continuó solo.
- Rutas de fallo del script probadas: sin `.env.local` (lo crea), MySQL apagado
  (mensaje con el comando de arranque según el sistema) y contraseña incorrecta
  (indica qué variable ajustar).

---

## 12. Problemas encontrados y resueltos

Cinco defectos reales que aparecieron al ejecutar, no al leer. Se documentan porque varios habrían aparecido igual en cualquier máquina.

| # | Problema | Causa | Solución |
|---|---|---|---|
| 1 | Acentos rotos: "Ríos" se guardaba como "RÃ­os" | El cliente de MySQL venía configurado en latin1, así que los bytes UTF-8 se guardaban doblemente codificados | `SET NAMES utf8mb4` al inicio de los tres `.sql` y `charset: 'UTF8MB4_GENERAL_CI'` en el pool |
| 2 | La caché nunca acertaba | El hash incluía `recomendaciones_previas`, así que cada análisis invalidaba su propia caché al insertar sus recomendaciones | El hash ignora las recomendaciones en estado `nueva`; el feedback sí invalida |
| 3 | La vista de cuellos de botella listaba tareas pendientes normales | Bastaba con tener dependientes para aparecer | Se exige estar bloqueada, vencida o sin movimiento en 7 días; los días se miden contra la bitácora |
| 4 | `ERROR 3823`: MySQL rechaza el `CHECK` de autodependencia | MySQL 8 no permite `CHECK` sobre columnas que participan en una FK con acción referencial | Se reemplazó por dos triggers `BEFORE INSERT` y `BEFORE UPDATE` |
| 5 | El asunto crítico aparecía de último en la lista | El orden iba por estado antes que por severidad | Se ordena por severidad primero, dejando los cerrados al final |

---

## 13. Limitaciones conocidas

1. **Faltan formularios de tareas y asuntos.** Proyectos, personas y empresas ya se crean y editan desde la interfaz; tareas y asuntos todavía entran por SQL (o vía las propuestas de la IA).
2. **Los archivos se guardan en disco local** (`UPLOADS_DIR`). Sirve para un entorno local; un despliegue requeriría almacenamiento de objetos.
3. **Extracción de texto de CV pendiente.** Falta elegir librería; `pdf-parse` para PDF y `mammoth` para DOCX es la combinación más simple en Node.
4. **Cuatro de los ocho análisis no están conectados a la interfaz** (`cuellos_botella`, `match_persona_tarea`, `patrones_globales`, `priorizacion_diaria`). Tienen contrato, esquema y prompt escritos.
5. **`metricas_snapshot` no se llena solo.** Necesita un proceso diario que tome la instantánea.
6. **Sin pruebas automatizadas.** La verificación fue manual contra una base real.
7. **Un solo usuario.** Sin autenticación ni permisos, por decisión de alcance.
8. **Cambios de ENUM no se aplican solos.** `scripts/preparar.mjs` aplica el esquema únicamente si las tablas no existen; tras cambiar un ENUM (p. ej. `tipo_analisis`) hay que correr `pnpm db:reset` o el `ALTER TABLE` equivalente.

---

## 14. Roadmap

### Fase 1 — Que el sistema se pueda usar sin SQL

- ✅ Formularios de alta y edición de proyectos, personas y empresas
- ✅ Registro automático en `bitacora` desde la capa de aplicación (mutaciones nuevas)
- ✅ Creación de proyecto con planteamiento de la IA: descripción libre → hitos y tareas propuestos → revisar y aceptar
- Formularios de alta y edición de tareas y asuntos
- Cambio de estado por arrastre en un tablero
- Proceso diario que llene `metricas_snapshot`

### Fase 2 — Completar el motor de IA

- Subida de CV con extracción de texto y análisis `perfil_cv`, con pantalla de validación de lo extraído
- `priorizacion_diaria` en la pantalla de inicio
- `match_persona_tarea` al crear o reasignar una tarea
- `patrones_globales` como proceso semanal

### Fase 3 — Inteligencia acumulada

- Gráficas de tendencia por proyecto sobre `metricas_snapshot`
- Panel de patrones con evolución de frecuencia y confianza
- Comparación entre categorías de proyecto: cuáles se atrasan sistemáticamente
- Medición del acierto de la IA: qué porcentaje de recomendaciones se acepta y se implementa

### Fase 4 — Si el alcance crece

- Autenticación y roles
- Registro de horas y costos
- Notificaciones
- Integración con repositorios de código

---

## 15. Vocabulario controlado

Los mismos valores en MySQL, TypeScript, los prompts y la interfaz.

**Estado de proyecto:** `idea` · `planificacion` · `en_progreso` · `en_pausa` · `en_revision` · `completado` · `cancelado`

**Estado de tarea:** `pendiente` · `en_progreso` · `en_revision` · `bloqueada` · `completada` · `cancelada`

**Estado de asunto:** `pendiente` · `en_progreso` · `en_espera` · `resuelto` · `cerrado` · `descartado`

**Estado de hito:** `pendiente` · `en_progreso` · `completado` · `atrasado` · `cancelado`

**Prioridad y severidad:** `baja` · `media` · `alta` · `critica`

**Salud:** `verde` · `amarillo` · `rojo` · `sin_datos`

**Tipo de tarea:** `feature` · `mejora` · `correccion` · `investigacion` · `documentacion` · `reunion` · `administrativa`

**Tipo de asunto:** `bug` · `incidencia` · `riesgo` · `bloqueo` · `deuda_tecnica` · `solicitud_cambio` · `pregunta`

**Tipo de habilidad:** `tecnica` · `herramienta` · `dominio` · `blanda` · `idioma` · `metodologia`

**Tipo de insumo de persona:** `fortaleza` · `aporte` · `pregunta_sugerida` · `area_mejora` · `interes` · `logro`

**Tipo de recomendación:** `accion` · `alerta` · `riesgo` · `mejora` · `asignacion` · `pregunta`

**Estado de recomendación:** `nueva` · `aceptada` · `en_progreso` · `implementada` · `descartada`

**Tipo de patrón:** `riesgo_recurrente` · `antipatron` · `buena_practica` · `correlacion_exito` · `brecha_skill`

**Tipo de análisis:** `salud_proyecto` · `cuellos_botella` · `match_persona_tarea` · `patrones_globales` · `priorizacion_diaria` · `perfil_cv` · `planteamiento_proyecto` · `tareas_sugeridas`

**Tipo de relación (persona):** `interno` · `freelance` · `cliente` · `stakeholder` · `proveedor` · `candidato`

**Tipo de empresa:** `cliente` · `proveedor` · `aliado` · `interna` · `prospecto`

---

## Documentos relacionados

| Archivo | Contenido |
|---|---|
| `README.md` | Instalación, comandos y estructura |
| `docs/00-guia.md` | Guía de decisiones y verificaciones |
| `docs/03-contrato-ia.md` | Contrato de datos con la IA en detalle |
| `db/01_schema.sql` | DDL comentado, fuente de verdad del modelo |
