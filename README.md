# MOQSA Moderno — reconstrucción independiente V3

Este proyecto **no oficial** conserva el diseño HTML V3 y lo ejecuta como una interfaz móvil dentro de Android. Sustituye a la estructura anterior de este repositorio. No incluye el APK original ni credenciales del proveedor.

## Carpetas
- `app/`: aplicación Android Kotlin y WebView con HTML V3; pantallas en vivo para Líneas → Calles → Intersecciones → Paradas → Próximas llegadas, favoritos y recorridos.
- `backend/`: puente HTTPS/JSON ↔ SOAP en Node.js con pruebas y validación de entradas.
- `.github/workflows/build.yml`: pruebas automáticas y compilación del APK debug.

## Compilar
1. Ejecutar **GitHub → Actions → Construir MOQSA Moderno**. Con cada push a `main` también se ejecuta.
2. Si la compilación pasa, descargar el artefacto `moqsa-moderno-v3-debug` con el archivo APK.
3. Alternativa: abrir la raíz en Android Studio con Java 17, Gradle 8.9 y Android SDK 35.

## Estado actual del backend original (20/10/2026)

El proyecto **no utiliza el portal web de SmartMovePro**: se conecta directamente al WebService SOAP de la APK MOQSA 1.7 mediante HTTPS (`https://clswbsas.smartmovepro.net/ModuloParadas/SWParadas.asmx`). Verificado: WSDL HTTP 200 y respuestas autenticadas. La API del puente se despliega en `https://moqsa-moderno-api.vercel.app`; las claves del servicio se mantienen en variables privadas del servidor.

**Conexión validada:** el APK original contiene el valor por defecto de entidad `4` (leído desde `SharedPreferences.getInt("entidad", 4)`) y envía `codigoAplicacion=24` en la operación de arribos. Ambos se configuraron en el proyecto Vercel como variables privadas del entorno de producción.

Prueba real verificada en [GitHub Actions](https://github.com/pereyradiego8/moqsa-moderno/actions/runs/39517233529): 16 líneas, línea 159 1, 52 calles, intersección 50521, parada MO-01080 y una respuesta de llegada **«25 min. aprox.»** durante la prueba. Son datos vivos del proveedor, no horarios simulados. La respuesta podría cambiar con el tiempo. No implica que el APK ya haya sido probado en un teléfono.

## Conectar datos reales
1. Desplegar `backend/` en un servidor HTTPS (por ejemplo Vercel, Root Directory = `backend`).
2. Establecer SOLO en el servidor variables `SOAP_ENDPOINT`, `SOAP_USER`, `SOAP_PASSWORD`, `SOAP_ENTITY`, `SOAP_APP_CODE` y otras que correspondan según `backend/.env.example`. Usar exclusivamente acceso autorizado.
3. La app Android utiliza por defecto la URL HTTPS del puente anterior; en **Más → Configuración** se puede cambiar si se migra el servidor.
4. Consultar Líneas y comparar con el cliente anterior; repetir hasta comprobar arribos reales.

**El backend está configurado en el proyecto Vercel conectado**. En otros despliegues se deberán configurar las variables de servidor; las credenciales nunca se deben poner en GitHub ni en la app Android. Si falla la conexión, las pantallas muestran un error en vez de inventar arribos.

## Estado y límites
- Interfaz V3 real de la conversación, sin líneas ni horarios sintéticos en las pantallas funcionales.
- Navegación y protocolo JSON implementados, pero **sin APK Android validado en teléfono** al generar este commit.
- Favoritos persistentes en el teléfono mediante almacenamiento local del WebView.
- Los recorridos exponen los puntos recibidos; todavía falta mapa.
- GPS, voz, reclamos y rutas personalizadas siguen señaladas como pendientes, sin falsas funcionalidades.
- Solo HTTPS entre Android y el puente. HTTP hacia SOAP antiguo está desactivado por defecto (`ALLOW_LEGACY_HTTP=false`); habilitarlo únicamente tras evaluación específica.
- El backend ya pasó un recorrido real de extremo a extremo. Faltan pruebas de instalación, navegación y funcionamiento en teléfono Android.

Proyecto independiente, no afiliado oficialmente a MOQSA. No desinstalar la app antigua hasta validar la nueva.
