-- ============================================================================
--  ORGANIZADOR DE PROYECTOS  ·  Esquema relacional MySQL 8.x
--  Base de datos: proyectos
--  Motor: InnoDB · Charset: utf8mb4 · Collation: utf8mb4_0900_ai_ci
--
--  Convenciones:
--    - Nombres de tablas en plural y snake_case, en español.
--    - Toda tabla lleva creado_en / actualizado_en.
--    - Los borrados son lógicos (activo / archivado) donde el histórico importa,
--      porque el motor de IA necesita la serie histórica para detectar patrones.
--    - Las columnas *_json usan el tipo JSON nativo de MySQL 8.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `proyectos`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `proyectos`;

-- El cliente de MySQL puede venir con charset latin1 según el sistema. Sin esta
-- línea, los acentos se guardan doblemente codificados y salen como "RÃ­os".
SET NAMES utf8mb4;


SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
--  BLOQUE 1 · CATÁLOGOS
--  Vocabulario controlado. Sin esto la IA compara peras con manzanas.
-- ============================================================================

-- Categoría principal del proyecto (catálogo fijo administrable).
CREATE TABLE IF NOT EXISTS `categorias` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre`        VARCHAR(80)  NOT NULL,
  `slug`          VARCHAR(80)  NOT NULL,
  `descripcion`   VARCHAR(255) NULL,
  `color_hex`     CHAR(7)      NOT NULL DEFAULT '#2E7D32',
  `icono`         VARCHAR(50)  NULL COMMENT 'Nombre del icono MUI, ej. Code, Campaign',
  `orden`         SMALLINT     NOT NULL DEFAULT 0,
  `activo`        TINYINT(1)   NOT NULL DEFAULT 1,
  `creado_en`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categorias_slug` (`slug`)
) ENGINE=InnoDB;

-- Etiquetas libres, transversales a proyectos, tareas y asuntos.
CREATE TABLE IF NOT EXISTS `etiquetas` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre`    VARCHAR(60)  NOT NULL,
  `slug`      VARCHAR(60)  NOT NULL,
  `color_hex` CHAR(7)      NOT NULL DEFAULT '#66BB6A',
  `creado_en` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_etiquetas_slug` (`slug`)
) ENGINE=InnoDB;

-- Categorías de asuntos/issues (ej. Bug funcional, Bloqueo externo, Deuda técnica).
CREATE TABLE IF NOT EXISTS `categorias_asunto` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre`      VARCHAR(80)  NOT NULL,
  `slug`        VARCHAR(80)  NOT NULL,
  `descripcion` VARCHAR(255) NULL,
  `color_hex`   CHAR(7)      NOT NULL DEFAULT '#EF6C00',
  `activo`      TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categorias_asunto_slug` (`slug`)
) ENGINE=InnoDB;

-- Catálogo maestro de habilidades / experticia.
CREATE TABLE IF NOT EXISTS `habilidades` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre`    VARCHAR(80)  NOT NULL,
  `slug`      VARCHAR(80)  NOT NULL,
  `tipo`      ENUM('tecnica','herramienta','dominio','blanda','idioma','metodologia')
              NOT NULL DEFAULT 'tecnica',
  `descripcion` VARCHAR(255) NULL,
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_habilidades_slug` (`slug`),
  KEY `ix_habilidades_tipo` (`tipo`)
) ENGINE=InnoDB;

-- Roles que una persona puede ocupar dentro de un proyecto.
CREATE TABLE IF NOT EXISTS `roles_proyecto` (
  `id`     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(60)  NOT NULL,
  `slug`   VARCHAR(60)  NOT NULL,
  `es_interno` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0 = cliente / stakeholder externo',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_proyecto_slug` (`slug`)
) ENGINE=InnoDB;

