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

## Corrección de arribos — 21/10/2026

El APK original toma la ciudad desde SharedPreferences('datos').getString('ciudad', 'QUILMES') y la envía a RecuperarProximosArribos.
El nombre de la calle (ejemplo: CALLE 24 - BERAZATEGUI) no determina la ciudad para SOAP.

El cliente había cambiado erróneamente esa ciudad a BERAZATEGUI, lo que coincidió con respuestas 'Parada inexistente'.
Se restauró el valor por defecto QUILMES. Si en una instalación se eligió manualmente otra ciudad, deberá configurarse ese valor.
El mensaje 'Parada inexistente' se trata ahora como error del servidor y no como ausencia de predicciones.

Se actualizaron las pruebas de regresión en scripts/check-ui.mjs para impedir deducir ciudad de la calle.
El APK privado de emergencia, firmado con el certificado de la versión anterior, corrige ese parámetro desde el JavaScript sin alterar clases Android.

**Pendiente:** validación de llegadas reales en un teléfono. No afirmar que las predicciones funcionan hasta completar esa prueba.
