-- ============================================================================
--  Datos iniciales de catálogos · base `proyectos`
--  Idempotente: se puede correr varias veces sin duplicar.
-- ============================================================================
USE `proyectos`;

-- El cliente de MySQL puede venir con charset latin1 según el sistema. Sin esta
-- línea, los acentos se guardan doblemente codificados y salen como "RÃ­os".
SET NAMES utf8mb4;


-- ---------------------------------------------------------------- CATEGORÍAS
INSERT INTO `categorias` (`nombre`,`slug`,`descripcion`,`color_hex`,`icono`,`orden`) VALUES
  ('Desarrollo Web',       'desarrollo-web',    'Sitios, portales y aplicaciones web',        '#2E7D32','Language',      10),
  ('Aplicación Móvil',     'app-movil',         'Apps nativas o híbridas',                    '#388E3C','PhoneIphone',   20),
  ('Datos e IA',           'datos-ia',          'Analítica, automatización y modelos',        '#00695C','Psychology',    30),
  ('Infraestructura',      'infraestructura',   'Servidores, redes, despliegue y DevOps',     '#455A64','Dns',           40),
  ('Integraciones',        'integraciones',     'APIs y conexión entre sistemas',             '#0277BD','Hub',           50),
  ('Diseño y UX',          'diseno-ux',         'Interfaz, experiencia e identidad visual',   '#7B1FA2','Brush',         60),
  ('Marketing Digital',    'marketing',         'Campañas, contenido y posicionamiento',      '#EF6C00','Campaign',      70),
  ('Consultoría',          'consultoria',       'Asesoría, auditoría y acompañamiento',       '#5D4037','Insights',      80),
  ('Soporte y Mantenimiento','soporte',         'Mantenimiento correctivo y evolutivo',       '#616161','Build',         90),
  ('Interno',              'interno',           'Proyectos propios de la organización',       '#1B5E20','Home',         100)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

-- ------------------------------------------------------- CATEGORÍAS DE ASUNTO
INSERT INTO `categorias_asunto` (`nombre`,`slug`,`descripcion`,`color_hex`) VALUES
  ('Bug funcional',        'bug-funcional',     'El sistema no hace lo que debería',          '#C62828'),
  ('Error de datos',       'error-datos',       'Información incorrecta o inconsistente',     '#AD1457'),
  ('Rendimiento',          'rendimiento',       'Lentitud o consumo excesivo de recursos',    '#EF6C00'),
  ('Bloqueo externo',      'bloqueo-externo',   'Depende de un tercero, cliente o proveedor', '#6A1B9A'),
  ('Falta de información', 'falta-informacion', 'No hay definición o requerimiento claro',    '#0277BD'),
  ('Deuda técnica',        'deuda-tecnica',     'Atajo que hay que pagar más adelante',       '#4E342E'),
  ('Cambio de alcance',    'cambio-alcance',    'El cliente pidió algo distinto',             '#F9A825'),
  ('Riesgo de plazo',      'riesgo-plazo',      'Amenaza la fecha comprometida',              '#D84315'),
  ('Seguridad',            'seguridad',         'Vulnerabilidad o exposición de datos',       '#B71C1C'),
  ('Mejora sugerida',      'mejora-sugerida',   'Oportunidad detectada, no es defecto',       '#2E7D32')
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

-- ------------------------------------------------------- ROLES EN EL PROYECTO
INSERT INTO `roles_proyecto` (`nombre`,`slug`,`es_interno`) VALUES
  ('Líder de proyecto',    'lider',            1),
  ('Desarrollador Backend','dev-backend',      1),
  ('Desarrollador Frontend','dev-frontend',    1),
  ('Desarrollador Full-stack','dev-fullstack', 1),
  ('Diseñador UI/UX',      'disenador',        1),
  ('QA / Tester',          'qa',               1),
  ('DevOps',               'devops',           1),
  ('Analista de datos',    'analista-datos',   1),
  ('Cliente',              'cliente',          0),
  ('Stakeholder',          'stakeholder',      0),
  ('Proveedor',            'proveedor',        0),
  ('Consultor externo',    'consultor',        0)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

-- ------------------------------------------------------------------ ETIQUETAS
INSERT INTO `etiquetas` (`nombre`,`slug`,`color_hex`) VALUES
  ('urgente','urgente','#C62828'),
  ('quick-win','quick-win','#43A047'),
  ('bloqueante','bloqueante','#EF6C00'),
  ('esperando-cliente','esperando-cliente','#6A1B9A'),
  ('investigación','investigacion','#0277BD'),
  ('refactor','refactor','#4E342E'),
  ('facturable','facturable','#00695C')
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

-- ----------------------------------------------------------------- HABILIDADES
INSERT INTO `habilidades` (`nombre`,`slug`,`tipo`) VALUES
  -- Técnicas
  ('JavaScript','javascript','tecnica'),
  ('TypeScript','typescript','tecnica'),
  ('React','react','tecnica'),
  ('Next.js','nextjs','tecnica'),
  ('Node.js','nodejs','tecnica'),
  ('PHP','php','tecnica'),
  ('Laravel','laravel','tecnica'),
  ('Python','python','tecnica'),
  ('MySQL','mysql','tecnica'),
  ('PostgreSQL','postgresql','tecnica'),
  ('Diseño de bases de datos','diseno-bd','tecnica'),
  ('APIs REST','apis-rest','tecnica'),
  ('React Native','react-native','tecnica'),
  ('Integración de LLM','integracion-llm','tecnica'),
  -- Herramientas
  ('Git','git','herramienta'),
  ('Docker','docker','herramienta'),
  ('Figma','figma','herramienta'),
  ('Material UI','material-ui','herramienta'),
  ('Power BI','power-bi','herramienta'),
  -- Metodologías
  ('Scrum','scrum','metodologia'),
  ('Kanban','kanban','metodologia'),
  ('Levantamiento de requerimientos','requerimientos','metodologia'),
  ('Testing y QA','testing-qa','metodologia'),
  -- Dominio
  ('E-commerce','ecommerce','dominio'),
  ('Fintech','fintech','dominio'),
  ('Salud','salud','dominio'),
  ('Educación','educacion','dominio'),
  ('Logística','logistica','dominio'),
  ('Retail','retail','dominio'),
  -- Blandas
  ('Comunicación con cliente','comunicacion-cliente','blanda'),
  ('Liderazgo de equipo','liderazgo','blanda'),
  ('Negociación','negociacion','blanda'),
  ('Documentación','documentacion','blanda'),
  -- Idiomas
  ('Español','espanol','idioma'),
  ('Inglés','ingles','idioma')
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);
