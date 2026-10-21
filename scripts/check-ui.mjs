import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('app/src/main/assets/live.js','utf8');
const native=fs.readFileSync('app/src/main/java/ar/com/colectivos/consulta/OriginalSoap.kt','utf8');
function section(start,end){
 const i=source.indexOf(start),j=source.indexOf(end,i);
 assert.ok(i>=0&&j>i,'Missing code: '+start);
 return source.slice(i,j);
}
const funcs=section('function stopHeading(r){','function mainV3(){');
const ctx=vm.createContext({dataV3:{stop:{nombre:'MO-01574',identificador:'MO-01574',sentido:''}}});
vm.runInContext(funcs,ctx);
assert.equal(vm.runInContext('stopHeading({sentido:"Constitución"})',ctx),'Hacia Constitución');
assert.equal(vm.runInContext('stopHeading({nombre:"MO-01574",identificador:"MO-01574"})',ctx),'Sentido no informado');
assert.ok(!section('function mainV3(){','function linesV3(){').includes("quickCard('Conexión'"));
assert.ok(source.includes('parada:dataV3.stop.identificador||dataV3.stop.id}'));
assert.ok(!source.includes('localityFromLabel'),'Never infer SOAP town from street');
assert.ok(!source.includes('stopLocality'),'Never infer SOAP town from street');
assert.ok(native.includes('params["localidad"] = "QUILMES"'),'SOAP uses original app-wide city setting default');
assert.ok(!native.includes('params["localidad"] = town'),'Regression: no per-street locality');
assert.ok(native.includes('message.contains("Parada inexistente"'),'Distinguish invalid stop from no buses');
assert.ok(native.includes('"LineaBanderaYbanAmpliada"'));
console.log('Passed: original SOAP city default, invalid stop error, stop heading and UI menu.');
