import 'server-only';
import { filas } from '@/db';

/** Un asistente de la reunión: alguien del sistema o un invitado externo. */
export interface FilaParticipante {
  persona_id: number | null;
  nombre: string | null;
  email: string | null;
}

export interface FilaReunion {
  id: number;
  instancia_id: number;
  proyecto_id: number;
  proyecto: string;
  titulo: string;
  objetivo: string | null;
  agenda: string | null;
  organizador_id: number | null;
  organizador: string | null;
  modalidad: string;
  ubicacion: string | null;
  enlace: string | null;
  zona_horaria: string;
  inicio: string;
  fin: string;
  duracion_minutos: number;
  estado: string;
  recurrencia: string;
  recurrencia_hasta: string | null;
  /** JSON agregado por MySQL; null cuando la reunión no tiene a nadie. */
  participantes: FilaParticipante[] | null;
  minuta_id: number | null;
  notas: string | null;
  resumen: string | null;
  minuta_estado: string | null;
}

/**
 * Agenda: una fila por OCURRENCIA, no por serie. Trae también lo que necesita
 * el diálogo de edición (organizador, duración, recurrencia, participantes)
 * para no tener que pedirlo aparte al abrirlo.
 *
 * Las fechas salen con `DATE_FORMAT` y sin zona: se guardan como reloj de pared
 * y `zona_horaria` dice cómo leerlas (ver `acciones/reuniones.ts`).
 */
export const reunionesAgenda = (proyectoId?: number) => filas<FilaReunion>(`
  SELECT r.id, i.id instancia_id, r.proyecto_id, p.nombre proyecto,
         r.titulo, r.objetivo, r.agenda,
         r.organizador_id, CONCAT_WS(' ', og.nombre, og.apellido) organizador,
         r.modalidad, r.ubicacion, r.enlace, r.zona_horaria,
         DATE_FORMAT(i.inicio, '%Y-%m-%dT%H:%i:%s') inicio,
         DATE_FORMAT(i.fin,    '%Y-%m-%dT%H:%i:%s') fin,
         r.duracion_minutos, i.estado, r.recurrencia, r.recurrencia_hasta,
         (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                   'persona_id', rp.persona_id,
                   -- NULLIF: CONCAT_WS con todo NULL devuelve '', no NULL.
                   'nombre', COALESCE(NULLIF(CONCAT_WS(' ', pe.nombre, pe.apellido), ''), rp.nombre_externo),
                   'email',  COALESCE(pe.email, rp.email_externo)))
            FROM reunion_participantes rp
            LEFT JOIN personas pe ON pe.id = rp.persona_id
           WHERE rp.reunion_id = r.id) participantes,
         m.id minuta_id, m.notas, m.resumen, m.estado minuta_estado
    FROM reunion_instancias i
    JOIN reuniones r ON r.id = i.reunion_id
    JOIN proyectos p ON p.id = r.proyecto_id
    LEFT JOIN personas og ON og.id = r.organizador_id
    LEFT JOIN reunion_minutas m ON m.instancia_id = i.id
   WHERE (? IS NULL OR r.proyecto_id = ?)
     AND i.inicio >= DATE_SUB(NOW(), INTERVAL 90 DAY)
   ORDER BY i.inicio
   LIMIT 250`, [proyectoId ?? null, proyectoId ?? null]);

export interface FilaImpacto { id:number; proyecto_id:number; proyecto:string; tipo:'oportunidad'|'riesgo'; titulo:string; descripcion:string|null; probabilidad:number; impacto:number; responsable:string|null; evidencia:string|null; plan_accion:string|null; fecha_objetivo:string|null; estado:string; origen:string }
export const impactosProyectoConsulta = (proyectoId?: number) => filas<FilaImpacto>(`SELECT x.*,p.nombre proyecto,CONCAT_WS(' ',pe.nombre,pe.apellido) responsable FROM impactos_proyecto x JOIN proyectos p ON p.id=x.proyecto_id LEFT JOIN personas pe ON pe.id=x.responsable_id WHERE (? IS NULL OR x.proyecto_id=?) ORDER BY x.probabilidad*x.impacto DESC,x.actualizado_en DESC`, [proyectoId ?? null, proyectoId ?? null]);

export interface FilaAprendizaje { id:number; proyecto_id:number; proyecto:string; reunion:string; tipo:string; titulo:string; detalle:string|null; polaridad:string; evidencia:string|null; estado:string; creado_en:string }
export const aprendizajesConsulta = (proyectoId?: number) => filas<FilaAprendizaje>(`SELECT e.id,r.proyecto_id,p.nombre proyecto,r.titulo reunion,e.tipo,e.titulo,e.detalle,e.polaridad,e.evidencia,e.estado,DATE_FORMAT(e.creado_en,'%Y-%m-%d') creado_en
  FROM reunion_elementos e JOIN reunion_minutas m ON m.id=e.minuta_id JOIN reunion_instancias i ON i.id=m.instancia_id JOIN reuniones r ON r.id=i.reunion_id JOIN proyectos p ON p.id=r.proyecto_id
  WHERE e.tipo IN ('aprendizaje','decision','resultado') AND (? IS NULL OR r.proyecto_id=?) ORDER BY e.creado_en DESC`, [proyectoId ?? null, proyectoId ?? null]);

