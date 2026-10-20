import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {handler} from '../app.mjs';
function listen(s){return new Promise(r=>s.listen(0,'127.0.0.1',()=>r(s.address().port)));}
function stop(s){return new Promise(r=>s.close(r));}

test('Integración: app JSON -> servidor autorizado de prueba -> SOAP y caché',async()=>{
 let calls=0;let seen='';
 const soap=http.createServer((req,res)=>{
   calls++;let xml='';req.on('data',c=>{xml+=c;});req.on('end',()=>{
     seen=xml;let operation=(req.headers.soapaction||'').split('/').at(-1).replace('"','');
     let payload;
     if(operation==='RecuperarLineaPorEntidad') payload={Lineas:[{CodigoLineaParada:100,Descripcion:'Línea TEST'}]};
     else if(operation==='RecuperarCallesPrincipalPorLinea')payload={Calles:[{Codigo:55,Descripcion:'Calle prueba'}]};
     else if(operation==='RecuperarProximosArribos')payload={Arribos:[{DescripcionLinea:'TEST',DescripcionBandera:'Centro',Arribo:'9 min'}]};
     else payload={MensajeEstado:'Sin datos'};
     const t=JSON.stringify(payload).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
     res.setHeader('content-type','text/xml');res.end(`<soap:Envelope><soap:Body><${operation}Response><${operation}Result>${t}</${operation}Result></${operation}Response></soap:Body></soap:Envelope>`);
   });
 });
 const port=await listen(soap);
 Object.assign(process.env,{SOAP_ENDPOINT:`http://127.0.0.1:${port}/test.asmx`,SOAP_USER:'test-only',SOAP_PASSWORD:'fake-password',SOAP_ENTITY:'test',ALLOW_LEGACY_HTTP:'true'});
 const app=http.createServer(handler);const httpport=await listen(app);
 try{
   let res=await fetch(`http://127.0.0.1:${httpport}/v1/lineas`),data=await res.json();
   assert.equal(res.status,200);assert.equal(data.items[0].nombre,'Línea TEST');
   assert.match(seen,/<usuario>test-only<\/usuario>/);
   assert.equal(data.items[0].id,'100');
   res=await fetch(`http://127.0.0.1:${httpport}/v1/lineas`);await res.json();assert.equal(calls,1,'debe cachear líneas');
   res=await fetch(`http://127.0.0.1:${httpport}/v1/calles?linea=100`);data=await res.json();assert.equal(data.items[0].nombre,'Calle prueba');
   res=await fetch(`http://127.0.0.1:${httpport}/v1/arribos?parada=123&linea=100`);data=await res.json();assert.equal(data.items[0].arribo,'9 min');
   res=await fetch(`http://127.0.0.1:${httpport}/v1/arribos?parada=%3Cscript%3E&linea=1`);assert.equal(res.status,400);
   res=await fetch(`http://127.0.0.1:${httpport}/v1/cercanas?lat=999&lon=-58.2`);assert.equal(res.status,400);
   res=await fetch(`http://127.0.0.1:${httpport}/health`);assert.equal((await res.json()).configured,true);
 }finally{await stop(app);await stop(soap);delete process.env.ALLOW_LEGACY_HTTP;delete process.env.SOAP_USER;delete process.env.SOAP_PASSWORD;delete process.env.SOAP_ENDPOINT;}
});
