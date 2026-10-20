package ar.com.cuandollega.moderno;
import android.content.*;
import org.json.*;
import java.util.*;
public final class Favorites {
 private final SharedPreferences pref;
 public Favorites(Context c){pref=c.getSharedPreferences("favoritos_v2",Context.MODE_PRIVATE);}
 public synchronized JSONArray list(){try{return new JSONArray(pref.getString("stops","[]"));}catch(Exception e){return new JSONArray();}}
 public synchronized void add(JSONObject data){
  String id=data.optString("identificador");String linea=data.optString("linea");if(id.isEmpty())return;
  JSONArray old=list(),fresh=new JSONArray();for(int i=0;i<old.length();i++){
   JSONObject v=old.optJSONObject(i);if(v!=null&&!(id.equals(v.optString("identificador"))&&linea.equals(v.optString("linea"))))fresh.put(v);
  }fresh.put(data);pref.edit().putString("stops",fresh.toString()).apply();
 }
 public synchronized boolean contains(String id,String line){JSONArray a=list();for(int i=0;i<a.length();i++){JSONObject o=a.optJSONObject(i);if(o!=null&&id.equals(o.optString("identificador"))&&line.equals(o.optString("linea")))return true;}return false;}
 public synchronized void remove(String id,String line){JSONArray a=list(),out=new JSONArray();for(int i=0;i<a.length();i++){JSONObject o=a.optJSONObject(i);if(o!=null&&!(id.equals(o.optString("identificador"))&&line.equals(o.optString("linea"))))out.put(o);}pref.edit().putString("stops",out.toString()).apply();}
}
