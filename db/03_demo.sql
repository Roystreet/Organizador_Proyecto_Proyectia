-- ============================================================================
--  Datos de demostración · base `proyectos`
--  Portafolio ficticio pero verosímil, con problemas reales que la IA debe
--  detectar: un proyecto estancado, un cuello de botella encadenado, una
--  persona sobrecargada y una categoría de asuntos que se repite.
--
--  Las fechas son relativas a CURDATE(), así que el seed no envejece.
-- ============================================================================
USE `proyectos`;

-- El cliente de MySQL puede venir con charset latin1 según el sistema. Sin esta
-- línea, los acentos se guardan doblemente codificados y salen como "RÃ­os".
SET NAMES utf8mb4;


SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE metricas_snapshot;
TRUNCATE TABLE recomendaciones_ia;
TRUNCATE TABLE analisis_ia;
TRUNCATE TABLE patrones_detectados;
TRUNCATE TABLE bitacora;
TRUNCATE TABLE comentarios;
TRUNCATE TABLE adjuntos;
TRUNCATE TABLE asunto_etiquetas;
TRUNCATE TABLE asuntos;
TRUNCATE TABLE tarea_habilidades_requeridas;
TRUNCATE TABLE tarea_etiquetas;
TRUNCATE TABLE tarea_dependencias;
TRUNCATE TABLE tareas;
TRUNCATE TABLE sprints;
TRUNCATE TABLE hitos;
TRUNCATE TABLE proyecto_habilidades_requeridas;
TRUNCATE TABLE proyecto_personas;
TRUNCATE TABLE proyecto_etiquetas;
TRUNCATE TABLE proyectos;
TRUNCATE TABLE persona_insumos;
TRUNCATE TABLE persona_experiencias;
TRUNCATE TABLE persona_habilidades;
TRUNCATE TABLE persona_documentos;
TRUNCATE TABLE personas;
TRUNCATE TABLE empresas;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------------ EMPRESAS
INSERT INTO empresas (id, nombre, slug, tipo, industria, tamano, pais, sitio_web) VALUES
 (1,'Distribuidora Andina C.A.','distribuidora-andina','cliente','Logística','mediana','Venezuela','https://andina.example'),
 (2,'Clínica Santa Elena','clinica-santa-elena','cliente','Salud','mediana','Venezuela',NULL),
 (3,'Verde Studio','verde-studio','interna','Tecnología','micro','Venezuela',NULL),
 (4,'Banco Litoral','banco-litoral','cliente','Fintech','grande','Panamá',NULL),
 (5,'Academia Nova','academia-nova','prospecto','Educación','pequena','Colombia',NULL);

-- ------------------------------------------------------------------ PERSONAS
INSERT INTO personas
 (id, nombre, apellido, email, empresa_id, tipo_relacion, rol_principal, seniority,
  anios_experiencia, disponibilidad_horas_semana, ubicacion, bio) VALUES
 (1,'Roiner','Bracamonte','roiner@verdestudio.example',3,'interno','Líder técnico','lead',12.0,40,'Caracas',
  'Dirige el estudio. Arquitectura, relación con clientes y decisiones de producto.'),
 (2,'Marianela','Ríos','marianela@verdestudio.example',3,'interno','Full-stack Developer','senior',8.0,40,'Valencia',
  'Backend en Node y PHP. Se ha vuelto el punto único de contacto de integraciones.'),
 (3,'Diego','Salazar','diego@verdestudio.example',3,'interno','Frontend Developer','semi_senior',4.0,40,'Caracas',NULL),
 (4,'Camila','Ortega','camila@verdestudio.example',3,'interno','Diseñadora UI/UX','senior',7.0,30,'Bogotá',NULL),
 (5,'Héctor','Peña','hector@freelance.example',NULL,'freelance','DevOps','senior',9.0,20,'Maracaibo',NULL),
 (6,'Valeria','Cordero','valeria@verdestudio.example',3,'interno','QA','junior',1.5,40,'Caracas',NULL),
 (7,'Luis','Guerra','lguerra@andina.example',1,'cliente','Gerente de Operaciones',NULL,NULL,NULL,'Barquisimeto',NULL),
 (8,'Patricia','Miranda','pmiranda@bancolitoral.example',4,'stakeholder','Directora de Innovación',NULL,NULL,NULL,'Ciudad de Panamá',NULL);

