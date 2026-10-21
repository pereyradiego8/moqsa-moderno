package ar.com.colectivos.consulta

import android.content.Context
import android.location.Geocoder
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/** Consulta únicamente las coordenadas públicas de las cabeceras de cada recorrido. */
class RouteGeocoder(private val context: Context) {
    private val cached = LinkedHashMap<String, JSONObject>(48, 0.75f, true)

    fun lookup(input: JSONObject): JSONObject {
        val points = input.optJSONArray("points")
            ?: throw IllegalArgumentException("Faltan extremos del recorrido")
        if (points.length() !in 1..4)
            throw IllegalArgumentException("Cantidad de extremos inválida")
        val result = JSONArray()
        val geocoder = if (Geocoder.isPresent()) Geocoder(context, Locale("es", "AR")) else null
        for (i in 0 until points.length()) {
            val p = points.optJSONObject(i) ?: throw IllegalArgumentException("Punto inválido")
            val lat = p.optDouble("lat", Double.NaN)
            val lon = p.optDouble("lon", Double.NaN)
            if (!lat.isFinite() || !lon.isFinite() || lat !in -90.0..90.0 ||
                lon !in -180.0..180.0 || (lat == 0.0 && lon == 0.0))
                throw IllegalArgumentException("Coordenadas de recorrido inválidas")
            val key = String.format(Locale.US, "%.5f,%.5f", lat, lon)
            val existing = synchronized(cached) { cached[key] }
            if (existing != null) { result.put(JSONObject(existing.toString())); continue }
            val value = JSONObject().put("street", "").put("intersection", "")
                .put("locality", "").put("number", "")
            try {
                val address = geocoder?.getFromLocation(lat, lon, 1)?.firstOrNull()
                if (address != null) {
                    value.put("street", address.thoroughfare?.trim() ?: "")
                    value.put("number", address.subThoroughfare?.trim() ?: "")
                    value.put("locality", (address.locality ?: address.subAdminArea ?: "").trim())
                    // Android Geocoder no identifica de forma fiable las esquinas.
                    // No inferir intersecciones a partir de números de puerta.
                }
            } catch (_: Exception) {
                // La dirección puede faltar sin impedir ver el recorrido.
            }
            synchronized(cached) {
                cached[key] = JSONObject(value.toString())
                if (cached.size > 64) cached.remove(cached.keys.first())
            }
            result.put(value)
        }
        return JSONObject().put("items", result)
    }
}
