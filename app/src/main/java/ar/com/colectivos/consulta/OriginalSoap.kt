package ar.com.colectivos.consulta

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import android.util.Xml
import org.xmlpull.v1.XmlPullParser
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Cliente directo al WebService del APK MOQSA 1.7. No consulta servidores intermedios.
 * La autenticación se almacena en AndroidKeyStore por cada dispositivo.
 */
class OriginalSoap(private val settings: DirectSettings) {
    companion object {
        const val ENDPOINT = "https://clswbsas.smartmovepro.net/ModuloParadas/SWParadas.asmx"
        private const val NAMESPACE = "http://clsw.smartmovepro.net/"
    }
    private fun xml(v: String): String = v.replace("&", "&amp;").replace("<", "&lt;")
        .replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;")
    private fun required(q: JSONObject, field: String): String {
        val v = q.optString(field).trim()
        if (v.isEmpty() || v.length > 90) throw IllegalArgumentException("Parámetro inválido: " + field)
        return v
    }

    fun execute(action: String, q: JSONObject): JSONObject {
        if (action != "nearby" && action != "nearbyArrivals") return executeOnce(action, q, null)

        // Los métodos de cercanía aceptan lista de empresas, pero con "191,7" devolvía
        // FormatException (-9). Probamos los DOS códigos ya configurados, de a uno.
        // Solo bajo demanda; las consultas de llegadas no se modifican.
        val combined = JSONArray()
        val seen = HashSet<String>()
        var rawCount = 0
        var healthy = 0
        val warnings = ArrayList<String>()
        val previousCompanies = HashSet<String>()
        for (company in listOf("191", "7")) {
            try {
                val response = executeOnce(action, q, company)
                val status = response.optString("codigoEstado")
                val message = response.optString("mensaje").trim()
                if (status == "-9" || message.contains("System.FormatException", ignoreCase = true)) {
                    warnings.add("El proveedor rechazó el formato para una empresa consultada")
                    continue
                }
                if (status.toIntOrNull()?.let { it < 0 } == true) {
                    warnings.add("El proveedor informó un error para una empresa consultada")
                    continue
                }
                healthy++
                rawCount += response.optInt("registrosOriginales",
                    response.optJSONArray("items")?.length() ?: 0)
                val rows = response.optJSONArray("items") ?: JSONArray()
                val currentKeys = HashSet<String>()
                for (i in 0 until rows.length()) {
                    val record = rows.optJSONObject(i) ?: continue
                    if (action == "nearby") {
                        val key = record.optString("identificador").ifBlank {
                            record.optString("codigoInterno").ifBlank { record.toString() }
                        }
                        if (seen.add(key)) combined.put(record)
                    } else {
                        // No fusionar dos colectivos de una misma empresa con idéntica ETA.
                        // Evitar solamente repeticiones entre respuestas de empresas.
                        val key = listOf("linea","destino","arribo","lat","lon").joinToString("|") {
                            record.optString(it)
                        }
                        if (!previousCompanies.contains(key)) combined.put(record)
                        currentKeys.add(key)
                    }
                }
                previousCompanies.addAll(currentKeys)
            } catch (_: Exception) {
                warnings.add("No se pudo completar una consulta de cercanía")
            }
        }
        if (healthy == 0) {
            throw IllegalStateException(
                if (action == "nearbyArrivals")
                    "El servidor original no pudo consultar los arribos de esta parada."
                else "El servicio original rechazó la búsqueda de paradas cercanas."
            )
        }
        return JSONObject()
            .put("ok", true)
            .put("items", combined)
            .put("registrosOriginales", rawCount)
            .put("registrosInterpretados", combined.length())
            .put("codigoEstado", if (warnings.isEmpty()) 0 else 1)
            .put("mensaje", if (warnings.isEmpty()) if (action == "nearbyArrivals") "Consulta de arribos de todas las líneas completada."
                 else "Consulta de cercanía completada."
                else "Resultado parcial: " + warnings.joinToString("; ") + ".")
            .put("parcial", warnings.isNotEmpty())
            .put("fuente", "SOAP original MOQSA")
    }

