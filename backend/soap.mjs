import {parseResponse} from './normalize.mjs';
const SOAP_NS='http://clsw.smartmovepro.net/';
const RECHARGE_NS='http://serviciosWebSms.efibus.com.ar/';
export const OPERATIONS={
 lineas:{op:'RecuperarLineaPorEntidad',query:[],env:['codigoEntidadSMP']},
 calles:{op:'RecuperarCallesPrincipalPorLinea',query:['linea']},
 intersecciones:{op:'RecuperarInterseccionPorLineaYCalle',query:['linea','calle']},
 paradas:{op:'RecuperarParadasPorLineaCalleEInterseccion',query:['linea','calle','interseccion']},
 cercanas:{op:'RecuperarParadasMasCercanasPorLocalidadProvinciaPais',query:['lat','lon']},
 arribos:{op:'RecuperarProximosArribos',query:['parada','linea']},
 recorrido:{op:'RecuperarRecorridoParaMapaAbrevYAmpliPorEntidadYLinea',query:['linea']},
 recargas:{op:'RecuperarPuntosDeRecargaCercanos',query:['lat','lon']}
};
const escapeXml=(input)=>String(input??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function env(k){return (process.env[k]||'').trim();}
function opParams(kind,q){
 switch(kind){
  case 'lineas':return {codigoEntidadSMP:env('SOAP_ENTITY')};
  case 'calles':return {codigoLineaParada:q.linea};
  case 'intersecciones':return {codigoLineaParada:q.linea,codigoCalle:q.calle};
  case 'paradas':return {codigoLinea:q.linea,codigoCalle:q.calle,codigoInterseccion:q.interseccion};
  case 'cercanas':return {latitud:q.lat,longitud:q.lon,listaCodigosEmpresa:env('SOAP_COMPANIES')||'191,7',descripcionProvincia:'BUENOS AIRES',descripcionPais:'ARGENTINA'};
  case 'arribos':return {identificadorParada:q.parada,codigoLineaParada:q.linea,codigoAplicacion:env('SOAP_APP_CODE'),localidad:env('SOAP_CITY')||'QUILMES'};
  case 'recorrido':return {codigoLineaParada:q.linea};
  case 'recargas':return {latitudString:q.lat,longitudString:q.lon};
  default:throw new Error('Operación no configurada');
 }
}
export function envelope(method, params, ns=SOAP_NS){const body=Object.entries(params).map(([k,v])=>`<${k}>${escapeXml(v)}</${k}>`).join('');
 return `<?xml version="1.0" encoding="utf-8"?>`+
 `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">`+
 `<soap:Body><${method} xmlns="${ns}">${body}</${method}></soap:Body></soap:Envelope>`;
}
function unescapeXML(s){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&apos;/gi,"'").replace(/&amp;/gi,'&');}
export function parseSoapXml(xml, method){
 // El XML contiene exactamente un nodo <OperaciónResult>, generalmente con JSON como texto escapado.
 const safe=method.replace(/[^\w]/g,'');const result=new RegExp(`<(?:(?:\\w+):)?${safe}Result(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${safe}Result\\s*>`,'i').exec(xml);
 if(!result)throw new Error('Respuesta SOAP sin resultado esperado');
 return parseResponse(unescapeXML(result[1]));
}
export class BackendError extends Error {constructor(status,msg){super(msg);this.status=status;}}
export async function callSoap(kind,query){
 const operation=OPERATIONS[kind];if(!operation)throw new BackendError(404,'Operación desconocida');
 if(kind==='lineas'&&!env('SOAP_ENTITY'))throw new BackendError(503,'Falta configurar el número de entidad que utiliza el APK original');
 const recharge=kind==='recargas';
 const endpoint=env(recharge?'SOAP_RECHARGE_ENDPOINT':'SOAP_ENDPOINT');
 const user=env(recharge?'SOAP_RECHARGE_USER':'SOAP_USER');
 const password=env(recharge?'SOAP_RECHARGE_PASSWORD':'SOAP_PASSWORD');
 const ns=recharge?RECHARGE_NS:SOAP_NS;
 if(!endpoint||!user||!password)throw new BackendError(503,'Servicio aún no configurado por el administrador');
 let url;try{url=new URL(endpoint);}catch{throw new BackendError(503,'URL del servidor SOAP inválida');}
 if(!['https:','http:'].includes(url.protocol))throw new BackendError(503,'Protocolo SOAP no permitido');
 if(url.protocol==='http:'&&env('ALLOW_LEGACY_HTTP')!=='true')throw new BackendError(503,'HTTP legado deshabilitado: solicitar endpoint HTTPS');
 if(!operation.query.every(k=>query[k]!==undefined))throw new BackendError(400,'Faltan parámetros de consulta');
 const params=recharge?{...opParams(kind,query),userID:user,clave:password}:
   kind==='lineas'?{usuario:user,clave:password,...opParams(kind,query)}:{...opParams(kind,query),usuario:user,clave:password};
 const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),9500);
 try{
  const resp=await fetch(endpoint,{method:'POST',headers:{'content-type':'text/xml; charset=utf-8','SOAPAction':`"${ns}${operation.op}"`,'Accept':'text/xml'},body:envelope(operation.op,params,ns),signal:ctrl.signal,redirect:'error'});
  if(!resp.ok)throw new BackendError(502,'El servicio de transporte no respondió correctamente');
  const text=await resp.text();if(text.length>900_000)throw new BackendError(502,'Respuesta del servidor demasiado extensa');
  return parseSoapXml(text,operation.op);
 }catch(e){if(e instanceof BackendError)throw e;throw new BackendError(502,e?.name==='AbortError'?'El servicio superó el tiempo de espera':'No fue posible conectar con el servicio');}
 finally{clearTimeout(timeout);}
}
