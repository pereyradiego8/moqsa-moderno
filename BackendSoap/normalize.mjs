/** Normalización flexible: el contrato original usa PrincipalJson con propiedades en español. */
function value(obj, ...names) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const n of names) {
    const key=Object.keys(obj).find(k=>k.toLowerCase()===n.toLowerCase());
    if (key && obj[key]!==undefined && obj[key]!==null) return obj[key];
  }
  return undefined;
}
const asString=(v)=>v==null?'':String(v);
export function parseResponse(raw) {
  if (typeof raw!=='string') return raw;
  const t=raw.trim();if(!t)return {};
  try {const p=JSON.parse(t);return typeof p==='string'?parseResponse(p):p;} catch {return {MensajeEstado:t};}
}
function getCollection(payload, names) {
  // Permite {Lineas:[...]}, {Principal:{Lineas:[...]}}, arrays o incluso un único objeto.
  if(Array.isArray(payload))return payload;
  if(!payload||typeof payload!=='object')return [];
  let group=value(payload,...names);
  if(group===undefined && Object.keys(payload).length===1){
    let only=payload[Object.keys(payload)[0]];
    if(only&&typeof only==='object')return getCollection(only,names);
  }
  if(typeof group==='string'){try{group=JSON.parse(group);}catch{return [];}}
  if(Array.isArray(group))return group;
  if(group && typeof group==='object')return [group];
  return [];
}
export function normalize(kind, payload){
  const keys={
    lineas:['Lineas','Linea','lineas'],calles:['Calles','Calle','calles'],
    intersecciones:['Calles','Intersecciones','Interseccion'],
    paradas:['Parada','Paradas'],cercanas:['Parada','Paradas'],
    arribos:['Arribos','Arribo'],recorrido:['Puntos','Recorrido'],recargas:['Puntos','PuntosRecarga']
  };
  const rows=getCollection(payload,keys[kind]||['items']);
  return rows.map(item=>{
    const o=typeof item==='object'&&item!==null?item:{descripcion:String(item)};
    if(kind==='lineas')return {
      id:asString(value(o,'CodigoLineaParada','codigo','Codigo')),
      nombre:asString(value(o,'Descripcion','descripcion','nombre'))
    };
    if(kind==='calles'||kind==='intersecciones')return {
      id:asString(value(o,'Codigo','codigo')),
      nombre:asString(value(o,'Descripcion','descripcion','nombre'))
    };
    if(kind==='paradas'||kind==='cercanas')return {
      id:asString(value(o,'Codigo','codigo','Identificador')),
      identificador:asString(value(o,'Identificador','identificador','Codigo')),
      nombre:asString(value(o,'Descripcion','descripcion','CallePrincipal','Identificador')),
      detalle:[value(o,'CallePrincipal'),value(o,'CalleInterseccion')].filter(Boolean).join(' y '),
      lat:number(value(o,'Latitud','latitud')),lon:number(value(o,'Longitud','longitud'))
    };
    if(kind==='arribos')return {
      linea:asString(value(o,'DescripcionLinea','Linea','linea')),
      destino:asString(value(o,'DescripcionBandera','Destino','Bandera')),
      arribo:asString(value(o,'Arribo','arribo','Tiempo')),
      lat:number(value(o,'Latitud','latitud')),lon:number(value(o,'Longitud','longitud')),
      latParada:number(value(o,'LatParada','latParada')),lonParada:number(value(o,'LongParada','longParada'))
    };
    if(kind==='recorrido'||kind==='recargas')return {
      id:asString(value(o,'Codigo','codigo')),
      nombre:asString(value(o,'Descripcion','descripcion')),
      lat:number(value(o,'Latitud','latitud')),lon:number(value(o,'Longitud','longitud'))
    };
    return o;
  }).filter((v)=>kind==='arribos' || Boolean(v.nombre||v.id));
}
function number(v){const n=Number(v);return v===undefined||v===null||v===''||!Number.isFinite(n)?null:n;}
export function message(payload){return asString(value(payload,'MensajeEstado','mensajeEstado','mensaje'))||'';}
