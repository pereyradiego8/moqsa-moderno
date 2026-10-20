package ar.com.cuandollega.moderno;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.*;
import java.io.*;
import java.net.*;

/** La app habla SOLO HTTPS JSON. Las credenciales SOAP nunca deben estar en el celular. */
public final class ApiClient {
    private final SharedPreferences prefs;
    public ApiClient(Context context) { prefs=context.getSharedPreferences("config",Context.MODE_PRIVATE); }
    public String base() { return prefs.getString("base", "").trim(); }
    public void setBase(String value) {
        String s=value.trim().replaceAll("/+$","");
        if(!s.matches("(?i)^https://[^\\s/?#]+(?::[0-9]{2,5})?(?:/[^\\s?#]*)?$")) throw new IllegalArgumentException("La dirección debe empezar con https:// y ser válida.");
        prefs.edit().putString("base",s).apply();
    }
    public boolean ready(){return !base().isEmpty();}
    public static String enc(String s) {
        try {return URLEncoder.encode(s==null?"":s,"UTF-8");}
        catch(java.io.UnsupportedEncodingException ignored){throw new IllegalStateException("UTF-8 no disponible");}
    }
    public JSONObject get(String path) throws Exception {
        if(!ready())throw new IOException("Falta configurar el servidor HTTPS en Ajustes.");
        URL u=new URL(base() + "/v1/" + path);
        if(!"https".equalsIgnoreCase(u.getProtocol()))throw new IOException("Solo se permite HTTPS.");
        HttpURLConnection c=(HttpURLConnection)u.openConnection();
        c.setConnectTimeout(9500);c.setReadTimeout(11500);c.setRequestMethod("GET");
        c.setRequestProperty("Accept","application/json");c.setInstanceFollowRedirects(false);
        try{
            int status=c.getResponseCode();
            if(status>=300&&status<400)throw new IOException("Redirección inesperada del servidor.");
            InputStream is=status>=400?c.getErrorStream():c.getInputStream();
            String json=readLimited(is,800_000);
            JSONObject obj;
            try {obj=new JSONObject(json);}catch(JSONException ex){throw new IOException("El servidor devolvió un formato no reconocido.");}
            if(status>=400 || !obj.optBoolean("ok",true)){
                String detail=obj.optString("error","Error al consultar el servicio");
                throw new IOException(detail.length()>180?detail.substring(0,180):detail);
            }
            return obj;
        }finally {c.disconnect();}
    }
    private static String readLimited(InputStream in,int max) throws IOException {
        if(in==null)return "";
        try(InputStream input=in;ByteArrayOutputStream buffer=new ByteArrayOutputStream()){
            byte[] chunk=new byte[4096];int n;int total=0;
            while((n=input.read(chunk))!=-1){total+=n;if(total>max)throw new IOException("Respuesta demasiado grande");buffer.write(chunk,0,n);}
            return buffer.toString("UTF-8");
        }
    }
}
