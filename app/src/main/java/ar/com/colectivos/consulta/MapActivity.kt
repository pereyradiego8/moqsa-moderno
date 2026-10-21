package ar.com.colectivos.consulta

import android.app.Activity
import android.graphics.Color
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.drawable.BitmapDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import java.io.File
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

/** Mapa interactivo real: los puntos llegan del WebService original, nunca son simulados. */
class MapActivity : Activity() {
    private lateinit var map: MapView
    private fun markerIcon(type: String): BitmapDrawable {
        val density = resources.displayMetrics.density
        val width = (54 * density).toInt().coerceAtLeast(54)
        val height = (65 * density).toInt().coerceAtLeast(65)
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val x = width / 2f
        val radius = width * 0.35f
        val y = radius + 4 * density
        val fill = when(type) {
            "bus" -> Color.rgb(25, 95, 199)  // Colectivo, azul.
            "user" -> Color.rgb(231, 121, 32) // Mi posición, naranja.
            "route" -> Color.rgb(95, 81, 172)
            else -> Color.rgb(0, 126, 94)    // Parada, verde.
        }
        val pin = Path().apply {
            moveTo(x - radius * .55f, y + radius * .5f)
            lineTo(x, height - 4 * density)
            lineTo(x + radius * .55f, y + radius * .5f)
            close()
        }
        canvas.drawPath(pin, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = fill })
        canvas.drawCircle(x, y, radius + 2 * density, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE })
        canvas.drawCircle(x, y, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = fill })
        val label = when(type) { "bus" -> "C"; "user" -> "YO"; "route" -> "R"; else -> "P" }
        canvas.drawText(label, x, y + 6 * density, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = if (label == "YO") 13 * density else 20 * density
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            textAlign = Paint.Align.CENTER
        })
        return BitmapDrawable(resources, bitmap)
    }



    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Cache interno: no requiere permisos de almacenamiento en Android moderno.
        val osmdroid = Configuration.getInstance()
        osmdroid.load(applicationContext, getSharedPreferences("moqsa_osm", MODE_PRIVATE))
        osmdroid.osmdroidBasePath = File(cacheDir, "osmdroid").apply { mkdirs() }
        osmdroid.osmdroidTileCache = File(cacheDir, "osmdroid/tiles").apply { mkdirs() }
        osmdroid.userAgentValue = "MOQSA-NoOficial/0.4 (" + packageName + ")"
        window.statusBarColor = Color.rgb(5, 100, 80)
        window.navigationBarColor = Color.BLACK

        val title = intent.getStringExtra("map_title") ?: "Mapa MOQSA"
        val type = intent.getStringExtra("map_type") ?: "stops"
        val arr = try { JSONArray(intent.getStringExtra("map_points") ?: "[]") }
                  catch (_: Exception) { JSONArray() }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(246, 250, 248))
        }
        val heading = TextView(this).apply {
            text = "‹    " + title
            textSize = 20f
            setTextColor(Color.rgb(21, 44, 53))
            setPadding(20, 23, 15, 21)
            setBackgroundColor(Color.WHITE)
            contentDescription = "Volver. " + title
            setOnClickListener { finish() }
        }
        root.addView(heading, LinearLayout.LayoutParams(-1, -2))
        map = MapView(this).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            setBuiltInZoomControls(true)
            setMinZoomLevel(3.0)
            setMaxZoomLevel(20.0)
            controller.setZoom(14.0)
        }
        root.addView(map, LinearLayout.LayoutParams(-1, 0, 1f))
        val legend = TextView(this).apply {
            text = "🟢 P  Parada      🔵 C  Colectivo      🟠 YO  Tu ubicación"
            textSize = 12f
            setTextColor(Color.rgb(28, 62, 66))
            setPadding(14, 12, 14, 10)
            setBackgroundColor(Color.WHITE)
        }
        if (type != "route") root.addView(legend, LinearLayout.LayoutParams(-1, -2))
        val attribution = TextView(this).apply {
            text = "© OpenStreetMap contributors · Información de recorridos: servicio original MOQSA"
            textSize = 11f
            setTextColor(Color.rgb(60, 95, 92))
            setPadding(12, 8, 12, 8)
        }
        root.addView(attribution, LinearLayout.LayoutParams(-1, -2))
        setContentView(root)

        val points = ArrayList<GeoPoint>()
        for (i in 0 until minOf(arr.length(), 1200)) {
            val obj = arr.optJSONObject(i) ?: continue
            val lat = obj.optDouble("lat", Double.NaN)
            val lon = obj.optDouble("lon", Double.NaN)
            if (!lat.isFinite() || !lon.isFinite() ||
                lat !in -90.0..90.0 || lon !in -180.0..180.0 ||
                (lat == 0.0 && lon == 0.0)) continue
            val pt = GeoPoint(lat, lon)
            points.add(pt)
            // Para un recorrido hay demasiados vértices para agregar un marcador por punto.
            if (type != "route" || i == 0 || i == arr.length() - 1) {
                val label = obj.optString("nombre").take(110).ifBlank {
                    if (type == "route") if (i == 0) "Inicio del recorrido" else "Fin del recorrido"
                    else "Parada"
                }
                val iconType = if (type == "route") "route" else obj.optString("tipo", "stop")
                map.overlays.add(Marker(map).apply {
                    position = pt
                    setTitle(label)
                    setIcon(markerIcon(iconType))
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                })
            }
        }
        if (type == "route" && points.size > 1) {
            map.overlays.add(0, Polyline(map).apply {
                setPoints(points)
                outlinePaint.color = Color.rgb(0, 126, 102)
                outlinePaint.strokeWidth = 8f
            })
        }
        if (points.isEmpty()) {
            val warning = TextView(this).apply {
                text = "Este recorrido o parada no tiene coordenadas disponibles en el servicio original."
                textSize = 16f
                setTextColor(Color.rgb(32, 62, 69))
                setPadding(30, 30, 30, 30)
                setBackgroundColor(Color.WHITE)
                gravity = Gravity.CENTER
            }
            (map.parent as ViewGroup).removeView(map)
            root.addView(warning, 1, LinearLayout.LayoutParams(-1, 0, 1f))
        } else if (points.size == 1 ||
            points.all { it.latitude == points.first().latitude &&
                         it.longitude == points.first().longitude }) {
            map.controller.setCenter(points.first())
            map.controller.setZoom(16.5)
        } else {
            map.post {
                if (!isFinishing) {
                    try {
                        map.zoomToBoundingBox(BoundingBox.fromGeoPoints(points), true, 65)
                    } catch (_: IllegalArgumentException) {
                        map.controller.setCenter(points.first())
                        map.controller.setZoom(14.0)
                    }
                }
            }
        }
        map.invalidate()
    }

    override fun onResume() { super.onResume(); if (::map.isInitialized) map.onResume() }
    override fun onPause() { if (::map.isInitialized) map.onPause(); super.onPause() }
}