-- Experticia (habilidad_id según el seed de catálogos)
INSERT INTO persona_habilidades (persona_id, habilidad_id, nivel, anios_experiencia, es_fortaleza, origen, validado, evidencia) VALUES
 -- Roiner: arquitectura y cliente
 (1, 2,5,8.0,1,'manual',1,'Lidera todos los proyectos TypeScript del estudio'),
 (1, 4,4,3.0,1,'manual',1,NULL),
 (1,11,5,10.0,1,'manual',1,'Diseñó los modelos de datos de los últimos seis proyectos'),
 (1,30,5,12.0,1,'manual',1,'Único interlocutor con clientes grandes'),
 (1,31,4,6.0,0,'manual',1,NULL),
 (1,22,4,9.0,1,'manual',1,NULL),
 -- Marianela: backend e integraciones (el recurso crítico)
 (2, 1,5,8.0,1,'manual',1,NULL),
 (2, 2,4,4.0,0,'manual',1,NULL),
 (2, 5,5,7.0,1,'manual',1,'Todas las APIs del estudio pasan por ella'),
 (2, 6,4,6.0,0,'manual',1,NULL),
 (2, 7,4,5.0,0,'manual',1,NULL),
 (2, 9,5,8.0,1,'manual',1,NULL),
 (2,12,5,7.0,1,'manual',1,'Integró pasarelas de pago en tres proyectos'),
 (2,25,4,4.0,1,'manual',1,'Dos proyectos fintech completos'),
 -- Diego: frontend
 (3, 1,4,4.0,1,'manual',1,NULL),
 (3, 2,4,3.0,1,'manual',1,NULL),
 (3, 3,4,4.0,1,'manual',1,NULL),
 (3, 4,3,2.0,0,'manual',1,NULL),
 (3,18,3,2.0,0,'manual',1,NULL),
 (3,24,3,2.0,0,'manual',1,NULL),
 -- Camila: diseño
 (4,17,5,7.0,1,'manual',1,NULL),
 (4,18,4,3.0,1,'manual',1,NULL),
 (4,22,4,5.0,1,'manual',1,NULL),
 (4,24,4,4.0,1,'manual',1,'Rediseñó dos tiendas en línea con mejora medible de conversión'),
 -- Héctor: infraestructura
 (5,15,5,9.0,1,'manual',1,NULL),
 (5,16,5,7.0,1,'manual',1,NULL),
 (5, 8,4,6.0,0,'manual',1,NULL),
 (5, 9,4,8.0,0,'manual',1,NULL),
 -- Valeria: QA en formación
 (6,23,3,1.5,1,'manual',1,NULL),
 (6, 1,2,1.0,0,'manual',1,NULL),
 (6,21,3,1.0,0,'manual',1,NULL);

INSERT INTO persona_experiencias (persona_id, empresa_nombre, cargo, industria, fecha_inicio, fecha_fin, es_actual, logros, origen) VALUES
 (2,'PagoSeguro LATAM','Backend Developer','Fintech','2019-03-01','2022-08-31',0,'Integró tres pasarelas de pago con conciliación automática','manual'),
 (2,'Verde Studio','Full-stack Developer','Tecnología','2022-09-01',NULL,1,NULL,'manual'),
 (4,'Agencia Kubo','Diseñadora de producto','Retail','2018-01-15','2023-05-31',0,'Rediseño de e-commerce con +22% de conversión','manual'),
 (5,'Nube Andina','SRE','Tecnología','2017-06-01','2024-01-31',0,'Migró 40 servicios a contenedores sin caída de servicio','manual');

INSERT INTO persona_insumos (persona_id, tipo, titulo, detalle, contexto, origen, validado) VALUES
 (2,'fortaleza','Integraciones con sistemas de terceros','Ha conectado pasarelas de pago, ERPs y APIs bancarias con manejo real de errores y reintentos.','Proyectos con dependencia externa','manual',1),
 (2,'aporte','Puede estandarizar el manejo de errores de integración','Documentar su patrón de reintentos evitaría que cada proyecto lo reinvente.','Interno','manual',1),
 (2,'pregunta_sugerida','¿Cómo manejas la conciliación cuando el proveedor responde tarde?','Es el problema que más nos ha costado en los últimos dos proyectos y ella ya lo resolvió antes.','Fintech','manual',1),
 (2,'area_mejora','Concentración de conocimiento','Es la única que conoce las integraciones. Conviene que acompañe a Diego en la próxima.','Interno','manual',1),
 (4,'fortaleza','Diseño orientado a conversión','Trabaja desde métricas, no desde gusto personal.','E-commerce y retail','manual',1),
 (4,'pregunta_sugerida','¿Qué métricas mirabas para justificar un rediseño ante el cliente?','Nos ayudaría a vender mejor los proyectos de diseño.','Comercial','manual',1),
 (5,'aporte','Puede dejar el despliegue automatizado','Hoy cada entrega se sube a mano; él ya tiene el patrón resuelto.','Infraestructura','manual',1),
 (1,'fortaleza','Relación con clientes grandes','Es quien sostiene la comunicación con Banco Litoral y Distribuidora Andina.','Comercial','manual',1);

