# Cuándo Llega MOQSA — modernización 2.1.0 beta1

**Proyecto experimental e independiente, no oficial.** Parte de la APK 1.7 aportada por el usuario. No publica secretos de terceros ni pretende ser un reemplazo validado hasta probar las consultas reales.

## Contenido

| Directorio | Descripción |
|---|---|
| `AndroidModerno/` | Proyecto nativo Android Java, versión `2.1.0-beta1`; mapa real embebido, navegabilidad nueva, filtros por línea/calle/intersección, favoritos, arribos, GPS y reclamos por compartir |
| `BackendSoap/` | Puente JSON ↔ SOAP en Node.js; requiere configuración y credenciales **autorizadas** solo en el servidor |
| `.github/workflows/build-android.yml` | GitHub Actions para ejecutar pruebas y compilar APK debug sin depender de Android Studio local |
| `ESTADO_Y_PROXIMOS_PASOS.md` | Qué se verificó, límites y procedimiento de compilación |
| `tools/reskin_apk.py` | Recurso histórico usado en la primera prueba visual de la APK 1.7; **no** se utiliza en el cliente nuevo |

## Mejoras incorporadas

- Mapa con calles de OpenStreetMap dentro de la app, controles de zoom/desplazamiento, puntos cercanos, interacción con marcadores y ubicaciones del colectivo/parada cuando el servidor las provee.
- Recorridos sobre el mapa real; esquema vectorial como alternativa si no carga la cartografía.
- Barra de navegación inferior, cabecera con Volver/Inicio/Ajustes, persistencia de favoritos, filtros tolerantes a tildes, búsqueda por voz y consulta manual por número de parada.
- Arribos con actualización manual y automática cada 30 segundos durante consulta visible, sin generación de tiempos ficticios.
- Compartir reclamos con foto opcional sin usar credenciales FTP incrustadas en la app.

## Estado verificado

- **5 pruebas automáticas** del backend SOAP/JSON pasaron (con datos y SOAP simulados).
- **4 clases Java** verificadas sintácticamente y JS del mapa validado.
- **Prueba Chromium del componente HTML**: controles, 9 teselas solicitadas para viewport, marcadores y detalle de parada, sin errores JS. El acceso a teselas remotas estaba bloqueado en este entorno.
- **No hay APK nueva compilada:** faltan Gradle/Android SDK en este entorno. Se incorpora un workflow CI capaz de compilar cuando el proyecto esté en un repositorio GitHub nuevo.
- **No hay ETA real operativo sin backend autorizado.** No se han verificado servidores vigentes ni probado contraseñas antiguas; el cliente informa que el backend falta en lugar de mostrar estimaciones inventadas.

## Compilar y probar

**Opción 1: GitHub.** Crear repositorio **nuevo** para este proyecto; poner los archivos de `moqsa_modernizacion/` en su raíz, incluida `.github/workflows/build-android.yml`. Realizar `push` a `main` o lanzar manualmente *Actions → MOQSA Moderno - pruebas y APK*. Descargar artefacto `MOQSA-Moderno-2.1.0-beta1-debug`.

**Opción 2: Android Studio.** Abrir carpeta `AndroidModerno/`, instalar JDK 17 y SDK Android 35, sincronizar AGP 8.7.3 (Gradle 8.9), ejecutar Build APK(s), variante `debug`.

**Conectar transporte.** Obtener del proveedor un endpoint SOAP vigente y credenciales **nuevas** y autorizadas. Configurarlas en el servidor (`BackendSoap/.env.example` como modelo) y exponer el puente mediante HTTPS (véase `Caddyfile.example`). Abrir Ajustes en Android y escribir URL base del backend. Validar en teléfono real que `lineas`, `calles`, `intersecciones`, `paradas`, `arribos`, `cercanas` y `recorrido` regresen datos correctos.

El paquete `ar.com.cuandollega.moderno` permite instalar en paralelo sin sobreescribir el viejo. Antes de reemplazarlo, ejecutar pruebas de campo, verificar la licencia de datos y el uso de teselas, dar de alta firma de producción y auditar permisos.

## Compatibilidad con consultas del proveedor (2.2.0-beta3)

La pestaña **Llegadas** integra la web pública de SmartMovePro en un WebView seguro con JavaScript y almacenamiento DOM habilitados, navegación interna, recarga, ubicación previa autorización y salida al navegador. URL: https://cuandollega.smartmovepro.net/moqsa

Esta integración **no reutiliza credenciales del APK original** ni alimenta el buscador nativo con respuestas de SmartMovePro. Las estimaciones se muestran únicamente mediante la página publicada por el propio proveedor, si sigue operativa.

La conexión HTTPS a nuestro backend JSON continúa disponible en Ajustes. Sin acceso SOAP autorizado, ese backend no devuelve arribos.
