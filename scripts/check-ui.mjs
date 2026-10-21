import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('app/src/main/assets/live.js','utf8');
function section(start,end){
 const i=source.indexOf(start),j=source.indexOf(end,i);
 assert.ok(i>=0&&j>i,'Missing code: '+start);
 return source.slice(i,j);
}
const funcs=section('function localityFromLabel(','function mainV3(){');
const ctx=vm.createContext({dataV3:{
 stop:{nombre:'MO-01574',identificador:'MO-01574',localidad:''},
 street:'0',streets:[{nombre:'CALLE 24 - BERAZATEGUI'}],
 crossing:'0',crossings:[{nombre:'CALLE 142 A - BERAZATEGUI'}]
}});
vm.runInContext(funcs,ctx);
for(const [label,city] of [
 ['CALLE 24 - BERAZATEGUI','BERAZATEGUI'],
 ['AV MITRE - QUILMES','QUILMES'],
 ['CALLE 400 - FLORENCIO VARELA','FLORENCIO VARELA'],
 ['MO-01574','']]){
 assert.equal(vm.runInContext('localityFromLabel('+JSON.stringify(label)+')',ctx),city);
}
assert.equal(vm.runInContext('stopLocality()',ctx),'BERAZATEGUI');
assert.equal(vm.runInContext('stopHeading({sentido:"Constitución"})',ctx),'Hacia Constitución');
assert.equal(vm.runInContext('stopHeading({nombre:"MO-01574",identificador:"MO-01574"})',ctx),'Sentido no informado');
assert.ok(!section('function mainV3(){','function linesV3(){').includes("quickCard('Conexión'"));
assert.ok(source.includes('parada:dataV3.stop.identificador||dataV3.stop.id,localidad'));
const kotlin=fs.readFileSync('app/src/main/java/ar/com/colectivos/consulta/OriginalSoap.kt','utf8');
assert.ok(kotlin.includes('params["localidad"] = town'));
assert.ok(!kotlin.includes('params["localidad"] = "QUILMES"'));
assert.ok(kotlin.includes('"LineaBanderaYbanAmpliada"'));
console.log('Passed: 4 localities, stop direction/identifier, menu, native SOAP locality.');
