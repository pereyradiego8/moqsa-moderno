import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('app/src/main/assets/live.js','utf8');
const soap = fs.readFileSync('app/src/main/java/ar/com/colectivos/consulta/OriginalSoap.kt','utf8');
const activity = fs.readFileSync('app/src/main/java/ar/com/colectivos/consulta/MainActivity.kt','utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Missing section '+start);
 return source.slice(a,b);
}
const ctx=vm.createContext({});
vm.runInContext(section('function stopHeading(r){','function mainV3(){'),ctx);
const evaluate=x=>vm.runInContext(x,ctx);

assert.equal(evaluate('stopHeading({sentido:"Constitución"})'),'Hacia Constitución');
assert.equal(evaluate('stopIdentifier({id:"14785",codigoInterno:"14785",identificador:""})'),'',
 'The internal register code is not a stop identifier');
assert.equal(evaluate('stopIdentifier({id:"14785",codigoInterno:"14785",identificador:"14785"})'),'',
 'Do not reuse a fallback numeric code from an older favorite');
assert.equal(evaluate('stopIdentifier({id:"14785",codigoInterno:"14785",identificador:"MO-01574"})'),'MO-01574');
assert.equal(evaluate('stopIdentifier({id:"100",codigoInterno:"100",identificador:"MO-01080"})'),'MO-01080');
assert.ok(!section('function mainV3(){','function linesV3(){').includes("quickCard('Conexión'"));
assert.ok(source.includes('parada:identifier}'), 'Arrivals send only validated identifiers');
assert.ok(!source.includes('parada:dataV3.stop.identificador||dataV3.stop.id'));
assert.ok(!source.includes("linea:'77',parada:'MO-01080'"),'Do not compare different routes');
assert.ok(source.includes('function diagnosticPanel()'),'On-device diagnostic compares selected route');
assert.ok(source.includes('Código de registro')&&source.includes('Identificador de llegadas'));
assert.ok(soap.includes('val codigoInterno = str(obj,"Codigo","CodigoParada")'));
assert.ok(soap.includes('val identificadorOriginal = str(obj,"Identificador","IdentificadorParada")'));
assert.ok(!soap.includes('str(obj,"Identificador","IdentificadorParada","Codigo")'));
assert.ok(soap.includes('params["localidad"] = "QUILMES"'));
assert.ok(soap.includes('message.contains("Parada inexistente"'));
assert.ok(!activity.includes('"diagnose.arrivals" ->'),'No unnecessary SOAP reference operation');
console.log('Passed: exact selected line and stop, independent Código/Identificador, no cross-line reference, SOAP city.');
