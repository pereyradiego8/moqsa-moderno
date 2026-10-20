import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {callSoap,BackendError} from './soap.mjs';
import {normalize,message} from './normalize.mjs';

const cache=new Map(),visits=new Map();
const ttl={lineas:600000,calles:900000,intersecciones:600000,paradas:120000,cercanas:20000,arribos:12000,recorrido:3600000,recargas:60000};
function json(res,status,obj){const body=JSON.stringify(obj);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(body);}
function validate(kind,params){
 const fields={lineas:[],calles:['linea'],intersecciones:['linea','calle'],paradas:['linea','calle','interseccion'],cercanas:['lat','lon'],arribos:['parada','linea'],recorrido:['linea'],recargas:['lat','lon']};
 if(!fields[kind])throw new BackendError(404,'Ruta inexistente');
 const q={};for(const k of fields[kind]){
  const v=params.get(k);if(!v||v.length>90||!/^[\p{L}\p{N}., _-]+$/u.test(v))throw new BackendError(400,'Parámetro inválido: '+k);q[k]=v;
 }
 if(kind==='cercanas'||kind==='recargas'){
   const lat=Number(q.lat),lon=Number(q.lon);
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180)throw new BackendError(400,'Coordenadas inválidas');
 }
 return q;
}
function ratelimit(ip){const now=Date.now();let s=visits.get(ip);if(!s||now-s.since>60000)s={since:now,count:0};s.count++;visits.set(ip,s);if(s.count>100)throw new BackendError(429,'Demasiadas solicitudes, intentá en un minuto');if(visits.size>5000)visits.clear();}
export async function handler(req,res){
 try{
  if(req.method!=='GET')throw new BackendError(405,'Método no admitido');
  if((req.url||'').length>2000)throw new BackendError(414,'URL muy larga');
  const url=new URL(req.url||'/', 'http://localhost');
  if(url.pathname==='/health'){json(res,200,{ok:true,service:'CuandoLlega API',configured:Boolean(process.env.SOAP_ENDPOINT&&process.env.SOAP_USER&&process.env.SOAP_PASSWORD&&process.env.SOAP_ENTITY)});return;}
  const match=/^\/v1\/(lineas|calles|intersecciones|paradas|cercanas|arribos|recorrido|recargas)$/.exec(url.pathname);
  if(!match)throw new BackendError(404,'Ruta inexistente');
  const kind=match[1];ratelimit(req.socket?.remoteAddress||'unknown');
  const query=validate(kind,url.searchParams);const key=kind+JSON.stringify(query),hit=cache.get(key);const now=Date.now();
  if(hit &&hit.expires>now){json(res,200,hit.value);return;}
  const payload=await callSoap(kind,query);
  const result={ok:true,items:normalize(kind,payload),mensaje:message(payload),retrievedAt:new Date().toISOString()};
  if(cache.size>1200)cache.clear();cache.set(key,{expires:now+ttl[kind],value:result});
  json(res,200,result);
 }catch(e){const status=e instanceof BackendError?e.status:502;json(res,status,{ok:false,error:e instanceof BackendError?e.message:'No se pudo completar la consulta'});}
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
 const port=Number(process.env.PORT||8787);const host=process.env.HOST||'127.0.0.1';
 http.createServer(handler).listen(port,host,()=>console.log(`Servidor iniciado en ${host}:${port} (usar HTTPS en producción)`));
}
