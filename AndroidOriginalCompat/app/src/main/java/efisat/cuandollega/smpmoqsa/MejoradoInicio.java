package efisat.cuandollega.smpmoqsa;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Capa visual sobre la aplicación ORIGINAL.
 * No consume APIs por separado, no envía credenciales y no sustituye
 * los servicios SOAP usados por la APK original.
 */
public final class MejoradoInicio extends Activity {
    private static final int DARK=Color.rgb(4,64,50), GREEN=Color.rgb(8,119,80);
    private static final int BG=Color.rgb(246,250,247), MUTED=Color.rgb(86,109,100), BORDER=Color.rgb(217,233,222);
    private static final String PKG="efisat.cuandollega.smpmoqsa";
    private LinearLayout outer;
    private WebView map;

    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private GradientDrawable bg(int color,int radius){
        GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;
    }
    private GradientDrawable outline(){
        GradientDrawable d=bg(Color.WHITE,18);d.setStroke(dp(1),BORDER);return d;
    }
    private TextView text(String s,int sp,int color,boolean bold){
        TextView t=new TextView(this);t.setText(s);t.setTextSize(sp);t.setTextColor(color);
        if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;
    }
    private LinearLayout col(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private LinearLayout row(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    private void gap(LinearLayout l,int h){l.addView(new View(this),new LinearLayout.LayoutParams(1,dp(h)));}
    private Button button(String name,boolean primary){
        Button b=new Button(this);b.setText(name);b.setAllCaps(false);b.setTextSize(15);
        b.setTextColor(primary?Color.WHITE:DARK);
        GradientDrawable d=bg(primary?GREEN:Color.rgb(231,244,236),13);
        b.setBackground(d);b.setMinHeight(dp(52));return b;
    }
    private void page(String title){
        if(map!=null){map.destroy();map=null;}
        outer=col();outer.setBackgroundColor(BG);setContentView(outer);
        LinearLayout nav=row();nav.setPadding(dp(14),dp(8),dp(14),dp(8));nav.setBackgroundColor(DARK);
        TextView back=text("‹",36,Color.WHITE,false);back.setGravity(Gravity.CENTER);
        nav.addView(back,new LinearLayout.LayoutParams(dp(44),dp(52)));
        back.setContentDescription("Volver al inicio");back.setOnClickListener(v->showHome());
        LinearLayout texts=col();texts.addView(text("CUÁNDO LLEGA",11,0xffb4ebd1,true));
        texts.addView(text(title,19,Color.WHITE,true));
        nav.addView(texts,new LinearLayout.LayoutParams(0,-2,1));
        TextView home=text("⌂",30,Color.WHITE,true);home.setGravity(Gravity.CENTER);
        home.setContentDescription("Inicio");home.setOnClickListener(v->showHome());
        nav.addView(home,new LinearLayout.LayoutParams(dp(44),dp(52)));
        outer.addView(nav);
    }
    private LinearLayout scroll(){
        ScrollView s=new ScrollView(this);s.setFillViewport(true);s.setVerticalScrollBarEnabled(false);
        LinearLayout content=col();content.setPadding(dp(17),dp(18),dp(17),dp(22));
        s.addView(content);outer.addView(s,new LinearLayout.LayoutParams(-1,0,1));
        return content;
    }
    private void action(LinearLayout in,String symbol,String title,String detail,Runnable callback){
        LinearLayout card=row();card.setPadding(dp(14),dp(16),dp(14),dp(16));card.setBackground(outline());
        TextView icon=text(symbol,24,GREEN,true);icon.setGravity(Gravity.CENTER);
        icon.setBackground(bg(0xffe8f6ed,12));card.addView(icon,new LinearLayout.LayoutParams(dp(44),dp(44)));
        LinearLayout texts=col();texts.setPadding(dp(12),0,dp(6),0);
        texts.addView(text(title,16,DARK,true));gap(texts,3);texts.addView(text(detail,13,MUTED,false));
        card.addView(texts,new LinearLayout.LayoutParams(0,-2,1));
        card.addView(text("›",27,MUTED,false));
        card.setOnClickListener(v->callback.run());
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(10);in.addView(card,p);
    }
    @Override public void onCreate(Bundle state){super.onCreate(state);showHome();}
    private void original(String name){
        try {
            Intent intent=new Intent();intent.setClassName(PKG,PKG+"."+name);
            intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);startActivity(intent);
        }catch(Exception e){
            Toast.makeText(this,"No se pudo abrir la pantalla original. Probá desde Inicio original.",Toast.LENGTH_LONG).show();
        }
    }
    private void showHome(){
        page("MOQSA · Tu colectivo");
        LinearLayout body=scroll();
        LinearLayout hero=col();hero.setPadding(dp(20),dp(22),dp(20),dp(22));
        hero.setBackground(bg(DARK,20));
        hero.addView(text("TRANSPORTE EN TIEMPO REAL",12,0xffbbebd2,true));gap(hero,12);
        hero.addView(text("Tu colectivo, más cerca.",28,Color.WHITE,true));gap(hero,7);
        hero.addView(text("Seguimos usando las consultas reales de la aplicación original de MOQSA.",15,0xffd0f1df,false));gap(hero,17);
        Button consult=button("Consultar llegadas →",false);
        consult.setOnClickListener(v->original("Main"));hero.addView(consult,new LinearLayout.LayoutParams(-1,dp(54)));
        body.addView(hero);gap(body,19);
        body.addView(text("Accesos rápidos",19,DARK,true));gap(body,13);
        action(body,"⌕","Buscar por línea y calle","Consulta original por línea, calle, esquina y parada",()->original("Main"));
        action(body,"★","Favoritos","Tus paradas guardadas en la aplicación original",()->original("ListaFavoritos"));
        action(body,"◎","Paradas cercanas","Usá las paradas cercanas de la app original",()->original("ListaParadasCercanas"));
        action(body,"≋","Recorridos de las líneas","Accedé a la consulta de recorridos",()->original("ListaLineaRecorridos"));
        action(body,"◉","Mapa alternativo","Calles reales sin depender de la firma de Google Maps",()->showMap());
        action(body,"⚙","Configuración original","Preferencias existentes de la aplicación",()->original("Configuracion"));
        gap(body,9);
        body.addView(text("Versión personalizada para pruebas. Las estimaciones las devuelve el servicio original; no se generan tiempos ficticios.",13,MUTED,false));
    }
    private void showMap(){
        page("Mapa de calles");
        LinearLayout controls=col();controls.setPadding(dp(12),dp(12),dp(12),dp(9));
        controls.addView(text("Mapa de apoyo · OpenStreetMap",16,DARK,true));
        gap(controls,7);
        controls.addView(text("Podés buscar una calle; las paradas y los horarios se consultan desde la pantalla original.",13,MUTED,false));
        gap(controls,8);
        LinearLayout bar=row();EditText address=new EditText(this);address.setSingleLine(true);
        address.setTextSize(14);address.setHint("Ej.: Av. Mitre, Berazategui");
        address.setBackground(outline());address.setPadding(dp(11),0,dp(8),0);
        bar.addView(address,new LinearLayout.LayoutParams(0,dp(47),1));
        Button find=button("Buscar",false);
        LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(dp(96),dp(47));fp.leftMargin=dp(7);
        bar.addView(find,fp);
        find.setOnClickListener(v->{
            String q=address.getText().toString().trim();
            if(!q.isEmpty())openExternal("geo:0,0?q="+Uri.encode(q+", Buenos Aires, Argentina"));
        });
        controls.addView(bar);gap(controls,6);
        Button arrivals=button("Consultar líneas y paradas originales",true);
        arrivals.setOnClickListener(v->original("Main"));
        controls.addView(arrivals,new LinearLayout.LayoutParams(-1,dp(49)));
        outer.addView(controls);
        map=new WebView(this);
        WebSettings ws=map.getSettings();ws.setJavaScriptEnabled(false);ws.setDomStorageEnabled(false);
        ws.setAllowFileAccess(false);ws.setAllowContentAccess(false);
        map.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,String url){
                if(url!=null&&!url.startsWith("https://www.openstreetmap.org/export/embed.html")){
                    openExternal(url);return true;
                }return false;
            }
        });
        outer.addView(map,new LinearLayout.LayoutParams(-1,0,1));
        map.loadUrl("https://www.openstreetmap.org/export/embed.html?bbox=-58.45%2C-34.9%2C-58.05%2C-34.6&layer=mapnik&marker=-34.761%2C-58.256");
        Button browser=button("Abrir mapa en navegador ↗",false);
        browser.setOnClickListener(v->openExternal("https://www.openstreetmap.org/#map=12/-34.761/-58.256"));
        outer.addView(browser,new LinearLayout.LayoutParams(-1,dp(49)));
    }
    private void openExternal(String url){
        try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}
        catch(Exception e){Toast.makeText(this,"No hay una aplicación para abrir el mapa",Toast.LENGTH_LONG).show();}
    }
    @Override public void onBackPressed(){
        if(map!=null){showHome();return;}super.onBackPressed();
    }
    @Override protected void onDestroy(){if(map!=null){map.destroy();map=null;}super.onDestroy();}
}
