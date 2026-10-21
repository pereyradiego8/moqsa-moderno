package ar.com.colectivos.consulta

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Sólo el teléfono guarda las credenciales; no se incluyen en el repositorio público. */
class DirectSettings(context: Context) {
    private val prefs = context.getSharedPreferences("moqsa_direct_soap", Context.MODE_PRIVATE)
    private val alias = "moqsa_original_soap_user_credentials_v1"
    // Private build placeholders. They are invalid in public builds.
    private val bundledUser = "ZZZZZZZZZZZZZ"
    private val bundledPassword = "ZZZZZZZZZZZZZZZZ"
    private fun hasBundledAccess() = bundledUser != "ZZZZZZZZZZZZZ" &&
        bundledPassword != "ZZZZZZZZZZZZZZZZ"
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val found = store.getKey(alias, null)
        if (found is SecretKey) return found
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build())
            generateKey()
        }
    }
    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val bytes = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }
    private fun decrypt(value: String): String {
        if (value.isEmpty()) return ""
        val bytes = Base64.decode(value, Base64.NO_WRAP)
        if (bytes.size < 28) throw IllegalStateException("Datos de acceso dañados")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
        return String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
    }
    fun publicConfig(): JSONObject = JSONObject()
        .put("server", OriginalSoap.ENDPOINT)
        .put("entity", 4)
        .put("appCode", 24)
        .put("configured", hasCredentials())
    fun hasCredentials(): Boolean = prefs.contains("credentials") || hasBundledAccess()
    fun credentials(): Pair<String, String> {
        val saved = prefs.getString("credentials", "") ?: ""
        if (saved.isBlank()) {
            if (hasBundledAccess()) return bundledUser to bundledPassword
            throw IllegalStateException("Faltan credenciales del servidor original. Configuralas en Ajustes.")
        }
        val parsed = JSONObject(decrypt(saved))
        val user = parsed.optString("user")
        val password = parsed.optString("password")
        if (user.isBlank() || password.isBlank()) throw IllegalStateException("Las credenciales guardadas son inválidas")
        return user to password
    }
    fun save(args: JSONObject): JSONObject {
        val user = args.optString("user").trim()
        val pass = args.optString("password")
        if (user.isBlank() || pass.isBlank()) throw IllegalArgumentException("Completá usuario y contraseña del servicio original")
        if (user.length > 128 || pass.length > 128) throw IllegalArgumentException("Credenciales demasiado largas")
        val value = encrypt(JSONObject().put("user", user).put("password", pass).toString())
        prefs.edit().putString("credentials", value).apply()
        return JSONObject().put("configured", true)
    }
}
