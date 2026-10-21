import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('app/src/main/assets/live.js','utf8');
const css=fs.readFileSync('app/src/main/assets/mobile.css','utf8');
const a=source.indexOf('function lineNumber('),b=source.indexOf('async function loadOtherArrivals(',a);
const n=source.indexOf('function nearStopArrivalsSorted('),e=source.indexOf('async function loadNearStopArrivals(',n);
assert.ok(a>=0&&b>a&&n>=0&&e>n);
const ctx=vm.createContext({});
vm.runInContext(source.slice(n,e)+source.slice(a,b),ctx);
const call=expr=>vm.runInContext(expr,ctx);
assert.equal(call("lineNumber('619')"),'619');
assert.equal(call("lineNumber('Línea 619')"),'619');
assert.equal(call("lineNumber('619 RAMAL A')"),'619');
assert.equal(call("lineNumber('219')"),'219');
const expression=[
 "otherLinesAtStop([",
 "{linea:'619',arribo:'21 min. aprox.'},",
 "{linea:'219',destino:'A Terminal',arribo:'8 min. aprox.'},",
 "{linea:'603',destino:'A Cruce',arribo:'3 min. aprox.'},",
 "{linea:'Línea 619',arribo:'27 min. aprox.'},",
 "{linea:'',arribo:'9 min. aprox.'},",
 "{linea:'219',arribo:'14 min. aprox.'}",
 "], '619', [{linea:'619',arribo:'21 min. aprox.'}])",
 ".map(x=>x.linea+'@'+x.arribo).join('|')"
].join('');
assert.equal(call(expression),'603@3 min. aprox.|219@8 min. aprox.|219@14 min. aprox.');
const distinct=call("otherLinesAtStop([{linea:'300',arribo:'4 min. aprox.'},{linea:'584',arribo:'8 min. aprox.'}], '300', []).map(x=>x.linea).join(',')");
assert.equal(distinct,'584');
assert.ok(source.includes("native('nearbyArrivals',{parada:identifier})"),'Misma parada');
assert.ok(source.includes("await request('arrivals',{linea:dataV3.line.id,parada:identifier},'arrivals')"),'Conservar consulta original');
assert.ok(source.includes('Otras líneas en esta parada'));
assert.ok(source.includes('dataV3.otherArrivals.map(otherArrivalCard)'));
assert.ok(css.includes('.other-arrival-item'));
assert.ok(!source.includes('Diagnóstico de esta parada'));
assert.ok(!source.includes('Función experimental: el SOAP'));
console.log('OK: 219 y 603 aparecen; 619 no se duplica; ETA ordenada.');
