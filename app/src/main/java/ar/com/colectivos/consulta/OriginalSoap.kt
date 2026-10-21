package ar.com.colectivos.consulta

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import javax.xml.XMLConstants
import javax.xml.parsers.DocumentBuilderFactory

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
                params["localidad"] = "QUILMES"
            }
            "route" -> {
                operation = "RecuperarRecorridoParaMapaAbrevYAmpliPorEntidadYLinea"
                params["codigoLineaParada"] = required(q, "linea")
            }
            "nearby" -> {
                operation = "RecuperarParadasMasCercanasPorLocalidadProvinciaPais"
                params["latitud"] = required(q, "lat")
                params["longitud"] = required(q, "lon")
                params["listaCodigosEmpresa"] = "191,7"
                params["descripcionProvincia"] = "BUENOS AIRES"
                params["descripcionPais"] = "ARGENTINA"
            }
            else -> throw IllegalArgumentException("Operación SOAP desconocida")
        }
        if (action != "lines") {
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
            val factory = DocumentBuilderFactory.newInstance()
            factory.isNamespaceAware = true
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false)
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false)
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true)
            factory.isXIncludeAware = false
            factory.isExpandEntityReferences = false
            runCatching { factory.setAttribute("http://javax.xml.XMLConstants/property/accessExternalDTD", "") }
            runCatching { factory.setAttribute("http://javax.xml.XMLConstants/property/accessExternalSchema", "") }
            val doc = factory.newDocumentBuilder().parse(ByteArrayInputStream(response.toByteArray()))
            if (doc.getElementsByTagNameNS("*", "Fault").length > 0)
                throw IllegalStateException("El proveedor devolvió un error SOAP")
            val result = doc.getElementsByTagNameNS("*", operation + "Result")
            if (result.length == 0) throw IllegalStateException("No se encontró el resultado de " + operation)
            val raw = result.item(0).textContent?.trim() ?: ""
            val payload = decode(raw)
            return JSONObject().put("ok", true).put("items", normalize(action, payload))
                .put("mensaje", value(payload, "MensajeEstado", "mensajeEstado", "mensaje")?.toString() ?: "")
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
        if (root !is JSONObject || depth > 3) return JSONArray()
        val group = value(root, *names)
        if (group is JSONArray) return group
        if (group is JSONObject) return JSONArray().put(group)
        if (group is String) return rows(decode(group), names, depth + 1)
        if (root.length() == 1) {
            val child = root.opt(root.keys().next())
            if (child is JSONObject || child is JSONArray || child is String) return rows(child, names, depth + 1)
        }
        return JSONArray()
    }
    private fun normalize(kind: String, raw: Any): JSONArray {
        val keys = when(kind) {
            "lines" -> arrayOf("Lineas","Linea")
            "streets" -> arrayOf("Calles","Calle")
            "crossings" -> arrayOf("Calles","Intersecciones","Interseccion")
            "stops","nearby" -> arrayOf("Parada","Paradas")
            "arrivals" -> arrayOf("Arribos","Arribo")
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
                    normalized.put("id",str(obj,"Codigo","Identificador"))
                    normalized.put("identificador",str(obj,"Identificador","Codigo"))
                    normalized.put("nombre",str(obj,"Descripcion","CallePrincipal","Identificador"))
                    val first = str(obj,"CallePrincipal")
                    val second = str(obj,"CalleInterseccion")
                    normalized.put("detalle", listOf(first,second).filter { it.isNotBlank() }.joinToString(" y "))
                    normalized.put("lat",number(obj,"Latitud"))
                    normalized.put("lon",number(obj,"Longitud"))
                }
                "arrivals" -> {
                    normalized.put("linea",str(obj,"DescripcionLinea","Linea"))
                    normalized.put("destino",str(obj,"DescripcionBandera","Destino","Bandera"))
                    normalized.put("arribo",str(obj,"Arribo","Tiempo"))
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
                normalized.optString("id").isNotBlank() || normalized.optString("nombre").isNotBlank()) out.put(normalized)
        }
        return out
    }
}
