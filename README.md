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

## Corrección de identificadores (21/10/2026)

El APK original define `ParadaJson.Codigo` (entero de registro) y `ParadaJson.Identificador` (texto utilizado para próximos arribos) como propiedades distintas. La reconstrucción los confundía: si faltaba `Identificador`, usaba `Codigo` como reemplazo y podía enviar valores como `14785` en lugar de un identificador de parada tipo `MO-xxxxx`.

Se eliminó ese fallback en Kotlin y en la interfaz. Si la consulta de paradas no trae el identificador verdadero, el cliente lo indica y **no envía el código interno** a `RecuperarProximosArribos`. Las paradas deben seleccionarse nuevamente; favoritos creados con códigos incorrectos se detectan y requieren volver a seleccionar.

También se retiró el control de referencia `línea 77 / MO-01080`, que correspondía a otra línea distinta de la 300 (código interno 84) de la captura y no servía para comparar la misma consulta. El diagnóstico muestra solo línea, código de registro e identificador de la parada seleccionados, sin secretos.

**Pendiente:** todavía no se ha demostrado que todas las paradas devuelvan predicciones. Verificar los campos y los arribos reales con el APK nuevo antes de declarar el problema resuelto.
