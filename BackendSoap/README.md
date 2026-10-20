# Backend API seguro de MOQSA Moderno

Puente HTTPS/JSON a consultas SOAP del proveedor, sin secretos en la APK.

## Endpoints públicos

- `GET /health`: indica si existen variables de conexión configuradas.
- `GET /v1/lineas`, `calles`, `intersecciones`, `paradas`, `cercanas`, `arribos`, `recorrido`, `recargas`.

Respuestas: `{"ok":true,"items":[...],"retrievedAt":"..."}`. Si faltan credenciales devuelve `503` con `{"ok":false,"error":"Servicio aún no configurado por el administrador"}` y jamás inventa arribos.

## Despliegue Vercel

Crear proyecto desde este repositorio con **Root Directory = BackendSoap**. Vercel reconoce `api/index.js` y `vercel.json`. La URL del proyecto se configura como base HTTPS del cliente Android. No contiene secretos de terceros.

## Credenciales

Configurar las variables en **Vercel → Proyecto → Settings → Environment Variables** usando credenciales **nuevas y autorizadas** facilitadas por el proveedor. Variables mínimas:

- `SOAP_ENDPOINT` (preferentemente HTTPS)
- `SOAP_USER`, `SOAP_PASSWORD`
- `SOAP_ENTITY` (código de entidad real)
- `SOAP_APP_CODE` si lo requiere el operador
- Opcionales: `SOAP_CITY`, `SOAP_COMPANIES`, `SOAP_RECHARGE_ENDPOINT`, `SOAP_RECHARGE_USER`, `SOAP_RECHARGE_PASSWORD`.

El código rechaza HTTP heredado salvo `ALLOW_LEGACY_HTTP=true`, que expone credenciales al proveedor por transporte sin cifrar; usar solo tras una evaluación específica, idealmente con túnel HTTPS privado. Nunca poner secretos en archivos del repositorio ni en `build.gradle`.

## Verificación

```sh
cd BackendSoap
npm test
curl https://TU_BACKEND/health
curl https://TU_BACKEND/v1/lineas
```

`configured=false` significa que el backend está publicado, pero todavía no está operativo el acceso a tiempos reales. La app debe seguir mostrando el error de conexión de modo explícito.
