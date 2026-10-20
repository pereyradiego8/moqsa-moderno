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
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** Interfaz V3 empaquetada, cliente HTTPS separado del backend SOAP. */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private val backendDefault = "https://moqsa-moderno-api.vercel.app"
    private val executor = Executors.newSingleThreadExecutor()
    private val preferences by lazy { getSharedPreferences("moqsa_backend", MODE_PRIVATE) }

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
            executor.execute {
                val response = try {
                    val args = JSONObject(parameters)
                    val value = when(action) {
                        "config.get" -> JSONObject().put("baseUrl", preferences.getString("baseUrl", backendDefault) ?: backendDefault)
                        "config.set" -> {
                            val base = args.optString("baseUrl").trim().trimEnd('/')
                            val uri = Uri.parse(base)
                            if (uri.scheme != "https" || uri.host.isNullOrBlank() || uri.encodedAuthority?.contains("@") == true)
                                throw IllegalArgumentException("Ingresá una URL HTTPS válida")
                            preferences.edit().putString("baseUrl", base).apply()
                            JSONObject().put("saved", true)
                        }
                        else -> request(action, args)
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

    private fun request(action: String, args: JSONObject): JSONObject {
        val base = preferences.getString("baseUrl", backendDefault)?.trimEnd('/') ?: backendDefault
        if (!base.startsWith("https://")) throw IllegalStateException("Configurá un backend HTTPS en Ajustes")
        val path = when(action) {
            "health" -> "/health"
            "lines" -> "/v1/lineas"
            "streets" -> "/v1/calles"
            "crossings" -> "/v1/intersecciones"
            "stops" -> "/v1/paradas"
            "arrivals" -> "/v1/arribos"
            "route" -> "/v1/recorrido"
            "nearby" -> "/v1/cercanas"
            else -> throw IllegalArgumentException("Acción desconocida")
        }
        val keys = when(action) {
            "streets", "route" -> listOf("linea")
            "crossings" -> listOf("linea", "calle")
            "stops" -> listOf("linea", "calle", "interseccion")
            "arrivals" -> listOf("parada", "linea")
            "nearby" -> listOf("lat", "lon")
            else -> emptyList()
        }
        val builder = Uri.parse(base + path).buildUpon()
        for (key in keys) {
            val value = args.optString(key).trim()
            if (value.isBlank() || value.length > 90)
                throw IllegalArgumentException("Falta parámetro: " + key)
            builder.appendQueryParameter(key, value)
        }
        val connection = URL(builder.build().toString()).openConnection() as HttpURLConnection
        connection.connectTimeout = 12000
        connection.readTimeout = 15000
        connection.instanceFollowRedirects = false
        try {
            val status = connection.responseCode
            val input = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = input?.bufferedReader(Charsets.UTF_8)?.use { it.readText().take(1000000) } ?: ""
            if (status !in 200..299) {
                val error = try { JSONObject(text).optString("error") } catch (_: Exception) { "" }
                throw IllegalStateException(error.ifBlank { "Error HTTP " + status })
            }
            val result = JSONObject(text)
            if (!result.optBoolean("ok", false)) throw IllegalStateException(result.optString("error", "Sin respuesta"))
            return result
        } finally {
            connection.disconnect()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("(function(){if(typeof screen!=='undefined'&&screen!=='home'){go('home');return true;}return false;})()") { result ->
            if (result != "true") super@MainActivity.onBackPressed()
        }
    }

    override fun onDestroy() {
        executor.shutdownNow()
        web.removeJavascriptInterface("AndroidApi")
        web.destroy()
        super.onDestroy()
    }
}
