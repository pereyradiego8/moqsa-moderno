package ar.com.cuandollega.moderno;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;

/** Mapa interactivo de OSM dentro de la app, sin Google Maps API key ni SDK externo. */
public final class MapPanel extends WebView {
    public interface StopListener {void selected(int index);}
    private boolean loaded=false;
    private JSONObject latest=new JSONObject();
    public MapPanel(Context context, StopListener listener) {
        super(context);
        setBackgroundColor(0xffdfeee6);
        WebSettings settings=getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString()+" CuandoLlegaModerno/2.1 (ar.com.cuandollega.moderno)");
        setWebViewClient(new WebViewClient(){
            private boolean route(String url){
                if(url.equals("https://www.openstreetmap.org/copyright")){
                    try{context.startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception ignored){}return true;
                }
                if(url.startsWith("moqsa:stop:")){
                    try {int index=Integer.parseInt(url.substring("moqsa:stop:".length()));if(index>=0&&index<250)listener.selected(index);}catch(NumberFormatException ignored){}
                }
                // Never navigate away from the packaged HTML or to untrusted websites.
                return true;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){return route(request.getUrl().toString());}
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return route(url);}
            @Override public void onPageFinished(WebView view,String url){loaded=true;publish();}
        });
        loadUrl("file:///android_asset/map.html");
    }
    public void update(JSONObject data){latest=data;publish();}
    private void publish(){if(loaded)evaluateJavascript("window.moqsaSetData("+latest.toString()+");",null);}
    @Override public void destroy(){loaded=false;super.destroy();}
}
