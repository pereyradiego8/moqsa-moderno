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

## Conectar datos reales
1. Desplegar `backend/` en un servidor HTTPS (por ejemplo Vercel, Root Directory = `backend`).
2. Establecer SOLO en el servidor variables `SOAP_ENDPOINT`, `SOAP_USER`, `SOAP_PASSWORD`, `SOAP_ENTITY`, `SOAP_APP_CODE` y otras que correspondan según `backend/.env.example`. Usar exclusivamente acceso autorizado.
3. En la aplicación, ir a **Más → Configuración** e indicar la URL HTTPS pública de la API JSON (sin `/v1`).
4. Consultar Líneas y comparar con el cliente anterior; repetir hasta comprobar arribos reales.

**El backend no queda configurado automáticamente.** Sin credenciales y servidor autorizados, las pantallas informan el error en vez de inventar horarios. El proyecto anterior contenía un puente SOAP JSON útil que se migró y mantiene pruebas.

## Estado y límites
- Interfaz V3 real de la conversación, sin líneas ni horarios sintéticos en las pantallas funcionales.
- Navegación y protocolo JSON implementados, pero **sin APK Android validado en teléfono** al generar este commit.
- Favoritos persistentes en el teléfono mediante almacenamiento local del WebView.
- Los recorridos exponen los puntos recibidos; todavía falta mapa.
- GPS, voz, reclamos y rutas personalizadas siguen señaladas como pendientes, sin falsas funcionalidades.
- Solo HTTPS entre Android y el puente. HTTP hacia SOAP antiguo está desactivado por defecto (`ALLOW_LEGACY_HTTP=false`); habilitarlo únicamente tras evaluación específica.
- Una vez que pase CI, los datos reales requieren pruebas de extremo a extremo.

Proyecto independiente, no afiliado oficialmente a MOQSA. No desinstalar la app antigua hasta validar la nueva.
