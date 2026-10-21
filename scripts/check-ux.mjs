import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('app/src/main/assets/live.js','utf8');
const css=fs.readFileSync('app/src/main/assets/mobile.css','utf8');
const activity=fs.readFileSync('app/src/main/java/ar/com/colectivos/consulta/MainActivity.kt','utf8');
const location=fs.readFileSync('app/src/main/java/ar/com/colectivos/consulta/UserLocation.kt','utf8');
const native=fs.readFileSync('app/src/main/java/ar/com/colectivos/consulta/MapActivity.kt','utf8');
const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
const soap=fs.readFileSync('app/src/main/java/ar/com/colectivos/consulta/OriginalSoap.kt','utf8');

function segment(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a, 'Missing code: '+start);
 return source.slice(a,b);
}
const ctx=vm.createContext({
 dataV3:{
  line:{id:'84',nombre:'300'},locality:null,street:null,crossing:null,
  streets:[
   {id:'1',nombre:'CALLE 25 - BERAZATEGUI'},
   {id:'2',nombre:'CALLE 4 - QUILMES'},
   {id:'3',nombre:'CALLE 9 - BERAZATEGUI'}
  ],
  crossings:[],stops:[],arrivals:[],stop:{identificador:'MO-01574',id:'14785',lat:null,lon:null},
  nearby:[],nearLocation:null
 }
});
vm.runInContext(segment('function validGeoPoint(','function mainV3(){'),ctx);
vm.runInContext(segment('const citySorter=','function chooseStreet(i){'),ctx);
vm.runInContext(segment('function etaParts(','function arrivalsV3(){'),ctx);
const evalExpr=src=>vm.runInContext(src,ctx);
const eta=evalExpr("etaParts('24 min. aprox.')");
assert.equal(eta.number,'24');
assert.match(eta.suffix,/min/i);
assert.equal(evalExpr("etaParts('9 min. aprox.').number"),'9');
assert.equal(evalExpr("etaParts('Sin estimación').number"),'');
assert.equal(JSON.stringify(evalExpr('cityList()')),JSON.stringify(['BERAZATEGUI','QUILMES']));
vm.runInContext("dataV3.locality='BERAZATEGUI'",ctx);
assert.equal(JSON.stringify(evalExpr("streetChoices().map(x=>x.r.nombre)")),JSON.stringify(['CALLE 9 - BERAZATEGUI','CALLE 25 - BERAZATEGUI']));
assert.ok(source.includes('currentStopPoint()'));
assert.ok(source.includes('lat:arrival.latParada,lon:arrival.lonParada'));
assert.ok(source.includes("geoPoints(dataV3.arrivals"));
assert.ok(source.includes("'bus'"));
assert.ok(source.includes('function loadNearby()'));
assert.ok(source.includes("native('location.get')"));
assert.ok(source.includes("native('nearby'"));
assert.ok(source.includes('distanceText('));
assert.ok(css.includes('grid-template-columns:minmax(0,126px) minmax(0,1fr)'));
assert.ok(css.includes('.eta-number'));
assert.ok(native.includes('markerIcon(iconType)')&&native.includes('Parada'));
assert.ok(location.includes('requestPermissions('));
assert.ok(location.includes('getLastKnownLocation'));
assert.ok(activity.includes('"location.get"'));
assert.ok(manifest.includes('android.permission.ACCESS_COARSE_LOCATION'));
assert.ok(soap.includes('"latParada"')&&soap.includes('"lonParada"'));
assert.ok(soap.includes('RecuperarParadasMasCercanasPorLocalidadProvinciaPais'));
assert.ok(soap.includes('params["localidad"] = "QUILMES"'),'Current working arrival city remains unchanged');
console.log('OK: 9/24 ETA, coordinates of selected stop, map types, GPS consent, city selector, numeric street order, original SOAP');
