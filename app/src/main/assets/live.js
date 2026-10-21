'use strict';
/* Nueva experiencia V3: datos de servicio, jamás líneas ni arribos simulados. */
const dataV3={lines:[],streets:[],crossings:[],stops:[],arrivals:[],route:[],line:null,locality:null,street:null,crossing:null,stop:null,nearby:[],nearLocation:null,nearError:'',nearLoading:false,error:'',loading:false,backend:'',mensaje:'',arrivalsChecked:false,diagnostico:null,diagnosticando:false};
const calls=new Map();let callNo=0;
function native(action,params={}){
 return new Promise((resolve,reject)=>{
  if(!window.AndroidApi){reject(Error('Abrí el APK Android para realizar consultas reales.'));return;}
  const id=++callNo,t=setTimeout(()=>{calls.delete(id);reject(Error('Se agotó el tiempo de espera de la consulta.'));},25000);
  calls.set(id,{resolve,reject,t});
  try{window.AndroidApi.call(id,action,JSON.stringify(params));}catch(e){clearTimeout(t);calls.delete(id);reject(e);}
 });
}
window.moqsaNativeResult=(id,response)=>{
 const call=calls.get(Number(id));if(!call)return;clearTimeout(call.t);calls.delete(Number(id));
 try{const p=JSON.parse(response);p.ok?call.resolve(p.data):call.reject(Error(p.error||'Servicio no disponible'));}
 catch(e){call.reject(e);}
};
const clean=v=>escapeHtml(String(v==null?'':v));
function item(row,detail,onclick,icon='bus'){
 return '<button class="row" onclick="'+onclick+'"><div class="glyph">'+I(icon)+'</div><div class="meta"><strong>'+clean(row)+'</strong><span>'+clean(detail)+'</span></div>'+I('chevron')+'</button>';
}
function feedback(){
 return (dataV3.loading?'<div class="card empty"><h3>Consultando servicio…</h3><p>Esperá un momento.</p></div>':'')+
 (dataV3.error?'<div class="card empty"><h3>No se pudo consultar el servidor original</h3><p>'+clean(dataV3.error)+'</p><button class="secondary" onclick="retryScreen()">Reintentar consulta</button></div>':'');
}
const empty=label=>'<div class="card empty"><h3>Sin '+clean(label)+'</h3><p>No hay resultados recibidos del servidor.</p></div>';
async function request(action,params,field){
 dataV3.loading=true;dataV3.error='';render();
 try{
  const resp=await native(action,params);
  if(!resp||!Array.isArray(resp.items))throw Error('Respuesta de API en formato inesperado');
  dataV3[field]=resp.items;dataV3.mensaje=String(resp.mensaje||'').trim();dataV3.loading=false;render();
 }catch(e){dataV3.loading=false;dataV3.mensaje='';dataV3.error=e.message||'Error de conexión';render();}
}
function retryScreen(){if(screen==='arrival')loadArrivals();else if(screen==='lines')loadLines();else if(screen==='stops'&&dataV3.line)request('streets',{linea:dataV3.line.id},'streets');}
function stopHeading(r){
 const direction=String(r.sentido||r.bandera||'').trim();
 const desc=String(r.nombre||'').trim();
 const ident=String(r.identificador||r.id||'').trim();
 if(direction)return /^hacia\s/i.test(direction)?direction:'Hacia '+direction;
 if(desc&&desc!==ident&&!/^MO-\d+/i.test(desc))return desc;
 return 'Sentido no informado';
}
function stopIdentifier(stop){
 const ident=String(stop?.identificador||'').trim();
 const internal=String(stop?.codigoInterno||stop?.id||'').trim();
 // En las compilaciones anteriores se copiaba "Codigo" al campo Identificador.
 // No enviar de nuevo el registro interno como identificador de llegada.
 if(!ident||(ident===internal&&/^\d+$/.test(ident)))return '';
 return ident;
}
function stopSubtitle(r){
 const id=stopIdentifier(r);
 const street=String(r.detalle||'').trim();
 const internal=String(r.codigoInterno||r.id||'').trim();
 return [street,id?'Parada '+id:internal?'Código interno '+internal+' · identificador no informado':'Identificador no informado'].filter(Boolean).join(' · ');
}
// Coordenadas exclusivas del SOAP original. Las teselas de OSM sólo son el fondo.
function validGeoPoint(v,label,type='stop'){
 const lat=Number(v?.lat),lon=Number(v?.lon);
 if(v?.lat==null||v?.lon==null||!Number.isFinite(lat)||!Number.isFinite(lon)||
    Math.abs(lat)>90||Math.abs(lon)>180||(lat===0&&lon===0))return null;
 return {lat,lon,nombre:String(label||v?.nombre||'Parada').slice(0,95),tipo:type};
}
function geoPoints(list,nameFn,type='stop'){
 return (Array.isArray(list)?list:[]).map((v,i)=>validGeoPoint(v,nameFn?nameFn(v,i):'',type)).filter(Boolean).slice(0,1200);
}
function currentStopPoint(){
 if(!dataV3.stop)return null;
 const label='Parada '+(stopIdentifier(dataV3.stop)||'seleccionada');
 const direct=validGeoPoint(dataV3.stop,label,'stop');
 if(direct)return direct;
 for(const arrival of dataV3.arrivals){
  const result=validGeoPoint({lat:arrival.latParada,lon:arrival.lonParada},label,'stop');
  if(result)return result;
 }
 return null;
}
function arrivalVehiclePoints(){
 return geoPoints(dataV3.arrivals,a=>
  (a.linea||dataV3.line?.nombre||'Colectivo')+' · '+
  (a.destino||'')+' · '+(a.arribo||''),'bus');
}
async function openMap(type,title,points){
 if(!points.length){toast('El servicio no informó coordenadas para este mapa');return;}
 try{await native('map.show',{type,title,points});}
 catch(e){toast('No se pudo abrir el mapa: '+String(e.message||'Error'));}
}
function openStopsMap(){
 const points=geoPoints(dataV3.stops,s=>stopHeading(s),'stop');
 openMap('stops','Paradas · '+String(dataV3.line?.nombre||''),points);
}
function openArrivalsMap(){
 if(!dataV3.stop)return;
 const stop=currentStopPoint();
 const vehicles=arrivalVehiclePoints();
 const points=[...(stop?[stop]:[]),...vehicles];
 openMap('stops','Próximas llegadas · '+String(dataV3.line?.nombre||''),points);
}
function openNearMap(){
 const me=validGeoPoint(dataV3.nearLocation,'Mi ubicación','user');
 const stops=geoPoints(dataV3.nearby,x=>stopHeading(x),'stop');
 openMap('stops','Paradas cercanas',[...(me?[me]:[]),...stops]);
}
function openRouteMap(){
 const points=geoPoints(dataV3.route,(v,i)=>v.nombre||'Punto '+String(i+1));
 openMap('route','Recorrido · '+String(dataV3.line?.nombre||''),points);
}
async function loadRoute(){
 if(!dataV3.line)return;
 dataV3.route=[];
 await request('route',{linea:dataV3.line.id},'route');
}
function mainV3(){
 return '<div class="greeting"><div class="eyebrow">TU VIAJE, MÁS SIMPLE</div><h2>¿A dónde<br>vamos hoy?</h2><p>Encontrá el colectivo y su parada sin perder tiempo.</p></div>'+
 '<form class="search-bar" onsubmit="event.preventDefault();queryLine()">'+I('search')+'<input id="lineQuery" placeholder="Buscar línea" aria-label="Buscar por número o nombre"/><button type="submit" aria-label="Buscar">'+I('arrow')+'</button></form>'+
 '<div class="hero"><div class="tag">'+I('clock')+' CONSULTA RÁPIDA</div><h3>¿Cuándo<br>llega mi cole?</h3><p>Elegí tu línea y parada para consultar.</p><div class="hero-bus">'+I('bus')+'</div><button class="hero-cta" onclick="go(\'lines\')">Consultar llegada '+I('arrow')+'</button></div>'+
 '<div class="headrow"><h3>¿Qué necesitás?</h3></div><div class="quick-grid">'+
 quickCard('Líneas y paradas','Consultá llegadas','bus','green','lines')+
 quickCard('Favoritos','Tus paradas guardadas','star','purple','fav')+
 quickCard('Recorridos','Explorá los trayectos','pin','orange','routes')+
 quickCard('Cómo consultar','Buscá tu línea y parada','info','blue','help')+'</div>'+
 notice('Cliente independiente y no oficial. No mostramos horarios de ejemplo como si fueran reales.');
}
function linesV3(){
 return intro('Elegí tu línea','Buscá un colectivo para encontrar su parada.','LÍNEAS DEL SERVICIO')+
 '<div class="search-bar line-search">'+I('search')+'<input id="searchLines" placeholder="Filtrar número o nombre" aria-label="Filtrar líneas" value="'+clean(searchValue)+'" oninput="filterLines()"/></div>'+
 '<div id="lineResults"></div><button class="secondary" onclick="loadLines()">'+I('refresh')+' Actualizar líneas</button>'+feedback();
}
function filterLines(){
 const input=document.getElementById('searchLines'),container=document.getElementById('lineResults');
 if(!input||!container)return;
 searchValue=input.value||'';const query=searchValue.toLocaleLowerCase('es-AR');
 const matches=dataV3.lines.map((r,i)=>({r,i})).filter(v=>String(v.r.nombre||v.r.id||'').toLocaleLowerCase('es-AR').includes(query));
 container.innerHTML=matches.length?matches.slice(0,200).map(({r,i})=>item(r.nombre||r.id,'Ver calles y paradas','chooseLine('+i+')')).join(''):
 (!dataV3.loading&&!dataV3.error?empty('líneas'):'');
}
async function loadLines(){await request('lines',{},'lines');}
function chooseLine(i){
 const selected=dataV3.lines[i];if(!selected)return;
 dataV3.line=selected;dataV3.street=null;dataV3.crossing=null;dataV3.stop=null;dataV3.streets=[];dataV3.crossings=[];dataV3.stops=[];dataV3.route=[];
 go('stops');request('streets',{linea:selected.id},'streets');
}
function optionsV3(rows,index){return rows.map((r,i)=>'<option value="'+i+'"'+(index===String(i)?' selected':'')+'>'+clean(r.nombre||r.id)+'</option>').join('');}
function stopsV3(){
 if(!dataV3.line)return intro('Elegí una línea','Primero necesitás seleccionar una línea.','PARADAS')+'<button class="primary" onclick="go(\'lines\')">Ver líneas</button>';
 let out=back('lines')+intro('Paradas de '+clean(dataV3.line.nombre||dataV3.line.id),'Elegí la calle y la intersección.','PARADAS REALES')+
 '<div class="card"><div class="field"><label for="street">Calle</label><select id="street" onchange="chooseStreet(this.value)"><option value="">Elegí una calle</option>'+
 optionsV3(dataV3.streets,dataV3.street)+'</select></div>'+
 '<div class="field"><label for="crossing">Intersección</label><select id="crossing" onchange="chooseCrossing(this.value)"><option value="">Elegí una intersección</option>'+
 optionsV3(dataV3.crossings,dataV3.crossing)+'</select></div></div>';
 if(geoPoints(dataV3.stops).length)out+='<button class="secondary map-action" onclick="openStopsMap()">'+I('pin')+' Ver paradas en mapa</button>';
 out+='<button class="secondary map-action" onclick="go(\'routes\')">'+I('arrow')+' Ver recorrido de la línea</button>';
 out+=dataV3.stops.map((r,i)=>item(stopHeading(r),stopSubtitle(r),'chooseStop('+i+')','pin')).join('');
 return out+feedback()+(dataV3.crossing!==null&&!dataV3.stops.length&&!dataV3.loading&&!dataV3.error?empty('paradas'):'');
}
function chooseStreet(i){
 if(i==='')return;const selected=dataV3.streets[Number(i)];if(!selected)return;
 dataV3.street=i;dataV3.crossing=null;dataV3.crossings=[];dataV3.stops=[];
 request('crossings',{linea:dataV3.line.id,calle:selected.id},'crossings');
}
function chooseCrossing(i){
 if(i==='')return;const s=dataV3.streets[Number(dataV3.street)],c=dataV3.crossings[Number(i)];
 if(!s||!c)return;dataV3.crossing=i;dataV3.stops=[];
 request('stops',{linea:dataV3.line.id,calle:s.id,interseccion:c.id},'stops');
}
function chooseStop(i){
 const stop=dataV3.stops[i];if(!stop)return;
 dataV3.stop=stop;dataV3.arrivals=[];dataV3.diagnostico=null;dataV3.arrivalsChecked=false;dataV3.mensaje='';go('arrival');loadArrivals();
}
async function loadArrivals(){
 if(!dataV3.line||!dataV3.stop)return;
 dataV3.arrivalsChecked=false;dataV3.mensaje='';dataV3.arrivals=[];
 const identifier=stopIdentifier(dataV3.stop);
 if(!identifier){
  dataV3.error='La parada no incluye el campo Identificador del servicio original. No se puede consultar con el código interno; volvé a seleccionar la parada.';
  render();
  return;
 }
 dataV3.error='';render();
 // Sólo enviamos el identificador real y la línea seleccionada.
 await request('arrivals',{linea:dataV3.line.id,parada:identifier},'arrivals');
 dataV3.arrivalsChecked=!dataV3.error;
}
function diagnosticPanel(){
 if(!dataV3.stop||!dataV3.line||!dataV3.error)return '';
 const ident=stopIdentifier(dataV3.stop);
 const codigo=String(dataV3.stop.codigoInterno||dataV3.stop.id||'');
 const line=String(dataV3.line.id||'');
 return '<div class="card"><h3>Diagnóstico de esta parada</h3>'+
 '<p>Línea seleccionada: <strong>'+clean(dataV3.line.nombre||'')+' (interna '+clean(line)+')</strong></p>'+
 '<p>Código de registro: <strong>'+clean(codigo||'No informado')+'</strong></p>'+
 '<p>Identificador de llegadas: <strong>'+clean(ident||'No informado por el servicio')+'</strong></p>'+
 '<p>Ciudad de consulta: <strong>QUILMES</strong></p>'+
 '<p><strong>Qué está pasando:</strong> '+clean(ident?
   'El servidor rechazó esta combinación de línea e identificador.':
   'La respuesta de paradas no incluyó un identificador válido; el código de registro no reemplaza ese dato.')+'</p>'+
 '<button class="secondary" onclick="moqsaGoBack()">Volver a la selección de paradas</button>'+
 '<p style="font-size:12px">Se muestran únicamente los códigos de la línea y parada seleccionadas; no se hacen consultas a otras líneas ni se exponen contraseñas.</p></div>';
}
// La ETA puede ser "24 min. aprox." o un mensaje no numérico del servicio.
function etaParts(raw){
 const value=String(raw||'Sin estimación').trim();
 const m=value.match(/^(\\d{1,4})\\s*min(?:\\.|utos?)?\\s*(.*)$/i);
 if(!m)return {number:'',suffix:value};
 return {number:m[1],suffix:'min'+(m[2]?'. '+m[2].replace(/^\\.\\s*/, ''):'.')};
}
function arrivalCard(a,i){
 const eta=etaParts(a.arribo);
 const label=i===0?'PRÓXIMO':'SIGUIENTE';
 const number=eta.number?
  '<div class="eta-number">'+clean(eta.number)+'</div><span class="eta-unit">'+clean(eta.suffix)+'</span>':
  '<div class="eta-other">'+clean(eta.suffix)+'</div>';
 return '<div class="arrival-highlight">'+
  '<div class="arrival-eta"><span class="eta-kicker">'+label+'</span>'+number+'</div>'+
  '<div class="arrival-details"><strong class="arrival-line">Línea '+clean(a.linea||dataV3.line.nombre||'—')+'</strong>'+
  '<span class="arrival-destination">'+clean(a.destino||'Destino no informado')+'</span>'+
  '<span class="arrival-position">'+(validGeoPoint(a,'','bus')?'Ubicación disponible en mapa':'Sin posición GPS informada')+'</span></div></div>';
}
function arrivalsV3(){
 if(!dataV3.stop||!dataV3.line)return intro('Próximas llegadas','Elegí una parada primero.','ARRIBOS')+'<button class="primary" onclick="go(\'lines\')">Buscar línea</button>';
 let out=back('stops')+intro('Próximas llegadas',clean(dataV3.line.nombre||dataV3.line.id)+' · '+clean(stopHeading(dataV3.stop)),'DATOS REALES')+
 '<div class="card arrival-panel"><div class="cardhead"><h3>Próximos colectivos</h3><button class="favourite" onclick="toggleFavorite()" aria-label="Guardar esta parada">'+I('star')+'</button></div>';
 out+=dataV3.arrivals.length
 ? dataV3.arrivals.map(arrivalCard).join('')
 :(!dataV3.loading&&!dataV3.error?'<div class="screen-note"><strong>Sin estimaciones disponibles ahora.</strong><p>'+clean(dataV3.mensaje||'El servidor no envió tiempos para esta parada. Podés intentar de nuevo en unos minutos.')+'</p></div>':'');
 out+='</div><button class="primary" onclick="loadArrivals()">'+I('refresh')+' Actualizar llegadas</button>';
 if(currentStopPoint()||arrivalVehiclePoints().length)
    out+='<button class="secondary map-action" onclick="openArrivalsMap()">'+I('pin')+' Ubicar parada y colectivos en mapa</button>';
 return out+feedback()+diagnosticPanel();
}
function favoritesV3(){try{const a=JSON.parse(localStorage.getItem('moqsa_v3_favs')||'[]');return Array.isArray(a)?a.filter(x=>x&&x.line&&x.stop).slice(0,100):[];}catch(e){return [];}}
function toggleFavorite(){
 if(!dataV3.line||!dataV3.stop)return;
 const key=dataV3.line.id+'|'+(stopIdentifier(dataV3.stop)||dataV3.stop.id);
 let rows=favoritesV3(),idx=rows.findIndex(x=>x.key===key);
 if(idx>=0){rows.splice(idx,1);toast('Eliminada de favoritos');}
 else{rows.unshift({key,line:dataV3.line,stop:dataV3.stop});toast('Guardada en favoritos');}
 localStorage.setItem('moqsa_v3_favs',JSON.stringify(rows));render();
}
function favsV3(){
 const favs=favoritesV3();return intro('Tus favoritos','Acceso rápido a tus paradas guardadas.','GUARDADOS')+
 (favs.length?favs.map((f,i)=>item(f.line.nombre||f.line.id,stopHeading(f.stop),'openFavorite('+i+')','star')).join(''):empty('favoritos'));
}
function openFavorite(i){const f=favoritesV3()[i];if(!f)return;dataV3.line=f.line;dataV3.stop=f.stop;dataV3.diagnostico=null;dataV3.arrivals=[];dataV3.error='';go('arrival');loadArrivals();}
function routesV3(){
 if(!dataV3.line)return intro('Recorridos','Elegí una línea para ver su trayecto sobre el mapa.','RECORRIDOS')+
 '<button class="primary" onclick="go(\'lines\')">Elegir línea</button>'+
 notice('Primero seleccioná una línea; después tocá “Ver recorrido de la línea” en Paradas.');
 const coords=geoPoints(dataV3.route,(v,i)=>v.nombre||'Punto '+String(i+1));
 let out=back('stops')+intro('Recorrido · '+clean(dataV3.line.nombre||dataV3.line.id),'Trayecto de la línea sobre OpenStreetMap.','MAPA DEL RECORRIDO')+
 '<button class="primary" onclick="loadRoute()">'+I('refresh')+' Consultar recorrido real</button>';
 if(coords.length){
   out+='<div class="card"><h3>Recorrido disponible</h3><p>'+coords.length+' puntos geográficos recibidos del servidor de transporte.</p></div>'+
   '<button class="secondary map-action" onclick="openRouteMap()">'+I('pin')+' Abrir recorrido en mapa interactivo</button>';
 }else if(!dataV3.loading&&!dataV3.error){
   out+=notice('Seleccioná “Consultar recorrido real”. El mapa se habilitará cuando el servicio original entregue coordenadas válidas.');
 }
 return out+feedback()+(dataV3.route.length&&!coords.length?notice('El servicio devolvió datos del recorrido, pero no coordenadas interpretables. No se dibuja una ruta ficticia.'):'');
}
function settingsV3(){
 return intro('Servidor original de MOQSA','Conexión HTTPS directa sin servicios intermedios.','CONEXIÓN SOAP')+
 '<div class="card"><div class="field"><label>Servidor original</label><p style="overflow-wrap:anywhere">clswbsas.smartmovepro.net · HTTPS</p></div>'+
 '<div class="field"><label>Entidad</label><p>4 (APK 1.7)</p></div>'+
 '<div class="field"><label>Aplicación</label><p>24 (APK 1.7)</p></div>'+
 '<p><strong>Estado:</strong> '+(dataV3.configured?'Acceso guardado en este teléfono':'Faltan credenciales del servidor original')+'</p>'+
 '<div class="field"><label for="soapUser">Usuario SOAP</label><input id="soapUser" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Usuario del servidor original"/></div>'+
 '<div class="field"><label for="soapPassword">Contraseña SOAP</label><input id="soapPassword" type="password" autocomplete="off" placeholder="Contraseña del servicio"/></div>'+
 '<button class="primary" onclick="saveApi()">'+I('check')+' Guardar credenciales</button></div>'+
 notice('Se conecta directamente al servicio original y cifra las claves en el dispositivo. No almacena credenciales en este repositorio.')+
 '<button class="secondary" onclick="checkApi()">Probar consulta real</button>'+feedback();
}
async function loadConfig(){
 try{const c=await native('config.get');dataV3.configured=Boolean(c.configured);if(screen==='settings')render();}
 catch(e){dataV3.error=e.message;render();}
}
async function saveApi(){
 try{
  const user=document.getElementById('soapUser').value.trim();
  const password=document.getElementById('soapPassword').value;
  await native('config.set',{user,password});
  dataV3.configured=true;dataV3.error='';toast('Acceso guardado');go('lines');
 }catch(e){dataV3.error=e.message;render();}
}
async function checkApi(){
 dataV3.loading=true;dataV3.error='';render();
 try{
  const res=await native('lines');
  if(!Array.isArray(res.items)||!res.items.length)throw Error('No llegaron líneas del servicio original');
  dataV3.lines=res.items;dataV3.loading=false;toast('Conectado: '+res.items.length+' líneas');go('lines');
 }catch(e){dataV3.loading=false;dataV3.error=e.message;render();}
}
function menuV3(){
 const entries=[['lines','Líneas y paradas','bus'],['fav','Guardados','star'],['routes','Recorridos','route'],['help','Cómo consultar','info'],['about','Acerca de MOQSA','bus']];
 return intro('Más opciones','Accedé directamente a las funciones útiles.','MOQSA')+
 '<div class="more-grid">'+entries.map(([page,label,icon])=>
 '<button class="more-item" onclick="go(\''+page+'\')">'+I(icon)+clean(label)+'</button>').join('')+'</div>';
}
function pendingV3(title){return intro(title,'Sección todavía no conectada al servicio real.','EN PREPARACIÓN')+
 '<div class="card empty"><h3>Función en desarrollo</h3><p>No mostramos datos de ejemplo como si fueran reales.</p></div>'+
 '<button class="secondary" onclick="go(\'lines\')">Consultar líneas</button>';}
