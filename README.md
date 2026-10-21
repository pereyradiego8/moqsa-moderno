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

## Mapas y legibilidad — versión 0.4 beta

- Se agregó un visor cartográfico nativo con osmdroid y teselas de OpenStreetMap (requiere Internet). El backend de datos de transporte **continúa siendo el SOAP original**.
- Desde **Paradas** se puede abrir el mapa de paradas cuando existen coordenadas, o ir a **Recorridos** para consultar el trazado de la línea y mostrarlo en un mapa con desplazamiento y zoom.
- Desde **Próximas llegadas**, cuando el SOAP facilita coordenadas, se pueden ubicar la parada y las posiciones informadas de los colectivos. No se inventan ubicaciones ni trayectos.
- Los tiempos de llegada, número de línea y destino tienen tarjetas más grandes y mayor contraste.
- **Cómo consultar** ahora explica cómo elegir línea, calle, cruce, sentido, actualizar estimaciones, usar Guardados e interpretar mensajes y mapas.
- Los mapas usan únicamente coordenadas reales presentes en la respuesta SOAP. Si el servicio carece de ellas, la aplicación lo informa. OpenStreetMap suministra solo el fondo cartográfico, no las llegadas.
- El botón **Cerca** y algunas funciones no relacionadas con mapas siguen pendientes; no mostrar información falsa.
- La incorporación de osmdroid requiere validar nueva compilación Android y arranque. Conservar la APK anterior que ya devuelve arribos correctos hasta probar esta versión.

## Ajustes de UX, mapas y Cerca (21/10/2026)

- **Llegadas:** la ETA ahora separa el número de minutos de la unidad; el número de línea y su destino quedan en una columna estable, sin saltar a una fila inesperada en teléfonos angostos. No se alteró la operación SOAP de arribos.
- **Mapa de llegadas:** si una parada no trae coordenadas propias, se recuperan `LatParada` y `LongParada` de los arribos. Marcadores distintos: **P** verde parada, **C** azul colectivo, **YO** naranja ubicación del usuario.
- **Selección por localidad:** después de elegir una línea, se elige localidad → calle → intersección. Localidades, calles y cruces se ordenan mediante el comparador español con orden numérico natural. Las localidades se extraen de los nombres de calles informados por el servidor de transporte; no se inventa un catálogo municipal.
- **Cerca:** solicita permiso de ubicación al tocar Buscar, utiliza GPS/red del dispositivo y llama directamente a `RecuperarParadasMasCercanasPorLocalidadProvinciaPais` en el SOAP original. Ordena resultados por distancia cuando hay coordenadas. Abrir una parada para consultar arribos requiere que la respuesta incluya identificadores reales de línea y parada.
- **Sin servidores intermedios:** el servicio de transporte sigue siendo exclusivamente el SOAP original. OpenStreetMap se usa para descargar teselas del mapa, sin proporcionar tiempos de llegada.
- **Pruebas:** `scripts/check-ux.mjs` valida tiempos, localidades, coordenadas y ubicación bajo demanda; compilación y arranque en Android verificados. El funcionamiento de GPS, la identificación de paradas y la representación real de recorridos requieren pruebas en un teléfono.

**Conservar la última APK funcional como respaldo** hasta confirmar los resultados de Cerca y mapas en el dispositivo real.
