package ar.com.colectivos.consulta

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import org.json.JSONObject
import java.util.concurrent.Executors

/** Interfaz V3 empaquetada, cliente HTTPS separado del backend SOAP. */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private val executor = Executors.newSingleThreadExecutor()
    private val directSettings by lazy { DirectSettings(this) }
    private val directSoap by lazy { OriginalSoap(directSettings) }
    private val routeGeocoder by lazy { RouteGeocoder(applicationContext) }
    private val userLocation by lazy { UserLocation(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(4, 111, 88)
        window.navigationBarColor = Color.BLACK
        web = WebView(this)
        setContentView(web)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = true
        web.settings.allowContentAccess = false
        web.settings.setAllowUniversalAccessFromFileURLs(false)
        web.settings.setAllowFileAccessFromFileURLs(false)
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (url == "file:///android_asset/index.html") {
                    view?.evaluateJavascript(
                        "(function(){var x=document.createElement('link');x.rel='stylesheet';x.href='mobile.css';document.head.appendChild(x)})()", null
                    )
                }
            }
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                val uri = request?.url ?: return null
                if (uri.scheme == "http" || uri.scheme == "https")
                    return WebResourceResponse("text/plain", "UTF-8", ByteArrayInputStream(ByteArray(0)))
                return null
            }
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                if (uri.scheme == "https") {
                    try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) { }
                }
                return true
            }
        }
        web.addJavascriptInterface(Bridge(), "AndroidApi")
        web.loadUrl("file:///android_asset/index.html")
    }

    private inner class Bridge {
        @JavascriptInterface
        fun call(id: Int, action: String, parameters: String) {
            if (action == "location.get") {
                runOnUiThread {
                    userLocation.request { point, error ->
                        val response = if (point != null)
                            JSONObject().put("ok", true).put("data", point)
                        else
                            JSONObject().put("ok", false).put("error", error ?: "Sin ubicación")
                        if (!isFinishing && !isDestroyed) {
                            web.evaluateJavascript(
                                "window.moqsaNativeResult(" + id + "," +
                                JSONObject.quote(response.toString()) + ")", null
                            )
                        }
                    }
                }
                return
            }
            executor.execute {
                val response = try {
                    val args = JSONObject(parameters)
                    val value = when(action) {
                        "config.get" -> directSettings.publicConfig()
                        "config.set" -> directSettings.save(args)
                        "route.addresses" -> routeGeocoder.lookup(args)
                        "health" -> JSONObject()
                            .put("configured", directSettings.hasCredentials())
                            .put("service", "SOAP original de MOQSA")
                        "map.show" -> {
                            val points = args.optJSONArray("points")
                                ?: throw IllegalArgumentException("No se recibieron coordenadas")
                            if (points.length() < 1 || points.length() > 1200)
                                throw IllegalArgumentException("Cantidad de puntos inválida")
                            val kind = args.optString("type")
                            if (kind != "route" && kind != "stops")
                                throw IllegalArgumentException("Tipo de mapa desconocido")
                            val title = args.optString("title", "Mapa MOQSA").take(110)
                            val raw = points.toString()
                            if (raw.length > 105_000) throw IllegalArgumentException("Mapa demasiado grande")
                            runOnUiThread {
                                if (!isFinishing && !isDestroyed) {
                                    startActivity(Intent(this@MainActivity, MapActivity::class.java).apply {
                                        putExtra("map_title", title)
                                        putExtra("map_type", kind)
                                        putExtra("map_points", raw)
                                    })
                                }
                            }
                            JSONObject().put("opened", true)
                        }
                        else -> directSoap.execute(action, args)
                    }
                    JSONObject().put("ok", true).put("data", value)
                } catch (e: Exception) {
                    JSONObject().put("ok", false).put("error", e.message ?: "No se pudo completar la consulta")
                }
                runOnUiThread {
                    if (!isFinishing && !isDestroyed) {
                        web.evaluateJavascript(
                            "window.moqsaNativeResult(" + id + "," + JSONObject.quote(response.toString()) + ")", null
                        )
                    }
                }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Una única navegación para tecla y gesto Atrás, igual que las flechas de la interfaz.
        web.evaluateJavascript(
            "(function(){return typeof window.moqsaGoBack === 'function' ? window.moqsaGoBack() : false;})()"
        ) { handled ->
            if (handled != "true" && !isFinishing && !isDestroyed) {
                super@MainActivity.onBackPressed()
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        userLocation.onPermissionResult(requestCode, grantResults)
    }

    override fun onDestroy() {
        if (::web.isInitialized) userLocation.stop()
        executor.shutdownNow()
        web.removeJavascriptInterface("AndroidApi")
        web.destroy()
        super.onDestroy()
    }
}
