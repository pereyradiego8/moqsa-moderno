import test from 'node:test';import assert from 'node:assert/strict';
import {envelope,parseSoapXml} from '../soap.mjs';import {normalize,parseResponse} from '../normalize.mjs';

test('Escapar entradas SOAP inseguras',()=>{
 const doc=envelope('Operacion',{texto:'<hola> & "a"'});
 assert.match(doc,/&lt;hola&gt; &amp; &quot;a&quot;/);
 assert.doesNotMatch(doc,/<hola>/);
});
test('Procesar SOAP XML escapado y datos de líneas',()=>{
 const xml='<soap:Envelope><soap:Body><RecuperarLineaPorEntidadResponse><RecuperarLineaPorEntidadResult>{&quot;Lineas&quot;:[{&quot;CodigoLineaParada&quot;:123,&quot;Descripcion&quot;:&quot;Línea de prueba&quot;}]}</RecuperarLineaPorEntidadResult></RecuperarLineaPorEntidadResponse></soap:Body></soap:Envelope>';
 const obj=parseSoapXml(xml,'RecuperarLineaPorEntidad');
 assert.deepEqual(normalize('lineas',obj),[{id:'123',nombre:'Línea de prueba'}]);
});
test('Normalizar parada, cruce y arribo',()=>{
 assert.deepEqual(normalize('calles',{Calles:[{Codigo:23,Descripcion:'Calle X'}]}),[{id:'23',nombre:'Calle X'}]);
 assert.deepEqual(normalize('paradas',{Parada:[{Codigo:4,Identificador:'100',Descripcion:'Parada X',CallePrincipal:'Calle A',CalleInterseccion:'Calle B'}]})[0].identificador,'100');
 const arrival=normalize('arribos',{Arribos:[{DescripcionLinea:'123',DescripcionBandera:'Centro',Arribo:'5 min'}]})[0];
 assert.equal(arrival.arribo,'5 min');assert.equal(arrival.lat,null);
});
test('Sin datos de servidor no inventa horarios',()=>{assert.deepEqual(normalize('arribos',{MensajeEstado:'Sin datos'}),[]);});