    private fun executeOnce(action: String, q: JSONObject, companyCode: String?): JSONObject {
        val (user, pass) = settings.credentials()
        val params = linkedMapOf<String, String>()
        val operation: String
        when (action) {
            "lines" -> {
                operation = "RecuperarLineaPorEntidad"
                params["usuario"] = user
                params["clave"] = pass
                params["codigoEntidadSMP"] = "4"
            }
            "streets" -> {
                operation = "RecuperarCallesPrincipalPorLinea"
                params["codigoLineaParada"] = required(q, "linea")
            }
            "crossings" -> {
                operation = "RecuperarInterseccionPorLineaYCalle"
                params["codigoLineaParada"] = required(q, "linea")
                params["codigoCalle"] = required(q, "calle")
            }
            "stops" -> {
                operation = "RecuperarParadasPorLineaCalleEInterseccion"
                params["codigoLinea"] = required(q, "linea")
                params["codigoCalle"] = required(q, "calle")
                params["codigoInterseccion"] = required(q, "interseccion")
            }
            "arrivals" -> {
                operation = "RecuperarProximosArribos"
                params["identificadorParada"] = required(q, "parada")
                params["codigoLineaParada"] = required(q, "linea")
                params["codigoAplicacion"] = "24"
                // Valor por defecto comprobado en el APK original:
                // SharedPreferences("datos").getString("ciudad", "QUILMES").
                // No debe derivarse de la calle elegida (p.ej. CALLE 24 - BERAZATEGUI).
                params["localidad"] = "QUILMES"
            }
            "route" -> {
                operation = "RecuperarRecorridoParaMapaAbrevYAmpliPorEntidadYLinea"
                params["codigoLineaParada"] = required(q, "linea")
            }
            "nearbyArrivals" -> {
                // Operación del WSDL original destinada a consultar todas las líneas
                // disponibles para un identificador de parada, sin seleccionar línea.
                operation = "RecuperarProximosArribosParaParadasCercanas"
                params["usuario"] = user
                params["clave"] = pass
                params["identificadorParada"] = required(q, "parada")
                params["listaCodigosEmpresas"] = companyCode
                    ?: throw IllegalArgumentException("Código de empresa requerido")
                params["codigoAplicacion"] = "24"
                params["localidad"] = "QUILMES"
                params["isSublinea"] = "false"
                params["isSoloAdaptados"] = "false"
            }
            "nearby" -> {
                operation = "RecuperarParadasMasCercanasPorLocalidadProvinciaPais"
                // Respetar el orden del WSDL: usuario, clave, latitud, longitud...
                params["usuario"] = user
                params["clave"] = pass
                params["latitud"] = required(q, "lat")
                params["longitud"] = required(q, "lon")
                params["listaCodigosEmpresa"] = companyCode
                    ?: throw IllegalArgumentException("Código de empresa requerido")
                // El WSDL público declara isInteligente como booleano.
                params["isInteligente"] = "false"
                params["descripcionProvincia"] = "BUENOS AIRES"
                params["descripcionPais"] = "ARGENTINA"
            }
            else -> throw IllegalArgumentException("Operación SOAP desconocida")
        }
        if (action != "lines" && action != "nearby" && action != "nearbyArrivals") {
            params["usuario"] = user
            params["clave"] = pass
        }
        val body = params.entries.joinToString("") { (k,v) -> "<" + k + ">" + xml(v) + "</" + k + ">" }
        val envelope = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
            "<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" " +
            "xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" " +
            "xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">" +
            "<soap:Body><" + operation + " xmlns=\"" + NAMESPACE + "\">" + body +
            "</" + operation + "></soap:Body></soap:Envelope>"

        val connection = URL(ENDPOINT).openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 12000
        connection.readTimeout = 20000
        connection.instanceFollowRedirects = false
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "text/xml; charset=utf-8")
        connection.setRequestProperty("SOAPAction", "\"" + NAMESPACE + operation + "\"")
        connection.setRequestProperty("Accept", "text/xml")
        try {
            connection.outputStream.use { it.write(envelope.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            if (status !in 200..299) throw IllegalStateException("El servicio SOAP original respondió HTTP " + status)
            val response = ByteArrayOutputStream()
            connection.inputStream.use { input ->
                val buffer = ByteArray(8192)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    if (response.size() + count > 900_000) throw IllegalStateException("Respuesta SOAP demasiado grande")
                    response.write(buffer, 0, count)
                }
            }
            val responseXml = String(response.toByteArray(), Charsets.UTF_8)
            // No cargar declaraciones DTD ni entidades XML remotas o internas.
            if (responseXml.contains("<!DOCTYPE", ignoreCase = true) ||
                responseXml.contains("<!ENTITY", ignoreCase = true))
                throw IllegalStateException("El servicio devolvió XML con entidades no permitidas")
            val parser = Xml.newPullParser()
            parser.setInput(ByteArrayInputStream(response.toByteArray()), "UTF-8")
            var raw: String? = null
            var insideResult = false
            val resultText = StringBuilder()
            var depth = 0
            var event = parser.eventType
            while (event != XmlPullParser.END_DOCUMENT) {
                when (event) {
                    XmlPullParser.DOCDECL ->
                        throw IllegalStateException("El servidor devolvió un documento XML con DTD")
                    XmlPullParser.START_TAG -> {
                        if (parser.name == "Fault") throw IllegalStateException("El proveedor devolvió un error SOAP")
                        if (!insideResult && parser.name == operation + "Result") {
                            insideResult = true
                            depth = parser.depth
                        }
                    }
                    XmlPullParser.TEXT, XmlPullParser.CDSECT -> {
                        if (insideResult) resultText.append(parser.text ?: "")
                    }
                    XmlPullParser.END_TAG -> {
                        if (insideResult && parser.depth == depth && parser.name == operation + "Result") {
                            raw = resultText.toString().trim()
                            break
                        }
                    }
                }
                event = parser.next()
            }
            if (raw == null) throw IllegalStateException("El servicio no devolvió el resultado SOAP esperado")
            val payload = decode(raw)
            val items = normalize(action, payload)
            val message = value(payload, "MensajeEstado", "mensajeEstado", "mensaje")?.toString()?.trim() ?: ""
            if (action == "arrivals" && items.length() == 0 &&
                message.contains("Parada inexistente", ignoreCase = true)) {
                throw IllegalStateException("El servidor no reconoció esta parada. Se puede reintentar la consulta.")
            }
            val output = JSONObject().put("ok", true).put("items", items).put("mensaje", message)
            if (action == "nearby" || action == "nearbyArrivals") {
                // No son datos personales: solo la cantidad y el estado que informa el SOAP.
                // Diferencia lista realmente vacía de filas recibidas pero no interpretadas.
                val rawCount = if (action == "nearby")
                    rows(payload, arrayOf("Parada", "Paradas", "ListadoParadas")).length()
                else rows(payload, arrayOf("Arribos","Arribo","ProximosArribos",
                    "ProximoArribo","ArribosParadasCercanas")).length()
                output.put("registrosOriginales", rawCount)
                output.put("codigoEstado", value(payload, "CodigoEstado", "codigoEstado") ?: JSONObject.NULL)
                output.put("registrosInterpretados", items.length())
                output.put("fuente", "SOAP original MOQSA")
            }
            return output
        } finally {
            connection.disconnect()
        }
    }

