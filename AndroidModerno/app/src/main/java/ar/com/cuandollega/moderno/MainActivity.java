package ar.com.cuandollega.moderno;

import android.Manifest;
import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.*;
import android.graphics.drawable.*;
import android.location.*;
import android.speech.RecognizerIntent;
import android.text.*;
import android.text.method.*;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.widget.*;
import org.json.*;
import java.text.Normalizer;
import java.util.*;
import java.util.concurrent.*;

/** Cliente nativo sin anuncios ni SDKs heredados. Las llegadas solo salen de un backend real. */
public final class MainActivity extends Activity {
    private static final int BG=Color.rgb(245,249,247), GREEN=Color.rgb(8,115,78), DEEP=Color.rgb(5,69,52), INK=Color.rgb(27,47,39), MUTED=Color.rgb(91,113,103), STROKE=Color.rgb(220,234,226);
    private static final int REQ_LOCATION=703, REQ_VOICE=704, REQ_PHOTO=705;
    private final ExecutorService pool=Executors.newSingleThreadExecutor();
    private final Handler ui=new Handler(Looper.getMainLooper());
    private final Deque<State> history=new ArrayDeque<>();
    private ApiClient api;private Favorites favorites;private LinearLayout root,body;private State state=new State("home");
    private int generation=0;private MapPanel mapPanel;private EditText searchField;private TextView reportPhotoLabel;private double lastMapLat=-34.75,lastMapLon=-58.25;private String errorMessage="";private android.net.Uri reportPhoto=null;
    private static final class State implements java.io.Serializable {
        String page, line="",lineName="",street="",streetName="",cross="",crossName="",stop="",stopName="",search=""; double mapLat=Double.NaN,mapLon=Double.NaN;
        State(String page){this.page=page;}
        State copy(String target){State v=new State(target);v.line=line;v.lineName=lineName;v.street=street;v.streetName=streetName;v.cross=cross;v.crossName=crossName;v.stop=stop;v.stopName=stopName;v.mapLat=mapLat;v.mapLon=mapLon;v.search="";return v;}
    }
    @Override public void onCreate(Bundle saved){super.onCreate(saved);api=new ApiClient(this);favorites=new Favorites(this);
        if(saved!=null){
            try{State stored=(State)saved.getSerializable("current");if(stored!=null)state=stored;
                java.util.ArrayList<State> previous=(java.util.ArrayList<State>)saved.getSerializable("history");
                if(previous!=null)history.addAll(previous);
                String photo=saved.getString("photo");if(photo!=null)reportPhoto=android.net.Uri.parse(photo);
            }catch(Exception ignored){}
        }
        getWindow().setStatusBarColor(DEEP);
        if(Build.VERSION.SDK_INT>=35)getWindow().setDecorFitsSystemWindows(false);
        if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->handleBack());
        render();
    }
    @Override protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);out.putSerializable("current",state);out.putSerializable("history",new java.util.ArrayList<>(history));if(reportPhoto!=null)out.putString("photo",reportPhoto.toString());}
    @Override protected void onDestroy(){generation++;pool.shutdownNow();if(mapPanel!=null){mapPanel.destroy();mapPanel=null;}super.onDestroy();}
    @Override protected void onResume(){super.onResume();if(root!=null && "arrivals".equals(state.page))render();}
    private int dp(float v){return (int)(getResources().getDisplayMetrics().density*v+.5f);}
    private GradientDrawable shape(int color,int radius){GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(dp(radius));return g;}
    private GradientDrawable stroke(int color,int radius,int border){GradientDrawable g=shape(color,radius);g.setStroke(dp(1),border);return g;}
    private GradientDrawable buttonBackground(boolean primary){GradientDrawable g=new GradientDrawable(GradientDrawable.Orientation.TL_BR,primary?new int[]{GREEN,DEEP}:new int[]{Color.WHITE,Color.WHITE});g.setCornerRadius(dp(15));if(!primary)g.setStroke(dp(1),STROKE);return g;}
    private LinearLayout col(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private LinearLayout row(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    private LinearLayout.LayoutParams lp(int w,int h){return new LinearLayout.LayoutParams(w<0?w:dp(w),h<0?h:dp(h));}
    private TextView text(String s,int sp,int color,boolean bold){TextView v=new TextView(this);v.setText(s);v.setTextSize(sp);v.setTextColor(color);v.setFontFeatureSettings("kern");if(bold)v.setTypeface(android.graphics.Typeface.DEFAULT,android.graphics.Typeface.BOLD);return v;}
    private TextView para(String s){TextView t=text(s,14,MUTED,false);t.setLineSpacing(dp(3),1f);return t;}
    private void space(LinearLayout l,int px){View v=new View(this);l.addView(v,lp(1,px));}
    private Button button(String title,boolean primary,Runnable click){Button b=new Button(this);b.setText(title);b.setAllCaps(false);b.setTextSize(14);b.setTypeface(null,android.graphics.Typeface.BOLD);b.setTextColor(primary?Color.WHITE:DEEP);b.setBackground(buttonBackground(primary));b.setMinHeight(dp(50));b.setPadding(dp(15),dp(9),dp(15),dp(9));b.setOnClickListener(v->click.run());return b;}
    private LinearLayout card(LinearLayout parent){LinearLayout c=col();c.setPadding(dp(18),dp(17),dp(18),dp(17));c.setBackground(stroke(Color.WHITE,20,STROKE));LinearLayout.LayoutParams p=lp(-1,-2);p.bottomMargin=dp(12);parent.addView(c,p);return c;}
    private LinearLayout padded(){LinearLayout l=col();l.setPadding(dp(18),dp(18),dp(18),dp(24));return l;}
    private void scrollBody(){ScrollView s=new ScrollView(this);s.setFillViewport(true);s.setVerticalScrollBarEnabled(false);body=padded();s.addView(body);root.addView(s,new LinearLayout.LayoutParams(-1,0,1f));}
    private void nav(State next){history.push(state);state=next;errorMessage="";hideKeyboard();render();}
    private void show(String page){nav(state.copy(page));}
    private void home(){history.clear();state=new State("home");hideKeyboard();render();}
    private void hideKeyboard(){try{((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(root.getWindowToken(),0);}catch(Exception ignored){}}
    @Override public void onBackPressed(){handleBack();}
    private void handleBack(){if(!history.isEmpty()){state=history.pop();render();}else finish();}
    private void header(){
        LinearLayout bar=row();bar.setPadding(dp(12),dp(10),dp(12),dp(10));bar.setBackgroundColor(DEEP);
        if(!history.isEmpty()){
            TextView back=text("‹",36,Color.WHITE,false);back.setGravity(Gravity.CENTER);back.setContentDescription("Volver atrás");bar.addView(back,lp(45,48));back.setOnClickListener(v->onBackPressed());
        }
        LinearLayout titles=col();TextView a=text("CUÁNDO LLEGA",11,Color.rgb(181,226,205),true);a.setLetterSpacing(.12f);titles.addView(a);
        TextView b=text(headerTitle(),18,Color.WHITE,true);titles.addView(b);bar.addView(titles,new LinearLayout.LayoutParams(0,-2,1));
        TextView home=text("⌂",28,Color.WHITE,false);home.setGravity(Gravity.CENTER);home.setContentDescription("Ir al inicio");bar.addView(home,lp(42,48));home.setOnClickListener(v->home());
        if(!"settings".equals(state.page)){TextView settings=text("⚙",24,Color.WHITE,false);settings.setGravity(Gravity.CENTER);settings.setContentDescription("Ajustes del servidor");bar.addView(settings,lp(42,48));settings.setOnClickListener(v->show("settings"));}
        root.addView(bar,lp(-1,70));
    }
    private String headerTitle(){switch(state.page){
        case "lines":return "Elegí una línea";case "routes":return "Recorridos";case "routeview":return "Mapa de recorrido";case "streets":return "Buscá por calle";case "crosses":return "Seleccioná intersección";case "stops":return "Elegí una parada";case "arrivals":return "Próximos arribos";
        case "pointmap":return "Ubicación en el mapa";case "map":return "Mapa de paradas";case "nearby":return "Paradas cercanas";case "favorites":return "Tus favoritos";case "recharges":return "Puntos de recarga";case "manual":return "Consulta por código";case "settings":return "Configuración";case "directions":return "Cómo llego";case "reports":return "Enviar un reclamo";default:return "MOQSA · Transporte";
    }}
    private void render(){
        generation++;searchField=null;reportPhotoLabel=null;
        if(mapPanel!=null){try{if(mapPanel.getParent() instanceof android.view.ViewGroup)((android.view.ViewGroup)mapPanel.getParent()).removeView(mapPanel);mapPanel.destroy();}catch(Exception ignored){}mapPanel=null;}
        root=col();root.setBackgroundColor(BG);
        if(Build.VERSION.SDK_INT>=35)root.setOnApplyWindowInsetsListener((view,insets)->{android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars());view.setPadding(0,bars.top,0,bars.bottom);return insets;});
        setContentView(root);header();
        switch(state.page){
            case "home":renderHome();break;case "settings":renderSettings();break;
            case "lines":case "routes":case "streets":case "crosses":case "stops":case "nearby":case "favorites":case "recharges":renderList();break;
            case "map":renderMap();break;case "pointmap":renderPointMap();break;case "manual":renderManual();break;case "arrivals":renderArrivals();break;case "routeview":renderRoute();break;
            case "directions":renderDirections();break;case "reports":renderReports();break;
            default:renderHome();
        }
        bottomNavigation();
    }
    private void bottomNavigation(){
        LinearLayout bar=row();bar.setBackgroundColor(Color.WHITE);bar.setPadding(dp(5),dp(7),dp(5),dp(7));
        addTab(bar,"⌂", "Inicio", "home");addTab(bar,"◎", "Mapa", "map");addTab(bar,"★", "Favoritos", "favorites");addTab(bar,"⌕", "Buscar", "lines");
        root.addView(bar,lp(-1,64));
    }
    private void addTab(LinearLayout bar,String glyph,String label,String target){
        boolean active=target.equals(state.page);LinearLayout tab=col();tab.setGravity(Gravity.CENTER);
        TextView icon=text(glyph,24,active?GREEN:MUTED,true);icon.setGravity(Gravity.CENTER);tab.addView(icon);
        TextView caption=text(label,11,active?GREEN:MUTED,active);caption.setGravity(Gravity.CENTER);tab.addView(caption);
        bar.addView(tab,new LinearLayout.LayoutParams(0,dp(52),1));tab.setContentDescription(label);tab.setOnClickListener(v->{if(!active){if("home".equals(target))home();else show(target);}});
    }
    private void label(LinearLayout parent,String title,String subtitle){TextView t=text(title,25,INK,true);parent.addView(t);space(parent,5);parent.addView(para(subtitle));space(parent,20);}
    private void renderHome(){
        scrollBody();
        LinearLayout hero=card(body);hero.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{DEEP,GREEN}));
        TextView pill=text("●  TRANSPORTE EN TIEMPO REAL",11,Color.rgb(196,239,215),true);hero.addView(pill);space(hero,14);
        TextView title=text("Tu colectivo,\nmás cerca.",28,Color.WHITE,true);title.setLineSpacing(dp(2),1);hero.addView(title);space(hero,9);
        TextView desc=text("Encontrá tu parada y consultá los próximos arribos.",15,Color.rgb(218,242,228),false);hero.addView(desc);space(hero,16);
        Button cta=button("Buscar por línea y calle  →",false,()->show("lines"));hero.addView(cta,lp(-1,54));
        space(body,10);body.addView(text("Accesos rápidos",18,INK,true));space(body,12);
        feature("⌕","Buscar parada por código","Con el número de parada y línea",()->show("manual"));
        feature("◉","Mapa interactivo de paradas","Calles, mapa y paradas cerca tuyo",()->show("map"));
        feature("◎","Paradas cerca tuyo","Ubicación precisa, solo si la permitís",()->show("nearby"));
        feature("★","Mis paradas favoritas","Guardá tus consultas frecuentes",()->show("favorites"));
        feature("↗","Cómo llegar","Indicaciones de transporte público",()->show("directions"));
        feature("≋","Recorridos por línea","Consultá el trazado que informa el servicio",()->show("routes"));
        feature("▣","Puntos de recarga","Consultá los puntos cercanos",()->show("recharges"));
        feature("✉","Reclamos y sugerencias","Prepará un mensaje desde tu correo",()->show("reports"));
        if(!api.ready()){
            LinearLayout c=card(body);c.addView(text("Configuración pendiente",16,INK,true));space(c,6);c.addView(para("Para obtener horarios reales en esta nueva versión, hace falta conectar un servidor autorizado. No se muestran estimaciones inventadas."));space(c,10);c.addView(button("Configurar servidor seguro",false,()->show("settings")),lp(-1,48));
        }
        space(body,10);TextView foot=para("Versión moderna experimental. Los horarios dependen del servicio de transporte configurado.");foot.setGravity(Gravity.CENTER);body.addView(foot);
    }
    private void feature(String symbol,String title,String sub,Runnable action){
        LinearLayout r=row();r.setBackground(stroke(Color.WHITE,18,STROKE));r.setPadding(dp(15),dp(14),dp(15),dp(14));
        TextView icon=text(symbol,24,GREEN,true);icon.setGravity(Gravity.CENTER);icon.setBackground(shape(Color.rgb(230,246,237),14));r.addView(icon,lp(46,46));
        LinearLayout texts=col();LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,1);p.leftMargin=dp(14);r.addView(texts,p);texts.addView(text(title,15,INK,true));space(texts,3);texts.addView(para(sub));
        r.addView(text("›",27,MUTED,false));r.setOnClickListener(v->action.run());
        LinearLayout.LayoutParams outer=lp(-1,-2);outer.bottomMargin=dp(10);body.addView(r,outer);
    }
    private void renderSettings(){scrollBody();label(body,"Conexión segura","Esta app no contiene contraseñas del servicio SOAP. Usa un puente HTTPS configurado por el administrador.");
        LinearLayout c=card(body);c.addView(text("Dirección del servidor HTTPS",15,INK,true));space(c,11);
        EditText url=field("https://tu-servidor.example.com",api.base());url.setInputType(android.text.InputType.TYPE_TEXT_VARIATION_URI);c.addView(url,lp(-1,54));space(c,16);
        c.addView(button("Guardar conexión",true,()->{try{api.setBase(url.getText().toString());Toast.makeText(this,"Servidor guardado",Toast.LENGTH_SHORT).show();home();}catch(Exception e){url.setError(e.getMessage());}}),lp(-1,50));
        space(body,8);body.addView(para("El backend debe implementar el contrato /v1 descrito en README.md. Si todavía no hay servidor activo, los buscadores mostrarán el motivo y ofrecerán reintentar. La APK original sigue siendo independiente."));
        space(body,10);
        body.addView(button("Comprobar conexión",false,()->{
            pool.execute(()->{
                try {
                    JSONObject health=api.health();
                    boolean configured=health.optBoolean("configured",false);
                    ui.post(()->new AlertDialog.Builder(this)
                        .setTitle("Estado del servidor")
                        .setMessage(configured?"Backend HTTPS activo y con acceso SOAP configurado. Probá la búsqueda de líneas para comprobar los datos reales.":"Backend HTTPS disponible, pero falta configurar el acceso autorizado de MOQSA para obtener líneas y horarios reales.")
                        .setPositiveButton("Aceptar",(d,w)->{}).show());
                } catch(Exception ex) {
                    ui.post(()->new AlertDialog.Builder(this)
                        .setTitle("No se pudo conectar")
                        .setMessage(ex.getMessage()).setPositiveButton("Aceptar",(d,w)->{}).show());
                }
            });
        }),lp(-1,50));
        space(body,20);body.addView(button("Volver",false,()->onBackPressed()),lp(-1,50));
    }
    private EditText field(String hint,String value){EditText e=new EditText(this);e.setSingleLine(true);e.setTextSize(16);e.setTextColor(INK);e.setHintTextColor(MUTED);e.setHint(hint);e.setPadding(dp(13),dp(10),dp(13),dp(10));e.setBackground(stroke(Color.WHITE,13,STROKE));if(value!=null)e.setText(value);return e;}
    private String path(){switch(state.page){
        case "lines":case "routes":return "lineas";
        case "streets":return "calles?linea="+ApiClient.enc(state.line);
        case "crosses":return "intersecciones?linea="+ApiClient.enc(state.line)+"&calle="+ApiClient.enc(state.street);
        case "stops":return "paradas?linea="+ApiClient.enc(state.line)+"&calle="+ApiClient.enc(state.street)+"&interseccion="+ApiClient.enc(state.cross);
        case "nearby":case "recharges":return "";
        default:return "";
    }}
    private String listTitle(){switch(state.page){
        case "lines":return "Líneas disponibles";case "routes":return "Recorridos de las líneas";case "streets":return "Calles de la línea "+state.lineName;
        case "crosses":return "Cruces con "+state.streetName;case "stops":return "Paradas en "+state.streetName;
        case "nearby":return "Cerca de tu ubicación";case "favorites":return "Consultas guardadas";case "recharges":return "Recargas cercanas";default:return "Resultados";
    }}
    private void renderList(){
        LinearLayout heading=padded();heading.setPadding(dp(18),dp(16),dp(18),dp(8));
        heading.addView(text(listTitle(),22,INK,true));space(heading,7);
        heading.addView(para(state.page.equals("lines")?"Elegí una línea para buscar sus calles.":state.page.equals("streets")?"Podés escribir parte del nombre de la calle.":state.page.equals("crosses")?"Elegí la esquina o intersección de referencia.":state.page.equals("stops")?"Tocá una parada para conocer los arribos.":"Filtrá los resultados por nombre o código."));space(heading,13);
        LinearLayout search=row();search.setBackground(stroke(Color.WHITE,16,STROKE));search.setPadding(dp(12),0,dp(8),0);
        search.addView(text("⌕",24,GREEN,true),lp(29,48));
        EditText edit=new EditText(this);searchField=edit;edit.setTextSize(16);edit.setTextColor(INK);edit.setHint("Buscar por nombre o código...");edit.setHintTextColor(MUTED);edit.setSingleLine(true);edit.setBackgroundColor(Color.TRANSPARENT);
        search.addView(edit,new LinearLayout.LayoutParams(0,dp(52),1));
        TextView mic=text("♩",21,GREEN,false);mic.setGravity(Gravity.CENTER);mic.setContentDescription("Búsqueda por voz");search.addView(mic,lp(42,50));mic.setOnClickListener(v->voice());
        heading.addView(search,lp(-1,54));root.addView(heading,lp(-1,-2));
        TextView status=para("Cargando datos...");status.setPadding(dp(20),dp(4),dp(12),dp(6));root.addView(status,lp(-1,-2));
        ListView list=new ListView(this);list.setDivider(null);list.setBackgroundColor(BG);list.setPadding(dp(12),dp(3),dp(12),dp(16));list.setClipToPadding(false);root.addView(list,new LinearLayout.LayoutParams(-1,0,1f));
        ResultAdapter adapter=new ResultAdapter();list.setAdapter(adapter);
        Runnable[] applyFilter={()->{adapter.filter(edit.getText().toString());status.setText(adapter.getCount()+" resultado(s)");}};
        edit.setText(state.search);edit.setSelection(edit.length());
        edit.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){state.search=s.toString();applyFilter[0].run();}public void afterTextChanged(Editable s){}});
        list.setOnItemClickListener((parent,view,position,id)->choose(adapter.item(position)));
        if("favorites".equals(state.page)){adapter.set(favorites.list());status.setText(adapter.getCount()+" favorito(s)");return;}
        if(!api.ready()){status.setText("Conectá el servidor en Ajustes para consultar datos reales.");showRetry(adapter,status);return;}
        if("nearby".equals(state.page)||"recharges".equals(state.page)){
            requestLocation((lat,lon)->load("nearby".equals(state.page)?"cercanas?lat="+lat+"&lon="+lon:"recargas?lat="+lat+"&lon="+lon,adapter,status),status);return;
        }
        load(path(),adapter,status);
    }
    private void showRetry(ResultAdapter a,TextView status){status.setOnClickListener(v->{if(!api.ready())show("settings");else if("nearby".equals(state.page)||"recharges".equals(state.page))render();else load(path(),a,status);});}
    private void load(String path,ResultAdapter adapter,TextView status){
        int token=generation;status.setText("Consultando servicio...");
        pool.execute(()->{
            try{JSONObject data=api.get(path);JSONArray items=data.optJSONArray("items");if(items==null)items=new JSONArray();JSONArray finalItems=items;
                ui.post(()->{if(token!=generation)return;adapter.set(finalItems);adapter.filter(state.search);status.setText(adapter.getCount()==0?"No hay resultados. Tocá acá para reintentar.":adapter.getCount()+" resultado(s)");showRetry(adapter,status);});
            }catch(Exception ex){ui.post(()->{if(token!=generation)return;status.setText("No fue posible consultar: "+ex.getMessage()+". Tocá para reintentar.");showRetry(adapter,status);});}
        });
    }
    private void choose(JSONObject o){String id=o.optString("id",o.optString("codigo",""));String name=o.optString("nombre",o.optString("descripcion",id));
        switch(state.page){
            case "lines":{State n=state.copy("streets");n.line=id;n.lineName=name;nav(n);break;}
            case "routes":{State n=state.copy("routeview");n.line=id;n.lineName=name;nav(n);break;}
            case "streets":{State n=state.copy("crosses");n.street=id;n.streetName=name;nav(n);break;}
            case "crosses":{State n=state.copy("stops");n.cross=id;n.crossName=name;nav(n);break;}
            case "stops":case "nearby":case "favorites":{openStop(o);break;}
            case "recharges":{
                double lat=o.optDouble("lat",Double.NaN),lon=o.optDouble("lon",Double.NaN);
                if(Double.isNaN(lat)||Double.isNaN(lon)){Toast.makeText(this,"No hay coordenadas de este punto",Toast.LENGTH_LONG).show();return;}openMap(lat,lon,name);break;
            }
        }
    }
    private void openStop(JSONObject o){
        String id=o.optString("id",o.optString("codigo","")),name=o.optString("nombre",o.optString("descripcion",id));
        State n=state.copy("arrivals");n.stop=o.optString("identificador",id);n.stopName=name;
                if(o.has("linea"))n.line=o.optString("linea");if(o.has("lineaNombre"))n.lineName=o.optString("lineaNombre");
                if(n.line.isEmpty()){
                    EditText entry=field("Código de línea","");
                    new AlertDialog.Builder(this).setTitle("Seleccioná una línea").setMessage("Para consultar arribos de esta parada cercana, ingresá el código de la línea.")
                        .setView(entry).setNegativeButton("Cancelar",(d,w)->{}).setPositiveButton("Consultar",(d,w)->{
                            if(entry.getText().toString().trim().isEmpty()){Toast.makeText(this,"Se necesita una línea para consultar",Toast.LENGTH_LONG).show();return;}
                            n.line=entry.getText().toString().trim();n.lineName=n.line;nav(n);
                        }).show();return;
                }
        nav(n);
    }
    private final class ResultAdapter extends android.widget.BaseAdapter {
        private final ArrayList<JSONObject> all=new ArrayList<>(),visible=new ArrayList<>();
        void set(JSONArray array){all.clear();for(int i=0;i<array.length();i++){JSONObject o=array.optJSONObject(i);if(o!=null)all.add(o);}filter(state.search);}
        void filter(String query){String q=normal(query);visible.clear();for(JSONObject v:all){if(q.isEmpty()||normal(v.optString("nombre",v.optString("descripcion",""))+" "+v.optString("id",v.optString("codigo",""))+" "+v.optString("identificador","")+" "+v.optString("detalle","")).contains(q))visible.add(v);}notifyDataSetChanged();}
        JSONObject item(int pos){return visible.get(pos);}
        @Override public int getCount(){return visible.size();}@Override public Object getItem(int p){return item(p);}@Override public long getItemId(int p){return p;}
        @Override public View getView(int p,View convert,android.view.ViewGroup parent){JSONObject v=item(p);
            LinearLayout r=row();r.setBackground(stroke(Color.WHITE,16,STROKE));r.setPadding(dp(16),dp(14),dp(12),dp(14));
            LinearLayout c=col();r.addView(c,new LinearLayout.LayoutParams(0,-2,1f));
            String name=v.optString("nombre",v.optString("descripcion",v.optString("identificador","Sin descripción")));
            c.addView(text(name,16,INK,true));String extra=v.optString("detalle","");String num=v.optString("identificador","");
            if(!num.isEmpty())extra=(extra.isEmpty()?"":" · ")+"Parada "+num+extra;
            if(!extra.isEmpty()){space(c,3);c.addView(para(extra));}
            r.addView(text("›",27,GREEN,false));
            LinearLayout outer=col();outer.addView(r,lp(-1,-2));space(outer,9);outer.setMinimumHeight(dp(65));return outer;
        }
    }
    private static String normal(String input){return Normalizer.normalize(input,Normalizer.Form.NFD).replaceAll("\\p{M}+","").toLowerCase(Locale.ROOT).trim();}
    private void renderManual(){scrollBody();label(body,"Buscá por identificador","Si conocés el número de parada, podés consultar directamente sin navegar por calles.");
        LinearLayout c=card(body);c.addView(text("Número de parada",14,INK,true));space(c,6);
        EditText stop=field("Ejemplo: identificador de la parada",state.stop);stop.setInputType(android.text.InputType.TYPE_CLASS_TEXT);c.addView(stop,lp(-1,56));space(c,15);
        c.addView(text("Código de línea",14,INK,true));space(c,6);
        EditText line=field("Código de línea",state.line);line.setInputType(android.text.InputType.TYPE_CLASS_TEXT);c.addView(line,lp(-1,56));space(c,15);
        c.addView(button("Ver próximos arribos  →",true,()->{
            String s=stop.getText().toString().trim(),l=line.getText().toString().trim();if(s.isEmpty()){stop.setError("Ingresá una parada");return;}
            if(l.isEmpty()){line.setError("Ingresá una línea");return;}
            State n=state.copy("arrivals");n.stop=s;n.stopName="Parada "+s;n.line=l;n.lineName=l;nav(n);
        }),lp(-1,54));
    }
    private void renderArrivals(){scrollBody();
        label(body,state.stopName.isEmpty()?"Parada "+state.stop:state.stopName,"Línea "+(state.lineName.isEmpty()?state.line:state.lineName)+" · Identificador "+state.stop);
        LinearLayout action=row();Button fav=button(favorites.contains(state.stop,state.line)?"★ Quitar favorito":"☆ Guardar favorito",false,()->{
            if(favorites.contains(state.stop,state.line))favorites.remove(state.stop,state.line);
            else{JSONObject obj=new JSONObject();try{obj.put("identificador",state.stop).put("linea",state.line).put("lineaNombre",state.lineName).put("nombre",state.stopName).put("id",state.stop);}catch(JSONException ignored){}favorites.add(obj);}
            render();
        });action.addView(fav,new LinearLayout.LayoutParams(0,dp(48),1));spaceX(action,10);
        Button reload=button("↻ Actualizar",true,()->render());action.addView(reload,lp(126,48));body.addView(action);space(body,20);
        TextView status=para("Buscando los arribos...");body.addView(status);space(body,12);
        LinearLayout arrivals=col();body.addView(arrivals,lp(-1,-2));
        if(!api.ready()){status.setText("Configurá un servidor HTTPS para obtener arribos reales.");body.addView(button("Abrir ajustes",false,()->show("settings")));return;}
        int token=generation;
        // Renovación automática cada 30 segundos mientras la pantalla está visible.
        ui.postDelayed(()->{if(token==generation&&"arrivals".equals(state.page)&&hasWindowFocus())render();},30000);
        String path="arribos?parada="+ApiClient.enc(state.stop)+"&linea="+ApiClient.enc(state.line);
        pool.execute(()->{try{JSONObject answer=api.get(path);JSONArray items=answer.optJSONArray("items");if(items==null)items=new JSONArray();JSONArray finalItems=items;
            ui.post(()->{if(token!=generation)return;arrivals.removeAllViews();if(finalItems.length()==0){status.setText(answer.optString("mensaje","No hay arribos informados actualmente."));return;}
                status.setText("Información recibida del servidor · Actualizá para renovar la consulta");
                for(int i=0;i<finalItems.length();i++){
                    JSONObject item=finalItems.optJSONObject(i);if(item==null)continue;LinearLayout card=card(arrivals);
                    String eta=item.optString("arribo",item.optString("eta","Sin estimación"));
                    TextView big=text(eta,22,GREEN,true);card.addView(big);space(card,7);
                    card.addView(text(item.optString("linea",state.lineName),16,INK,true));space(card,4);
                    card.addView(para(item.optString("destino","Destino no informado")));
                    double lat=item.optDouble("lat",Double.NaN),lon=item.optDouble("lon",Double.NaN);
                    if(validGeo(lat,lon)){space(card,13);card.addView(button("Ver colectivo en el mapa  →",false,()->showPointMap(lat,lon,"Ubicación del colectivo")),lp(-1,44));}
                    double stopLat=item.optDouble("latParada",Double.NaN),stopLon=item.optDouble("lonParada",Double.NaN);
                    if(validGeo(stopLat,stopLon)){space(card,8);card.addView(button("Ver ubicación de la parada",false,()->showPointMap(stopLat,stopLon,state.stopName)),lp(-1,44));}
                }
            });
        }catch(Exception ex){ui.post(()->{if(token==generation)status.setText("Error al consultar arribos: "+ex.getMessage()+". Usá Actualizar para reintentar.");});}});
    }
    private void spaceX(LinearLayout r,int v){View x=new View(this);r.addView(x,lp(v,1));}
    private void showPointMap(double lat,double lon,String name){State n=state.copy("pointmap");n.mapLat=lat;n.mapLon=lon;n.stopName=name;nav(n);}
    private void renderPointMap(){
        LinearLayout top=padded();top.setPadding(dp(18),dp(10),dp(18),dp(8));top.addView(text(state.stopName,19,INK,true));root.addView(top);
        mapPanel=new MapPanel(this,index->{});root.addView(mapPanel,new LinearLayout.LayoutParams(-1,0,1));
        try{JSONObject point=new JSONObject();point.put("lat",state.mapLat).put("lon",state.mapLon).put("label",state.stopName).put("viewOnly",true);
            JSONArray a=new JSONArray();a.put(point);JSONObject data=new JSONObject();data.put("points",a);mapPanel.update(data);
        }catch(JSONException ignored){}
        LinearLayout footer=padded();footer.setPadding(dp(16),dp(10),dp(16),dp(12));footer.addView(button("Abrir también en Maps ↗",false,()->openMap(state.mapLat,state.mapLon,state.stopName)),lp(-1,47));root.addView(footer);
    }
    private void openMap(double lat,double lon,String label){try{android.net.Uri uri=android.net.Uri.parse("geo:"+lat+","+lon+"?q="+lat+","+lon+"("+android.net.Uri.encode(label)+")");startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ex){Toast.makeText(this,"No hay aplicación de mapas disponible",Toast.LENGTH_LONG).show();}}
    /** Cartografía real dentro de la app. Solo muestra paradas efectivamente informadas por el servicio. */
    private void renderMap(){
        LinearLayout head=padded();head.setPadding(dp(18),dp(14),dp(18),dp(10));
        head.addView(text("Explorá las paradas",22,INK,true));space(head,5);
        TextView status=para("El mapa requiere internet. Permitir ubicación es opcional.");head.addView(status);root.addView(head);
        final JSONArray[] mapStops={new JSONArray()};
        mapPanel=new MapPanel(this,index->{JSONObject chosen=mapStops[0].optJSONObject(index);if(chosen!=null)openStop(chosen);});
        root.addView(mapPanel,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout footer=padded();footer.setPadding(dp(16),dp(9),dp(16),dp(12));
        footer.addView(button("↻ Actualizar paradas cercanas",true,()->render()),lp(-1,48));space(footer,7);
        footer.addView(button("Abrir mapa externo si no carga ↗",false,()->openMap(lastMapLat,lastMapLon,"Mapa de la zona")),lp(-1,44));
        root.addView(footer,lp(-1,-2));
        if(!api.ready()){status.setText("Mapa de calles disponible. Para mostrar paradas reales configurá un servidor HTTPS en Ajustes.");return;}
        final int token=generation;
        requestLocation((lat,lon)->{
            if(token!=generation)return;
            lastMapLat=Double.parseDouble(lat);lastMapLon=Double.parseDouble(lon);
            try{JSONObject initial=new JSONObject();JSONObject center=new JSONObject();center.put("lat",Double.parseDouble(lat));center.put("lon",Double.parseDouble(lon));initial.put("center",center).put("user",center);mapPanel.update(initial);}catch(JSONException ignored){}
            status.setText("Buscando paradas informadas por el servicio...");
            pool.execute(()->{try{
                JSONObject response=api.get("cercanas?lat="+lat+"&lon="+lon);JSONArray items=response.optJSONArray("items");if(items==null)items=new JSONArray();
                JSONArray stops=new JSONArray(),pins=new JSONArray();
                for(int i=0;i<items.length() && i<600;i++){JSONObject stop=items.optJSONObject(i);if(stop==null)continue;
                    double a=stop.optDouble("lat",Double.NaN),b=stop.optDouble("lon",Double.NaN);
                    if(!validGeo(a,b))continue;
                    stops.put(stop);JSONObject pin=new JSONObject();pin.put("lat",a).put("lon",b).put("label",stop.optString("nombre","Parada"));pin.put("subtitle",stop.optString("detalle",stop.optString("identificador","")));pins.put(pin);
                    if(stops.length()==250)break;
                }
                JSONObject data=new JSONObject();data.put("points",pins);JSONObject loc=new JSONObject();loc.put("lat",Double.parseDouble(lat)).put("lon",Double.parseDouble(lon));data.put("user",loc);
                final JSONArray result=stops;ui.post(()->{if(token!=generation||mapPanel==null)return;mapStops[0]=result;mapPanel.update(data);
                    status.setText(result.length()==0?"No se encontraron paradas con coordenadas. Podés buscar por línea y calle.":result.length()+" paradas cercanas. Tocá un marcador para consultar sus arribos.");
                });
            }catch(Exception e){ui.post(()->{if(token==generation)status.setText("No se pudieron consultar las paradas: "+e.getMessage());});}});
        },status);
    }
    private static boolean validGeo(double lat,double lon){return !Double.isNaN(lat)&&!Double.isNaN(lon)&&Double.isFinite(lat)&&Double.isFinite(lon)&&Math.abs(lat)<=85&&Math.abs(lon)<=180&&(lat!=0||lon!=0);}
    private void renderRoute(){
        scrollBody();label(body,"Recorrido de " + state.lineName,"Mapa con calles de OpenStreetMap y recorrido informado por el servidor.");
        TextView status=para("Cargando recorrido y cartografía...");body.addView(status);space(body,12);
        LinearLayout holder=card(body);
        mapPanel=new MapPanel(this,index->{});holder.addView(mapPanel,lp(-1,375));space(holder,12);
        holder.addView(button("Ver línea y paradas por calle",false,()->{State n=state.copy("streets");nav(n);}),lp(-1,48));space(holder,10);
        TextView help=para("Podés mover, ampliar y reducir el mapa. Necesita internet para las calles. No se inventan recorridos.");holder.addView(help);
        if(!api.ready()){status.setText("Para ver el recorrido de la línea hay que configurar el servicio HTTPS en Ajustes.");return;}
        int token=generation;
        pool.execute(()->{try{
            JSONObject response=api.get("recorrido?linea="+ApiClient.enc(state.line));JSONArray items=response.optJSONArray("items");if(items==null)items=new JSONArray();
            JSONArray coordsJson=new JSONArray();ArrayList<double[]> coords=new ArrayList<>();
            for(int i=0;i<items.length() && i<1400;i++){JSONObject p=items.optJSONObject(i);if(p==null)continue;double lat=p.optDouble("lat",Double.NaN),lon=p.optDouble("lon",Double.NaN);
                if(validGeo(lat,lon)){coords.add(new double[]{lat,lon});JSONObject point=new JSONObject();point.put("lat",lat).put("lon",lon);coordsJson.put(point);}
            }
            JSONObject data=new JSONObject();data.put("route",coordsJson);
            ui.post(()->{if(token!=generation||mapPanel==null)return;
                if(coords.isEmpty()){status.setText("El servidor no informó coordenadas válidas para esta línea.");return;}
                mapPanel.update(data);status.setText("Recorrido recibido: "+coords.size()+" puntos. El trazado depende del servicio de transporte.");
                space(holder,12);double[] first=coords.get(0);holder.addView(button("Abrir también en Maps ↗",false,()->openMap(first[0],first[1],state.lineName)),lp(-1,48));
                space(holder,10);holder.addView(button("Mostrar esquema sin mapa",false,()->{RouteDiagram diagram=new RouteDiagram(coords);holder.addView(diagram,lp(-1,250));}),lp(-1,48));
            });
        }catch(Exception ex){ui.post(()->{if(token==generation)status.setText("No se pudo obtener el recorrido: "+ex.getMessage());});}});
    }
    private final class RouteDiagram extends View {
        private final ArrayList<double[]> points;private final Paint paint=new Paint(3);
        RouteDiagram(ArrayList<double[]> points){super(MainActivity.this);this.points=points;setBackground(shape(Color.rgb(234,247,239),14));}
        @Override protected void onDraw(Canvas c){super.onDraw(c);if(points.isEmpty())return;
            double minLat=90,maxLat=-90,minLon=180,maxLon=-180;
            for(double[] p:points){minLat=Math.min(minLat,p[0]);maxLat=Math.max(maxLat,p[0]);minLon=Math.min(minLon,p[1]);maxLon=Math.max(maxLon,p[1]);}
            float pad=dp(24),w=getWidth()-pad*2,h=getHeight()-pad*2;double spanLat=Math.max(0.0001,maxLat-minLat),spanLon=Math.max(0.0001,maxLon-minLon);
            android.graphics.Path path=new android.graphics.Path();
            for(int i=0;i<points.size();i++){
                double[] p=points.get(i);float x=pad+(float)((p[1]-minLon)/spanLon*w),y=pad+(float)((maxLat-p[0])/spanLat*h);
                if(i==0)path.moveTo(x,y);else path.lineTo(x,y);
            }
            paint.setColor(GREEN);paint.setStrokeWidth(dp(5));paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeJoin(Paint.Join.ROUND);paint.setStyle(Paint.Style.STROKE);c.drawPath(path,paint);
            double[] a=points.get(0),b=points.get(points.size()-1);paint.setStyle(Paint.Style.FILL);
            paint.setColor(DEEP);c.drawCircle(pad+(float)((a[1]-minLon)/spanLon*w),pad+(float)((maxLat-a[0])/spanLat*h),dp(9),paint);
            paint.setColor(Color.rgb(242,148,33));c.drawCircle(pad+(float)((b[1]-minLon)/spanLon*w),pad+(float)((maxLat-b[0])/spanLat*h),dp(9),paint);
        }
    }
    private void renderDirections(){scrollBody();label(body,"Planificá tu viaje","Abrí indicaciones de transporte público con tu aplicación de mapas favorita.");
        LinearLayout c=card(body);c.addView(text("Desde",14,INK,true));space(c,5);EditText from=field("Mi ubicación o dirección de origen","");c.addView(from,lp(-1,54));space(c,14);
        c.addView(text("Hasta",14,INK,true));space(c,5);EditText to=field("Dirección o punto de destino","");c.addView(to,lp(-1,54));space(c,16);
        c.addView(button("Buscar recorrido en Maps ↗",true,()->{
            if(to.getText().toString().trim().isEmpty()){to.setError("Ingresá destino");return;}
            String url="https://www.google.com/maps/dir/?api=1&travelmode=transit&destination="+ApiClient.enc(to.getText().toString());
            if(!from.getText().toString().trim().isEmpty())url+="&origin="+ApiClient.enc(from.getText().toString());
            try{startActivity(new Intent(Intent.ACTION_VIEW,android.net.Uri.parse(url)));}catch(Exception e){Toast.makeText(this,"No se pudo abrir el mapa",Toast.LENGTH_LONG).show();}
        }),lp(-1,55));
        space(body,14);body.addView(para("Esta integración abre instrucciones de viaje externas. No afirma que las rutas externas correspondan exclusivamente a MOQSA."));
    }
    private void renderReports(){scrollBody();label(body,"Reclamos y sugerencias","Prepará un mensaje para enviarlo desde una aplicación de correo. No se utiliza el antiguo FTP inseguro.");
        LinearLayout c=card(body);c.addView(text("Nombre y apellido (opcional)",14,INK,true));space(c,5);
        EditText name=field("Tu nombre","");c.addView(name,lp(-1,52));space(c,12);
        c.addView(text("Línea (opcional)",14,INK,true));space(c,5);EditText line=field("Línea o ramal","");c.addView(line,lp(-1,52));space(c,12);
        c.addView(text("Tu mensaje",14,INK,true));space(c,5);EditText details=field("Describí qué ocurrió...","");details.setSingleLine(false);details.setGravity(Gravity.TOP|Gravity.START);details.setMinLines(5);c.addView(details,lp(-1,-2));space(c,16);
        TextView photoInfo=para(reportPhoto==null?"No hay fotografía adjunta.":"Fotografía seleccionada (solo se compartirá cuando confirmes el envío).");reportPhotoLabel=photoInfo;
        c.addView(button("📎 Adjuntar una fotografía",false,()->{
            Intent chooser=new Intent(Intent.ACTION_GET_CONTENT);chooser.setType("image/*");chooser.addCategory(Intent.CATEGORY_OPENABLE);
            try{startActivityForResult(Intent.createChooser(chooser,"Elegir fotografía"),REQ_PHOTO);}catch(Exception e){Toast.makeText(this,"No se pudo abrir el selector de imágenes",Toast.LENGTH_LONG).show();}
        }),lp(-1,50));space(c,8);c.addView(photoInfo);space(c,14);
        c.addView(button("Enviar con mi correo ↗",true,()->{
            String note=details.getText().toString().trim();if(note.isEmpty()){details.setError("Escribí un comentario");return;}
            Intent send=new Intent(Intent.ACTION_SEND);send.setType(reportPhoto==null?"text/plain":"image/*");
            if(reportPhoto!=null){send.putExtra(Intent.EXTRA_STREAM,reportPhoto);send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);}
            send.putExtra(Intent.EXTRA_SUBJECT,"Consulta o reclamo de transporte"+(line.length()>0?" — Línea "+line.getText():""));send.putExtra(Intent.EXTRA_TEXT,"Nombre: "+name.getText()+"\nLínea: "+line.getText()+"\n\n"+note);
            try{startActivity(Intent.createChooser(send,"Compartir el reclamo"));}catch(Exception e){Toast.makeText(this,"No hay aplicaciones para compartir",Toast.LENGTH_LONG).show();}
        }),lp(-1,55));
        space(body,12);body.addView(para("No se envía automáticamente a MOQSA: seleccioná el destinatario oficial y verificá los datos antes de enviar."));
    }
    private interface PositionCallback {void got(String lat,String lon);}
    private PositionCallback pending;
    private void requestLocation(PositionCallback cb,TextView status){pending=cb;
        boolean fine=checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED;
        boolean coarse=checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
        if(!fine&&!coarse){status.setText("Permití la ubicación para obtener paradas cercanas; el mapa se puede explorar sin ella.");requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},REQ_LOCATION);return;}
        locate(status);
    }
    @Override public void onRequestPermissionsResult(int req,String[] permissions,int[] results){super.onRequestPermissionsResult(req,permissions,results);if(req==REQ_LOCATION){if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED){pending=null;render();}else{pending=null;Toast.makeText(this,"Ubicación no autorizada. Podés usar la búsqueda por línea y calle.",Toast.LENGTH_LONG).show();}}}
    @SuppressWarnings("MissingPermission")
    private void locate(TextView status){
        try{
            LocationManager mgr=(LocationManager)getSystemService(LOCATION_SERVICE);
            Location found=null;
            for(String provider:mgr.getProviders(true)){
                Location p=mgr.getLastKnownLocation(provider);
                if(p!=null&&(found==null||p.getTime()>found.getTime()))found=p;
            }
            if(found!=null&&System.currentTimeMillis()-found.getTime()<10*60*1000L){deliver(found);return;}
            status.setText("Obteniendo ubicación actual...");
            final int token=generation;
            final LocationListener listener=new LocationListener(){public void onLocationChanged(Location loc){mgr.removeUpdates(this);if(token==generation)deliver(loc);} public void onProviderDisabled(String s){}public void onProviderEnabled(String s){}public void onStatusChanged(String s,int st,Bundle b){}};
            String provider=mgr.isProviderEnabled(LocationManager.NETWORK_PROVIDER)?LocationManager.NETWORK_PROVIDER:LocationManager.GPS_PROVIDER;
            if(!mgr.isProviderEnabled(provider)){pending=null;status.setText("Activá el GPS o la ubicación por red, y tocá acá para reintentar.");status.setOnClickListener(v->render());return;}
            mgr.requestSingleUpdate(provider,listener,Looper.getMainLooper());
            ui.postDelayed(()->{mgr.removeUpdates(listener);if(token==generation&&pending!=null){pending=null;status.setText("No se pudo obtener ubicación reciente. Revisá el GPS y tocá acá para reintentar.");status.setOnClickListener(v->render());}},12000);
        }catch(Exception e){status.setText("La ubicación no está disponible. Activá la localización del dispositivo.");}
    }
    private void deliver(Location l){PositionCallback cb=pending;pending=null;if(cb!=null)cb.got(String.format(Locale.US,"%.6f",l.getLatitude()),String.format(Locale.US,"%.6f",l.getLongitude()));}
    private void voice(){try{Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"es-AR");i.putExtra(RecognizerIntent.EXTRA_PROMPT,"Decí una línea, calle o parada");startActivityForResult(i,REQ_VOICE);}catch(Exception e){Toast.makeText(this,"Búsqueda por voz no disponible en este dispositivo",Toast.LENGTH_LONG).show();}}
    @Override protected void onActivityResult(int req,int code,Intent data){super.onActivityResult(req,code,data);if(req==REQ_PHOTO&&code==RESULT_OK&&data!=null){reportPhoto=data.getData();if(reportPhotoLabel!=null)reportPhotoLabel.setText("Fotografía adjunta. Se compartirá únicamente cuando elijas cómo enviarla.");Toast.makeText(this,"Fotografía seleccionada para adjuntar",Toast.LENGTH_SHORT).show();return;}if(req==REQ_VOICE&&code==RESULT_OK&&data!=null){ArrayList<String> result=data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);if(result!=null&&!result.isEmpty()){if(searchField!=null)searchField.setText(result.get(0));else {State s=state.copy("lines");s.search=result.get(0);nav(s);}}}}
}
