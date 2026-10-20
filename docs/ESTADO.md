# Estado de implementación — V3

Se trasladó la interfaz V3 aprobada a `app/src/main/assets/index.html`, agregando `live.js` para sustituir datos simulados por respuestas del puente JSON. El puente SOAP está en `backend/` y requiere credenciales propias en el servidor.

Conectadas en código: líneas, calles, intersecciones, paradas, llegadas, favoritos locales, consulta de puntos de recorrido.

Sin cerrar: compilación Android en CI, validación real del backend, GPS, mapas interactivos, voz, reclamos y pruebas físicas.

No instalar como reemplazo definitivo hasta completar validaciones.