-- ============================================================================
--  BLOQUE 2 · EMPRESAS Y PERSONAS (DIRECTORIO DE INVOLUCRADOS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `empresas` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre`         VARCHAR(150) NOT NULL,
  `slug`           VARCHAR(150) NOT NULL,
  `tipo`           ENUM('cliente','proveedor','aliado','interna','prospecto')
                   NOT NULL DEFAULT 'cliente',
  `industria`      VARCHAR(100) NULL,
  `tamano`         ENUM('micro','pequena','mediana','grande','corporativo') NULL,
  `pais`           VARCHAR(80)  NULL,
  `sitio_web`      VARCHAR(255) NULL,
  `contacto_email` VARCHAR(150) NULL,
  `contacto_telefono` VARCHAR(50) NULL,
  `notas`          TEXT NULL,
  `activo`         TINYINT(1)   NOT NULL DEFAULT 1,
  `creado_en`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_empresas_slug` (`slug`),
  KEY `ix_empresas_tipo` (`tipo`),
  KEY `ix_empresas_industria` (`industria`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `personas` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre`          VARCHAR(100) NOT NULL,
  `apellido`        VARCHAR(100) NULL,
  `email`           VARCHAR(150) NULL,
  `telefono`        VARCHAR(50)  NULL,
  `foto_url`        VARCHAR(500) NULL,
  `empresa_id`      INT UNSIGNED NULL,
  `tipo_relacion`   ENUM('interno','freelance','cliente','stakeholder','proveedor','candidato')
                    NOT NULL DEFAULT 'interno',
  `rol_principal`   VARCHAR(100) NULL COMMENT 'Ej. Full-stack Developer, Diseñador UX',
  `seniority`       ENUM('junior','semi_senior','senior','lead','director') NULL,
  `anios_experiencia` DECIMAL(4,1) NULL,
  `disponibilidad_horas_semana` TINYINT UNSIGNED NULL
                    COMMENT 'Capacidad declarada; base para detectar sobrecarga',
  `zona_horaria`    VARCHAR(60)  NULL DEFAULT 'America/Caracas',
  `ubicacion`       VARCHAR(120) NULL,
  `linkedin_url`    VARCHAR(255) NULL,
  `portafolio_url`  VARCHAR(255) NULL,
  `bio`             TEXT NULL COMMENT 'Escrita a mano',
  `resumen_ia`      TEXT NULL COMMENT 'Resumen del perfil generado por la IA a partir del CV',
  `perfil_actualizado_en` DATETIME NULL,
  `activo`          TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_personas_email` (`email`),
  KEY `ix_personas_empresa` (`empresa_id`),
  KEY `ix_personas_tipo_relacion` (`tipo_relacion`),
  KEY `ix_personas_activo` (`activo`),
  CONSTRAINT `fk_personas_empresa` FOREIGN KEY (`empresa_id`)
    REFERENCES `empresas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Documentos del perfil: CV en PDF/DOCX, portafolio, certificaciones.
-- El texto extraído es la materia prima que se manda al LLM.
CREATE TABLE IF NOT EXISTS `persona_documentos` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `persona_id`      INT UNSIGNED NOT NULL,
  `tipo`            ENUM('cv','portafolio','certificacion','notas','otro') NOT NULL DEFAULT 'cv',
  `nombre_archivo`  VARCHAR(255) NOT NULL,
  `ruta_archivo`    VARCHAR(500) NULL COMMENT 'NULL cuando el insumo es texto pegado, sin archivo',
  `mime_type`       VARCHAR(100) NULL,
  `tamano_bytes`    INT UNSIGNED NULL,
  `texto_extraido`  LONGTEXT NULL,
  `estado_extraccion` ENUM('pendiente','procesando','procesado','error')
                    NOT NULL DEFAULT 'pendiente',
  `error_extraccion` VARCHAR(500) NULL,
  `procesado_en`    DATETIME NULL,
  `creado_en`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_persona_documentos_persona` (`persona_id`),
  KEY `ix_persona_documentos_estado` (`estado_extraccion`),
  CONSTRAINT `fk_persona_documentos_persona` FOREIGN KEY (`persona_id`)
    REFERENCES `personas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Experticia. `origen` distingue lo capturado a mano de lo inferido del CV,
-- y `confianza` permite mostrar en la UI qué tan seguro está el modelo.
CREATE TABLE IF NOT EXISTS `persona_habilidades` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `persona_id`     INT UNSIGNED NOT NULL,
  `habilidad_id`   INT UNSIGNED NOT NULL,
  `nivel`          TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '1=básico … 5=experto',
  `anios_experiencia` DECIMAL(4,1) NULL,
  `es_fortaleza`   TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Destacada en el perfil',
  `evidencia`      VARCHAR(500) NULL COMMENT 'Frase del CV o proyecto que la respalda',
  `origen`         ENUM('manual','ia_cv','ia_desempeno') NOT NULL DEFAULT 'manual',
  `confianza`      DECIMAL(3,2) NULL COMMENT '0.00–1.00 cuando origen es IA',
  `validado`       TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Confirmado por el usuario',
  `creado_en`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_persona_habilidad` (`persona_id`,`habilidad_id`),
  KEY `ix_persona_habilidades_habilidad` (`habilidad_id`),
  KEY `ix_persona_habilidades_nivel` (`nivel`),
  CONSTRAINT `fk_ph_persona` FOREIGN KEY (`persona_id`)
    REFERENCES `personas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ph_habilidad` FOREIGN KEY (`habilidad_id`)
    REFERENCES `habilidades` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ck_ph_nivel` CHECK (`nivel` BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- Historial laboral extraído del CV. Alimenta el análisis de patrones de industria.
CREATE TABLE IF NOT EXISTS `persona_experiencias` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `persona_id`    INT UNSIGNED NOT NULL,
  `empresa_nombre` VARCHAR(150) NOT NULL,
  `empresa_id`    INT UNSIGNED NULL COMMENT 'Si la empresa ya existe en el directorio',
  `cargo`         VARCHAR(150) NOT NULL,
  `industria`     VARCHAR(100) NULL,
  `fecha_inicio`  DATE NULL,
  `fecha_fin`     DATE NULL,
  `es_actual`     TINYINT(1) NOT NULL DEFAULT 0,
  `descripcion`   TEXT NULL,
  `logros`        TEXT NULL,
  `origen`        ENUM('manual','ia_cv') NOT NULL DEFAULT 'ia_cv',
  `creado_en`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_persona_experiencias_persona` (`persona_id`),
  KEY `ix_persona_experiencias_industria` (`industria`),
  CONSTRAINT `fk_pe_persona` FOREIGN KEY (`persona_id`)
    REFERENCES `personas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pe_empresa` FOREIGN KEY (`empresa_id`)
    REFERENCES `empresas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- El corazón de "qué me puede aportar esta persona y qué le puedo preguntar".
CREATE TABLE IF NOT EXISTS `persona_insumos` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `persona_id`  INT UNSIGNED NOT NULL,
  `tipo`        ENUM('fortaleza','aporte','pregunta_sugerida','area_mejora','interes','logro')
                NOT NULL,
  `titulo`      VARCHAR(200) NOT NULL,
  `detalle`     TEXT NULL,
  `contexto`    VARCHAR(255) NULL COMMENT 'En qué situación aplica: tipo de proyecto, fase, industria',
  `origen`      ENUM('manual','ia_cv','ia_desempeno') NOT NULL DEFAULT 'ia_cv',
  `confianza`   DECIMAL(3,2) NULL,
  `validado`    TINYINT(1) NOT NULL DEFAULT 0,
  `creado_en`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_persona_insumos_persona_tipo` (`persona_id`,`tipo`),
  CONSTRAINT `fk_pi_persona` FOREIGN KEY (`persona_id`)
    REFERENCES `personas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Taxonomía de industrias. Deliberadamente aparte de `habilidades`: el sector
-- es el CONTEXTO donde alguien trabajó (farmacia, logística, minería), no algo
-- que sepa hacer. Cruzarlos por separado es lo que permite decir "sabe validar
-- procesos Y viene de farmacia" en vez de mezclar los dos ejes.
CREATE TABLE IF NOT EXISTS `sectores` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre`      VARCHAR(80)  NOT NULL,
  `slug`        VARCHAR(80)  NOT NULL,
  `descripcion` VARCHAR(255) NULL,
  `color_hex`   CHAR(7)      NOT NULL DEFAULT '#2E7D32',
  `orden`       SMALLINT     NOT NULL DEFAULT 0,
  `activo`      TINYINT(1)   NOT NULL DEFAULT 1,
  `creado_en`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sectores_slug` (`slug`)
) ENGINE=InnoDB;

-- Sectores que cubre una persona, con su nivel de experiencia real en cada uno.
CREATE TABLE IF NOT EXISTS `persona_sectores` (
  `persona_id`        INT UNSIGNED NOT NULL,
  `sector_id`         INT UNSIGNED NOT NULL,
  `nivel`             TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '1=roce puntual … 5=especialista',
  `anios_experiencia` DECIMAL(4,1) NULL,
  `es_principal`      TINYINT(1) NOT NULL DEFAULT 0,
  `evidencia`         VARCHAR(500) NULL,
  `origen`            ENUM('manual','ia_cv') NOT NULL DEFAULT 'manual',
  `confianza`         DECIMAL(3,2) NULL,
  `validado`          TINYINT(1) NOT NULL DEFAULT 0,
  `creado_en`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`persona_id`,`sector_id`),
  KEY `ix_persona_sectores_sector` (`sector_id`),
  CONSTRAINT `fk_pse_persona` FOREIGN KEY (`persona_id`)
    REFERENCES `personas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pse_sector` FOREIGN KEY (`sector_id`)
    REFERENCES `sectores` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ck_pse_nivel` CHECK (`nivel` BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- ============================================================================
--  BLOQUE 3 · PROYECTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `proyectos` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo`           VARCHAR(20)  NOT NULL COMMENT 'Clave corta, ej. ORG-01',
  `nombre`           VARCHAR(200) NOT NULL,
  `slug`             VARCHAR(200) NOT NULL,
  `descripcion`      TEXT NULL COMMENT 'Lo que escribió el usuario. Materia prima: nada la sobrescribe',
  `resumen_ia`       TEXT NULL COMMENT 'De qué trata, redactado por la IA. NUNCA pisa descripcion',
  `resumen_ia_actualizado_en` DATETIME NULL,
  `objetivo`         TEXT NULL COMMENT 'Qué se considera éxito. Clave para el análisis IA',
  `categoria_id`     INT UNSIGNED NULL,
  `empresa_id`       INT UNSIGNED NULL,
  `responsable_id`   INT UNSIGNED NULL,
  `estado`           ENUM('idea','planificacion','en_progreso','en_pausa','en_revision','completado','cancelado')
                     NOT NULL DEFAULT 'idea',
  `prioridad`        ENUM('baja','media','alta','critica') NOT NULL DEFAULT 'media',
  `salud`            ENUM('verde','amarillo','rojo','sin_datos') NOT NULL DEFAULT 'sin_datos'
                     COMMENT 'Semáforo; puede fijarse a mano o recalcularse con la IA',
  `salud_origen`     ENUM('manual','calculada','ia') NOT NULL DEFAULT 'calculada',
  `progreso_pct`     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `progreso_origen`  ENUM('manual','calculado') NOT NULL DEFAULT 'calculado',
  `fecha_inicio`     DATE NULL,
  `fecha_fin_estimada` DATE NULL,
  `fecha_fin_real`   DATE NULL,
  `repositorio_url`  VARCHAR(255) NULL,
  `url_produccion`   VARCHAR(255) NULL,
  `notas`            TEXT NULL,
  `ultimo_movimiento_en` DATETIME NULL
                     COMMENT 'Última actividad real: tarea, asunto o comentario. Detecta estancamiento',
  `archivado`        TINYINT(1) NOT NULL DEFAULT 0,
  `wizard_paso`      TINYINT UNSIGNED NULL
                     COMMENT 'Paso del asistente de creación. NULL = proyecto publicado',
  `creado_en`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_proyectos_codigo` (`codigo`),
  UNIQUE KEY `uq_proyectos_slug` (`slug`),
  KEY `ix_proyectos_estado` (`estado`),
  KEY `ix_proyectos_categoria` (`categoria_id`),
  KEY `ix_proyectos_empresa` (`empresa_id`),
  KEY `ix_proyectos_salud` (`salud`),
  KEY `ix_proyectos_dashboard` (`archivado`,`estado`,`prioridad`),
  CONSTRAINT `fk_proyectos_categoria` FOREIGN KEY (`categoria_id`)
    REFERENCES `categorias` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_proyectos_empresa` FOREIGN KEY (`empresa_id`)
    REFERENCES `empresas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_proyectos_responsable` FOREIGN KEY (`responsable_id`)
    REFERENCES `personas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ck_proyectos_progreso` CHECK (`progreso_pct` BETWEEN 0 AND 100)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `proyecto_etiquetas` (
  `proyecto_id` INT UNSIGNED NOT NULL,
  `etiqueta_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`proyecto_id`,`etiqueta_id`),
  KEY `ix_pe_etiqueta` (`etiqueta_id`),
  CONSTRAINT `fk_pet_proyecto` FOREIGN KEY (`proyecto_id`)
    REFERENCES `proyectos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pet_etiqueta` FOREIGN KEY (`etiqueta_id`)
    REFERENCES `etiquetas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Involucrados en el proyecto. Una persona puede tener varios roles.
CREATE TABLE IF NOT EXISTS `proyecto_personas` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `proyecto_id`    INT UNSIGNED NOT NULL,
  `persona_id`     INT UNSIGNED NOT NULL,
  `rol_id`         INT UNSIGNED NULL,
  `asignacion_pct` TINYINT UNSIGNED NULL COMMENT 'Porcentaje de su capacidad dedicado aquí',
  `fecha_ingreso`  DATE NULL,
  `fecha_salida`   DATE NULL,
  `es_principal`   TINYINT(1) NOT NULL DEFAULT 0,
  `activo`         TINYINT(1) NOT NULL DEFAULT 1,
  `notas`          VARCHAR(500) NULL,
  `creado_en`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_proyecto_persona_rol` (`proyecto_id`,`persona_id`,`rol_id`),
  KEY `ix_pp_persona` (`persona_id`),
  CONSTRAINT `fk_pp_proyecto` FOREIGN KEY (`proyecto_id`)
    REFERENCES `proyectos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pp_persona` FOREIGN KEY (`persona_id`)
    REFERENCES `personas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pp_rol` FOREIGN KEY (`rol_id`)
    REFERENCES `roles_proyecto` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Habilidades que el proyecto requiere. Cruzar contra persona_habilidades
-- es lo que produce el match persona ↔ tarea y las brechas de equipo.
CREATE TABLE IF NOT EXISTS `proyecto_habilidades_requeridas` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `proyecto_id`   INT UNSIGNED NOT NULL,
  `habilidad_id`  INT UNSIGNED NOT NULL,
  `nivel_minimo`  TINYINT UNSIGNED NOT NULL DEFAULT 3,
  `criticidad`    ENUM('deseable','importante','indispensable') NOT NULL DEFAULT 'importante',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_proyecto_habilidad` (`proyecto_id`,`habilidad_id`),
  KEY `ix_phr_habilidad` (`habilidad_id`),
  CONSTRAINT `fk_phr_proyecto` FOREIGN KEY (`proyecto_id`)
    REFERENCES `proyectos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_phr_habilidad` FOREIGN KEY (`habilidad_id`)
    REFERENCES `habilidades` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Sector del proyecto. Es la otra mitad del match: sin esto solo se puede
-- cruzar experticia técnica, y un ERP para una farmacéutica no lo saca
-- adelante cualquiera que sepa de ERP.
CREATE TABLE IF NOT EXISTS `proyecto_sectores` (
  `proyecto_id`  INT UNSIGNED NOT NULL,
  `sector_id`    INT UNSIGNED NOT NULL,
  `es_principal` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`proyecto_id`,`sector_id`),
  KEY `ix_proyecto_sectores_sector` (`sector_id`),
  CONSTRAINT `fk_prs_proyecto` FOREIGN KEY (`proyecto_id`)
    REFERENCES `proyectos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_prs_sector` FOREIGN KEY (`sector_id`)
    REFERENCES `sectores` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Preguntas de encuadre que la IA genera al crear el proyecto, con su respuesta.
-- Viven aquí y no en `comentarios` porque una respuesta se edita como tal, y
-- porque realimentan el payload del planteamiento: responder una invalida su
-- caché y mejora el plan siguiente.
CREATE TABLE IF NOT EXISTS `proyecto_preguntas` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `proyecto_id`    INT UNSIGNED NOT NULL,
  `analisis_id`    INT UNSIGNED NULL COMMENT 'Análisis que la generó; NULL si la escribió el usuario',
  `pregunta`       VARCHAR(500) NOT NULL,
  `motivo`         VARCHAR(500) NULL COMMENT 'Qué decisión del plan cambia según la respuesta',
  `tema`           VARCHAR(80)  NULL,
  `importancia`    ENUM('baja','media','alta','critica') NOT NULL DEFAULT 'media',
  `respuesta`      TEXT NULL,
  `estado`         ENUM('pendiente','respondida','omitida') NOT NULL DEFAULT 'pendiente',
  `orden`          SMALLINT NOT NULL DEFAULT 0,
  `creado_en`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_proyecto_pregunta` (`proyecto_id`,`pregunta`(180)),
  KEY `ix_ppr_proyecto_estado` (`proyecto_id`,`estado`),
  CONSTRAINT `fk_ppr_proyecto` FOREIGN KEY (`proyecto_id`)
    REFERENCES `proyectos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ppr_analisis` FOREIGN KEY (`analisis_id`)
    REFERENCES `analisis_ia` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
--  BLOQUE 4 · HITOS Y SPRINTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `hitos` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `proyecto_id`    INT UNSIGNED NOT NULL,
  `nombre`         VARCHAR(200) NOT NULL,
  `descripcion`    TEXT NULL,
  `fecha_inicio`   DATE NULL COMMENT 'Arranque de la fase. NULL = se deriva de la fase anterior',
  `fecha_objetivo` DATE NULL,
  `fecha_completado` DATE NULL,
  `estado`         ENUM('pendiente','en_progreso','completado','atrasado','cancelado')
                   NOT NULL DEFAULT 'pendiente',
  `orden`          SMALLINT NOT NULL DEFAULT 0,
  `creado_en`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_hitos_proyecto` (`proyecto_id`),
  KEY `ix_hitos_fecha_objetivo` (`fecha_objetivo`),
  KEY `ix_hitos_fecha_inicio` (`fecha_inicio`),
  CONSTRAINT `fk_hitos_proyecto` FOREIGN KEY (`proyecto_id`)
    REFERENCES `proyectos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `sprints` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `proyecto_id`  INT UNSIGNED NOT NULL,
  `nombre`       VARCHAR(120) NOT NULL,
  `objetivo`     TEXT NULL,
  `fecha_inicio` DATE NOT NULL,
  `fecha_fin`    DATE NOT NULL,
  `estado`       ENUM('planificado','activo','cerrado') NOT NULL DEFAULT 'planificado',
  `creado_en`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_sprints_proyecto` (`proyecto_id`),
  KEY `ix_sprints_estado` (`estado`),
  CONSTRAINT `fk_sprints_proyecto` FOREIGN KEY (`proyecto_id`)
    REFERENCES `proyectos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
--  BLOQUE 5 · TAREAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `tareas` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `proyecto_id`      INT UNSIGNED NOT NULL,
  `hito_id`          INT UNSIGNED NULL,
  `sprint_id`        INT UNSIGNED NULL,
  `tarea_padre_id`   INT UNSIGNED NULL COMMENT 'Subtareas',
  `titulo`           VARCHAR(255) NOT NULL,
  `descripcion`      TEXT NULL,
  `tipo`             ENUM('feature','mejora','correccion','investigacion','documentacion','reunion','administrativa')
                     NOT NULL DEFAULT 'feature',
  `estado`           ENUM('pendiente','en_progreso','en_revision','bloqueada','completada','cancelada')
                     NOT NULL DEFAULT 'pendiente',
  `prioridad`        ENUM('baja','media','alta','critica') NOT NULL DEFAULT 'media',
  `responsable_id`   INT UNSIGNED NULL,
  `fecha_inicio`     DATE NULL,
  `fecha_vencimiento` DATE NULL,
  `fecha_completada` DATETIME NULL,
  `estimacion_horas` DECIMAL(6,2) NULL,
  `progreso_pct`     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `motivo_bloqueo`   VARCHAR(500) NULL COMMENT 'Se llena cuando estado = bloqueada',
  `bloqueada_desde`  DATETIME NULL,
  `orden`            INT NOT NULL DEFAULT 0,
  `creado_en`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_tareas_proyecto_estado` (`proyecto_id`,`estado`),
  KEY `ix_tareas_responsable` (`responsable_id`),
  KEY `ix_tareas_vencimiento` (`fecha_vencimiento`),
  KEY `ix_tareas_sprint` (`sprint_id`),
  KEY `ix_tareas_hito` (`hito_id`),
  KEY `ix_tareas_padre` (`tarea_padre_id`),
  CONSTRAINT `fk_tareas_proyecto` FOREIGN KEY (`proyecto_id`)
    REFERENCES `proyectos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tareas_hito` FOREIGN KEY (`hito_id`)
    REFERENCES `hitos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tareas_sprint` FOREIGN KEY (`sprint_id`)
    REFERENCES `sprints` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tareas_padre` FOREIGN KEY (`tarea_padre_id`)
    REFERENCES `tareas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tareas_responsable` FOREIGN KEY (`responsable_id`)
    REFERENCES `personas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ck_tareas_progreso` CHECK (`progreso_pct` BETWEEN 0 AND 100)
) ENGINE=InnoDB;

-- Dependencias entre tareas: sin esto no hay detección real de cuellos de botella.
CREATE TABLE IF NOT EXISTS `tarea_dependencias` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tarea_id`         INT UNSIGNED NOT NULL COMMENT 'La que espera',
  `depende_de_id`    INT UNSIGNED NOT NULL COMMENT 'La que debe terminar antes',
  `tipo`             ENUM('bloquea','relacionada','duplica') NOT NULL DEFAULT 'bloquea',
  `creado_en`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tarea_dependencia` (`tarea_id`,`depende_de_id`),
  KEY `ix_td_depende_de` (`depende_de_id`),
  CONSTRAINT `fk_td_tarea` FOREIGN KEY (`tarea_id`)
    REFERENCES `tareas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_td_depende` FOREIGN KEY (`depende_de_id`)
    REFERENCES `tareas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
  -- Nota: MySQL 8 no permite un CHECK sobre columnas que participan en una FK
  -- con acción referencial, así que la regla "una tarea no depende de sí misma"
  -- se aplica con el trigger de más abajo.
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tarea_etiquetas` (
  `tarea_id`    INT UNSIGNED NOT NULL,
  `etiqueta_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`tarea_id`,`etiqueta_id`),
  KEY `ix_te_etiqueta` (`etiqueta_id`),
  CONSTRAINT `fk_te_tarea` FOREIGN KEY (`tarea_id`)
    REFERENCES `tareas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_te_etiqueta` FOREIGN KEY (`etiqueta_id`)
    REFERENCES `etiquetas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Habilidades que exige una tarea concreta (para el match fino persona ↔ tarea).
CREATE TABLE IF NOT EXISTS `tarea_habilidades_requeridas` (
  `tarea_id`     INT UNSIGNED NOT NULL,
  `habilidad_id` INT UNSIGNED NOT NULL,
  `nivel_minimo` TINYINT UNSIGNED NOT NULL DEFAULT 3,
  PRIMARY KEY (`tarea_id`,`habilidad_id`),
  KEY `ix_thr_habilidad` (`habilidad_id`),
  CONSTRAINT `fk_thr_tarea` FOREIGN KEY (`tarea_id`)
    REFERENCES `tareas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_thr_habilidad` FOREIGN KEY (`habilidad_id`)
    REFERENCES `habilidades` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
--  BLOQUE 6 · ASUNTOS (ISSUES / BUGS / RIESGOS / BLOQUEOS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `asuntos` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `proyecto_id`       INT UNSIGNED NOT NULL,
  `tarea_id`          INT UNSIGNED NULL COMMENT 'Si nace de una tarea concreta',
  `categoria_asunto_id` INT UNSIGNED NULL,
  `codigo`            VARCHAR(24) NULL COMMENT 'Ej. ORG-01-A15',
  `titulo`            VARCHAR(255) NOT NULL,
  `descripcion`       TEXT NULL,
  `tipo`              ENUM('bug','incidencia','riesgo','bloqueo','deuda_tecnica','solicitud_cambio','pregunta')
                      NOT NULL DEFAULT 'incidencia',
  `severidad`         ENUM('baja','media','alta','critica') NOT NULL DEFAULT 'media',
  `impacto`           ENUM('bajo','medio','alto') NOT NULL DEFAULT 'medio',
  `estado`            ENUM('pendiente','en_progreso','en_espera','resuelto','cerrado','descartado')
                      NOT NULL DEFAULT 'pendiente',
  `reportado_por_id`  INT UNSIGNED NULL,
  `asignado_a_id`     INT UNSIGNED NULL,
  `es_recurrente`     TINYINT(1) NOT NULL DEFAULT 0
                      COMMENT 'Marcado a mano o por la IA cuando el patrón se repite',
  `causa_raiz`        VARCHAR(500) NULL,
  `resolucion`        TEXT NULL,
  `fecha_reporte`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_objetivo`    DATE NULL,
  `fecha_resolucion`  DATETIME NULL,
  `creado_en`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_asuntos_codigo` (`codigo`),
  KEY `ix_asuntos_proyecto_estado` (`proyecto_id`,`estado`),
  KEY `ix_asuntos_severidad` (`severidad`),
  KEY `ix_asuntos_tipo` (`tipo`),
  KEY `ix_asuntos_asignado` (`asignado_a_id`),
  KEY `ix_asuntos_categoria` (`categoria_asunto_id`),
  CONSTRAINT `fk_asuntos_proyecto` FOREIGN KEY (`proyecto_id`)
    REFERENCES `proyectos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_asuntos_tarea` FOREIGN KEY (`tarea_id`)
    REFERENCES `tareas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_asuntos_categoria` FOREIGN KEY (`categoria_asunto_id`)
    REFERENCES `categorias_asunto` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_asuntos_reportado` FOREIGN KEY (`reportado_por_id`)
    REFERENCES `personas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_asuntos_asignado` FOREIGN KEY (`asignado_a_id`)
    REFERENCES `personas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `asunto_etiquetas` (
  `asunto_id`   INT UNSIGNED NOT NULL,
  `etiqueta_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`asunto_id`,`etiqueta_id`),
  KEY `ix_ae_etiqueta` (`etiqueta_id`),
  CONSTRAINT `fk_ae_asunto` FOREIGN KEY (`asunto_id`)
    REFERENCES `asuntos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ae_etiqueta` FOREIGN KEY (`etiqueta_id`)
    REFERENCES `etiquetas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
--  BLOQUE 7 · COMENTARIOS, BITÁCORA Y ADJUNTOS (polimórficos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `comentarios` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entidad_tipo` ENUM('proyecto','tarea','asunto','persona','hito') NOT NULL,
  `entidad_id`   INT UNSIGNED NOT NULL,
  `autor_id`     INT UNSIGNED NULL COMMENT 'NULL = el propietario del sistema',
  `contenido`    TEXT NOT NULL,
  `es_decision`  TINYINT(1) NOT NULL DEFAULT 0
                 COMMENT 'Marca comentarios que registran una decisión; peso alto para la IA',
  `creado_en`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_comentarios_entidad` (`entidad_tipo`,`entidad_id`,`creado_en`),
  KEY `ix_comentarios_autor` (`autor_id`),
  CONSTRAINT `fk_comentarios_autor` FOREIGN KEY (`autor_id`)
    REFERENCES `personas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Historial de cambios. Es la serie temporal que permite medir velocidad,
-- tiempo en cada estado y detectar proyectos estancados.
CREATE TABLE IF NOT EXISTS `bitacora` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entidad_tipo`   ENUM('proyecto','tarea','asunto','persona','hito','sprint','empresa') NOT NULL,
  `entidad_id`     INT UNSIGNED NOT NULL,
  `proyecto_id`    INT UNSIGNED NULL COMMENT 'Desnormalizado para filtrar rápido por proyecto',
  `accion`         ENUM('crear','actualizar','cambio_estado','asignar','comentar','eliminar')
                   NOT NULL,
  `campo`          VARCHAR(60) NULL,
  `valor_anterior` VARCHAR(500) NULL,
  `valor_nuevo`    VARCHAR(500) NULL,
  `actor_id`       INT UNSIGNED NULL,
  `creado_en`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_bitacora_entidad` (`entidad_tipo`,`entidad_id`,`creado_en`),
  KEY `ix_bitacora_proyecto_fecha` (`proyecto_id`,`creado_en`),
  CONSTRAINT `fk_bitacora_proyecto` FOREIGN KEY (`proyecto_id`)
    REFERENCES `proyectos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `adjuntos` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entidad_tipo`   ENUM('proyecto','tarea','asunto','persona','hito') NOT NULL,
  `entidad_id`     INT UNSIGNED NOT NULL,
  `nombre_archivo` VARCHAR(255) NOT NULL,
  `ruta_archivo`   VARCHAR(500) NOT NULL,
  `mime_type`      VARCHAR(100) NULL,
  `tamano_bytes`   INT UNSIGNED NULL,
  `descripcion`    VARCHAR(255) NULL,
  `creado_en`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_adjuntos_entidad` (`entidad_tipo`,`entidad_id`)
) ENGINE=InnoDB;

-- ============================================================================
--  BLOQUE 8 · MOTOR DE IA
--  Se guarda el payload enviado y la respuesta cruda: sin eso no hay forma de
--  auditar, comparar versiones de prompt ni reproducir un análisis.
-- ============================================================================

CREATE TABLE IF NOT EXISTS `analisis_ia` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tipo_analisis`   ENUM('salud_proyecto','cuellos_botella','match_persona_tarea',
                         'patrones_globales','priorizacion_diaria','perfil_cv',
                         'planteamiento_proyecto','tareas_sugeridas',
                         'preguntas_encuadre','perfiles_requeridos')
                    NOT NULL,
  `alcance`         ENUM('proyecto','global','persona','tarea') NOT NULL,
  `proyecto_id`     INT UNSIGNED NULL,
  `persona_id`      INT UNSIGNED NULL,
  `modelo`          VARCHAR(80) NOT NULL COMMENT 'Ej. gpt-4.1, gpt-4o-mini',
  `prompt_version`  VARCHAR(20) NOT NULL DEFAULT 'v1',
  `payload_hash`    CHAR(64) NULL COMMENT 'SHA-256 del payload; evita reanalizar lo idéntico',
  `payload_json`    JSON NOT NULL,
  `respuesta_json`  JSON NULL,
  `resumen`         TEXT NULL COMMENT 'Titular en lenguaje natural para mostrar en el dashboard',
  `puntaje_salud`   TINYINT UNSIGNED NULL COMMENT '0–100 devuelto por el modelo',
  `estado`          ENUM('pendiente','ok','error') NOT NULL DEFAULT 'pendiente',
  `error_mensaje`   VARCHAR(1000) NULL,
  `tokens_entrada`  INT UNSIGNED NULL,
  `tokens_salida`   INT UNSIGNED NULL,
  `costo_usd`       DECIMAL(10,6) NULL,
  `latencia_ms`     INT UNSIGNED NULL,
  `creado_en`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_analisis_proyecto_fecha` (`proyecto_id`,`creado_en`),
  KEY `ix_analisis_tipo` (`tipo_analisis`,`creado_en`),
  KEY `ix_analisis_hash` (`payload_hash`),
  CONSTRAINT `fk_analisis_proyecto` FOREIGN KEY (`proyecto_id`)
    REFERENCES `proyectos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_analisis_persona` FOREIGN KEY (`persona_id`)
    REFERENCES `personas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Salidas accionables normalizadas. El feedback cierra el ciclo de aprendizaje.
CREATE TABLE IF NOT EXISTS `recomendaciones_ia` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `analisis_id`      INT UNSIGNED NOT NULL,
  `proyecto_id`      INT UNSIGNED NULL,
  `tipo`             ENUM('accion','alerta','riesgo','mejora','asignacion','pregunta')
                     NOT NULL DEFAULT 'accion',
  `titulo`           VARCHAR(255) NOT NULL,
  `descripcion`      TEXT NULL,
  `justificacion`    TEXT NULL COMMENT 'Qué datos concretos la sustentan',
  `prioridad`        ENUM('baja','media','alta','critica') NOT NULL DEFAULT 'media',
  `impacto_estimado` ENUM('bajo','medio','alto') NOT NULL DEFAULT 'medio',
  `esfuerzo_estimado` ENUM('bajo','medio','alto') NOT NULL DEFAULT 'medio',
  `entidad_tipo`     ENUM('proyecto','tarea','asunto','persona') NULL,
  `entidad_id`       INT UNSIGNED NULL,
  `persona_sugerida_id` INT UNSIGNED NULL,
  `estado`           ENUM('nueva','aceptada','en_progreso','implementada','descartada')
                     NOT NULL DEFAULT 'nueva',
  `feedback_usuario` VARCHAR(500) NULL COMMENT 'Por qué se descartó o cómo resultó',
  `creado_en`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_reco_analisis` (`analisis_id`),
  KEY `ix_reco_proyecto_estado` (`proyecto_id`,`estado`),
  KEY `ix_reco_prioridad` (`prioridad`),
  CONSTRAINT `fk_reco_analisis` FOREIGN KEY (`analisis_id`)
    REFERENCES `analisis_ia` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reco_proyecto` FOREIGN KEY (`proyecto_id`)
    REFERENCES `proyectos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reco_persona_sugerida` FOREIGN KEY (`persona_sugerida_id`)
    REFERENCES `personas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Patrones transversales entre proyectos. Se acumulan y refuerzan con el tiempo.
CREATE TABLE IF NOT EXISTS `patrones_detectados` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clave`             VARCHAR(120) NOT NULL COMMENT 'Identificador estable para reforzar el mismo patrón',
  `nombre`            VARCHAR(200) NOT NULL,
  `descripcion`       TEXT NULL,
  `tipo`              ENUM('riesgo_recurrente','antipatron','buena_practica','correlacion_exito','brecha_skill')
                      NOT NULL,
  `ambito`            ENUM('categoria','empresa','persona','global') NOT NULL DEFAULT 'global',
  `evidencia_json`    JSON NULL COMMENT 'IDs de proyectos/asuntos que lo sustentan',
  `frecuencia`        SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `confianza`         DECIMAL(3,2) NULL,
  `recomendacion`     TEXT NULL,
  `estado`            ENUM('activo','mitigado','descartado') NOT NULL DEFAULT 'activo',
  `primera_deteccion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_deteccion`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_patrones_clave` (`clave`),
  KEY `ix_patrones_tipo` (`tipo`,`estado`)
) ENGINE=InnoDB;

-- Instantánea periódica de métricas por proyecto: permite graficar tendencias
-- y darle a la IA el "antes" contra el cual comparar.
CREATE TABLE IF NOT EXISTS `metricas_snapshot` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `proyecto_id`         INT UNSIGNED NOT NULL,
  `fecha`               DATE NOT NULL,
  `progreso_pct`        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `tareas_total`        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `tareas_completadas`  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `tareas_bloqueadas`   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `tareas_vencidas`     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `asuntos_abiertos`    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `asuntos_criticos`    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `dias_sin_movimiento` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `salud`               ENUM('verde','amarillo','rojo','sin_datos') NOT NULL DEFAULT 'sin_datos',
  `creado_en`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_metricas_proyecto_fecha` (`proyecto_id`,`fecha`),
  CONSTRAINT `fk_metricas_proyecto` FOREIGN KEY (`proyecto_id`)
    REFERENCES `proyectos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- Regla de integridad que el CHECK no puede cubrir: sin auto-dependencias.
DELIMITER $$

DROP TRIGGER IF EXISTS `trg_tarea_dependencias_ins`$$
CREATE TRIGGER `trg_tarea_dependencias_ins`
BEFORE INSERT ON `tarea_dependencias`
FOR EACH ROW
BEGIN
  IF NEW.tarea_id = NEW.depende_de_id THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Una tarea no puede depender de sí misma';
  END IF;
END$$

DROP TRIGGER IF EXISTS `trg_tarea_dependencias_upd`$$
CREATE TRIGGER `trg_tarea_dependencias_upd`
BEFORE UPDATE ON `tarea_dependencias`
FOR EACH ROW
BEGIN
  IF NEW.tarea_id = NEW.depende_de_id THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Una tarea no puede depender de sí misma';
  END IF;
END$$

DELIMITER ;

-- ============================================================================
--  BLOQUE 9 · VISTAS PARA EL DASHBOARD Y PARA ARMAR EL PAYLOAD DE IA
-- ============================================================================

-- Vista principal del dashboard: una fila por proyecto con todo lo agregado.
CREATE OR REPLACE VIEW `v_resumen_proyectos` AS
SELECT
  p.id,
  p.codigo,
  p.nombre,
  p.estado,
  p.prioridad,
  p.salud,
  p.progreso_pct,
  c.nombre  AS categoria,
  e.nombre  AS empresa,
  CONCAT_WS(' ', r.nombre, r.apellido) AS responsable,
  p.fecha_inicio,
  p.fecha_fin_estimada,
  DATEDIFF(p.fecha_fin_estimada, CURDATE())               AS dias_restantes,
  DATEDIFF(CURDATE(), COALESCE(p.ultimo_movimiento_en, p.creado_en)) AS dias_sin_movimiento,
  (SELECT COUNT(*) FROM tareas t WHERE t.proyecto_id = p.id)                                    AS tareas_total,
  (SELECT COUNT(*) FROM tareas t WHERE t.proyecto_id = p.id AND t.estado = 'completada')        AS tareas_completadas,
  (SELECT COUNT(*) FROM tareas t WHERE t.proyecto_id = p.id AND t.estado = 'bloqueada')         AS tareas_bloqueadas,
  (SELECT COUNT(*) FROM tareas t WHERE t.proyecto_id = p.id
     AND t.estado NOT IN ('completada','cancelada')
     AND t.fecha_vencimiento < CURDATE())                                                       AS tareas_vencidas,
  (SELECT COUNT(*) FROM asuntos a WHERE a.proyecto_id = p.id
     AND a.estado NOT IN ('resuelto','cerrado','descartado'))                                   AS asuntos_abiertos,
  (SELECT COUNT(*) FROM asuntos a WHERE a.proyecto_id = p.id
     AND a.severidad = 'critica' AND a.estado NOT IN ('resuelto','cerrado','descartado'))       AS asuntos_criticos,
  (SELECT COUNT(*) FROM proyecto_personas pp WHERE pp.proyecto_id = p.id AND pp.activo = 1)     AS involucrados
FROM proyectos p
LEFT JOIN categorias c ON c.id = p.categoria_id
LEFT JOIN empresas   e ON e.id = p.empresa_id
LEFT JOIN personas   r ON r.id = p.responsable_id
WHERE p.archivado = 0;

-- Carga de trabajo por persona: insumo directo para detectar sobrecarga.
CREATE OR REPLACE VIEW `v_carga_personas` AS
SELECT
  pe.id                                   AS persona_id,
  CONCAT_WS(' ', pe.nombre, pe.apellido)  AS nombre_completo,
  pe.rol_principal,
  pe.disponibilidad_horas_semana,
  COUNT(DISTINCT pp.proyecto_id)          AS proyectos_activos,
  COUNT(DISTINCT CASE WHEN t.estado NOT IN ('completada','cancelada') THEN t.id END) AS tareas_abiertas,
  COUNT(DISTINCT CASE WHEN t.estado = 'bloqueada' THEN t.id END)                     AS tareas_bloqueadas,
  COUNT(DISTINCT CASE WHEN t.estado NOT IN ('completada','cancelada')
                        AND t.fecha_vencimiento < CURDATE() THEN t.id END)           AS tareas_vencidas,
  COALESCE(SUM(CASE WHEN t.estado NOT IN ('completada','cancelada')
                    THEN t.estimacion_horas END), 0)                                 AS horas_estimadas_pendientes
FROM personas pe
LEFT JOIN proyecto_personas pp ON pp.persona_id = pe.id AND pp.activo = 1
LEFT JOIN tareas t             ON t.responsable_id = pe.id
WHERE pe.activo = 1
GROUP BY pe.id, pe.nombre, pe.apellido, pe.rol_principal, pe.disponibilidad_horas_semana;

-- Tareas que bloquean a otras y siguen abiertas: los cuellos de botella reales.
-- Un cuello de botella no es cualquier tarea que tenga dependientes: es una que
-- además está realmente detenida. Sin este filtro la lista se llena de tareas
-- pendientes normales y deja de ser accionable.
--
-- `dias_detenida` se mide contra el último movimiento registrado en la bitácora,
-- no contra actualizado_en, porque ese último cambia con cualquier edición menor.
CREATE OR REPLACE VIEW `v_cuellos_botella` AS
SELECT
  t.id                AS tarea_id,
  t.proyecto_id,
  p.codigo            AS proyecto_codigo,
  t.titulo,
  t.estado,
  t.prioridad,
  t.motivo_bloqueo,
  CONCAT_WS(' ', pe.nombre, pe.apellido) AS responsable,
  DATEDIFF(CURDATE(), DATE(COALESCE(
    t.bloqueada_desde,
    (SELECT MAX(b.creado_en) FROM bitacora b
      WHERE b.entidad_tipo = 'tarea' AND b.entidad_id = t.id),
    t.creado_en
  )))                 AS dias_detenida,
  COUNT(td.id)        AS tareas_que_bloquea
FROM tareas t
JOIN tarea_dependencias td ON td.depende_de_id = t.id AND td.tipo = 'bloquea'
JOIN proyectos p           ON p.id = t.proyecto_id
LEFT JOIN personas pe      ON pe.id = t.responsable_id
WHERE t.estado NOT IN ('completada','cancelada')
  AND (
        t.estado = 'bloqueada'
     OR t.fecha_vencimiento < CURDATE()
     OR DATE(COALESCE(
          t.bloqueada_desde,
          (SELECT MAX(b.creado_en) FROM bitacora b
            WHERE b.entidad_tipo = 'tarea' AND b.entidad_id = t.id),
          t.creado_en
        )) <= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      )
GROUP BY t.id, t.proyecto_id, p.codigo, t.titulo, t.estado, t.prioridad,
         t.motivo_bloqueo, pe.nombre, pe.apellido, t.bloqueada_desde, t.creado_en
HAVING tareas_que_bloquea > 0;
