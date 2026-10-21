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
            executor.execute {
                val response = try {
                    val args = JSONObject(parameters)
                    val value = when(action) {
                        "config.get" -> directSettings.publicConfig()
                        "config.set" -> directSettings.save(args)
                        "health" -> JSONObject()
                            .put("configured", directSettings.hasCredentials())
                            .put("service", "SOAP original de MOQSA")
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