makers.home=mainV3;makers.more=menuV3;makers.lines=linesV3;makers.stops=stopsV3;makers.arrival=arrivalsV3;
makers.fav=favsV3;makers.routes=routesV3;makers.map=routesV3;makers.time=arrivalsV3;
makers.settings=settingsV3;makers.near=()=>pendingV3('Paradas cercanas');makers.journey=()=>pendingV3('¿Cómo llego?');
makers.voice=()=>pendingV3('Búsqueda por voz');makers.reload=()=>pendingV3('Puntos de recarga');
makers.reports=()=>pendingV3('Consultas y reclamos');makers.news=()=>pendingV3('Novedades');
makers.shortcuts=()=>pendingV3('Accesos directos');
makers.about=()=>intro('MOQSA','Consulta de colectivos.','ACERCA DE')+notice('Cliente no oficial. Consulta directamente el servicio SOAP original por HTTPS, sin servidor intermedio.');
function helpV3(){
 const steps=[
 ['01','Buscá tu línea','Entrá en Líneas y escribí el número (por ejemplo, 300). Elegí el ramal que uses.'],
 ['02','Elegí la calle y el cruce','Seleccioná la calle principal y después su intersección. Estas opciones vienen del servicio de transporte.'],
 ['03','Comprobá el sentido de la parada','Prestá atención al destino: “Hacia …” identifica el sentido del colectivo. El código MO-xxxxx es una referencia técnica.'],
 ['04','Consultá el próximo arribo','El tiempo es una estimación del servidor y puede cambiar. Tocá Actualizar llegadas cuando quieras refrescar.'],
 ['05','Guardá y ubicá tu parada','Tocá la estrella para agregarla a Guardados. Si se conocen las coordenadas, también podés ubicarla en el mapa.']
 ];
 return intro('Cómo consultar','Todo lo que necesitás para encontrar tu colectivo más rápido.','GUÍA DE VIAJE')+
 '<div class="help-steps">'+steps.map(([n,title,description])=>
 '<div class="help-step"><span class="help-number">'+n+'</span><div><strong>'+title+'</strong><p>'+description+'</p></div></div>').join('')+'</div>'+
 '<div class="card help-tips"><h3>¿Cómo interpretar los tiempos?</h3>'+
 '<p><strong>“5 min aprox.”</strong> indica que el colectivo podría llegar en unos cinco minutos; no es una garantía.</p>'+
 '<p><strong>“Sin estimación”</strong> significa que el servidor no tiene una predicción disponible en ese momento.</p>'+
 '<p><strong>“Error de consulta”</strong> significa que no pudimos obtener una respuesta válida; reintentá o volvé a seleccionar la parada.</p></div>'+
 '<div class="card help-tips"><h3>Mapas y recorridos</h3><p>Podés abrir el mapa del recorrido desde Paradas → Ver recorrido de la línea. El mapa utiliza OpenStreetMap y solo dibuja coordenadas reales recibidas del servicio.</p></div>'+
 '<button class="primary" onclick="go(\'lines\')">'+I('bus')+' Empezar una consulta</button>'+
 '<button class="secondary" onclick="go(\'fav\')">'+I('star')+' Abrir mis paradas guardadas</button>';
}
makers.help=helpV3;
const oldGo=go;
const navTrail=[];
const MAX_NAV_TRAIL=60;

