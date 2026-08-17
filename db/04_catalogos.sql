-- ============================================================================
--  Catálogos incrementales · base `proyectos`
--
--  A diferencia de 02_seed.sql (que solo corre cuando los catálogos están
--  vacíos), este archivo se ejecuta en CADA arranque. Por eso solo puede
--  contener INSERT … ON DUPLICATE KEY UPDATE: nada destructivo, nada que
--  dependa del estado previo.
--
--  Es el sitio donde se amplía el vocabulario sin tocar los datos del usuario.
-- ============================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------- HABILIDADES
-- El seed original (02_seed.sql) cubre bien software y poco más. La
-- organización trabaja en varios sectores: química, farmacia, logística,
-- manufactura, salud, legal y finanzas. Sin estas entradas, el perfilado por
-- IA no tiene contra qué emparejar y acaba inventando habilidades duplicadas.
INSERT INTO `habilidades` (`nombre`,`slug`,`tipo`) VALUES
  -- Química, farmacia y laboratorio
  ('Química analítica',                        'quimica-analitica',    'tecnica'),
  ('Cromatografía HPLC/GC',                    'hplc-gc',              'tecnica'),
  ('Formulación de productos',                 'formulacion',          'tecnica'),
  ('Control de calidad de laboratorio',        'control-calidad-lab',  'tecnica'),
  ('Buenas Prácticas de Manufactura (BPM/GMP)','bpm-gmp',              'metodologia'),
  ('Validación de procesos',                   'validacion-procesos',  'metodologia'),
  ('Registro sanitario',                       'registro-sanitario',   'dominio'),
  ('Farmacovigilancia',                        'farmacovigilancia',    'dominio'),
  ('Seguridad de procesos químicos',           'seguridad-procesos',   'dominio'),
  -- Logística y cadena de suministro
  ('Gestión de inventarios',                   'gestion-inventarios',  'metodologia'),
  ('Planificación de la demanda',              'planificacion-demanda','metodologia'),
  ('Comercio exterior y aduanas',              'comercio-exterior',    'dominio'),
  ('Gestión de almacenes (WMS)',               'wms',                  'herramienta'),
  ('Distribución y última milla',              'ultima-milla',         'dominio'),
  ('Negociación con proveedores',              'compras',              'blanda'),
  -- Manufactura e industria
  ('Lean Manufacturing',                       'lean',                 'metodologia'),
  ('Six Sigma',                                'six-sigma',            'metodologia'),
  ('Mantenimiento industrial',                 'mantenimiento-industrial','tecnica'),
  ('Automatización industrial (PLC)',          'plc',                  'tecnica'),
  ('Diseño CAD',                               'cad',                  'herramienta'),
  -- Salud
  ('Gestión clínica',                          'gestion-clinica',      'dominio'),
  ('Interoperabilidad HL7/FHIR',               'hl7-fhir',             'tecnica'),
  ('Bioseguridad',                             'bioseguridad',         'dominio'),
  -- Energía y ambiente
  ('Eficiencia energética',                    'eficiencia-energetica','dominio'),
  ('Energías renovables',                      'energias-renovables',  'dominio'),
  ('Evaluación de impacto ambiental',          'impacto-ambiental',    'metodologia'),
  -- Legal, finanzas y gestión
  ('Redacción de contratos',                   'contratos',            'dominio'),
  ('Cumplimiento normativo',                   'compliance',           'metodologia'),
  ('Propiedad intelectual',                    'propiedad-intelectual','dominio'),
  ('Contabilidad',                             'contabilidad',         'tecnica'),
  ('Análisis financiero',                      'analisis-financiero',  'tecnica'),
  ('Control de gestión',                       'control-gestion',      'metodologia'),
  ('Auditoría interna',                        'auditoria-interna',    'metodologia'),
  -- Transversales a cualquier sector
  ('Gestión de proyectos (PMBOK)',             'pmbok',                'metodologia'),
  ('Gestión del cambio',                       'gestion-cambio',       'metodologia'),
  ('Análisis de riesgos',                      'analisis-riesgos',     'metodologia'),
  ('Formación y capacitación',                 'capacitacion',         'blanda'),
  ('Atención al cliente',                      'atencion-cliente',     'blanda'),
  ('Portugués',                                'portugues',            'idioma'),
  ('Francés',                                  'frances',              'idioma')
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);
