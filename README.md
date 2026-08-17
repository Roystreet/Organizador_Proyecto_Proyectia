# Organizador de Proyectos

Gestión de proyectos con análisis asistido por IA. Next.js 15 · TypeScript · Material UI · MySQL 8 · Drizzle ORM · OpenAI.

## Puesta en marcha

```bash
pnpm install
pnpm db:up     # solo si no tienes MySQL instalado (levanta el contenedor)
pnpm dev
```

Si ya tienes MySQL corriendo en tu máquina, sáltate `pnpm db:up`: basta con
`pnpm install` y `pnpm dev`.

`pnpm dev` se encarga de todo antes de arrancar el servidor:

1. Crea `.env.local` a partir de `.env.example` si no existe.
2. Comprueba que MySQL responda (y explica qué hacer si no).
3. Crea la base indicada en `DB_NAME` si falta.
4. Aplica el esquema, pero solo si las tablas no están.
5. Carga los catálogos, solo si están vacíos.
6. Carga el portafolio de demostración, solo la primera vez.

Es idempotente: correrlo diez veces seguidas no duplica ni rompe nada.
Luego abre <http://localhost:3000>.

### Credenciales

La configuración por defecto usa:

```env
DB_USER=root
DB_PASSWORD=root1234
```

Es la misma contraseña que trae el `docker-compose.yml`, así que si levantas la
base con `pnpm db:up` no hay nada que ajustar. Si tu MySQL local usa otra,
cámbiala en `.env.local`.

### MySQL con Docker

El `docker-compose.yml` incluido levanta MySQL 8 con esa contraseña, la base ya
creada, `utf8mb4` configurado y un volumen para que los datos sobrevivan:

```bash
pnpm db:up      # levantar
pnpm db:logs    # ver el arranque
pnpm db:down    # detener
```

El primer arranque tarda medio minuto en inicializar. No hace falta esperar:
`pnpm dev` reintenta la conexión durante 40 segundos, así que puedes encadenar
`pnpm db:up && pnpm dev` sin más.

Si ya usas el puerto 3306 para otro MySQL, cambia el mapeo en
`docker-compose.yml` y el `DB_PORT` de `.env.local`.

### El nombre de la base

Por defecto es `proyectos`. Si prefieres otro, cambia `DB_NAME` en `.env.local`
y el script la crea con ese nombre:

```env
DB_NAME=proyecto
```

### Sin API key de OpenAI

`.env.example` viene con `IA_MODO=simulado`, así que el motor de análisis
funciona desde el primer arranque usando un analista por reglas
(`src/lib/ai/simulador.ts`) en lugar del modelo. Para usar OpenAI de verdad:

```env
IA_MODO=real
OPENAI_API_KEY=sk-...
```

Si `IA_MODO=real` pero no hay clave, cae al modo simulado en vez de fallar.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Prepara la base si hace falta y arranca en desarrollo |
| `pnpm dev:rapido` | Arranca sin verificar la base **ni aplicar migraciones** |

> **Tras traer cambios de esquema, corre `pnpm run setup` una vez.**
> `scripts/migraciones.mjs` aplica los cambios pendientes de forma idempotente
> (detecta contra `information_schema` lo que ya está), así que se puede correr
> las veces que haga falta sin romper nada y sin borrar la base.
> Ojo: `pnpm setup` sin `run` invoca el comando propio de pnpm, no este script.
| `pnpm setup` | Solo la preparación, sin arrancar |
| `pnpm db:up` | Levanta MySQL con Docker Compose |
| `pnpm db:down` | Detiene el contenedor |
| `pnpm db:logs` | Sigue los logs de MySQL |
| `pnpm db:reset` | Borra la base y la reconstruye desde cero |
| `pnpm build` | Build de producción |
| `pnpm start` | Prepara y arranca el build de producción |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:studio` | Explorador visual de la base |

> `db:push` de Drizzle crea tablas, no vistas ni triggers. `db/01_schema.sql`
> es la fuente de verdad para esos objetos, y es lo que usa `pnpm setup`.

## Estructura

```
docker-compose.yml           MySQL 8 opcional, con la misma contraseña
scripts/
  preparar.mjs               Preparación automática (lo que corre `pnpm dev`)
  reset-db.mjs               Borrado y reconstrucción de la base
  lib-sql.mjs                Partidor de .sql que entiende bloques DELIMITER
db/
  01_schema.sql              Esquema completo
  02_seed.sql                Catálogos base
  03_demo.sql                Datos de demostración
src/
  app/
    page.tsx                 Dashboard de visión global
    proyectos/               Lista y detalle de proyecto
    personas/                Directorio con experticia
    api/ia/analizar/         POST · dispara el análisis
    api/ia/recomendaciones/  PATCH · aceptar o descartar una recomendación
  components/                Shell, tarjetas, chips semánticos, panel de IA
  db/                        Cliente Drizzle y schema
  theme/                     Tema MUI en verdes (claro y oscuro)
  lib/
    consultas.ts             Todas las consultas SQL de lectura
    formato.ts               Fechas y cálculo determinista del semáforo
    ai/
      tipos.ts               Contrato de payload y respuestas
      esquemas.ts            JSON Schemas para Structured Outputs
      prompts.ts             Prompts de sistema por tipo de análisis
      construirPayload.ts    Arma el payload desde SQL
      simulador.ts           Analista por reglas (modo sin API)
      validacion.ts          Zod + saneamiento de referencias
      cliente.ts             Orquestación, caché por hash y persistencia
docs/
  00-guia.md                 Guía general y decisiones
  03-contrato-ia.md          Contrato de datos con la IA en detalle
```

## API

### `POST /api/ia/analizar`

```json
{ "proyecto_id": 1, "forzar": false }
```

Devuelve el análisis completo más `recomendacion_ids`, alineados con
`datos.recomendaciones` para poder dar feedback sobre cada una.

Sin `forzar`, si el estado del proyecto no cambió desde el último análisis
(mismo hash de payload, dentro de `IA_CACHE_HORAS`), devuelve el guardado y no
llama al modelo.

Respuestas: `200` con el análisis · `400` payload inválido · `404` proyecto
inexistente · `500` fallo del modelo o de la base.

### `PATCH /api/ia/recomendaciones/[id]`

```json
{ "estado": "descartada", "feedback": "No hay presupuesto este trimestre" }
```

Estados: `nueva`, `aceptada`, `en_progreso`, `implementada`, `descartada`.
El feedback entra en el payload del siguiente análisis, así que el sistema deja
de proponer lo que ya se descartó.