// Todas las rutas (incluidas las pestañas) dejan constancia de la pantalla anterior.
go=function(key){
 const destination=PAGES[key]?key:'home';
 if(destination===screen)return;
 navTrail.push(screen);
 if(navTrail.length>MAX_NAV_TRAIL)navTrail.shift();
 oldGo(destination);
 if(destination==='lines'&&!dataV3.lines.length)loadLines();
};

// Función compartida por Atrás Android y las flechas visibles.
window.moqsaGoBack=function(){
 while(navTrail.length){
  const previous=navTrail.pop();
  if(!PAGES[previous]||previous===screen)continue;
  oldGo(previous);
  if(previous==='lines'&&!dataV3.lines.length)loadLines();
  return true;
 }
 if(screen!=='home'){
  oldGo('home');
  return true;
 }
 return false;
};

// Las flechas de pantalla respetan el historial en vez de crear una ruta de regreso nueva.
back=function(fallback='home'){
 const previous=[...navTrail].reverse().find(p=>PAGES[p]&&p!==screen)||fallback;
 return '<div class="page-header"><button class="back" aria-label="Volver a '+clean(PAGES[previous]||'Inicio')+'" onclick="moqsaGoBack()">'+I('back')+'</button><span class="crumb">Volver a '+clean(PAGES[previous]||'Inicio')+'</span></div>';
};
render();loadConfig();
