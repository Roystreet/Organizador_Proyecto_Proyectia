# Organizador de Proyectos · Guía

Segunda entrega: además de los tres artefactos de diseño, ya hay una aplicación
Next.js funcionando contra MySQL, con dashboard, detalle de proyecto, directorio
de personas y el motor de análisis de IA conectado de punta a punta.

Para instalar y correr basta con `pnpm install` y `pnpm dev`: el arranque crea
la base, aplica el esquema y carga los datos si hace falta. Detalles en `README.md`.

## Decisiones tomadas

| Punto | Decisión |
|---|---|
| Base de datos | MySQL 8, esquema `proyectos` |
| Acceso a datos | Drizzle ORM + mysql2 |
| Usuarios | Un solo usuario (tú). Sin login. Las personas del directorio son registros, no cuentas |
| Motor de IA | OpenAI, con Structured Outputs (`strict: true`) |
| Categorías | Catálogo administrable + etiquetas libres |
| Perfiles | Se sube un CV o datos de la persona y la IA extrae habilidades, experiencia y fortalezas |
| Módulos incluidos | Clientes/empresas, comentarios y bitácora, hitos, sprints y adjuntos |
| Fuera de alcance por ahora | Registro de horas y costos |
| Análisis sin API key | `IA_MODO=simulado` usa un analista por reglas equivalente |

## Archivos

La estructura completa está en `README.md`. Lo esencial:

```
db/01_schema.sql · 02_seed.sql · 03_demo.sql   Base de datos
src/theme/theme.ts                             Tema MUI en verdes
src/lib/ai/                                    Motor de IA completo
src/app/                                       Dashboard, proyectos, personas, API
docs/03-contrato-ia.md                         Contrato de datos con la IA
```

## 1 · Base de datos

Nueve bloques temáticos:

1. **Catálogos** — `categorias`, `etiquetas`, `categorias_asunto`, `habilidades`, `roles_proyecto`
2. **Directorio** — `empresas`, `personas`, `persona_documentos`, `persona_habilidades`, `persona_experiencias`, `persona_insumos`
3. **Proyectos** — `proyectos`, `proyecto_personas`, `proyecto_etiquetas`, `proyecto_habilidades_requeridas`
4. **Planificación** — `hitos`, `sprints`
5. **Tareas** — `tareas`, `tarea_dependencias`, `tarea_etiquetas`, `tarea_habilidades_requeridas`
6. **Asuntos** — `asuntos`, `asunto_etiquetas`
7. **Trazabilidad** — `comentarios`, `bitacora`, `adjuntos`
8. **IA** — `analisis_ia`, `recomendaciones_ia`, `patrones_detectados`
9. **Series** — `metricas_snapshot`

### Las cinco tablas que hacen posible el análisis de IA

Son las que normalmente no se ponen en un gestor de proyectos y son exactamente las que dan el valor:

- **`tarea_dependencias`** — sin saber qué tarea bloquea a cuál, "cuello de botella" es una opinión. Con ella es un dato: la vista `v_cuellos_botella` los saca en una consulta.
- **`bitacora`** — cada cambio de estado con su fecha. Es la serie temporal que permite decir "este proyecto se frenó hace tres semanas" en vez de "este proyecto va lento".
- **`persona_insumos`** — fortalezas, aportes y **preguntas sugeridas** por persona. Responde directamente a lo que pediste: qué te puede aportar cada colaborador y qué le puedes preguntar.
- **`patrones_detectados`** — la memoria entre corridas. Cada patrón tiene una `clave` estable: cuando la IA lo vuelve a ver, sube la `frecuencia` en vez de reportarlo como nuevo. Así la confianza crece con la evidencia.
- **`recomendaciones_ia`** con `feedback_usuario` — cierra el ciclo. Lo que descartaste y por qué entra en el siguiente análisis, y el sistema deja de proponerte lo que ya rechazaste.

### Tres vistas listas para el dashboard

- `v_resumen_proyectos` — una fila por proyecto con todos los contadores agregados. Es la consulta del dashboard principal.
- `v_carga_personas` — carga real por persona sumando **todos** sus proyectos. Detecta sobrecarga.
- `v_cuellos_botella` — tareas abiertas que bloquean a otras, con días detenidas.

### Cómo instalarla

`pnpm dev` lo hace solo. Si prefieres a mano:

```bash
mysql -u root -p < db/01_schema.sql
mysql -u root -p < db/02_seed.sql
mysql -u root -p < db/03_demo.sql   # opcional
```

Verificado contra MySQL 8.0.46: el esquema levanta limpio, las vistas devuelven datos correctos y el trigger anti-autodependencia dispara.

Con Drizzle, `npx drizzle-kit push` genera exactamente las mismas 30 tablas y 318 columnas (comprobado por diferencia contra `information_schema`). Las vistas y los triggers solo existen en el SQL, así que el archivo `.sql` es la fuente de verdad para esos objetos.

## 2 · Tema de Material UI

`src/theme/theme.ts` define tres escalas de color y una capa semántica.

**Marca**: verde (`#2E7D32` en claro, `#66BB6A` en oscuro), verde azulado como secundario, y neutros con una pizca de verde para que los grises no se vean azulados junto al verde.

**Capa semántica** — la parte importante. Cada estado del dominio tiene su terna de colores:

```ts
theme.palette.semantico.salud.rojo        // { main, suave, contraste }
theme.palette.semantico.prioridad.critica
theme.palette.semantico.estadoTarea.bloqueada
theme.palette.semantico.estadoAsunto.en_espera
theme.palette.semantico.estadoProyecto.en_pausa
```

