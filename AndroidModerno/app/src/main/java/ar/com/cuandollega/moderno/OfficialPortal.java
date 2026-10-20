package ar.com.cuandollega.moderno;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/** Muestra el sitio web público del proveedor, sin copiar credenciales de su APK. */
public final class OfficialPortal extends WebView {
    public static final String HOME="https://cuandollega.smartmovepro.net/moqsa";
    public static final int LOCATION_PERMISSION_REQUEST=706;
    private final Activity activity;
    private GeolocationPermissions.Callback pendingLocation;
    private String pendingOrigin;

    public OfficialPortal(Activity activity) {
        super(activity);
        this.activity=activity;
        WebSettings settings=getSettings();
        settings.setJavaScriptEnabled(true); // La página pública necesita JavaScript.
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if(Build.VERSION.SDK_INT>=26)settings.setSafeBrowsingEnabled(true);
        setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return navigate(request.getUrl());}
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return navigate(Uri.parse(url));}
        });
        setWebChromeClient(new WebChromeClient(){
            @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback cb){
                if(!trusted(Uri.parse(origin))){cb.invoke(origin,false,false);return;}
                if(locationGranted()){cb.invoke(origin,true,false);return;}
                pendingOrigin=origin;pendingLocation=cb;
                activity.requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},LOCATION_PERMISSION_REQUEST);
            }
            @Override public void onGeolocationPermissionsHidePrompt(){
                if(pendingLocation!=null){pendingLocation.invoke(pendingOrigin,false,false);pendingLocation=null;pendingOrigin=null;}
            }
        });
        loadUrl(HOME);
    }
    private static boolean trusted(Uri uri){
        return uri!=null&&"https".equalsIgnoreCase(uri.getScheme())
            &&"cuandollega.smartmovepro.net".equalsIgnoreCase(uri.getHost())
            &&(uri.getPort()==-1||uri.getPort()==443)&&uri.getUserInfo()==null;
    }
    private boolean navigate(Uri uri){
        if(trusted(uri))return false;
        if(uri!=null&&("https".equalsIgnoreCase(uri.getScheme())||"http".equalsIgnoreCase(uri.getScheme()))){
            try{activity.startActivity(new Intent(Intent.ACTION_VIEW,uri));}
            catch(Exception e){Toast.makeText(activity,"No se pudo abrir el enlace externo",Toast.LENGTH_LONG).show();}
        }
        return true;
    }
    private boolean locationGranted(){
        return activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
            || activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
    }
    public void locationPermissionResult(){
        if(pendingLocation!=null){
            pendingLocation.invoke(pendingOrigin,locationGranted(),false);
            pendingLocation=null;pendingOrigin=null;
        }
    }
    public void goToSection(String section){
        switch(section){
            case "recorridos":loadUrl(HOME+"/recorridos");break;
            case "paradascercanas":loadUrl(HOME+"/paradascercanas");break;
            case "favoritos":loadUrl(HOME+"/favoritos");break;
            default:loadUrl(HOME);
        }
    }
    public void openInBrowser(){
        Uri uri=getUrl()==null?Uri.parse(HOME):Uri.parse(getUrl());
        if(!trusted(uri))uri=Uri.parse(HOME);
        try{activity.startActivity(new Intent(Intent.ACTION_VIEW,uri));}
        catch(Exception e){Toast.makeText(activity,"No se pudo abrir el navegador",Toast.LENGTH_LONG).show();}
    }
    @Override public void destroy(){
        if(pendingLocation!=null){pendingLocation.invoke(pendingOrigin,false,false);pendingLocation=null;pendingOrigin=null;}
        stopLoading();super.destroy();
    }
}
