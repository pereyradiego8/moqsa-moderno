import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const live=fs.readFileSync('app/src/main/assets/live.js','utf8');
const position=live.lastIndexOf('const oldGo=go;');
assert.ok(position>=0,'Falta el historial de navegación');
const code=live.slice(position);
const pages=['home','lines','stops','arrival','fav','routes','near','nearStop','help','about','more','settings'];
const dataV3={
 lines:[{id:'77',nombre:'300'}],routeRequestId:0,route:[],routeLine:null,
 routeQuery:'',routeVariant:0,routeLoading:false,routeError:'',
 routeMapError:'',routeListScroll:0
};
const root={scrollTop:0};
const ctx=vm.createContext({window:{},root,dataV3,PAGES:Object.fromEntries(pages.map(p=>[p,p])),
 clean:x=>String(x),I:x=>x,render:()=>{},loadConfig:()=>{},loadLines:()=>{},
 refreshRouteLines:()=>{},backToRouteLines:()=>{
   dataV3.routeRequestId++;dataV3.routeLine=null;dataV3.route=[];dataV3.routeVariant=0;
   root.scrollTop=dataV3.routeListScroll;
 }});
vm.runInContext("let screen='home'; function go(page){screen=page;root.scrollTop=0;} function back(){return '';}",ctx);
vm.runInContext(code,ctx);
const get=()=>vm.runInContext('screen',ctx);
const go=page=>vm.runInContext('go('+JSON.stringify(page)+')',ctx);
const back=()=>vm.runInContext('window.moqsaGoBack()',ctx);
const arrow=()=>vm.runInContext("back('home')",ctx);
assert.equal(get(),'home');
assert.equal(back(),false,'Atrás en Inicio permite salir de Android');
// Pantallas anidadas: una por vez, sin saltos a Inicio.
root.scrollTop=140;
go('lines');root.scrollTop=365;
go('stops');root.scrollTop=250;
go('arrival');
assert.match(arrow(),/Volver a stops/);
assert.equal(back(),true);assert.equal(get(),'stops');assert.equal(root.scrollTop,250);
assert.equal(back(),true);assert.equal(get(),'lines');assert.equal(root.scrollTop,365);
assert.equal(back(),true);assert.equal(get(),'home');assert.equal(root.scrollTop,140);
assert.equal(back(),false);
// Desde guardados regresamos a guardados, no a inicio.
go('fav');go('arrival');
assert.equal(back(),true);assert.equal(get(),'fav');
go('more');go('help');
assert.equal(back(),true);assert.equal(get(),'more');
assert.equal(back(),true);assert.equal(get(),'fav');
// No duplicar pantalla por navegar al mismo destino.
go('lines');go('lines');go('stops');
assert.equal(back(),true);assert.equal(get(),'lines');
assert.equal(back(),true);assert.equal(get(),'fav');
// Recorridos con subvista de detalle: Atrás vuelve al listado antes del menú.
go('more');root.scrollTop=185;go('routes');root.scrollTop=260;
dataV3.routeListScroll=260;dataV3.routeLine={id:'2',nombre:'619'};
dataV3.route=[{nombre:'ramal real',lat:-34.7,lon:-58.2}];
dataV3.routeQuery='619';
assert.match(arrow(),/Volver a recorridos/);
assert.equal(back(),true);
assert.equal(get(),'routes','El detalle pertenece a la misma pantalla');
assert.equal(dataV3.routeLine,null);
assert.equal(root.scrollTop,260,'El catálogo recuerda dónde se tocó la línea');
assert.equal(vm.runInContext('navTrail.length',ctx),2,'No se consume una entrada al cerrar el detalle');
assert.equal(back(),true);assert.equal(get(),'more');assert.equal(root.scrollTop,185);
// Si otra pantalla se abre desde detalle, el Atrás debe restaurarlo.
go('routes');
dataV3.routeLine={id:'3',nombre:'300'};
dataV3.route=[{nombre:'R1;IDA',lat:-34.7,lon:-58.2}];
dataV3.routeVariant=0;
go('settings');assert.equal(get(),'settings');
assert.equal(back(),true);assert.equal(get(),'routes');
assert.equal(dataV3.routeLine.id,'3');
assert.equal(dataV3.route.length,1);
assert.equal(back(),true);assert.equal(dataV3.routeLine,null);
assert.equal(back(),true);assert.equal(get(),'more');
// La navegación por pestañas respeta el mismo historial sin bucles.
go('home');assert.equal(back(),true);assert.equal(get(),'more');
for(let i=0;i<90;i++)go(i%2?'lines':'home');
assert.ok(vm.runInContext('navTrail.length',ctx)<=60);
const android=fs.readFileSync('app/src/main/java/ar/com/colectivos/consulta/MainActivity.kt','utf8');
assert.ok(android.includes('window.moqsaGoBack()'));
assert.match(arrow(),/onclick="moqsaGoBack\(\)"/);
console.log('OK: Atrás por niveles, detalle->catálogo->origen, restauración de scroll y Android.');
