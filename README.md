# MOQSA Moderno — cliente Android directo

Cliente no oficial con interfaz V3 y comunicación directa por HTTPS al mismo WebService SOAP de la APK MOQSA 1.7.

**Endpoint único:** `https://clswbsas.smartmovepro.net/ModuloParadas/SWParadas.asmx`

El APK no depende de Vercel, de un proxy JSON ni de ningún servicio intermedio.

## Implementación

- Consultas: líneas, calles, intersecciones, paradas, próximos arribos, recorridos, paradas cercanas.
- Valores recuperados de la APK original: entidad `4`, aplicación `24`, localidad `QUILMES`.
- Usuario y contraseña: se configuran una vez en Ajustes y se cifran localmente mediante Android Keystore (AES-GCM).
- No se publican las credenciales compartidas de un proveedor externo ni se incluyen en el APK público.
- Configuración local de credenciales requerida para usar el servicio.

## Compilación

GitHub Actions → **MOQSA Android directo al SOAP original** → artifact `moqsa-directo-debug`.

## Limitaciones

Aunque previamente se validó la secuencia SOAP mediante un proxy de prueba, el nuevo cliente directo aún requiere pruebas en dispositivo. Mapas, GPS, voz y algunas pantallas quedan pendientes. No desinstalar todavía la app original.

La APK no puede leer las preferencias privadas de otra app Android instalada. No hay ningún backend propio de este proyecto.

## Corrección 21/10/2026: sentidos y arribos

- `OriginalSoap` recupera los metadatos de sentido/bandera que el cliente anterior descartaba.
- El lector de JSON SOAP ahora busca `Arribos` y `Paradas` dentro de `PrincipalJson` incluso cuando la respuesta incluye `MensajeEstado` y otras propiedades.
- `RecuperarProximosArribos` ya no recibe `localidad=QUILMES` fija: usa la localidad de la calle seleccionada. Ejemplo verificado en los tests: `CALLE 24 - BERAZATEGUI` implica `BERAZATEGUI`.
- La lista de paradas presenta el sentido cuando está informado y deja `MO-xxxxx` como referencia secundaria. Nunca inventa un destino.
- La portada y el menú habitual omiten Configuración de conexión; el acceso técnico queda fuera del recorrido normal.
- Se añadió `scripts/check-ui.mjs` para probar localidades, sentidos y ausencia de la opción Conexión.
- La prueba automática valida compilación y arranque con un recurso de autenticación ficticio. No sustituye la comprobación de arribos reales en un teléfono.

**Para probarlo:** con la línea 300, elegir `CALLE 24 - BERAZATEGUI`, `CALLE 142 A - BERAZATEGUI` y comparar `MO-00527` o `MO-01574` contra la aplicación original. Si un destino sigue sin aparecer o hay arribos vacíos, el diagnóstico requiere confirmar los datos que devuelve esa parada; no se asignan nombres ni tiempos falsos.
