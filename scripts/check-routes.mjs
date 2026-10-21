import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('app/src/main/assets/live.js','utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,'No se encontró sección: '+start);
 return source.slice(a,b);
}
const dataV3={
 lines:[{id:'1',nombre:'65'},{id:'2',nombre:'619'},{id:'3',nombre:'300'}],
 line:{id:'99',nombre:'Última línea 98'},routeLine:null,routeQuery:'',
 route:[],routeRequestId:0,routeLoading:false,routeError:'',loading:false
};
const pending=[],maps=[],elements={
 routeSearch:{value:''},
 routeLineResults:{innerHTML:''}
};
const ctx=vm.createContext({
 dataV3,
 orderedRows:rows=>rows.map((r,i)=>({r,i})),
 native:(action,params)=>new Promise(resolve=>pending.push({action,params,resolve})),
 render:()=>{},
 openMap:(...args)=>maps.push(args),
 geoPoints:rows=>rows,
 clean:value=>String(value),
 intro:title=>'Título '+title+' | ',
 back:()=>'',notice:msg=>'Aviso '+msg,
 empty:msg=>'Sin '+msg,feedback:()=>'',I:x=>x,
 item:(name,description,action)=>'[Línea '+name+' '+action+']',
 document:{getElementById:id=>elements[id]||null},
 window:{},
 PAGES:Object.fromEntries(['home','lines','stops','routes','more'].map(k=>[k,k])),
 loadLines:()=>{},
 loadConfig:()=>{}
});
vm.runInContext(
 section('function openRouteMap(){','function mainV3(){')+
 section('function routeLineChoices(){','function metersBetween('),ctx);
const call=expr=>vm.runInContext(expr,ctx);

// Recorridos inicia sin seleccionar la línea utilizada para paradas.
let html=call('routesV3()');
assert.match(html,/Todas las líneas/);
assert.match(html,/Línea 65/);
assert.match(html,/Línea 619/);
assert.match(html,/Línea 300/);
assert.ok(!html.includes('Última línea 98'));
assert.ok(!html.includes('Recorrido · Última línea 98'));

// Filtrar no altera la línea de la consulta de paradas.
elements.routeSearch.value='619';
call('filterRouteLines()');
assert.match(elements.routeLineResults.innerHTML,/Línea 619/);
assert.ok(!elements.routeLineResults.innerHTML.includes('Línea 65'));
assert.equal(dataV3.routeQuery,'619');
assert.equal(dataV3.line.id,'99');

// Elegir una línea dispara su propio servicio de recorridos.
call('chooseRouteLine(1)');
assert.equal(dataV3.routeLine.nombre,'619');
assert.equal(dataV3.routeQuery,'');
assert.equal(pending[0].action,'route');
assert.equal(pending[0].params.linea,'2');
assert.match(call('routesV3()'),/Recorrido · 619/);

// Si se elige otra, una respuesta antigua no pisa el trayecto nuevo.
call('chooseRouteLine(0)');
assert.equal(pending[1].params.linea,'1');
pending[1].resolve({items:[{lat:-34.75,lon:-58.25,nombre:'Trayecto correcto'}]});
await new Promise(setImmediate);
assert.equal(dataV3.route[0].nombre,'Trayecto correcto');
pending[0].resolve({items:[{lat:-34.8,lon:-58.3,nombre:'Trayecto viejo'}]});
await new Promise(setImmediate);
assert.equal(dataV3.route[0].nombre,'Trayecto correcto');
call('openRouteMap()');
assert.match(maps[0][1],/65/);
assert.equal(dataV3.line.id,'99','La selección de paradas no debe cambiar');

// Volver a entrar desde cualquier pantalla vuelve a mostrar todas las líneas.
vm.runInContext("let screen='stops';function go(key){screen=key;}function back(){return '';}",ctx);
vm.runInContext(section('const oldGo=go;','render();loadConfig();'),ctx);
vm.runInContext("go('routes')",ctx);
assert.equal(dataV3.routeLine,null);
assert.equal(dataV3.route.length,0);
assert.equal(dataV3.routeQuery,'');
assert.match(call('routesV3()'),/Todas las líneas/);
console.log('OK: catálogo de recorridos independiente, filtro, selección, mapa y respuestas antiguas.');
