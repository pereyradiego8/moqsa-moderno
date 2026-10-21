# Estado de MOQSA Moderno

Arquitectura de red: `Android → HTTPS → clswbsas.smartmovepro.net/ModuloParadas/SWParadas.asmx`.

El WebService responde por HTTPS y sus operaciones y parámetros fueron validados previamente. Se retiró el antiguo proxy JSON del código y de la compilación. En esta nueva arquitectura el servidor SOAP requiere usuario y contraseña autorizados, que se guardan cifrados en el dispositivo y no forman parte del APK público.

Antes de declarar la aplicación lista: instalar el nuevo APK, configurar las credenciales, comprobar consulta de líneas, calles, intersecciones, paradas y tiempos, además de verificar mapas, GPS y funciones pendientes.

El repositorio sólo contiene el cliente Android. Sin código de servidor y sin despliegue de middleware.
