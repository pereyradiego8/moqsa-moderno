'use strict';
/* Nueva experiencia V3: datos de servicio, jamás líneas ni arribos simulados. */
const dataV3={lines:[],streets:[],crossings:[],stops:[],arrivals:[],route:[],line:null,street:null,crossing:null,stop:null,error:'',loading:false,backend:'',mensaje:'',arrivalsChecked:false};
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
function stopSubtitle(r){
 const id=String(r.identificador||r.id||'').trim();
 const street=String(r.detalle||'').trim();
 return [street,id?'Parada '+id:''].filter(Boolean).join(' · ')||'Consultar próximos arribos';
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
 dataV3.line=selected;dataV3.street=null;dataV3.crossing=null;dataV3.stop=null;dataV3.streets=[];dataV3.crossings=[];dataV3.stops=[];
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
 dataV3.stop=stop;dataV3.arrivals=[];dataV3.arrivalsChecked=false;dataV3.mensaje='';go('arrival');loadArrivals();
}
async function loadArrivals(){
 if(!dataV3.line||!dataV3.stop)return;
 dataV3.arrivalsChecked=false;dataV3.mensaje='';dataV3.arrivals=[];render();
 // El WebService espera la ciudad configurada de MOQSA, NO la localidad de la calle.
 // OriginalSoap aplica el valor global original al construir la petición.
 await request('arrivals',{linea:dataV3.line.id,parada:dataV3.stop.identificador||dataV3.stop.id},'arrivals');
 dataV3.arrivalsChecked=!dataV3.error;
}
function arrivalsV3(){
 if(!dataV3.stop||!dataV3.line)return intro('Próximas llegadas','Elegí una parada primero.','ARRIBOS')+'<button class="primary" onclick="go(\'lines\')">Buscar línea</button>';
 let out=back('stops')+intro('Próximas llegadas',clean(dataV3.line.nombre||dataV3.line.id)+' · '+clean(stopHeading(dataV3.stop)),'DATOS REALES')+
 '<div class="card"><div class="cardhead"><h3>Próximos colectivos</h3><button class="favourite" onclick="toggleFavorite()" aria-label="Guardar esta parada">'+I('star')+'</button></div>';
 out+=dataV3.arrivals.length?dataV3.arrivals.map(a=>'<div class="arrival-entry">'+I('clock')+'<div><strong>'+clean(a.arribo||'Sin estimación')+'</strong><small>'+clean(a.linea||'')+' · '+clean(a.destino||'')+'</small></div></div>').join(''):
 (!dataV3.loading&&!dataV3.error?'<div class="screen-note"><strong>Sin arribos informados en este momento.</strong><p>'+clean(dataV3.mensaje||'No se recibieron predicciones para esta parada y sentido. Podés volver a consultar.')+'</p></div>':'');
 return out+'</div><button class="primary" onclick="loadArrivals()">'+I('refresh')+' Actualizar llegadas</button>'+feedback();
}
function favoritesV3(){try{const a=JSON.parse(localStorage.getItem('moqsa_v3_favs')||'[]');return Array.isArray(a)?a.filter(x=>x&&x.line&&x.stop).slice(0,100):[];}catch(e){return [];}}
function toggleFavorite(){
 if(!dataV3.line||!dataV3.stop)return;
 const key=dataV3.line.id+'|'+(dataV3.stop.identificador||dataV3.stop.id);
 let rows=favoritesV3(),idx=rows.findIndex(x=>x.key===key);
 if(idx>=0){rows.splice(idx,1);toast('Eliminada de favoritos');}
 else{rows.unshift({key,line:dataV3.line,stop:dataV3.stop});toast('Guardada en favoritos');}
 localStorage.setItem('moqsa_v3_favs',JSON.stringify(rows));render();
}
function favsV3(){
 const favs=favoritesV3();return intro('Tus favoritos','Acceso rápido a tus paradas guardadas.','GUARDADOS')+
 (favs.length?favs.map((f,i)=>item(f.line.nombre||f.line.id,stopHeading(f.stop),'openFavorite('+i+')','star')).join(''):empty('favoritos'));
}
function openFavorite(i){const f=favoritesV3()[i];if(!f)return;dataV3.line=f.line;dataV3.stop=f.stop;dataV3.arrivals=[];dataV3.error='';go('arrival');loadArrivals();}
function routesV3(){
 if(!dataV3.line)return intro('Recorridos','Primero elegí una línea.','RECORRIDOS')+'<button class="primary" onclick="go(\'lines\')">Elegir línea</button>';
 return back('lines')+intro('Recorrido: '+clean(dataV3.line.nombre||dataV3.line.id),'Puntos recibidos del servicio.','RECORRIDOS')+
 '<button class="primary" onclick="request(\'route\',{linea:dataV3.line.id},\'route\')">'+I('refresh')+' Consultar recorrido</button>'+
 (dataV3.route.length?'<div class="card">'+dataV3.route.map(r=>'<div class="stop-item">'+clean(r.nombre||r.id||'Punto')+'</div>').join('')+'</div>':notice('El mapa real todavía está pendiente de integración.'))+feedback();
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
makers.help=()=>intro('Cómo consultar','Elegí una línea, calle, intersección y parada para ver horarios.','AYUDA');
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