    private fun decode(raw: String): Any {
        if (raw.isBlank()) return JSONObject()
        return try {
            val parsed = JSONTokener(raw).nextValue()
            if (parsed is String && parsed != raw) decode(parsed) else parsed
        } catch (_: Exception) {
            JSONObject().put("MensajeEstado", raw.take(500))
        }
    }
    private fun value(obj: Any?, vararg names: String): Any? {
        if (obj !is JSONObject) return null
        val keys = obj.keys()
        while (keys.hasNext()) {
            val k = keys.next()
            if (names.any { it.equals(k, true) }) {
                val v = obj.opt(k)
                if (v != JSONObject.NULL) return v
            }
        }
        return null
    }
    private fun str(obj: Any?, vararg names: String): String = value(obj, *names)?.toString() ?: ""
    private fun number(obj: Any?, vararg names: String): Any {
        val n = value(obj, *names)?.toString()?.toDoubleOrNull()
        return n ?: JSONObject.NULL
    }
    private fun rows(root: Any, names: Array<String>, depth: Int = 0): JSONArray {
        if (root is JSONArray) return root
        if (root is String) return if (depth < 6) rows(decode(root), names, depth + 1) else JSONArray()
        if (root !is JSONObject || depth > 5) return JSONArray()
        val group = value(root, *names)
        if (group is JSONArray) return group
        if (group is String) {
            val nested = rows(decode(group), names, depth + 1)
            if (nested.length() > 0) return nested
        }
        if (group is JSONObject) {
            val nested = rows(group, names, depth + 1)
            if (nested.length() > 0) return nested
            return JSONArray().put(group)
        }
        // El proveedor puede mezclar PrincipalJson, MensajeEstado y otros metadatos.
        // La condición antigua root.length()==1 hacía perder arribos de esas respuestas.
        for (key in arrayOf("PrincipalJson", "Principal", "Datos", "Resultado", "Data", "Items", "Detalle")) {
            val nestedValue = value(root, key) ?: continue
            val nested = rows(nestedValue, names, depth + 1)
            if (nested.length() > 0) return nested
        }
        val keys = root.keys()
        while (keys.hasNext()) {
            val child = root.opt(keys.next())
            if (child is JSONObject || child is JSONArray) {
                val nested = rows(child, names, depth + 1)
                if (nested.length() > 0) return nested
            }
        }
        return JSONArray()
    }
    private fun normalize(kind: String, raw: Any): JSONArray {
        val keys = when(kind) {
            "lines" -> arrayOf("Lineas","Linea")
            "streets" -> arrayOf("Calles","Calle")
            "crossings" -> arrayOf("Calles","Intersecciones","Interseccion")
            "stops","nearby" -> arrayOf("Parada","Paradas","ListadoParadas")
            "arrivals","nearbyArrivals" -> arrayOf("Arribos","Arribo","ProximosArribos",
                "ProximoArribo","ArribosParadasCercanas","ProximosArribosParaParadasCercanas")
            "route" -> arrayOf("Puntos","Recorrido")
            else -> arrayOf("items")
        }
        val input = rows(raw, keys)
        val out = JSONArray()
        for (i in 0 until input.length()) {
            val r = input.opt(i) ?: continue
            val obj = if (r is JSONObject) r else JSONObject().put("descripcion", r.toString())
            val normalized = JSONObject()
            when(kind) {
                "lines" -> {
                    normalized.put("id", str(obj,"CodigoLineaParada","Codigo","codigo"))
                    normalized.put("nombre",str(obj,"Descripcion","nombre"))
                }
                "streets","crossings" -> {
                    normalized.put("id",str(obj,"Codigo","codigo"))
                    normalized.put("nombre",str(obj,"Descripcion","nombre"))
                }
                "stops","nearby" -> {
                    // ParadaJson de la APK 1.7 contiene campos independientes:
                    // Codigo (registro interno) e Identificador (enviado a próximos arribos).
                    // Nunca usar Codigo como fallback para Identificador.
                    val codigoInterno = str(obj,"Codigo","CodigoParada")
                    val identificadorOriginal = str(obj,"Identificador","IdentificadorParada")
                    normalized.put("id",codigoInterno)
                    normalized.put("codigoInterno",codigoInterno)
                    normalized.put("identificador",identificadorOriginal)
                    normalized.put("identificadorPresente",identificadorOriginal.isNotBlank())
                    normalized.put("nombre",str(obj,"Descripcion","DescripcionParada","NombreParada","CallePrincipal"))
                    val first = str(obj,"CallePrincipal","NombreCalle")
                    val second = str(obj,"CalleInterseccion","InterseccionCalle")
                    normalized.put("detalle", listOf(first,second).filter { it.isNotBlank() }.joinToString(" y "))
                    normalized.put("callePrincipal",first)
                    normalized.put("cruce1",second)
                    normalized.put("cruce2",str(obj,"CalleInterseccion2",
                        "SegundaInterseccion","CalleEntre2","CalleSecundaria2"))
                    normalized.put("altura",str(obj,"Altura","Numero","Numeracion"))
                    normalized.put("direccion",str(obj,"Direccion","DireccionCompleta",
                        "Ubicacion","CalleYAltura","DireccionParada","Domicilio"))
                    // La APK 1.7 conserva estos campos de la bandera de cada parada.
                    val sentido = str(obj,"LineaBanderaYbanAmpliada",
                        "LineaBanderaYbanampliada","AbreviaturaAmpliadaBandera",
                        "DescripcionBandera","Sentido","Destino",
                        "AbreviaturaBandera","Bandera")
                    normalized.put("sentido",sentido)
                    normalized.put("bandera",str(obj,"AbreviaturaBandera","DescripcionBandera","Bandera"))
                    normalized.put("localidad",str(obj,"Localidad","DescripcionLocalidad","NombreLocalidad"))
                    normalized.put("lineaId",str(obj,"CodigoLineaParada","CodigoLinea"))
                    normalized.put("lineaNombre",str(obj,"DescripcionLinea","Linea"))
                    normalized.put("lat",number(obj,"Latitud"))
                    normalized.put("lon",number(obj,"Longitud"))
                }
                "arrivals","nearbyArrivals" -> {
                    normalized.put("linea",str(obj,"DescripcionLinea","Linea",
                        "NumeroLinea","AbreviaturaLinea","LineaDescripcion"))
                    normalized.put("destino",str(obj,"DescripcionBandera","Destino","Bandera","AbrevBandera"))
                    normalized.put("arribo",str(obj,"Arribo","Tiempo","ProximoArribo"))
                    normalized.put("lat",number(obj,"Latitud"))
                    normalized.put("lon",number(obj,"Longitud"))
                    normalized.put("latParada",number(obj,"LatParada"))
                    normalized.put("lonParada",number(obj,"LongParada"))
                }
                "route" -> {
                    normalized.put("id",str(obj,"Codigo"))
                    normalized.put("nombre",str(obj,"Descripcion"))
                    normalized.put("lat",number(obj,"Latitud"))
                    normalized.put("lon",number(obj,"Longitud"))
                }
            }
            if (kind == "arrivals" ||
                (kind == "nearbyArrivals" &&
                    (normalized.optString("linea").isNotBlank() ||
                     normalized.optString("arribo").isNotBlank())) ||
                normalized.optString("id").isNotBlank() ||
                normalized.optString("identificador").isNotBlank() ||
                normalized.optString("nombre").isNotBlank()) out.put(normalized)
        }
        return out
    }
}
