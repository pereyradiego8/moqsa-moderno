package ar.com.colectivos.consulta

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import org.json.JSONObject

/** Ubicación bajo demanda. No se consulta sin un gesto explícito del usuario. */
class UserLocation(private val activity: Activity) {
    companion object { const val REQUEST_CODE = 4182 }
    private val manager = activity.getSystemService(Activity.LOCATION_SERVICE) as LocationManager
    private val handler = Handler(Looper.getMainLooper())
    private var callback: ((JSONObject?, String?) -> Unit)? = null
    private var listener: LocationListener? = null
    private var fallback: Location? = null
    private var timeout: Runnable? = null

    fun request(deliver: (JSONObject?, String?) -> Unit) {
        if (callback != null) {
            deliver(null, "Hay una búsqueda de ubicación en curso")
            return
        }
        callback = deliver
        val fine = activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
        val coarse = activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) {
            activity.requestPermissions(arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ), REQUEST_CODE)
            return
        }
        acquire()
    }

    fun onPermissionResult(code: Int, result: IntArray) {
        if (code != REQUEST_CODE || callback == null) return
        if (result.any { it == PackageManager.PERMISSION_GRANTED }) acquire()
        else finish(null, "Activá el permiso de ubicación para buscar paradas cercanas")
    }

    private fun acquire() {
        try {
            val now = System.currentTimeMillis()
            val providers = listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)
                .filter { manager.isProviderEnabled(it) }
            if (providers.isEmpty()) {
                finish(null, "Activá la ubicación del teléfono para buscar paradas")
                return
            }
            val candidates = providers.mapNotNull { provider ->
                try { manager.getLastKnownLocation(provider) } catch (_: SecurityException) { null }
            }.filter { it.latitude in -90.0..90.0 && it.longitude in -180.0..180.0 }
            val best = candidates.maxByOrNull { it.time }
            fallback = best?.takeIf { now - it.time in 0..1800000 }
            if (best != null && now - best.time in 0..120000 &&
                best.accuracy <= 350f) {
                finish(best, null)
                return
            }
            val positionListener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    if (location.latitude in -90.0..90.0 && location.longitude in -180.0..180.0)
                        finish(location, null)
                }
                override fun onProviderDisabled(provider: String) { }
                override fun onProviderEnabled(provider: String) { }
                @Deprecated("Deprecated in Java")
                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) { }
            }
            listener = positionListener
            for (provider in providers) {
                try {
                    manager.requestLocationUpdates(provider, 0L, 0f, positionListener, Looper.getMainLooper())
                } catch (_: SecurityException) { }
            }
            val task = Runnable {
                val cached = fallback
                if (cached != null) finish(cached, null)
                else finish(null, "No pude determinar tu ubicación. Activá GPS o probá al aire libre.")
            }
            timeout = task
            handler.postDelayed(task, 16000)
        } catch (_: SecurityException) {
            finish(null, "No se otorgó permiso para obtener la ubicación")
        } catch (_: Exception) {
            finish(null, "No se pudo acceder a la ubicación del teléfono")
        }
    }

    private fun finish(point: Location?, error: String?) {
        val receiver = callback ?: return
        callback = null
        listener?.let { manager.removeUpdates(it) }
        listener = null
        timeout?.let { handler.removeCallbacks(it) }
        timeout = null
        fallback = null
        if (point != null) receiver(JSONObject()
            .put("lat", point.latitude).put("lon", point.longitude)
            .put("precisionMetros", point.accuracy.toDouble()), null)
        else receiver(null, error ?: "Ubicación no disponible")
    }

    fun stop() {
        callback = null
        listener?.let { manager.removeUpdates(it) }
        listener = null
        timeout?.let { handler.removeCallbacks(it) }
        timeout = null
    }
}
