'use strict';
/* Nueva experiencia V3: datos de servicio, jamás líneas ni arribos simulados. */
const dataV3={lines:[],streets:[],crossings:[],stops:[],arrivals:[],otherArrivals:[],otherLoading:false,otherNotice:'',otherPartial:false,otherRequestId:0,route:[],routeLine:null,routeQuery:'',routeLoading:false,routeError:'',routeRequestId:0,routeVariant:0,routeMapLoading:false,routeMapError:'',routeAddresses:{},routeAddressPending:false,routeListScroll:0,routeRefreshing:false,routeRefreshStatus:'',routeRefreshError:'',line:null,locality:null,street:null,crossing:null,stop:null,nearby:[],nearLocation:null,nearAccuracy:null,nearDiagnostic:null,nearError:'',nearLoading:false,nearStop:null,nearStopArrivals:[],nearStopMessage:'',nearStopError:'',nearStopLoading:false,nearStopPartial:false,nearStopRequestId:0,error:'',loading:false,backend:'',mensaje:'',arrivalsChecked:false,diagnostico:null,diagnosticando:false};
const calls=new Map();let callNo=0;
function native(action,params={}){
 return new Promise((resolve,reject)=>{
  if(!window.AndroidApi){reject(Error('Abrí el APK Android para realizar consultas reales.'));return;}
  const id=++callNo,t=setTimeout(()=>{calls.delete(id);reject(Error('Se agotó el tiempo de espera de la consulta.'));},action==="nearby"||action==="nearbyArrivals"||action==="route"?85000:action==="route.addresses"?65000:25000);
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
 return (dataV3.loading?'<div class="card empty"><h3>Buscando información…</h3><p>Esperá un momento.</p></div>':'')+
 (dataV3.error?'<div class="card empty"><h3>No pudimos completar la consulta</h3><p>Probá nuevamente.</p><button class="secondary" onclick="retryScreen()">Reintentar</button></div>':'');
}
const empty=label=>'<div class="card empty"><h3>Sin '+clean(label)+'</h3><p>No encontramos información por el momento.</p></div>';
const fieldRequests=Object.create(null);
function invalidateStopRequests(){
 for(const field of ['streets','crossings','stops'])fieldRequests[field]=(fieldRequests[field]||0)+1;
}
async function request(action,params,field){
 const requestId=fieldRequests[field]=(fieldRequests[field]||0)+1;
 dataV3.loading=true;dataV3.error='';render();
 try{
  const resp=await native(action,params);
  if(fieldRequests[field]!==requestId)return;
  if(!resp||!Array.isArray(resp.items))throw Error('Respuesta de API en formato inesperado');
  dataV3[field]=resp.items;dataV3.mensaje=String(resp.mensaje||'').trim();dataV3.loading=false;render();
 }catch(e){
  if(fieldRequests[field]!==requestId)return;
  dataV3.loading=false;dataV3.mensaje='';dataV3.error=e.message||'Error de conexión';render();
 }
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
 return street||'Consultar próximos arribos';
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
 if(!points.length){toast('No hay ubicación disponible para este mapa');return;}
 try{await native('map.show',{type,title,points});}
 catch(e){toast('No pudimos abrir el mapa. Probá otra vez.');}
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
function routeMeters(a,b){
 const lat1=Number(a.lat),lon1=Number(a.lon),lat2=Number(b.lat),lon2=Number(b.lon);
 const toRadians=Math.PI/180;
 const deltaLatitude=(lat2-lat1)*toRadians,deltaLongitude=(lon2-lon1)*toRadians;
 const value=Math.sin(deltaLatitude/2)**2+
  Math.cos(lat1*toRadians)*Math.cos(lat2*toRadians)*Math.sin(deltaLongitude/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(value)));
}
function routeDistance(points){
 let total=0;
 for(let i=1;i<points.length;i++){
  const meters=routeMeters(points[i-1],points[i]);
  if(meters<5000)total+=meters;
 }
 return total;
}
function routeIsReturn(ida,vuelta){
 const a=ida.points,b=vuelta.points;
 if(a.length<2||b.length<2)return false;
 const startA=a[0],endA=a[a.length-1],startB=b[0],endB=b[b.length-1];
 const latScale=111195,lonScale=111195*Math.cos((Number(startA.lat)+Number(endA.lat))/2*Math.PI/180);
 const ax=(endA.lon-startA.lon)*lonScale,ay=(endA.lat-startA.lat)*latScale;
 const bx=(endB.lon-startB.lon)*lonScale,by=(endB.lat-startB.lat)*latScale;
 const lengthA=Math.hypot(ax,ay),lengthB=Math.hypot(bx,by);
 if(lengthA<200||lengthB<200)return false; // No adivinar sentidos a partir de lazos cerrados.
 const opposite=(ax*bx+ay*by)/(lengthA*lengthB);
 if(opposite>-.55)return false;
 const reverse=routeMeters(startA,endB)+routeMeters(endA,startB);
 const same=routeMeters(startA,startB)+routeMeters(endA,endB);
 return reverse<same*.75 && reverse<Math.max(lengthA,lengthB)*1.35;
}
function routeVariants(){
 const all=(Array.isArray(dataV3.route)?dataV3.route:[])
  .filter(row=>validGeoPoint(row,row?.nombre||'', 'route'));
 if(!all.length)return [];
 // Cada descripción del proveedor puede ser un ramal, pero también puede
 // ser un nombre de punto intermedio. Solo tratamos grupos largos como trazados.
 const groups=new Map();
 for(const row of all){
  const key=String(row.nombre||'').trim();
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(row);
 }
 const entries=[...groups.entries()];
 const realBranches=entries.length>1 && entries.length<=80 &&
  entries.every(([name])=>Boolean(name)) &&
  entries.filter(([,pts])=>pts.length>=2).length>=Math.ceil(entries.length*.7);
 if(!realBranches)return [{label:'Recorrido completo',name:String(all[0]?.nombre||''),points:all}];
 const candidates=entries.map(([name,points],index)=>({name,points,length:routeDistance(points),index}))
  .filter(v=>v.points.length>=2 && v.length>=100)
  .sort((a,b)=>Math.abs(b.length-a.length)<Math.max(a.length,b.length)*.03?
    a.index-b.index:b.length-a.length);
 if(!candidates.length)return [{label:'Recorrido completo',name:String(all[0]?.nombre||''),points:all}];
 const ida=candidates[0];
 const vuelta=candidates.filter(c=>c!==ida && c.length>=ida.length*.45 && routeIsReturn(ida,c))
  .sort((a,b)=>b.length-a.length)[0];
 const output=[{label:vuelta?'Ida':'Recorrido completo',name:ida.name,points:ida.points}];
 if(vuelta)output.push({label:'Vuelta',name:vuelta.name,points:vuelta.points});
 return output;
}
function routeTerminalHints(name){
 const raw=String(name||'').trim();
 const segment=(raw.includes(';')?raw.split(';').slice(1).join(';'):raw).trim();
 const candidates=segment.split(/\s*-\s*/).map(x=>x.trim().replace(/\s*\(EXP\)\s*$/i,''));
 if(candidates.length!==2||candidates.some(x=>x.length<3||/^(IDA|VUELTA|RECORRIDO)$/i.test(x)))return ['',''];
 return candidates;
}
function routeEndpointInfo(variant,index,end){
 const point=end==='start'?variant.points[0]:variant.points[variant.points.length-1];
 const geocoded=dataV3.routeAddresses[String(index)+':'+end]||{};
 const street=String(point?.callePrincipal||geocoded.street||'').trim();
 const intersection=String(point?.cruce1||geocoded.intersection||'').trim();
 const directAddress=String(point?.direccion||'').trim();
 const hint=routeTerminalHints(variant.name)[end==='start'?0:1];
 if(street)return {title:street+(intersection?' y '+intersection:''),
  note:intersection?'Calle e intersección informadas':'Intersección no informada'};
 if(directAddress)return {title:directAddress,note:'Intersección no informada'};
 if(hint)return {title:hint,note:'Referencia del recorrido · calle e intersección no informadas'};
 return {title:end==='start'?'Origen no identificado':'Destino no identificado',
  note:'Calle e intersección no informadas'};
}
async function loadRouteAddresses(requestId){
 const variants=routeVariants();
 const points=[];
 for(const variant of variants){
  if(!variant.points.length)continue;
  points.push({lat:variant.points[0].lat,lon:variant.points[0].lon});
  const last=variant.points[variant.points.length-1];
  points.push({lat:last.lat,lon:last.lon});
 }
 if(!points.length)return;
 dataV3.routeAddressPending=true;render();
 try{
  const result=await native('route.addresses',{points});
  if(requestId!==dataV3.routeRequestId||screen!=='routes'||!dataV3.routeLine)return;
  if(Array.isArray(result?.items)){
   const addresses={};
   for(let i=0;i<result.items.length;i++)
    addresses[Math.floor(i/2)+':'+(i%2?'end':'start')]=result.items[i];
   dataV3.routeAddresses=addresses;
  }
 }catch(_){}
 finally{
  if(requestId===dataV3.routeRequestId&&dataV3.routeLine){
   dataV3.routeAddressPending=false;
   if(screen==='routes')render();
  }
 }
}
function chooseRouteVariant(index){
 const variants=routeVariants();
 const i=Number(index);
 if(!Number.isInteger(i)||i<0||i>=variants.length)return;
 dataV3.routeVariant=i;dataV3.routeMapError='';
 const offset=typeof root!=='undefined'&&root?root.scrollTop:0;
 render();if(typeof root!=='undefined'&&root)root.scrollTop=offset;
}
function routeMapPoints(){
 const selected=routeVariants()[dataV3.routeVariant];
 if(!selected)return [];
 const all=selected.points;
 const count=Math.min(650,all.length);
 const points=[];
 for(let i=0;i<count;i++){
  const index=count===1?0:Math.round(i*(all.length-1)/(count-1));
  const row=all[index];
  const p=validGeoPoint(row,row.nombre||'Punto '+String(index+1),'route');
  if(p){p.nombre=p.nombre.slice(0,45);points.push(p);}
 }
 return points;
}
async function openRouteMap(){
 if(dataV3.routeMapLoading||!dataV3.routeLine)return;
 const points=routeMapPoints();
 if(!points.length){
  dataV3.routeMapError='El servicio todavía no informó coordenadas para este trayecto.';
  render();return;
 }
 dataV3.routeMapLoading=true;dataV3.routeMapError='';render();
 const branch=routeVariants()[dataV3.routeVariant];
 const from=routeEndpointInfo(branch,dataV3.routeVariant,'start').title;
 const to=routeEndpointInfo(branch,dataV3.routeVariant,'end').title;
 const title='Línea '+String(dataV3.routeLine.nombre||dataV3.routeLine.id)+' · '+from+' → '+to;
 try{
  await native('map.show',{type:'route',title,points});
 }catch(e){
  dataV3.routeMapError='No se pudo abrir el mapa. Probá nuevamente.';
 }finally{
  dataV3.routeMapLoading=false;
  if(screen==='routes'&&dataV3.routeLine)render();
 }
}
async function loadRoute(){
 const selected=dataV3.routeLine;
 if(!selected)return;
 const requestId=++dataV3.routeRequestId;
 dataV3.route=[];dataV3.routeVariant=0;dataV3.routeLoading=true;dataV3.routeError='';dataV3.routeMapError='';
 dataV3.routeAddresses={};dataV3.routeAddressPending=false;
 render();
 try{
  const response=await native('route',{linea:selected.id,isSublinea:Boolean(selected.isSublinea)});
  if(requestId!==dataV3.routeRequestId||dataV3.routeLine?.id!==selected.id)return;
  if(!response||!Array.isArray(response.items))throw Error('Respuesta inválida');
  dataV3.route=response.items;
  if(!routeVariants().length) dataV3.routeError='Esta línea no tiene puntos de mapa disponibles en el servicio. Podés reintentar.';
 }catch(e){
  if(requestId!==dataV3.routeRequestId||dataV3.routeLine?.id!==selected.id)return;
  dataV3.routeError='No pudimos recuperar el recorrido desde el servicio. Intentá nuevamente.';
 }
 dataV3.routeLoading=false;
 render();
 if(!dataV3.routeError&&requestId===dataV3.routeRequestId)void loadRouteAddresses(requestId);
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
 '';
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
 stopSteps.length=0;
 invalidateStopRequests();
 dataV3.line=selected;dataV3.locality=null;dataV3.street=null;dataV3.crossing=null;dataV3.stop=null;dataV3.streets=[];dataV3.crossings=[];dataV3.stops=[];dataV3.route=[];
 go('stops');request('streets',{linea:selected.id},'streets');
}
const citySorter=new Intl.Collator('es-AR',{sensitivity:'base',numeric:true,ignorePunctuation:true});
function orderedRows(rows){
 return (Array.isArray(rows)?rows:[]).map((r,i)=>({r,i})).sort((a,b)=>
  citySorter.compare(String(a.r.nombre||a.r.id||''),String(b.r.nombre||b.r.id||'')));
}
function streetCity(record){
 const explicit=String(record?.localidad||'').trim();
 if(explicit)return explicit.toLocaleUpperCase('es-AR');
 // El SOAP de calles incluye la localidad después del último " - ".
 const raw=String(record?.nombre||'').trim();
 const at=raw.lastIndexOf(' - ');
 return at<0?'SIN LOCALIDAD INFORMADA':raw.slice(at+3).trim().toLocaleUpperCase('es-AR')||'SIN LOCALIDAD INFORMADA';
}
function cityList(){
 const uniques=new Map();
 for(const r of dataV3.streets){const town=streetCity(r);uniques.set(town.toLocaleLowerCase('es-AR'),town);}
 return [...uniques.values()].sort((a,b)=>citySorter.compare(a,b));
}
function streetChoices(){
 return orderedRows(dataV3.streets).filter(({r})=>streetCity(r)===dataV3.locality)
   .map(({r,i})=>({r,i}));
}
function optionsV3(rows,index){
 return orderedRows(rows).map(({r,i})=>'<option value="'+i+'"'+(index===String(i)?' selected':'')+'>'+clean(r.nombre||r.id)+'</option>').join('');
}
function chooseLocality(city){
 if((city||null)===dataV3.locality)return;
 rememberStopStep();
 invalidateStopRequests();
 dataV3.locality=city||null;
 dataV3.street=null;dataV3.crossing=null;dataV3.crossings=[];dataV3.stops=[];dataV3.error='';
 render();
}
function stopsV3(){
 if(!dataV3.line)return intro('Elegí una línea','Primero necesitás seleccionar una línea.','PARADAS')+'<button class="primary" onclick="go(\'lines\')">Ver líneas</button>';
 let out=back('lines')+intro('Paradas de '+clean(dataV3.line.nombre||dataV3.line.id),
 'Elegí la localidad, la calle y después la intersección.','PARADAS REALES')+
 '<div class="card"><div class="field"><label for="locality">1. Localidad</label>'+
 '<select id="locality" onchange="chooseLocality(this.value)"><option value="">Elegí la localidad</option>'+
 cityList().map(city=>'<option value="'+clean(city)+'"'+(dataV3.locality===city?' selected':'')+'>'+clean(city)+'</option>').join('')+
 '</select></div><div class="field"><label for="street">2. Calle</label>'+
 '<select id="street" onchange="chooseStreet(this.value)" '+(!dataV3.locality?'disabled':'')+'><option value="">Elegí una calle</option>'+
 streetChoices().map(({r,i})=>'<option value="'+i+'"'+(dataV3.street===String(i)?' selected':'')+'>'+clean(r.nombre||r.id)+'</option>').join('')+
 '</select></div><div class="field"><label for="crossing">3. Intersección</label>'+
 '<select id="crossing" onchange="chooseCrossing(this.value)" '+(dataV3.street===null?'disabled':'')+'><option value="">Elegí una intersección</option>'+
 optionsV3(dataV3.crossings,dataV3.crossing)+'</select></div></div>';
 if(geoPoints(dataV3.stops).length)out+='<button class="secondary map-action" onclick="openStopsMap()">'+I('pin')+' Ver paradas en mapa</button>';
 out+='<button class="secondary map-action" onclick="go(\'routes\')">'+I('arrow')+' Explorar recorridos</button>';
 out+=dataV3.stops.map((r,i)=>item(stopHeading(r),stopSubtitle(r),'chooseStop('+i+')','pin')).join('');
 return out+feedback()+(dataV3.crossing!==null&&!dataV3.stops.length&&!dataV3.loading&&!dataV3.error?empty('paradas'):'');
}
function chooseStreet(i){
 if(i==='')return;const selected=dataV3.streets[Number(i)];if(!selected||streetCity(selected)!==dataV3.locality)return;
 if(dataV3.street===String(i))return;
 rememberStopStep();
 invalidateStopRequests();
 dataV3.street=i;dataV3.crossing=null;dataV3.crossings=[];dataV3.stops=[];
 request('crossings',{linea:dataV3.line.id,calle:selected.id},'crossings');
}
function chooseCrossing(i){
 if(i==='')return;const s=dataV3.streets[Number(dataV3.street)],c=dataV3.crossings[Number(i)];
 if(!s||!c)return;
 if(dataV3.crossing===String(i))return;
 rememberStopStep();
 invalidateStopRequests();
 dataV3.crossing=i;dataV3.stops=[];
 request('stops',{linea:dataV3.line.id,calle:s.id,interseccion:c.id},'stops');
}
function chooseStop(i){
 const stop=dataV3.stops[i];if(!stop)return;
 dataV3.stop=stop;dataV3.arrivals=[];dataV3.otherRequestId++;dataV3.otherArrivals=[];dataV3.otherLoading=false;dataV3.diagnostico=null;dataV3.arrivalsChecked=false;dataV3.mensaje='';go('arrival');loadArrivals();
}
function lineNumber(label){
 const text=String(label||'').trim().toLocaleUpperCase('es-AR');
 const match=text.match(/(?:^|L[ÍI]NEA\s*)(\d{1,4})(?=\D|$)/);
 return match?match[1]:'';
}
function otherLinesAtStop(rows,selectedLine,selectedArrivals=[]){
 const current=lineNumber(selectedLine);
 const primaryNumbers=new Set((Array.isArray(selectedArrivals)?selectedArrivals:[])
  .map(row=>lineNumber(row.linea)).filter(Boolean));
 if(current)primaryNumbers.add(current);
 const distinct=[];
 for(const a of (Array.isArray(rows)?rows:[])){
  const number=lineNumber(a.linea);
  if(!number||primaryNumbers.has(number))continue;
  distinct.push(a);
 }
 return nearStopArrivalsSorted(distinct);
}
async function loadOtherArrivals(identifier){
 const requestId=++dataV3.otherRequestId;
 dataV3.otherLoading=true;dataV3.otherNotice='';dataV3.otherPartial=false;dataV3.otherArrivals=[];
 render();
 try{
  const response=await native('nearbyArrivals',{parada:identifier});
  if(requestId!==dataV3.otherRequestId)return;
  if(!Array.isArray(response.items))throw Error('La consulta no devolvió arribos');
  dataV3.otherArrivals=otherLinesAtStop(response.items,
    dataV3.line?.nombre||dataV3.line?.id,dataV3.arrivals);
  dataV3.otherPartial=Boolean(response.parcial);
 }catch(e){
  if(requestId!==dataV3.otherRequestId)return;
  dataV3.otherNotice='No hay información disponible de otras líneas por ahora.';
 }
 if(requestId===dataV3.otherRequestId){
  dataV3.otherLoading=false;render();
 }
}
async function loadArrivals(){
 if(!dataV3.line||!dataV3.stop)return;
 const thisRequest=++dataV3.otherRequestId;
 dataV3.arrivalsChecked=false;dataV3.mensaje='';dataV3.arrivals=[];
 dataV3.otherArrivals=[];dataV3.otherLoading=false;
 dataV3.otherNotice='';dataV3.otherPartial=false;
 const identifier=stopIdentifier(dataV3.stop);
 if(!identifier){
  dataV3.error='No pudimos identificar esta parada. Volvé a seleccionarla.';
  render();return;
 }
 dataV3.error='';render();
 await request('arrivals',{linea:dataV3.line.id,parada:identifier},'arrivals');
 if(thisRequest!==dataV3.otherRequestId)return;
 dataV3.arrivalsChecked=!dataV3.error;
 if(!dataV3.error&&screen==='arrival')void loadOtherArrivals(identifier);
}
function etaParts(raw){
 const value=String(raw||'Sin estimación').trim();
 const m=value.match(/^(\d{1,4})\s*min(?:\.|utos?)?\s*(.*)$/i);
 if(!m)return {number:'',suffix:value};
 const extra=m[2].replace(/^\.\s*/,'').trim();
 return {number:m[1],suffix:'min.'+(extra?' '+extra:'')};
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
function otherArrivalCard(a,i){
 const eta=etaParts(a.arribo);
 const number=eta.number?
  '<strong class="other-eta-number">'+clean(eta.number)+'</strong><span>'+clean(eta.suffix)+'</span>':
  '<strong class="other-eta-description">'+clean(eta.suffix)+'</strong>';
 return '<div class="other-arrival-item"><div class="other-arrival-details">'+
 '<strong>Línea '+clean(a.linea||'')+'</strong>'+
 '<span>'+clean(a.destino||'Destino no informado')+'</span></div>'+
 '<div class="other-arrival-time">'+number+'</div></div>';
}
function arrivalsV3(){
 if(!dataV3.stop||!dataV3.line)return intro('Próximas llegadas','Elegí una parada primero.','ARRIBOS')+'<button class="primary" onclick="go(\'lines\')">Buscar línea</button>';
 let out=back('stops')+intro('Próximas llegadas',clean(dataV3.line.nombre||dataV3.line.id)+' · '+clean(stopHeading(dataV3.stop)),'DATOS REALES')+
 '<div class="card arrival-panel"><div class="cardhead"><h3>Próximos colectivos</h3><button class="favourite" onclick="toggleFavorite()" aria-label="Guardar esta parada">'+I('star')+'</button></div>';
 out+=dataV3.arrivals.length
 ? dataV3.arrivals.map(arrivalCard).join('')
 :(!dataV3.loading&&!dataV3.error?'<div class="screen-note"><strong>Sin estimaciones disponibles ahora.</strong><p>Volvé a consultar en unos minutos.</p></div>':'');
 out+='</div>';
 out+='<div class="card arrival-panel other-lines-panel"><div class="cardhead"><h3>Otras líneas en esta parada</h3></div>';
 if(dataV3.otherArrivals.length)out+=dataV3.otherArrivals.map(otherArrivalCard).join('');
 else if(dataV3.otherLoading)out+='<p>Buscando otras líneas…</p>';
 else out+='<p>'+clean(dataV3.otherNotice||'Sin otras llegadas informadas por ahora.')+'</p>';
 if(dataV3.otherPartial&&dataV3.otherArrivals.length)out+='<p class="muted">Puede haber más líneas sin estimación.</p>';
 out+='</div><button class="primary" onclick="loadArrivals()">'+I('refresh')+' Actualizar llegadas</button>';
 if(currentStopPoint()||arrivalVehiclePoints().length)
    out+='<button class="secondary map-action" onclick="openArrivalsMap()">'+I('pin')+' Ver parada y colectivos en el mapa</button>';
 return out+feedback();
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
function openFavorite(i){const f=favoritesV3()[i];if(!f)return;dataV3.line=f.line;dataV3.stop=f.stop;dataV3.otherRequestId++;dataV3.otherArrivals=[];dataV3.diagnostico=null;dataV3.arrivals=[];dataV3.error='';go('arrival');loadArrivals();}
function routeLineChoices(){
 const query=dataV3.routeQuery.trim().toLocaleLowerCase('es-AR');
 const matches=orderedRows(dataV3.lines).filter(({r})=>
  String(r.nombre||r.id||'').toLocaleLowerCase('es-AR').includes(query));
 if(!matches.length){
  if(dataV3.routeRefreshing)return notice('Buscando líneas disponibles…');
  return empty(query?'líneas que coincidan con tu búsqueda':'líneas disponibles');
 }
 return matches.map(({r,i})=>
  item(r.nombre||r.id,'Ver recorrido en el mapa','chooseRouteLine('+i+')','route')).join('');
}
function filterRouteLines(){
 const input=document.getElementById('routeSearch');
 const output=document.getElementById('routeLineResults');
 if(!input||!output)return;
 dataV3.routeQuery=input.value||'';
 output.innerHTML=routeLineChoices();
}
function routeScrollToTop(){
 if(typeof root!=='undefined'&&root)root.scrollTop=0;
}
function chooseRouteLine(i){
 const selected=dataV3.lines[Number(i)];
 if(!selected)return;
 dataV3.routeRequestId++;
 dataV3.routeListScroll=typeof root!=='undefined'&&root?root.scrollTop:0;
 dataV3.routeLine=selected;
 dataV3.route=[];dataV3.routeLoading=false;dataV3.routeError='';dataV3.routeMapError='';
 dataV3.routeVariant=0;dataV3.routeAddresses={};dataV3.routeAddressPending=false;
 render();
 routeScrollToTop();
 void loadRoute();
}
function backToRouteLines(){
 dataV3.routeRequestId++;
 dataV3.routeLine=null;dataV3.route=[];dataV3.routeLoading=false;dataV3.routeError='';dataV3.routeMapError='';
 dataV3.routeVariant=0;dataV3.routeAddresses={};dataV3.routeAddressPending=false;
 render();
 if(typeof root!=='undefined'&&root)root.scrollTop=dataV3.routeListScroll||0;
}
async function refreshRouteLines(){
 if(dataV3.routeRefreshing)return;
 dataV3.routeRefreshing=true;
 dataV3.routeRefreshStatus='Actualizando las líneas…';
 dataV3.routeRefreshError='';
 const applyStatus=()=>{
  if(screen!=='routes'||dataV3.routeLine)return;
  const status=document.getElementById('routeRefreshStatus');
  if(status){status.textContent=dataV3.routeRefreshStatus;status.className='route-feedback'+(dataV3.routeRefreshError?' route-error':'');}
  const button=document.getElementById('refreshRouteLines');
  if(button)button.disabled=dataV3.routeRefreshing;
 };
 applyStatus();
 try{
  const response=await native('lines');
  if(!response||!Array.isArray(response.items)||!response.items.length)
   throw Error('Sin líneas disponibles');
  dataV3.lines=response.items;
  dataV3.routeRefreshStatus='Lista actualizada: '+response.items.length+' líneas.';
  if(screen==='routes'&&!dataV3.routeLine){
   const results=document.getElementById('routeLineResults');
   if(results)results.innerHTML=routeLineChoices();
  }
 }catch(e){
  dataV3.routeRefreshError='No pudimos actualizar las líneas. Revisá la conexión e intentá de nuevo.';
  dataV3.routeRefreshStatus=dataV3.routeRefreshError;
 }finally{
  dataV3.routeRefreshing=false;
  applyStatus();
 }
}
function routesV3(){
 let out=back('home')+
  intro('Recorridos','Elegí una línea para consultar su trayecto en el mapa.','RECORRIDOS');
 if(dataV3.routeLine){
  const variants=routeVariants();
  out+='<div class="card route-detail" aria-live="polite"><div class="cardhead"><h3>Recorrido · '+
   clean(dataV3.routeLine.nombre||dataV3.routeLine.id)+'</h3></div>';
  if(dataV3.routeLoading)out+='<p class="route-loading">Consultando el recorrido…</p>';
  else if(dataV3.routeError)out+='<p class="route-error">'+clean(dataV3.routeError)+'</p>';
  else if(variants.length){
   out+='<p>'+(variants.length>1?'Elegí el recorrido según dónde comienza y termina.':
    'Este es el trayecto completo disponible para la línea.')+'</p>'+
    '<div class="route-directions" role="group" aria-label="Origen y destino del recorrido">';
   out+=variants.map((r,i)=>{
    const from=routeEndpointInfo(r,i,'start'),to=routeEndpointInfo(r,i,'end');
    return '<button class="route-direction '+(dataV3.routeVariant===i?'selected':'')+
     '" onclick="chooseRouteVariant('+i+')" aria-pressed="'+(dataV3.routeVariant===i?'true':'false')+'">'+
     '<span class="route-place"><span class="route-place-label">SALE DE</span>'+
     '<strong>'+clean(from.title)+'</strong><small>'+clean(from.note)+'</small></span>'+
     '<span class="route-arrow" aria-hidden="true">'+I('arrow')+'</span>'+
     '<span class="route-place"><span class="route-place-label">LLEGA A</span>'+
     '<strong>'+clean(to.title)+'</strong><small>'+clean(to.note)+'</small></span></button>';
   }).join('')+'</div>'+
   (dataV3.routeAddressPending?'<p class="route-geocode-status" aria-live="polite">Buscando las calles de origen y destino…</p>':'');
   const current=variants[dataV3.routeVariant]||variants[0];
   out+='<p>Trayecto completo de origen a destino.</p>'+
    '<button class="primary map-action" onclick="openRouteMap()" '+
    (dataV3.routeMapLoading?'disabled':'')+'>'+I('pin')+
    (dataV3.routeMapLoading?' Abriendo mapa…':' Abrir mapa interactivo')+'</button>';
  }else out+='<p>Esta línea no tiene un trayecto geográfico disponible por ahora.</p>';
  if(dataV3.routeMapError)out+='<p class="route-error" role="alert">'+clean(dataV3.routeMapError)+'</p>';
  out+='<button class="secondary" onclick="loadRoute()" '+(dataV3.routeLoading?'disabled':'')+'>'+
   I('refresh')+' Reintentar consulta</button></div>'+
   '<button class="secondary route-change" onclick="backToRouteLines()">'+I('back')+' Elegir otra línea</button>';
  return out;
 }
 out+='<div class="headrow"><h3>Todas las líneas</h3></div>'+
  '<div class="search-bar line-search">'+I('search')+
  '<input id="routeSearch" aria-label="Buscar línea para ver recorrido" placeholder="Buscar número o nombre" value="'+
  clean(dataV3.routeQuery)+'" oninput="filterRouteLines()"/></div>'+
  '<div id="routeLineResults" class="route-line-list">'+routeLineChoices()+'</div>'+
  '<button id="refreshRouteLines" class="secondary" onclick="refreshRouteLines()" '+
  (dataV3.routeRefreshing?'disabled':'')+'>'+I('refresh')+' Actualizar líneas</button>'+
  '<p id="routeRefreshStatus" class="route-feedback'+(dataV3.routeRefreshError?' route-error':'')+'" aria-live="polite">'+
  clean(dataV3.routeRefreshStatus)+'</p>';
 return out;
}
function metersBetween(a,b){
 if(!a||!b)return null;
 const p=validGeoPoint(a),q=validGeoPoint(b);
 if(!p||!q)return null;
 const toRad=Math.PI/180;
 const dlat=(q.lat-p.lat)*toRad,dlon=(q.lon-p.lon)*toRad;
 const aa=Math.sin(dlat/2)**2+Math.cos(p.lat*toRad)*Math.cos(q.lat*toRad)*Math.sin(dlon/2)**2;
 return Math.round(6371000*2*Math.atan2(Math.sqrt(aa),Math.sqrt(1-aa)));
}
function distanceText(m){
 if(!Number.isFinite(m))return '';
 return m<1000?m+' m':(m/1000).toLocaleString('es-AR',{maximumFractionDigits:1})+' km';
}
async function loadNearby(){
 if(dataV3.nearLoading)return;
 dataV3.nearLoading=true;dataV3.nearError='';dataV3.nearDiagnostic=null;dataV3.nearby=[];render();
 try{
  const location=await native('location.get');
  if(!validGeoPoint(location))throw Error('El teléfono no devolvió una ubicación válida');
  dataV3.nearLocation={lat:location.lat,lon:location.lon};
  dataV3.nearAccuracy=Number.isFinite(Number(location.precisionMetros))?
   Math.max(0,Math.round(Number(location.precisionMetros))):null;
  const response=await native('nearby',{lat:String(location.lat),lon:String(location.lon)});
  if(!Array.isArray(response.items))throw Error('No pudimos completar la búsqueda.');
  dataV3.nearby=response.items;
  dataV3.nearDiagnostic={
   codigoEstado:response.codigoEstado,
   mensaje:String(response.mensaje||'').slice(0,250),
   originales:Number(response.registrosOriginales),
   interpretados:Number(response.registrosInterpretados),
   parcial:Boolean(response.parcial)
  };
 }catch(e){const message=String(e.message||'');dataV3.nearError=/ubicaci[oó]n|GPS|permiso|precisa/i.test(message)?message:'No encontramos paradas. Probá otra vez.';}
 dataV3.nearLoading=false;render();
}
function nearbyV3(){
 let out=intro('Paradas cerca tuyo','Encontrá paradas cerca de donde estás.','CERCA DE MÍ')+
 '<div class="card"><h3>Buscar paradas cercanas</h3>'+
 '<p>Usamos tu ubicación para buscar paradas cercanas.</p>'+
 '<button class="primary" onclick="loadNearby()" '+(dataV3.nearLoading?'disabled':'')+'>'+
 I('pin')+' '+(dataV3.nearLoading?'Buscando tu ubicación…':'Buscar paradas cerca de mí')+'</button></div>';
 if(dataV3.nearby.length){
  const list=dataV3.nearby.map((stop,i)=>({stop,i,d:metersBetween(dataV3.nearLocation,stop)}))
    .sort((a,b)=>(a.d??Number.MAX_VALUE)-(b.d??Number.MAX_VALUE));
  out+='<div class="headrow"><h3>Paradas encontradas ('+list.length+')</h3></div>';
  if(geoPoints(dataV3.nearby).length)
   out+='<button class="secondary map-action" onclick="openNearMap()">'+I('pin')+' Ver paradas en el mapa</button>';
  out+=list.slice(0,60).map(({stop,i,d})=>{
   const loc=nearbyStopLocation(stop);
   const summary=[loc.details,d!=null?distanceText(d):''].filter(Boolean).join(' · ');
   return item(loc.street,summary,'openNearbyStop('+i+')','pin');
  }).join('');
 }else if(!dataV3.nearLoading&&!dataV3.nearError&&dataV3.nearDiagnostic){
  out+=notice('No encontramos paradas cerca por ahora. Podés buscar por línea y localidad.');
  out+='<button class="secondary" onclick="go(&quot;lines&quot;)">Buscar paradas por línea</button>';
 }
 if(dataV3.nearLocation&&!dataV3.nearLoading)out+='<button class="secondary map-action" onclick="openNearMap()">'+I('pin')+' Ver mi ubicación en el mapa</button>';
 if(dataV3.nearError&&!dataV3.nearLocation)
  out+='<div class="card empty"><h3>No se pudo buscar</h3><p>'+clean(dataV3.nearError)+'</p></div>';
 return out;
}
function nearbyStopLocation(stop){
 const main=String(stop?.callePrincipal||'').trim();
 const cross1=String(stop?.cruce1||'').trim();
 const cross2=String(stop?.cruce2||'').trim();
 const height=String(stop?.altura||'').trim();
 const address=String(stop?.direccion||'').trim();
 const rawName=String(stop?.nombre||'').trim();
 const isCode=s=>!s||/^MO[- ]?\d+$/i.test(s)||/^\d+$/.test(s);
 let street=main;
 if(!street && address && !isCode(address))street=address;
 if(!street && rawName && !isCode(rawName))street=rawName;
 if(!street && String(stop?.detalle||'').trim())street=String(stop.detalle).trim();
 let details='';
 if(cross1&&cross2 && cross1.toLocaleLowerCase('es-AR')!==cross2.toLocaleLowerCase('es-AR'))
  details='Entre '+cross1+' y '+cross2;
 else if(cross1)details='Cruce con '+cross1;
 else if(cross2)details='Cruce con '+cross2;
 else details='Intersecciones no informadas por el servicio';
 return {street:street||'Calle no informada',details,at:height&&!street.includes(height)?'Altura '+height:''};
}
function nearStopArrivalsSorted(items){
 return [...(Array.isArray(items)?items:[])].sort((a,b)=>{
  const parse=v=>{
   const match=String(v?.arribo||'').match(/(\d{1,4})\s*min/i);
   return match?Number(match[1]):Number.MAX_VALUE;
  };
  return parse(a)-parse(b);
 });
}
async function loadNearStopArrivals(){
 const stop=dataV3.nearStop;
 if(!stop || dataV3.nearStopLoading)return;
 const requestId=++dataV3.nearStopRequestId;
 dataV3.nearStopArrivals=[];dataV3.nearStopError='';dataV3.nearStopMessage='';
 const ident=stopIdentifier(stop);
 if(!ident){
  dataV3.nearStopError='No hay información disponible para esta parada.';
  render();return;
 }
 dataV3.nearStopLoading=true;render();
 try{
  const response=await native('nearbyArrivals',{parada:ident});
  if(requestId!==dataV3.nearStopRequestId)return;
  if(!Array.isArray(response.items))throw Error('No pudimos consultar las llegadas');
  dataV3.nearStopArrivals=nearStopArrivalsSorted(response.items);
  dataV3.nearStopMessage=String(response.mensaje||'');
  dataV3.nearStopPartial=Boolean(response.parcial);
 }catch(e){
  if(requestId!==dataV3.nearStopRequestId)return;
  dataV3.nearStopError='No pudimos actualizar las llegadas. Intentá nuevamente.';
 }
 if(requestId===dataV3.nearStopRequestId){dataV3.nearStopLoading=false;render();}
}
function openNearbyStop(i){
 const stop=dataV3.nearby[i];if(!stop)return;
 ++dataV3.nearStopRequestId;dataV3.nearStopLoading=false;
 dataV3.nearStop=stop;
 dataV3.nearStopArrivals=[];
 dataV3.nearStopError='';
 dataV3.nearStopMessage='';
 dataV3.nearStopPartial=false;
 go('nearStop');
 loadNearStopArrivals();
}
function openNearStopMap(){
 if(!dataV3.nearStop)return;
 let point=validGeoPoint(dataV3.nearStop,nearbyStopLocation(dataV3.nearStop).street,'stop');
 if(!point)for(const a of dataV3.nearStopArrivals){
  point=validGeoPoint({lat:a.latParada,lon:a.lonParada},nearbyStopLocation(dataV3.nearStop).street,'stop');
  if(point)break;
 }
 const buses=geoPoints(dataV3.nearStopArrivals,a=>'Línea '+String(a.linea||'')+' · '+String(a.arribo||''),'bus');
 const points=[...(point?[point]:[]),...buses];
 openMap('stops','Parada cercana · Todas las líneas',points);
}
function nearArrivalCard(a,i){
 const eta=etaParts(a.arribo);
 const line=String(a.linea||'').trim();
 const destination=String(a.destino||'').trim();
 const num=eta.number?
  '<div class="eta-number">'+clean(eta.number)+'</div><span class="eta-unit">'+clean(eta.suffix)+'</span>':
  '<div class="eta-other">'+clean(eta.suffix)+'</div>';
 return '<div class="arrival-highlight">'+
   '<div class="arrival-eta"><span class="eta-kicker">'+(i===0?'PRÓXIMO':'SIGUIENTE')+'</span>'+num+'</div>'+
   '<div class="arrival-details"><strong class="arrival-line">'+clean(line?'Línea '+line:'Línea no informada')+'</strong>'+
   '<span class="arrival-destination">'+clean(destination||'Destino no informado')+'</span>'+
   '<span class="arrival-position">'+(validGeoPoint(a,'','bus')?'Ubicación en mapa disponible':'Ubicación GPS del colectivo no informada')+'</span></div></div>';
}
function nearbyStopV3(){
 const stop=dataV3.nearStop;
 if(!stop)return back('near')+intro('Parada cercana','Seleccioná una parada desde Cerca.','DETALLE DE PARADA');
 const address=nearbyStopLocation(stop);
 const distance=metersBetween(dataV3.nearLocation,stop);
 const name=clean(address.street);
 let out=back('near')+intro('Parada cercana',name,'CERCA DE MÍ')+
   '<div class="card near-address"><div class="eyebrow">UBICACIÓN DE LA PARADA</div>'+
   '<h3>'+name+'</h3>'+
   (address.at?'<p>'+clean(address.at)+'</p>':'')+
   '<p>'+clean(address.details)+'</p>'+
   (stop.localidad?'<p>'+clean(stop.localidad)+'</p>':'')+
   (distance!=null?'<p>'+clean(distanceText(distance))+' desde tu ubicación</p>':'')+'</div>'+
   '<div class="card arrival-panel"><div class="cardhead"><h3>Todas las líneas que llegan</h3></div>';
 if(dataV3.nearStopArrivals.length)out+=dataV3.nearStopArrivals.map(nearArrivalCard).join('');
 else if(dataV3.nearStopLoading)out+='<p>Buscando llegadas…</p>';
 else if(dataV3.nearStopError)out+='<p>No fue posible obtener arribos de esta parada.</p>';
 else out+='<p>Sin estimaciones por ahora.</p>';
 out+='</div>';
 if(dataV3.nearStopPartial)out+=notice('Puede haber más líneas sin estimación por ahora.');
 if(dataV3.nearStopError)out+='<div class="card empty"><h3>Consulta no disponible</h3><p>'+clean(dataV3.nearStopError)+'</p></div>';
 out+='<button class="primary" onclick="loadNearStopArrivals()" '+(dataV3.nearStopLoading?'disabled':'')+'>'+I('refresh')+
   (dataV3.nearStopLoading?' Consultando…':' Actualizar todas las llegadas')+'</button>';
 if(validGeoPoint(stop)||geoPoints(dataV3.nearStopArrivals).length)
   out+='<button class="secondary map-action" onclick="openNearStopMap()">'+I('pin')+' Ubicar esta parada y colectivos</button>';
 return out;
}
function settingsV3(){
 return intro('Preferencias','Consultá tus colectivos de manera simple.','AJUSTES')+
 '<div class="card"><h3>MOQSA</h3><p>Consultá líneas, paradas, recorridos y tus favoritos.</p></div>'+
 '<button class="secondary" onclick="go(\'home\')">Volver al inicio</button>';
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
  if(!Array.isArray(res.items)||!res.items.length)throw Error('No encontramos líneas en este momento');
  dataV3.lines=res.items;dataV3.loading=false;toast('Conectado: '+res.items.length+' líneas');go('lines');
 }catch(e){dataV3.loading=false;dataV3.error=e.message;render();}
}
function menuV3(){
 const entries=[['lines','Líneas y paradas','bus'],['fav','Guardados','star'],['routes','Recorridos','route'],['help','Cómo consultar','info'],['about','Acerca de MOQSA','bus']];
 return intro('Más opciones','Accedé directamente a las funciones útiles.','MOQSA')+
 '<div class="more-grid">'+entries.map(([page,label,icon])=>
 '<button class="more-item" onclick="go(\''+page+'\')">'+I(icon)+clean(label)+'</button>').join('')+'</div>';
}
function pendingV3(title){return intro(title,'Estamos preparando esta función.','PRÓXIMAMENTE')+
 '<div class="card empty"><h3>Próximamente</h3><p>Volvé a consultar más adelante.</p></div>'+
 '<button class="secondary" onclick="go(\'lines\')">Consultar líneas</button>';}
makers.home=mainV3;makers.more=menuV3;makers.lines=linesV3;makers.stops=stopsV3;makers.arrival=arrivalsV3;
makers.fav=favsV3;makers.routes=routesV3;makers.map=routesV3;makers.time=arrivalsV3;
PAGES.nearStop='Detalle de parada';
makers.nearStop=nearbyStopV3;
makers.settings=settingsV3;makers.near=nearbyV3;makers.journey=()=>pendingV3('¿Cómo llego?');
makers.voice=()=>pendingV3('Búsqueda por voz');makers.reload=()=>pendingV3('Puntos de recarga');
makers.reports=()=>pendingV3('Consultas y reclamos');makers.news=()=>pendingV3('Novedades');
makers.shortcuts=()=>pendingV3('Accesos directos');
makers.about=()=>intro('MOQSA','Encontrá tu colectivo con más facilidad.','ACERCA DE')+notice('Aplicación independiente y no oficial. Los tiempos son estimaciones.');
function helpV3(){
 const steps=[
 ['01','Buscá tu línea','Entrá en Líneas y escribí el número (por ejemplo, 300). Elegí el ramal que uses.'],
 ['02','Elegí la calle y el cruce','Seleccioná la localidad, la calle principal y después su intersección.'],
 ['03','Comprobá el sentido de la parada','Prestá atención al destino: “Hacia …” indica en qué dirección va el colectivo.'],
 ['04','Consultá el próximo arribo','El tiempo es aproximado y puede cambiar. Tocá Actualizar llegadas cuando quieras refrescar.'],
 ['05','Guardá y ubicá tu parada','Tocá la estrella para agregarla a Guardados. Si se conocen las coordenadas, también podés ubicarla en el mapa.']
 ];
 return intro('Cómo consultar','Todo lo que necesitás para encontrar tu colectivo más rápido.','GUÍA DE VIAJE')+
 '<div class="help-steps">'+steps.map(([n,title,description])=>
 '<div class="help-step"><span class="help-number">'+n+'</span><div><strong>'+title+'</strong><p>'+description+'</p></div></div>').join('')+'</div>'+
 '<div class="card help-tips"><h3>¿Cómo interpretar los tiempos?</h3>'+
 '<p><strong>“5 min aprox.”</strong> indica que el colectivo podría llegar en unos cinco minutos; no es una garantía.</p>'+
 '<p><strong>“Sin estimación”</strong> significa que no hay un tiempo disponible ahora.</p>'+
 '<p><strong>“Error de consulta”</strong> significa que no pudimos consultar en ese momento; probá otra vez.</p></div>'+
 '<div class="card help-tips"><h3>Mapas y recorridos</h3><p>Abrí el mapa desde una parada o un recorrido para ver su ubicación.</p></div>'+
 '<button class="primary" onclick="go(\'lines\')">'+I('bus')+' Empezar una consulta</button>'+
 '<button class="secondary" onclick="go(\'fav\')">'+I('star')+' Abrir mis paradas guardadas</button>';
}
makers.help=helpV3;
const oldGo=go;
const navTrail=[];
const stopSteps=[];
const MAX_NAV_TRAIL=60;
const MAX_STOP_STEPS=30;
function snapshotStopStep(){
 return {
  locality:dataV3.locality,street:dataV3.street,crossing:dataV3.crossing,
  crossings:dataV3.crossings,stops:dataV3.stops,
  scroll:typeof root!=='undefined'&&root?root.scrollTop:0
 };
}
function rememberStopStep(){
 stopSteps.push(snapshotStopStep());
 if(stopSteps.length>MAX_STOP_STEPS)stopSteps.shift();
}
function restoreStopStep(){
 if(!stopSteps.length)return false;
 invalidateStopRequests();
 const previous=stopSteps.pop();
 dataV3.locality=previous.locality;
 dataV3.street=previous.street;
 dataV3.crossing=previous.crossing;
 dataV3.crossings=previous.crossings||[];
 dataV3.stops=previous.stops||[];
 dataV3.loading=false;dataV3.error='';
 render();
 if(typeof root!=='undefined'&&root)root.scrollTop=previous.scroll||0;
 return true;
}

function snapshotNavScreen(){
 const previous={page:screen,scroll:typeof root!=='undefined'&&root?root.scrollTop:0};
 if(screen==='stops'){
  previous.stops=snapshotStopStep();
  previous.stopSteps=stopSteps.slice();
 }
 if(screen==='routes'){
  previous.route={
   line:dataV3.routeLine,items:dataV3.route,query:dataV3.routeQuery,
   variant:dataV3.routeVariant,error:dataV3.routeError,mapError:dataV3.routeMapError
  };
 }
 return previous;
}
function restoreNavScreen(entry){
 if(entry.stops && entry.page==='stops'){
  invalidateStopRequests();
  dataV3.locality=entry.stops.locality;
  dataV3.street=entry.stops.street;
  dataV3.crossing=entry.stops.crossing;
  dataV3.crossings=entry.stops.crossings||[];
  dataV3.stops=entry.stops.stops||[];
  dataV3.loading=false;dataV3.error='';
  stopSteps.splice(0,stopSteps.length,...(entry.stopSteps||[]));
 }
 if(entry.route && entry.page==='routes'){
  dataV3.routeRequestId++;
  dataV3.routeLine=entry.route.line;
  dataV3.route=entry.route.items||[];
  dataV3.routeQuery=entry.route.query||'';
  dataV3.routeVariant=entry.route.variant||0;
  dataV3.routeError=entry.route.error||'';
  dataV3.routeMapError=entry.route.mapError||'';
  dataV3.routeLoading=false;
  dataV3.routeMapLoading=false;
 }
 oldGo(entry.page);
 if(typeof root!=='undefined'&&root)root.scrollTop=entry.scroll||0;
 if(entry.page==='routes'&&!dataV3.lines.length)void refreshRouteLines();
 else if(entry.page==='lines'&&!dataV3.lines.length)loadLines();
}
function resetRouteSelection(){
 dataV3.routeRequestId++;
 dataV3.routeLine=null;dataV3.routeQuery='';dataV3.route=[];
 dataV3.routeLoading=false;dataV3.routeError='';dataV3.routeVariant=0;
 dataV3.routeMapLoading=false;dataV3.routeMapError='';
 dataV3.routeListScroll=0;
}
// Cada navegación nueva crea un nivel. Se recupera el desplazamiento al volver.
go=function(key){
 const destination=PAGES[key]?key:'home';
 if(destination===screen)return;
 navTrail.push(snapshotNavScreen());
 if(navTrail.length>MAX_NAV_TRAIL)navTrail.shift();
 if(destination==='routes')resetRouteSelection();
 oldGo(destination);
 if(destination==='routes'&&!dataV3.lines.length)void refreshRouteLines();
 else if(destination==='lines'&&!dataV3.lines.length)loadLines();
};
// Retroceder primero dentro de Recorridos y luego por pantallas visitadas.
window.moqsaGoBack=function(){
 if(screen==='routes'&&dataV3.routeLine){
  backToRouteLines();
  return true;
 }
 if(screen==='stops'&&restoreStopStep())return true;
 while(navTrail.length){
  const previous=navTrail.pop();
  if(!previous||!PAGES[previous.page]||previous.page===screen)continue;
  restoreNavScreen(previous);
  return true;
 }
 if(screen!=='home'){
  oldGo('home');
  return true;
 }
 return false;
};
back=function(fallback='home'){
 if(screen==='stops'&&stopSteps.length){
  return '<div class="page-header"><button class="back" aria-label="Volver al paso anterior" onclick="moqsaGoBack()">'+
   I('back')+'</button><span class="crumb">Volver al paso anterior</span></div>';
 }
 if(screen==='routes'&&dataV3.routeLine){
  return '<div class="page-header"><button class="back" aria-label="Volver a recorridos" onclick="moqsaGoBack()">'+
   I('back')+'</button><span class="crumb">Volver a recorridos</span></div>';
 }
 const previous=[...navTrail].reverse().find(p=>p&&PAGES[p.page]&&p.page!==screen);
 const target=previous?.page||fallback;
 return '<div class="page-header"><button class="back" aria-label="Volver a '+clean(PAGES[target]||'Inicio')+
  '" onclick="moqsaGoBack()">'+I('back')+'</button><span class="crumb">Volver a '+
  clean(PAGES[target]||'Inicio')+'</span></div>';
};
render();loadConfig();