-- ----------------------------------------------------------------- PROYECTOS
INSERT INTO proyectos
 (id, codigo, nombre, slug, descripcion, objetivo, categoria_id, empresa_id, responsable_id,
  estado, prioridad, salud, progreso_pct, fecha_inicio, fecha_fin_estimada, ultimo_movimiento_en) VALUES
 (1,'AND-01','Portal de pedidos Andina','portal-pedidos-andina',
  'Portal web para que los clientes mayoristas de Distribuidora Andina coloquen pedidos sin llamar por teléfono.',
  'Que el 60% de los pedidos entren por el portal en los primeros tres meses, reduciendo la carga del call center.',
  1,1,1,'en_progreso','alta','sin_datos',48, DATE_SUB(CURDATE(), INTERVAL 78 DAY), DATE_ADD(CURDATE(), INTERVAL 24 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),

 (2,'BLT-02','App de citas Banco Litoral','app-citas-banco-litoral',
  'Aplicación móvil para agendar citas en agencias y evitar colas.',
  'Reducir el tiempo promedio de espera en agencia de 40 a 15 minutos.',
  2,4,1,'en_progreso','critica','sin_datos',31, DATE_SUB(CURDATE(), INTERVAL 52 DAY), DATE_ADD(CURDATE(), INTERVAL 9 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),

 (3,'CSE-03','Historia clínica digital','historia-clinica-digital',
  'Migración de historias clínicas en papel a un sistema digital consultable.',
  'Que todo el personal médico consulte historias desde el sistema, sin papel, al cierre del año.',
  1,2,2,'en_pausa','media','sin_datos',22, DATE_SUB(CURDATE(), INTERVAL 120 DAY), DATE_ADD(CURDATE(), INTERVAL 60 DAY), DATE_SUB(NOW(), INTERVAL 34 DAY)),

 (4,'VRD-04','Sitio institucional Verde Studio','sitio-verde-studio',
  'Rehacer el sitio del estudio con casos de éxito.',
  'Generar al menos 5 consultas calificadas al mes desde el sitio.',
  7,3,4,'en_progreso','baja','sin_datos',65, DATE_SUB(CURDATE(), INTERVAL 40 DAY), DATE_ADD(CURDATE(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),

 (5,'AND-05','Tablero de indicadores Andina','tablero-indicadores-andina',
  'Tablero de ventas y rotación de inventario para la gerencia.',
  'Que la gerencia deje de pedir reportes manuales cada semana.',
  3,1,1,'planificacion','media','sin_datos',8, DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_ADD(CURDATE(), INTERVAL 75 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY)),

 (6,'NOV-06','Plataforma de cursos Academia Nova','plataforma-academia-nova',
  'Propuesta de plataforma de cursos en línea con evaluaciones.',
  'Cerrar la propuesta comercial y arrancar en septiembre.',
  1,5,1,'idea','media','sin_datos',0, NULL, NULL, DATE_SUB(NOW(), INTERVAL 11 DAY)),

 (7,'CSE-07','Portal de resultados de laboratorio','portal-resultados-lab',
  'Portal para que los pacientes consulten resultados en línea.',
  'Eliminar la entrega de resultados en mostrador.',
  1,2,2,'completado','media','verde',100, DATE_SUB(CURDATE(), INTERVAL 210 DAY), DATE_SUB(CURDATE(), INTERVAL 45 DAY), DATE_SUB(NOW(), INTERVAL 44 DAY));
UPDATE proyectos SET fecha_fin_real = DATE_SUB(CURDATE(), INTERVAL 38 DAY) WHERE id = 7;

INSERT INTO proyecto_etiquetas (proyecto_id, etiqueta_id) VALUES
 (1,7),(2,1),(2,7),(3,4),(4,2),(5,5),(6,5);

INSERT INTO proyecto_personas (proyecto_id, persona_id, rol_id, asignacion_pct, es_principal, fecha_ingreso) VALUES
 (1,1,1,25,1,DATE_SUB(CURDATE(), INTERVAL 78 DAY)),
 (1,2,4,50,0,DATE_SUB(CURDATE(), INTERVAL 78 DAY)),
 (1,3,3,60,0,DATE_SUB(CURDATE(), INTERVAL 70 DAY)),
 (1,6,6,30,0,DATE_SUB(CURDATE(), INTERVAL 40 DAY)),
 (1,7,9,NULL,0,DATE_SUB(CURDATE(), INTERVAL 78 DAY)),
 (2,1,1,20,1,DATE_SUB(CURDATE(), INTERVAL 52 DAY)),
 (2,2,2,40,0,DATE_SUB(CURDATE(), INTERVAL 52 DAY)),
 (2,4,5,40,0,DATE_SUB(CURDATE(), INTERVAL 50 DAY)),
 (2,8,10,NULL,0,DATE_SUB(CURDATE(), INTERVAL 52 DAY)),
 (3,2,4,15,1,DATE_SUB(CURDATE(), INTERVAL 120 DAY)),
 (3,6,6,10,0,DATE_SUB(CURDATE(), INTERVAL 90 DAY)),
 (4,4,5,30,1,DATE_SUB(CURDATE(), INTERVAL 40 DAY)),
 (4,3,3,20,0,DATE_SUB(CURDATE(), INTERVAL 35 DAY)),
 (5,1,1,10,1,DATE_SUB(CURDATE(), INTERVAL 15 DAY)),
 (5,2,8,10,0,DATE_SUB(CURDATE(), INTERVAL 15 DAY)),
 (7,2,4,0,1,DATE_SUB(CURDATE(), INTERVAL 210 DAY)),
 (7,5,7,0,0,DATE_SUB(CURDATE(), INTERVAL 200 DAY));

INSERT INTO proyecto_habilidades_requeridas (proyecto_id, habilidad_id, nivel_minimo, criticidad) VALUES
 (1,4,4,'indispensable'),(1,9,4,'indispensable'),(1,12,4,'importante'),(1,24,3,'deseable'),
 (2,13,4,'indispensable'),(2,12,4,'indispensable'),(2,25,3,'importante'),(2,17,4,'importante'),
 (3,6,3,'importante'),(3,9,4,'indispensable'),(3,26,3,'deseable'),
 (5,19,4,'indispensable'),(5,9,3,'importante');

-- --------------------------------------------------------------------- HITOS
INSERT INTO hitos (id, proyecto_id, nombre, fecha_objetivo, estado, orden) VALUES
 (1,1,'Catálogo y carrito funcionando', DATE_SUB(CURDATE(), INTERVAL 20 DAY),'completado',1),
 (2,1,'Pagos en línea operativos', DATE_ADD(CURDATE(), INTERVAL 5 DAY),'en_progreso',2),
 (3,1,'Puesta en producción', DATE_ADD(CURDATE(), INTERVAL 24 DAY),'pendiente',3),
 (4,2,'Prototipo aprobado por el banco', DATE_SUB(CURDATE(), INTERVAL 12 DAY),'completado',1),
 (5,2,'Versión beta en TestFlight', DATE_ADD(CURDATE(), INTERVAL 2 DAY),'en_progreso',2),
 (6,3,'Modelo de datos validado con el personal médico', DATE_SUB(CURDATE(), INTERVAL 55 DAY),'atrasado',1),
 (7,4,'Contenido de casos de éxito listo', DATE_ADD(CURDATE(), INTERVAL 8 DAY),'en_progreso',1);

INSERT INTO sprints (id, proyecto_id, nombre, objetivo, fecha_inicio, fecha_fin, estado) VALUES
 (1,1,'Sprint 7','Cerrar pagos y conciliación', DATE_SUB(CURDATE(), INTERVAL 6 DAY), DATE_ADD(CURDATE(), INTERVAL 8 DAY),'activo'),
 (2,2,'Sprint 4','Beta lista para el banco', DATE_SUB(CURDATE(), INTERVAL 4 DAY), DATE_ADD(CURDATE(), INTERVAL 10 DAY),'activo');

-- -------------------------------------------------------------------- TAREAS
INSERT INTO tareas
 (id, proyecto_id, hito_id, sprint_id, titulo, descripcion, tipo, estado, prioridad,
  responsable_id, fecha_vencimiento, estimacion_horas, progreso_pct, motivo_bloqueo, bloqueada_desde, fecha_completada) VALUES
 -- AND-01
 (1,1,1,NULL,'Modelo de datos del catálogo',NULL,'feature','completada','alta',2,DATE_SUB(CURDATE(),INTERVAL 60 DAY),16,100,NULL,NULL,DATE_SUB(NOW(),INTERVAL 62 DAY)),
 (2,1,1,NULL,'Pantalla de catálogo y filtros',NULL,'feature','completada','alta',3,DATE_SUB(CURDATE(),INTERVAL 40 DAY),24,100,NULL,NULL,DATE_SUB(NOW(),INTERVAL 39 DAY)),
 (3,1,1,NULL,'Carrito y resumen de pedido',NULL,'feature','completada','alta',3,DATE_SUB(CURDATE(),INTERVAL 25 DAY),20,100,NULL,NULL,DATE_SUB(NOW(),INTERVAL 22 DAY)),
 (4,1,2,1,'Integrar pasarela de pagos','Conexión con el proveedor de pagos y manejo de reintentos.','feature','bloqueada','critica',2,DATE_SUB(CURDATE(),INTERVAL 4 DAY),24,35,'El proveedor no ha entregado las credenciales del ambiente de producción.',DATE_SUB(NOW(),INTERVAL 13 DAY),NULL),
 (5,1,2,1,'Conciliación de pagos con el ERP',NULL,'feature','pendiente','alta',2,DATE_ADD(CURDATE(),INTERVAL 3 DAY),16,0,NULL,NULL,NULL),
 (6,1,2,1,'Correos de confirmación de pedido',NULL,'feature','pendiente','media',3,DATE_ADD(CURDATE(),INTERVAL 5 DAY),8,0,NULL,NULL,NULL),
 (7,1,3,NULL,'Pruebas de aceptación con el cliente',NULL,'documentacion','pendiente','alta',6,DATE_ADD(CURDATE(),INTERVAL 15 DAY),12,0,NULL,NULL,NULL),
 (8,1,3,NULL,'Despliegue en el servidor del cliente',NULL,'administrativa','pendiente','alta',5,DATE_ADD(CURDATE(),INTERVAL 20 DAY),8,0,NULL,NULL,NULL),
 (9,1,NULL,1,'Corregir cálculo de descuento por volumen',NULL,'correccion','en_progreso','media',2,DATE_ADD(CURDATE(),INTERVAL 1 DAY),4,60,NULL,NULL,NULL),
 -- BLT-02
 (10,2,4,NULL,'Prototipo de alta fidelidad',NULL,'feature','completada','alta',4,DATE_SUB(CURDATE(),INTERVAL 15 DAY),30,100,NULL,NULL,DATE_SUB(NOW(),INTERVAL 14 DAY)),
 (11,2,5,2,'Autenticación con el core bancario','Requiere certificado del banco.','feature','bloqueada','critica',2,DATE_SUB(CURDATE(),INTERVAL 6 DAY),20,20,'Esperando que el banco habilite el certificado del ambiente de pruebas.',DATE_SUB(NOW(),INTERVAL 9 DAY),NULL),
 (12,2,5,2,'Pantalla de selección de agencia y horario',NULL,'feature','en_progreso','alta',3,DATE_ADD(CURDATE(),INTERVAL 2 DAY),18,55,NULL,NULL,NULL),
 (13,2,5,2,'Notificaciones push de recordatorio',NULL,'feature','pendiente','media',2,DATE_ADD(CURDATE(),INTERVAL 6 DAY),12,0,NULL,NULL,NULL),
 (14,2,5,2,'Empaquetado y subida a TestFlight',NULL,'administrativa','pendiente','critica',5,DATE_ADD(CURDATE(),INTERVAL 2 DAY),6,0,NULL,NULL,NULL),
 (15,2,NULL,NULL,'Plan de pruebas de la beta',NULL,'documentacion','pendiente','media',6,DATE_ADD(CURDATE(),INTERVAL 4 DAY),8,0,NULL,NULL,NULL),
 -- CSE-03 (estancado)
 (16,3,6,NULL,'Levantamiento con el personal médico',NULL,'investigacion','en_progreso','alta',2,DATE_SUB(CURDATE(),INTERVAL 50 DAY),20,40,NULL,NULL,NULL),
 (17,3,6,NULL,'Diseño del modelo de historia clínica',NULL,'feature','pendiente','alta',2,DATE_SUB(CURDATE(),INTERVAL 30 DAY),24,0,NULL,NULL,NULL),
 (18,3,NULL,NULL,'Definir política de resguardo de datos',NULL,'documentacion','pendiente','critica',1,DATE_SUB(CURDATE(),INTERVAL 20 DAY),8,0,NULL,NULL,NULL),
 -- VRD-04
 (19,4,7,NULL,'Redactar los tres casos de éxito',NULL,'documentacion','en_progreso','media',4,DATE_ADD(CURDATE(),INTERVAL 6 DAY),12,70,NULL,NULL,NULL),
 (20,4,7,NULL,'Maquetar la página de inicio',NULL,'feature','completada','media',3,DATE_SUB(CURDATE(),INTERVAL 10 DAY),16,100,NULL,NULL,DATE_SUB(NOW(),INTERVAL 9 DAY)),
 (21,4,NULL,NULL,'Sesión de fotos del equipo',NULL,'administrativa','pendiente','baja',4,DATE_ADD(CURDATE(),INTERVAL 20 DAY),4,0,NULL,NULL,NULL),
 -- AND-05
 (22,5,NULL,NULL,'Definir los indicadores con la gerencia',NULL,'investigacion','en_progreso','alta',1,DATE_ADD(CURDATE(),INTERVAL 7 DAY),10,30,NULL,NULL,NULL),
 (23,5,NULL,NULL,'Conectar el origen de datos del ERP',NULL,'feature','pendiente','alta',2,DATE_ADD(CURDATE(),INTERVAL 25 DAY),16,0,NULL,NULL,NULL),
 -- NOV-06
 (24,6,NULL,NULL,'Armar la propuesta económica',NULL,'administrativa','pendiente','media',1,DATE_ADD(CURDATE(),INTERVAL 4 DAY),6,0,NULL,NULL,NULL);

-- Cadena de bloqueo: 4 frena a 5, 6, 7 y 8. Y 11 frena a 14.
INSERT INTO tarea_dependencias (tarea_id, depende_de_id, tipo) VALUES
 (5,4,'bloquea'),(6,4,'bloquea'),(7,4,'bloquea'),(8,7,'bloquea'),
 (14,11,'bloquea'),(15,12,'relacionada'),(17,16,'bloquea'),(23,22,'bloquea');

INSERT INTO tarea_etiquetas (tarea_id, etiqueta_id) VALUES
 (4,3),(4,4),(11,3),(11,4),(14,1),(18,1);

INSERT INTO tarea_habilidades_requeridas (tarea_id, habilidad_id, nivel_minimo) VALUES
 (4,12,4),(4,5,4),(5,9,4),(11,12,4),(11,25,3),(12,13,3),(14,16,3),(23,19,3);

-- ------------------------------------------------------------------- ASUNTOS
INSERT INTO asuntos
 (id, proyecto_id, tarea_id, categoria_asunto_id, codigo, titulo, descripcion, tipo, severidad, impacto,
  estado, reportado_por_id, asignado_a_id, es_recurrente, fecha_reporte, fecha_objetivo, fecha_resolucion, causa_raiz) VALUES
 (1,1,4,4,'AND-01-A1','Proveedor de pagos no entrega credenciales de producción',
  'Se solicitaron hace dos semanas. Sin ellas no se puede cerrar el hito de pagos.','bloqueo','critica','alto',
  'en_espera',1,1,1,DATE_SUB(NOW(),INTERVAL 13 DAY),DATE_SUB(CURDATE(),INTERVAL 5 DAY),NULL,'Dependencia de un tercero sin acuerdo de nivel de servicio'),
 (2,1,NULL,7,'AND-01-A2','El cliente pidió descuentos por volumen escalonados',
  'No estaba en el alcance original.','solicitud_cambio','media','medio','en_progreso',7,2,0,
  DATE_SUB(NOW(),INTERVAL 9 DAY),DATE_ADD(CURDATE(),INTERVAL 3 DAY),NULL,NULL),
 (3,1,NULL,3,'AND-01-A3','El catálogo tarda más de 6 segundos con 4000 productos',
  NULL,'bug','alta','alto','pendiente',6,3,0,DATE_SUB(NOW(),INTERVAL 5 DAY),DATE_ADD(CURDATE(),INTERVAL 7 DAY),NULL,NULL),
 (4,2,11,4,'BLT-02-A1','El banco no habilita el certificado del ambiente de pruebas',
  'Tercera solicitud enviada. Bloquea la beta comprometida.','bloqueo','critica','alto','en_espera',1,1,1,
  DATE_SUB(NOW(),INTERVAL 9 DAY),DATE_SUB(CURDATE(),INTERVAL 2 DAY),NULL,'Dependencia de un tercero sin acuerdo de nivel de servicio'),
 (5,2,NULL,8,'BLT-02-A2','La fecha de beta no es alcanzable con el bloqueo actual',
  'Quedan 9 días y la autenticación no ha arrancado.','riesgo','critica','alto','pendiente',1,1,0,
  DATE_SUB(NOW(),INTERVAL 3 DAY),NULL,NULL,NULL),
 (6,2,NULL,5,'BLT-02-A3','Falta definir qué pasa si el usuario no asiste a la cita',
  NULL,'pregunta','media','medio','pendiente',4,8,0,DATE_SUB(NOW(),INTERVAL 7 DAY),NULL,NULL,NULL),
 (7,3,NULL,4,'CSE-03-A1','La clínica no ha asignado un médico de contacto',
  'Sin interlocutor no se puede validar el modelo de datos.','bloqueo','alta','alto','en_espera',2,1,1,
  DATE_SUB(NOW(),INTERVAL 40 DAY),NULL,NULL,'Dependencia de un tercero sin acuerdo de nivel de servicio'),
 (8,3,NULL,9,'CSE-03-A2','Falta definir el tratamiento de datos sensibles de pacientes',
  NULL,'riesgo','critica','alto','pendiente',1,1,0,DATE_SUB(NOW(),INTERVAL 35 DAY),NULL,NULL,NULL),
 (9,4,NULL,10,'VRD-04-A1','Aprovechar el rediseño para medir conversión',
  NULL,'incidencia','baja','bajo','pendiente',4,4,0,DATE_SUB(NOW(),INTERVAL 6 DAY),NULL,NULL,NULL),
 (10,1,NULL,6,'AND-01-A4','Las validaciones de formulario están duplicadas en cliente y servidor',
  NULL,'deuda_tecnica','media','medio','pendiente',2,3,0,DATE_SUB(NOW(),INTERVAL 18 DAY),NULL,NULL,NULL),
 (11,7,NULL,1,'CSE-07-A1','Los PDF no abrían en Safari','Resuelto antes del cierre.','bug','media','medio',
  'resuelto',6,2,0,DATE_SUB(NOW(),INTERVAL 60 DAY),NULL,DATE_SUB(NOW(),INTERVAL 55 DAY),NULL),
 (12,5,NULL,5,'AND-05-A1','No está claro de dónde sale el dato de rotación de inventario',
  NULL,'pregunta','media','medio','pendiente',1,7,0,DATE_SUB(NOW(),INTERVAL 6 DAY),NULL,NULL,NULL);

-- --------------------------------------------------------------- COMENTARIOS
INSERT INTO comentarios (entidad_tipo, entidad_id, autor_id, contenido, es_decision, creado_en) VALUES
 ('proyecto',1,1,'Decidimos seguir maquetando la pantalla de pago con datos simulados mientras llegan las credenciales, para no perder la semana.',1,DATE_SUB(NOW(),INTERVAL 11 DAY)),
 ('proyecto',1,7,'La gerencia quiere el portal andando antes del cierre de trimestre.',0,DATE_SUB(NOW(),INTERVAL 8 DAY)),
 ('tarea',4,2,'El proveedor respondió que el trámite tarda entre 10 y 15 días hábiles.',0,DATE_SUB(NOW(),INTERVAL 6 DAY)),
 ('proyecto',2,1,'Acordamos con Patricia que si el certificado no llega el viernes, movemos la beta dos semanas.',1,DATE_SUB(NOW(),INTERVAL 4 DAY)),
 ('proyecto',3,2,'Sin médico de contacto no tiene sentido seguir. Propongo pausar formalmente.',1,DATE_SUB(NOW(),INTERVAL 34 DAY)),
 ('proyecto',4,4,'Los casos de éxito quedaron mejor de lo esperado, vale la pena empujar este proyecto.',0,DATE_SUB(NOW(),INTERVAL 5 DAY));

-- ------------------------------------------------------------------ BITÁCORA
INSERT INTO bitacora (entidad_tipo, entidad_id, proyecto_id, accion, campo, valor_anterior, valor_nuevo, actor_id, creado_en) VALUES
 ('tarea',3,1,'cambio_estado','estado','en_progreso','completada',3,DATE_SUB(NOW(),INTERVAL 22 DAY)),
 ('tarea',4,1,'cambio_estado','estado','en_progreso','bloqueada',2,DATE_SUB(NOW(),INTERVAL 13 DAY)),
 ('asunto',1,1,'crear',NULL,NULL,'Proveedor de pagos no entrega credenciales',1,DATE_SUB(NOW(),INTERVAL 13 DAY)),
 ('tarea',9,1,'cambio_estado','estado','pendiente','en_progreso',2,DATE_SUB(NOW(),INTERVAL 2 DAY)),
 ('asunto',3,1,'crear',NULL,NULL,'Catálogo lento con 4000 productos',6,DATE_SUB(NOW(),INTERVAL 5 DAY)),
 ('tarea',10,2,'cambio_estado','estado','en_revision','completada',4,DATE_SUB(NOW(),INTERVAL 14 DAY)),
 ('tarea',11,2,'cambio_estado','estado','pendiente','bloqueada',2,DATE_SUB(NOW(),INTERVAL 9 DAY)),
 ('asunto',5,2,'crear',NULL,NULL,'Riesgo de incumplir la fecha de beta',1,DATE_SUB(NOW(),INTERVAL 3 DAY)),
 ('tarea',12,2,'actualizar','progreso_pct','30','55',3,DATE_SUB(NOW(),INTERVAL 2 DAY)),
 ('tarea',16,3,'cambio_estado','estado','pendiente','en_progreso',2,DATE_SUB(NOW(),INTERVAL 52 DAY)),
 ('proyecto',3,3,'cambio_estado','estado','en_progreso','en_pausa',1,DATE_SUB(NOW(),INTERVAL 34 DAY)),
 ('tarea',19,4,'actualizar','progreso_pct','40','70',4,DATE_SUB(NOW(),INTERVAL 5 DAY)),
 ('tarea',22,5,'cambio_estado','estado','pendiente','en_progreso',1,DATE_SUB(NOW(),INTERVAL 6 DAY));

-- ------------------------------------------------------- SNAPSHOTS SEMANALES
INSERT INTO metricas_snapshot
 (proyecto_id, fecha, progreso_pct, tareas_total, tareas_completadas, tareas_bloqueadas,
  tareas_vencidas, asuntos_abiertos, asuntos_criticos, dias_sin_movimiento, salud) VALUES
 (1,DATE_SUB(CURDATE(),INTERVAL 35 DAY),22,8,1,0,0,1,0,1,'verde'),
 (1,DATE_SUB(CURDATE(),INTERVAL 28 DAY),30,9,2,0,0,2,0,1,'verde'),
 (1,DATE_SUB(CURDATE(),INTERVAL 21 DAY),41,9,3,0,0,2,0,2,'verde'),
 (1,DATE_SUB(CURDATE(),INTERVAL 14 DAY),45,9,3,1,0,3,1,1,'amarillo'),
 (1,DATE_SUB(CURDATE(),INTERVAL 7 DAY),47,9,3,1,1,4,1,1,'amarillo'),
 (2,DATE_SUB(CURDATE(),INTERVAL 28 DAY),12,5,0,0,0,1,0,2,'verde'),
 (2,DATE_SUB(CURDATE(),INTERVAL 21 DAY),20,6,1,0,0,1,0,1,'verde'),
 (2,DATE_SUB(CURDATE(),INTERVAL 14 DAY),28,6,1,0,0,2,0,2,'amarillo'),
 (2,DATE_SUB(CURDATE(),INTERVAL 7 DAY),30,6,1,1,1,3,1,2,'rojo'),
 (3,DATE_SUB(CURDATE(),INTERVAL 28 DAY),22,3,0,0,2,2,1,20,'rojo'),
 (3,DATE_SUB(CURDATE(),INTERVAL 14 DAY),22,3,0,0,3,2,1,27,'rojo'),
 (3,DATE_SUB(CURDATE(),INTERVAL 7 DAY),22,3,0,0,3,2,1,34,'rojo'),
 (4,DATE_SUB(CURDATE(),INTERVAL 14 DAY),50,3,1,0,0,1,0,3,'verde'),
 (4,DATE_SUB(CURDATE(),INTERVAL 7 DAY),62,3,1,0,0,1,0,4,'verde');

-- --------------------------------------------------- PATRONES YA DETECTADOS
-- Simula que el sistema ya corrió antes y acumuló memoria.
INSERT INTO patrones_detectados (clave, nombre, descripcion, tipo, ambito, evidencia_json, frecuencia, confianza, recomendacion, primera_deteccion) VALUES
 ('bloqueo_credenciales_terceros','Los bloqueos por credenciales de terceros se repiten',
  'Tres proyectos distintos se han detenido esperando accesos que dependen de un cliente o proveedor, sin fecha comprometida.',
  'riesgo_recurrente','global','{"proyecto_ids":[1,2,3],"asunto_ids":[1,4,7]}',3,0.78,
  'Pedir credenciales y accesos como primera tarea del proyecto, con fecha comprometida en el contrato.',
  DATE_SUB(NOW(),INTERVAL 21 DAY));
