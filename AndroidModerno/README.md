# Cuándo Llega — cliente Android 2.1 beta

Proyecto Android Studio (`Java 17`, AGP `8.7.3`, SDK `35`, Android 8+). **No es una versión oficial de MOQSA ni constituye por sí solo un servicio de arribos funcional.** El origen es una APK antigua suministrada para análisis.

## Interfaz y funciones implementadas

- Inicio rediseñado, navegación inferior **Inicio / Mapa / Favoritos / Buscar**, Volver e Inicio en encabezado y botón Atrás de Android.
- Búsqueda de línea → calle → intersección → parada; búsqueda textual sin distinción de mayúsculas y tildes, y opción de voz.
- Consulta manual por número de parada y línea, favoritos locales y arribos con actualización manual y periódica cada 30 segundos si la pantalla sigue visible.
- Nuevo **mapa cartográfico interactivo integrado** (archivo `app/src/main/assets/map.html` y `MapPanel.java`): calles, zoom, arrastre, paradas cercanas y marcadores que permiten abrir arribos. Ubicaciones desde la consulta de arribos.
- Recorridos de línea superpuestos a la cartografía y posibilidad de mostrar el antiguo diagrama sin fondo si el mapa no carga.
- Indicación del origen/destino mediante aplicación de mapas externa, reclamos compartidos desde el teléfono con foto opcional (sin FTP inseguro).

**Mapas**: requiere conexión a Internet para teselas HTTPS de OpenStreetMap; no requiere Google Maps API key. Usa teselas exclusivamente del área visible, deja que WebView cachee según cabeceras HTTP, identifica la aplicación en el user-agent y conserva la atribución visible. Para un despliegue de alto volumen, contratar un proveedor autorizado de teselas o alojar uno propio. Ver [política oficial](https://operations.osmfoundation.org/policies/tiles/).

**Datos de transportes**: la app **no incluye** servidor MOQSA, datos de horarios ni credenciales antiguas. La consulta real depende de que el administrador configure una API HTTPS JSON `/v1` conectada con autorización al sistema de transporte. Si no está configurada, la interfaz muestra un aviso en lugar de inventar estimaciones.

## Compilación local

1. Instalar **Android Studio** (JDK 17; SDK Platform 35).
2. Abrir **esta carpeta `AndroidModerno/`** con Android Studio.
3. Esperar sincronización de Gradle y elegir `Build → Build APK(s)` en la variante `debug`.
4. Alternativamente, con Gradle 8.9 y SDK configurado: `gradle :app:assembleDebug` o `./compilar.sh`.
5. Resultado esperado: `app/build/outputs/apk/debug/app-debug.apk`. Es una APK **debug**, firmada con una clave de pruebas; no publicar esa firma como versión final.

## Compilación por GitHub Actions

Si se publica **el directorio padre** (el que contiene `AndroidModerno`, `BackendSoap` y `.github`) en la raíz de un repositorio nuevo, el flujo `.github/workflows/build-android.yml` compila automáticamente y publica el APK en *Actions → Artifacts*.

Si se sube **solo `AndroidModerno/`** como raíz, este proyecto también incluye el flujo `.github/workflows/android-debug.yml`.

## Comprobaciones y riesgos aún pendientes

- Se comprobó sintaxis Java y JavaScript, navegación/markers del HTML en Chromium y el puente SOAP con respuestas simuladas.
- **No se compiló el proyecto Android en el entorno de análisis** (sin Gradle ni Android SDK) y **no se ejecutó en un celular**; podrían quedar errores de compilación o ejecución.
- **No se verificó la cartografía remota en una app Android real**, ni las consultas reales del servidor MOQSA. Antes de reemplazar la app vieja, verificar conexión y consultar paradas reales en un dispositivo.
- El paquete `ar.com.cuandollega.moderno` no sobrescribe la APK oficial. No pretende importar favoritos automáticamente de la versión anterior.
