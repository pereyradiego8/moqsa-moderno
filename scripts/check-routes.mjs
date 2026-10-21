import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const live=fs.readFileSync('app/src/main/assets/live.js','utf8');
function section(start,end){
 const a=live.indexOf(start),b=live.indexOf(end,a);
 assert.ok(a>=0 && b>a,'Sección faltante: '+start);
 return live.slice(a,b);
}
const dataV3={
 lines:[{id:'1',nombre:'65'},{id:'2',nombre:'619'},{id:'3',nombre:'300'}],
 line:{id:'99',nombre:'Última línea 98'},routeLine:null,routeQuery:'',
 route:[],routeRequestId:0,routeVariant:0,routeMapLoading:false,routeMapError:'',
 routeLoading:false,routeError:'',routeRefreshing:false,routeRefreshStatus:'',
 routeRefreshError:'',loading:false
};
const pending=[], elements={routeSearch:{value:''},routeLineResults:{innerHTML:''}};
const ctx=vm.createContext({
 dataV3,
 screen:'routes',root:{scrollTop:340},
 orderedRows:rows=>rows.map((r,i)=>({r,i})),
 native:(action,params)=>new Promise((resolve,reject)=>pending.push({action,params,resolve,reject})),
 render:()=>{}, clean:value=>String(value),intro:title=>'Título '+title+' | ',
 back:()=>'',notice:msg=>'Aviso '+msg,empty:msg=>'Sin '+msg,feedback:()=>'',I:x=>x,
 item:(name,description,action)=>'[Línea '+name+' '+action+']',
 document:{getElementById:id=>elements[id]||null},
 window:{},
 PAGES:Object.fromEntries(['home','lines','stops','routes','more'].map(k=>[k,k])),
 loadLines:()=>{},loadConfig:()=>{}
});
vm.runInContext(
 section('function validGeoPoint(','function currentStopPoint(')+
 section('function routeLabelFromService(','function mainV3(){')+
 section('function routeLineChoices(){','function metersBetween('),ctx);
const call=expr=>vm.runInContext(expr,ctx);
assert.match(call('routesV3()'),/Todas las líneas/);
assert.match(call('routesV3()'),/Línea 65/);
assert.match(call('routesV3()'),/Línea 619/);
assert.ok(!call('routesV3()').includes('Última línea 98'));

elements.routeSearch.value='619';
call('filterRouteLines()');
assert.match(elements.routeLineResults.innerHTML,/Línea 619/);
assert.ok(!elements.routeLineResults.innerHTML.includes('Línea 65'));
assert.equal(dataV3.line.id,'99');
call('chooseRouteLine(1)');
assert.equal(ctx.root.scrollTop,0);
assert.equal(dataV3.routeQuery,'619');
assert.equal(pending[0].action,'route');
assert.equal(pending[0].params.linea,'2');
assert.equal(pending[0].params.isSublinea,false);
assert.match(call('routesV3()'),/Recorrido · 619/);

// Cambiar de línea: una respuesta demorada nunca reemplaza la vigente.
call('chooseRouteLine(0)');
pending[1].resolve({items:[{lat:-34.75,lon:-58.25,nombre:'Tramo real'}]});
await new Promise(setImmediate);
pending[0].resolve({items:[{lat:-34.8,lon:-58.3,nombre:'Tramo viejo'}]});
await new Promise(setImmediate);
assert.equal(dataV3.route[0].nombre,'Tramo real');
const opening=call('openRouteMap()');
assert.equal(pending[2].action,'map.show');
assert.equal(pending[2].params.type,'route');
assert.equal(pending[2].params.points.length,1);
pending[2].resolve({opened:true});
await opening;
assert.equal(dataV3.line.id,'99');

// El selector también aparece con una sola variante real.
dataV3.route=[{nombre:'ÚNICO;Hacia Bernal',lat:-34.7,lon:-58.2}];
assert.equal(call('routeVariants().length'),1);
assert.equal(call('routeVariants()[0].label'),'Hacia Bernal');
assert.match(call('routesV3()'),/chooseRouteVariant\(0\)/);
assert.match(call('routesV3()'),/Este es el recorrido disponible/);
// No inventar ramales cuando el servidor entrega nombres por vértice.
dataV3.route=Array.from({length:15},(_,i)=>({
 nombre:'Punto '+(i+1),lat:-34.7+i*.0001,lon:-58.2+i*.0001
}));
assert.equal(call('routeVariants().length'),1);
assert.equal(call('routeVariants()[0].label'),'Recorrido disponible');

// Un recorrido con ramales independientes no debe unir las geometrías.
dataV3.route=[
 {nombre:'R1;Ida',lat:-34.75,lon:-58.2},
 {nombre:'R1;Ida',lat:-34.74,lon:-58.19},
 {nombre:'R2;Vuelta',lat:-34.73,lon:-58.18},
 {nombre:'R2;Vuelta',lat:-34.72,lon:-58.17}
];
assert.equal(call('routeVariants().length'),2);
assert.match(call('routesV3()'),/Elegí el ramal/);
call('chooseRouteVariant(1)');
const onlyVuelta=call('routeMapPoints()');
assert.equal(onlyVuelta.length,2);
assert.equal(onlyVuelta[0].lat,-34.73);

// Recorridos largos se muestrean, sin inventar puntos y conservando extremos.
dataV3.route=Array.from({length:5000},(_,i)=>({
 nombre:'R1;Ida',lat:-34.8+i*0.00001,lon:-58.3+i*0.00001
}));
dataV3.routeVariant=0;
const sampled=call('routeMapPoints()');
assert.ok(sampled.length<=650);
assert.equal(sampled[0].lat,-34.8);
assert.ok(Math.abs(sampled.at(-1).lat-(-34.8+4999*.00001))<1e-7);
assert.ok(JSON.stringify(sampled).length<105000);

// Reintento o fallo del servicio debe mostrar un estado visible.
dataV3.route=[{nombre:'',lat:null,lon:null}];
assert.equal(call('routeVariants().length'),0);
dataV3.routeError='No se recibió mapa.';
assert.match(call('routesV3()'),/No se recibió mapa/);
call('backToRouteLines()');
assert.equal(dataV3.routeLine,null);
assert.equal(dataV3.line.id,'99');

vm.runInContext("screen='stops';function go(key){screen=key;}function back(){return '';}",ctx);
vm.runInContext(section('const oldGo=go;','render();loadConfig();'),ctx);
call("go('routes')");
assert.equal(dataV3.routeLine,null);
assert.match(call('routesV3()'),/Todas las líneas/);
ctx.screen='routes';ctx.root.scrollTop=270;
const updating=call('refreshRouteLines()');
assert.equal(pending[3].action,'lines');
assert.match(dataV3.routeRefreshStatus,/Actualizando/);
pending[3].resolve({items:[{id:'4',nombre:'584'},{id:'5',nombre:'603'}]});
await updating;
assert.equal(dataV3.lines.length,2);
assert.match(dataV3.routeRefreshStatus,/Lista actualizada/);
assert.equal(ctx.root.scrollTop,270);
console.log('OK: líneas, ramas, geometría extensa, mapa, refresco, mensajes y navegación.');