export type TipoNodo = 'proyecto'|'tarea'|'persona'|'hito'|'reunion'|'aprendizaje'|'impacto';
export interface GraphNode { id:string; type:TipoNodo; label:string; status:string|null; projectId:number|null; url:string; metadata:Record<string,unknown> }
export interface GraphEdge { id:string; source:string; target:string; type:string; origin:'derivada'|'manual'|'ia'; weight:number; evidence:string|null; editable:boolean }
export interface GrafoDto { nodes:GraphNode[]; edges:GraphEdge[] }

export async function grafoOperacion(proyectoId?: number, limite=250): Promise<GrafoDto> {
  const filtro = proyectoId ? 'WHERE p.id = ?' : 'WHERE p.archivado=0'; const params = proyectoId ? [proyectoId] : [];
  const [ps,ts,hs,rs,is,rels] = await Promise.all([
    filas<any>(`SELECT p.id,p.nombre,p.estado FROM proyectos p ${filtro} LIMIT ?`, [...params,limite]),
    filas<any>(`SELECT t.id,t.proyecto_id,t.titulo,t.estado,t.responsable_id,t.hito_id FROM tareas t JOIN proyectos p ON p.id=t.proyecto_id ${filtro} AND t.estado<>'cancelada' LIMIT ?`, [...params,limite]),
    filas<any>(`SELECT h.id,h.proyecto_id,h.nombre,h.estado FROM hitos h JOIN proyectos p ON p.id=h.proyecto_id ${filtro} LIMIT ?`, [...params,limite]),
    filas<any>(`SELECT r.id,r.proyecto_id,r.titulo,r.estado FROM reuniones r JOIN proyectos p ON p.id=r.proyecto_id ${filtro} LIMIT ?`, [...params,limite]),
    filas<any>(`SELECT x.id,x.proyecto_id,x.titulo,x.estado,x.tipo FROM impactos_proyecto x JOIN proyectos p ON p.id=x.proyecto_id ${filtro} LIMIT ?`, [...params,limite]),
    filas<any>(`SELECT * FROM relaciones_semanticas WHERE estado='validada' LIMIT ?`, [limite]),
  ]);
  const nodes:GraphNode[]=[]; const edges:GraphEdge[]=[]; const add=(type:TipoNodo,x:any,label:string,url:string)=>nodes.push({id:`${type}:${x.id}`,type,label,status:x.estado??null,projectId:x.proyecto_id??(type==='proyecto'?x.id:null),url,metadata:x});
  ps.forEach((x:any)=>add('proyecto',x,x.nombre,`/proyectos/${x.id}`)); ts.forEach((x:any)=>{add('tarea',x,x.titulo,`/proyectos/${x.proyecto_id}`);edges.push({id:`p-t-${x.id}`,source:`proyecto:${x.proyecto_id}`,target:`tarea:${x.id}`,type:'contiene',origin:'derivada',weight:1,evidence:null,editable:false});if(x.hito_id)edges.push({id:`h-t-${x.id}`,source:`hito:${x.hito_id}`,target:`tarea:${x.id}`,type:'agrupa',origin:'derivada',weight:1,evidence:null,editable:false});});
  hs.forEach((x:any)=>{add('hito',x,x.nombre,`/proyectos/${x.proyecto_id}`);edges.push({id:`p-h-${x.id}`,source:`proyecto:${x.proyecto_id}`,target:`hito:${x.id}`,type:'planifica',origin:'derivada',weight:1,evidence:null,editable:false});});
  rs.forEach((x:any)=>{add('reunion',x,x.titulo,`/agenda`);edges.push({id:`p-r-${x.id}`,source:`proyecto:${x.proyecto_id}`,target:`reunion:${x.id}`,type:'reunion',origin:'derivada',weight:1,evidence:null,editable:false});});
  is.forEach((x:any)=>{add('impacto',x,x.titulo,`/proyectos/${x.proyecto_id}`);edges.push({id:`p-i-${x.id}`,source:`impacto:${x.id}`,target:`proyecto:${x.proyecto_id}`,type:x.tipo==='oportunidad'?'potencia':'amenaza',origin:'derivada',weight:(x.probabilidad??3)*(x.impacto??3)/25,evidence:null,editable:false});});
  const ids=new Set(nodes.map((n)=>n.id)); rels.forEach((x:any)=>{const s=`${x.origen_tipo}:${x.origen_id}`,t=`${x.destino_tipo}:${x.destino_id}`;if(ids.has(s)&&ids.has(t))edges.push({id:`s-${x.id}`,source:s,target:t,type:x.tipo,origin:x.origen,weight:Number(x.peso),evidence:x.evidencia,editable:true});});
  return {nodes:nodes.slice(0,limite),edges};
}
