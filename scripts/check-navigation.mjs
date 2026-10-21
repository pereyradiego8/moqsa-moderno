import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const live=fs.readFileSync('app/src/main/assets/live.js','utf8');
const index=live.lastIndexOf('const oldGo=go;');
assert.ok(index>=0,'No existe la implementación del historial');
const navigation=live.slice(index);
const pages=['home','lines','stops','arrival','fav','routes','near','help','about','more','settings'];
const stub={
 screen:'home',
 PAGES:Object.fromEntries(pages.map(x=>[x,x])),
 go:function(page){this.screen=page;},
 back:()=>'', render:()=>{}, loadConfig:()=>{}, loadLines:()=>{},
 dataV3:{lines:[{id:'77',nombre:'300'}]},
 clean:x=>String(x),I:x=>x
};
// Las variables declaradas con let a nivel de la página son parte del contexto léxico.
const ctx=vm.createContext({window:{},PAGES:stub.PAGES,dataV3:stub.dataV3,
 clean:stub.clean,I:stub.I,render:stub.render,loadConfig:stub.loadConfig,loadLines:stub.loadLines});
vm.runInContext("let screen='home'; function go(page){screen=page;} function back(){return '';}",ctx);
vm.runInContext(navigation,ctx);
const get=()=>vm.runInContext('screen',ctx);
const go=page=>vm.runInContext('go('+JSON.stringify(page)+')',ctx);
const back=()=>vm.runInContext('window.moqsaGoBack()',ctx);
const arrow=()=>vm.runInContext("back('home')",ctx);
assert.equal(get(),'home');
assert.equal(back(),false,'Atrás en Inicio debería cerrar Android');
go('lines');go('stops');go('arrival');
assert.equal(get(),'arrival');
assert.match(arrow(),/Volver a stops/);
assert.equal(back(),true);
assert.equal(get(),'stops');
assert.match(arrow(),/Volver a lines/);
assert.equal(back(),true);
assert.equal(get(),'lines');
assert.equal(back(),true);
assert.equal(get(),'home');
assert.equal(back(),false);

go('fav');go('arrival');
assert.equal(back(),true);
assert.equal(get(),'fav','Atrás desde favorito vuelve a Favoritos');
go('more');go('help');
assert.equal(back(),true);
assert.equal(get(),'more','Atrás desde Ayuda vuelve a Más');
assert.equal(back(),true);
assert.equal(get(),'fav');

go('lines');go('lines');go('stops');
assert.equal(back(),true);
assert.equal(get(),'lines','Navegar al mismo destino no debe duplicar historial');
assert.equal(back(),true);
assert.equal(get(),'fav');

go('home');
assert.equal(back(),true);
assert.equal(get(),'fav','Atrás desde Inicio vuelve a la pestaña anterior si hay historial');
for(let i=0;i<90;i++)go(i%2?'lines':'home');
assert.ok(vm.runInContext('navTrail.length',ctx)<=60,'El historial debe estar limitado');
assert.equal(fs.readFileSync('app/src/main/java/ar/com/colectivos/consulta/MainActivity.kt','utf8').includes('window.moqsaGoBack()'),true);
console.log('OK: pantalla anterior, favoritos, Más, flechas, pestañas, sin duplicados y máximo 60 pantallas');