`main` para puntos y bordes, `suave` para fondos de chip, `contraste` para el texto sobre `suave`. Las tres versiones existen para claro y oscuro, así que un chip se ve bien en ambos modos sin condicionales en el componente:

```tsx
const c = colorDe(theme, 'salud', proyecto.salud);
<Chip label={ETIQUETAS.salud[proyecto.salud]}
      sx={{ bgcolor: c.suave, color: c.contraste }} />
```

El verde es la marca; los estados tienen su propia escala. Si todo fuera verde, el dashboard no comunicaría nada de un vistazo — que es justo el problema que querías resolver.

También hay `paletaGraficos`: ocho colores categóricos ordenados por distinguibilidad para las gráficas del dashboard.

Dependencias: `@mui/material @emotion/react @emotion/styled @mui/material-nextjs`.

## 3 · Contrato con la IA

Detalle completo en `03-contrato-ia.md`. El resumen:

Al modelo no se le manda la base de datos, se le manda un informe ya digerido. Todo lo contable se cuenta en SQL; el modelo se reserva para interpretar y recomendar. Cada elemento del payload lleva su `id` real, así cada recomendación que devuelve se convierte en una fila que apunta a un registro concreto.

Seis análisis: `salud_proyecto`, `cuellos_botella`, `match_persona_tarea`, `patrones_globales`, `priorizacion_diaria` y `perfil_cv`.

Dos secciones del payload cierran el ciclo de aprendizaje: `patrones_conocidos` (para reforzar en vez de repetir) y `recomendaciones_previas` con tu feedback (para que deje de proponerte lo que ya descartaste).

---

## Qué falta decidir

1. **Cálculo de la salud (`verde`/`amarillo`/`rojo`).** El campo tiene `salud_origen` para distinguir si la fijaste tú, si la calculó una fórmula o si la puso la IA. Falta definir la fórmula base — mi propuesta: que la calcule SQL con reglas simples (desviación de progreso, bloqueos, asuntos críticos, días sin movimiento) y que la IA solo la ajuste cuando ve algo que la fórmula no captura.
2. **Dónde se guardan los archivos.** Hoy `persona_documentos.ruta_archivo` y `adjuntos.ruta_archivo` asumen disco local (`UPLOADS_DIR`). Sirve para un entorno local; si algún día esto se despliega, hay que migrar a almacenamiento de objetos.
3. **Extracción de texto de los CV.** Hay que elegir librería: `pdf-parse` para PDF y `mammoth` para DOCX es la combinación más simple en Node.
4. **Frecuencia de los análisis automáticos.** `priorizacion_diaria` cada mañana y `patrones_globales` semanal es un punto de partida razonable, pero depende de cuánto se mueva tu portafolio.

## 4 · La aplicación

Tres pantallas, todas leyendo de las vistas SQL:

**Dashboard** (`/`) — fila de KPIs del portafolio, tarjetas de proyecto con
semáforo y avance real (calculado sobre tareas completadas, no sobre el
porcentaje declarado a mano), panel de cuellos de botella, carga del equipo
sumando todos los proyectos, y los patrones ya detectados.

**Detalle de proyecto** (`/proyectos/[id]`) — objetivo, KPIs, panel de análisis
de IA, tabla de tareas marcando cuáles frenan a otras, asuntos ordenados por
severidad, involucrados con su carga aquí y en el portafolio, y las habilidades
requeridas indicando cuáles cubre el equipo y cuáles no.

**Personas** (`/personas`) — directorio con experticia por nivel, fortalezas,
qué puede aportar cada quien y qué conviene preguntarle.

### El semáforo tiene dos fuentes

`proyectos.salud_origen` distingue de dónde viene el color:

- `calculada` — fórmula determinista en `src/lib/formato.ts` que pesa asuntos
  críticos, bloqueos, tareas vencidas, días sin movimiento y la combinación
  peligrosa de fecha cerca con avance bajo. Corre siempre, sin costo.
- `ia` — la sobrescribe el análisis cuando se ejecuta.

Así el dashboard nunca muestra "sin datos" habiendo datos, y la IA solo se paga
cuando aporta algo por encima de la fórmula.

### El ciclo de aprendizaje, cerrado

1. El análisis guarda sus recomendaciones en `recomendaciones_ia`.
2. En la interfaz cada una se acepta o se descarta.
3. El feedback entra en el payload del siguiente análisis.
4. El modelo deja de proponer lo que ya se rechazó.

El hash de caché se calcula sobre el estado del proyecto **excluyendo las
recomendaciones que siguen en estado `nueva`**. Sin esa exclusión, cada análisis
invalidaría su propia caché al insertar sus recomendaciones y nunca habría un
acierto. Dar feedback sí invalida, porque eso sí es información nueva.

## Verificaciones hechas

- Esquema y seeds ejecutados contra MySQL 8.0.46 real.
- `drizzle-kit push` genera las mismas 30 tablas y 318 columnas que el DDL
  (comparado por diferencia contra `information_schema`).
- `npm run build` y `tsc --noEmit` sin errores.
- Rutas `/`, `/proyectos`, `/proyectos/[id]`, `/personas` devuelven 200 con
  datos reales.
- `POST /api/ia/analizar`: 200 con análisis, 400 sin `proyecto_id`, 404 con id
  inexistente; segunda llamada consecutiva sirve desde caché; tras dar feedback
  a una recomendación, vuelve a analizar.
- `PATCH /api/ia/recomendaciones/[id]` persiste estado y feedback.

## Siguiente paso sugerido

Formularios de alta y edición: hoy los datos entran por SQL. Después de eso,
la carga de CV con extracción por IA (`perfil_cv` ya tiene su esquema y su
prompt escritos, falta el endpoint y la extracción de texto del PDF).
