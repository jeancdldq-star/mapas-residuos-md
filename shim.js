/* Capa de compatibilidad: hace que la aplicación funcione fuera de Claude.
   Expone window.claude.use('db'|'user'|'assets'|'downloads') sobre Firebase (Firestore + Auth).
   El acceso se controla con dos códigos: uno de consulta y otro de edición. */
(function(){
'use strict';
var CFG=window.APP_CONFIG||{};
var V='10.14.1',B='https://www.gstatic.com/firebasejs/'+V+'/',KEY='residuos-code';
var role=null,ctxP=null,gateEl=null;
function h(tag,css,txt){var e=document.createElement(tag);if(css)e.style.cssText=css;if(txt!=null)e.textContent=txt;return e}
var dark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
var C=dark?{bg:'#111713',card:'#192019',ink:'#e6eee9',mut:'#97a69e',line:'#2c3831',acc:'#4fc3a8',accInk:'#06201a',err:'#ff8a80'}:{bg:'#f1f4f2',card:'#ffffff',ink:'#17211d',mut:'#5b6a63',line:'#d8dfdb',acc:'#0b6b5a',accInk:'#ffffff',err:'#b3261e'};
function gate(){
  if(gateEl) return gateEl;
  gateEl=h('div','position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;background:'+C.bg+';color:'+C.ink+';font-family:"IBM Plex Sans","Segoe UI",system-ui,sans-serif');
  document.body.append(gateEl); return gateEl;
}
function hideGate(){if(gateEl){gateEl.remove();gateEl=null}}
function card(){var g=gate();g.replaceChildren();var c=h('div','width:min(380px,100%);background:'+C.card+';border:1px solid '+C.line+';border-radius:12px;padding:22px;display:flex;flex-direction:column;gap:12px;box-shadow:0 6px 24px rgba(0,0,0,.14)');g.append(c);return c}
function fatal(title,text){var c=card();c.append(h('strong','font-size:18px',title),h('div','font-size:14px;color:'+C.mut+';line-height:1.45',text))}
function askCode(msg,prefill){
  return new Promise(function(res){
    var c=card(); var f=h('form','display:flex;flex-direction:column;gap:12px'); c.append(f);
    f.append(h('strong','font-size:20px','Mapas de residuos'),h('div','font-size:14px;color:'+C.mut,'Introduce el código de acceso que te han dado.'));
    var i=h('input','font:inherit;padding:10px 12px;border:1px solid '+C.line+';border-radius:8px;background:'+C.card+';color:'+C.ink+';min-height:44px'); i.type='password'; i.autocomplete='current-password'; i.placeholder='Código de acceso'; i.setAttribute('aria-label','Código de acceso'); i.value=prefill||'';
    var l=h('label','display:flex;gap:8px;align-items:center;font-size:13px;color:'+C.mut); var k=h('input'); k.type='checkbox'; k.checked=true; k.style.accentColor=C.acc; l.append(k,'Recordar en este dispositivo');
    var e=h('div','font-size:13px;color:'+C.err+';min-height:18px',msg||''); e.setAttribute('role','alert');
    var b=h('button','font:inherit;font-weight:600;padding:10px;border:0;border-radius:8px;background:'+C.acc+';color:'+C.accInk+';min-height:44px;cursor:pointer','Entrar'); b.type='submit';
    f.append(i,l,e,b); setTimeout(function(){i.focus()},0);
    f.onsubmit=function(ev){ev.preventDefault();res({code:i.value.trim(),remember:k.checked})};
  });
}
async function attempt(Au,auth,email,code){
  try{await Au.signInWithEmailAndPassword(auth,email,code);return 'ok'}
  catch(e){var c=(e&&e.code)||'';if(c==='auth/network-request-failed')return 'net';if(c==='auth/too-many-requests')return 'many';return 'bad'}
}
async function tryLogin(Au,auth,code){
  var a=await attempt(Au,auth,CFG.editorEmail,code); if(a==='ok') return {role:'edit'};
  if(a==='net'||a==='many') return {err:a};
  var b=await attempt(Au,auth,CFG.readerEmail,code); if(b==='ok') return {role:'view'};
  if(b==='net'||b==='many') return {err:b};
  return {err:'bad'};
}
function init(){
  if(ctxP) return ctxP;
  ctxP=(async function(){
    var fb=CFG.firebase;
    if(!fb||!fb.apiKey||/PEGA|YOUR_|XXXX/i.test(fb.apiKey)){fatal('Falta configurar la aplicación','Abre el archivo config.js y pega en él la configuración de Firebase (paso 4 de la guía).');return new Promise(function(){})}
    var mods;
    try{mods=await Promise.all([import(B+'firebase-app.js'),import(B+'firebase-auth.js'),import(B+'firebase-firestore.js')])}
    catch(e){fatal('No se pudo conectar','No se han podido cargar los componentes necesarios. Comprueba la conexión a internet y recarga la página.');return new Promise(function(){})}
    var A=mods[0],Au=mods[1],F=mods[2];
    var app=A.initializeApp(fb),auth=Au.getAuth(app),db=F.getFirestore(app);
    var code='';try{code=localStorage.getItem(KEY)||''}catch(e){}
    var msg='',prefill='';
    for(;;){
      var remember=true;
      if(!code){var a=await askCode(msg,prefill);code=a.code;remember=a.remember;prefill='';if(!code){msg='Escribe el código.';continue}}
      var r=await tryLogin(Au,auth,code);
      if(r.role){role=r.role;try{if(remember)localStorage.setItem(KEY,code);else localStorage.removeItem(KEY)}catch(e){}break}
      if(r.err==='net'){msg='No hay conexión con el servidor. Inténtalo de nuevo.';prefill=code;code='';continue}
      if(r.err==='many'){msg='Demasiados intentos. Espera unos minutos.';prefill=code;code='';continue}
      try{localStorage.removeItem(KEY)}catch(e){}
      msg='Código incorrecto.';code='';
    }
    hideGate();
    return {A:A,Au:Au,F:F,app:app,auth:auth,db:db};
  })();
  return ctxP;
}
/* ---------- base de datos con la misma interfaz que usa la aplicación ---------- */
function mapErr(e){var c=(e&&e.code)||'';return {code:c==='resource-exhausted'?'quota_exceeded':c==='permission-denied'?'not_granted':(c||'error'),message:(e&&e.message)||''}}
function makeDb(x){
  var F=x.F,db=x.db;
  function wrap(d){return {id:d.id,data:function(){return d.data()}}}
  function query(name,cons){
    return {
      orderBy:function(f,d){return query(name,cons.concat([F.orderBy(f,d||'asc')]))},
      limit:function(n){return query(name,cons.concat([F.limit(n)]))},
      onSnapshot:function(cb,err){return F.onSnapshot(F.query.apply(null,[F.collection(db,name)].concat(cons)),function(s){cb({docs:s.docs.map(wrap)})},function(e){if(err)err(mapErr(e))})},
      get:function(){return F.getDocs(F.query.apply(null,[F.collection(db,name)].concat(cons))).then(function(s){return {docs:s.docs.map(wrap)}},function(e){throw mapErr(e)})}
    };
  }
  return {
    collection:function(n){return query(n,[])},
    doc:function(path){
      var ref=F.doc(db,path);
      return {
        set:function(d){return F.setDoc(ref,d).catch(function(e){throw mapErr(e)})},
        update:function(d){return F.updateDoc(ref,d).catch(function(e){throw mapErr(e)})},
        delete:function(){return F.deleteDoc(ref).catch(function(e){throw mapErr(e)})},
        get:function(){return F.getDoc(ref).then(function(s){return {exists:s.exists(),id:s.id,data:function(){return s.data()}}},function(e){throw mapErr(e)})}
      };
    }
  };
}
/* ---------- imágenes de fondo: se guardan en trozos dentro de Firestore (sin Storage) ---------- */
var CH=900000,MAXCH=4,urlCache={},urlDone={};
function rid(){var a=new Uint8Array(12);crypto.getRandomValues(a);return Array.prototype.map.call(a,function(b){return ('0'+b.toString(16)).slice(-2)}).join('')}
function readAsDataUrl(blob){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result)};r.onerror=function(){rej(new Error('lectura'))};r.readAsDataURL(blob)})}
async function compress(file){
  if(file.type==='image/svg+xml'){var s=await readAsDataUrl(file);if(s.length>CH*MAXCH)throw {code:'too_large'};return s}
  var bmp=await createImageBitmap(file),max=3200,sc=Math.min(1,max/Math.max(bmp.width,bmp.height));
  for(var pass=0;pass<3;pass++){
    var cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(bmp.width*sc));cv.height=Math.max(1,Math.round(bmp.height*sc));
    var g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,cv.width,cv.height);g.drawImage(bmp,0,0,cv.width,cv.height);
    var qs=[.9,.82,.72,.6];
    for(var i=0;i<qs.length;i++){var u=cv.toDataURL('image/jpeg',qs[i]);if(u.length<=CH*MAXCH)return u}
    sc*=.7;
  }
  throw {code:'too_large'};
}
function makeAssets(x){
  var F=x.F,db=x.db;
  return {
    upload:async function(file){
      var url=await compress(file),id=rid(),n=Math.ceil(url.length/CH),tasks=[];
      for(var i=0;i<n;i++)tasks.push(F.setDoc(F.doc(db,'imgs',id+'_'+i),{id:id,n:i,total:n,data:url.slice(i*CH,(i+1)*CH)}));
      try{await Promise.all(tasks)}catch(e){throw mapErr(e)}
      return {id:id,url:'',sizeBytes:url.length,contentType:url.slice(5,url.indexOf(';'))};
    },
    delete:async function(id){
      var first=await F.getDoc(F.doc(db,'imgs',id+'_0'));if(!first.exists())return;
      var total=first.data().total||1,t=[];for(var i=0;i<total;i++)t.push(F.deleteDoc(F.doc(db,'imgs',id+'_'+i)));
      await Promise.all(t);delete urlCache[id];delete urlDone[id];
    }
  };
}
async function loadImage(id){
  var x=await init(),F=x.F,db=x.db;
  var first=await F.getDoc(F.doc(db,'imgs',id+'_0'));if(!first.exists())return '';
  var total=first.data().total||1,parts=[first.data().data],rest=[];
  for(var i=1;i<total;i++)rest.push(F.getDoc(F.doc(db,'imgs',id+'_'+i)));
  var docs=await Promise.all(rest);docs.forEach(function(d){parts.push(d.exists()?d.data().data:'')});
  var blob=await (await fetch(parts.join(''))).blob();
  return URL.createObjectURL(blob);
}
window.__imgReady=function(id){
  if(!urlCache[id])urlCache[id]=loadImage(id).then(function(u){urlDone[id]=u;return u},function(){delete urlCache[id];return ''});
  return urlCache[id];
};
window.__imgUrl=function(id){
  if(urlDone[id])return urlDone[id];
  window.__imgReady(id).then(function(u){if(u)window.dispatchEvent(new Event('imgloaded'))});
  return '';
};
/* ---------- descargas normales del navegador ---------- */
var downloads={save:function(req){
  return new Promise(function(res,rej){
    try{
      var d=req.data,blob=d instanceof Blob?d:new Blob([d]);
      var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=req.filename;document.body.append(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},4000);res({status:'saved'});
    }catch(e){rej({code:'unavailable',message:String(e&&e.message||e)})}
  });
}};
window.__logout=function(){
  try{localStorage.removeItem(KEY)}catch(e){}
  (ctxP||Promise.resolve(null)).then(function(x){return x?x.Au.signOut(x.auth):null}).catch(function(){}).then(function(){location.reload()});
};
window.claude={use:function(name){
  if(name==='downloads')return Promise.resolve(downloads);
  if(name==='db')return init().then(makeDb);
  if(name==='user')return init().then(function(){return {can:function(n){return n==='data.write'?role==='edit':role==='edit'},canEdit:function(){return role==='edit'},isOwner:function(){return false}}});
  if(name==='assets')return init().then(function(x){return role==='edit'?makeAssets(x):null});
  return Promise.resolve(null);
}};
})();

/* Cinta de aviso cuando la web es el entorno de pruebas (config.js → entorno) */
(function(){
  var env=window.APP_CONFIG&&window.APP_CONFIG.entorno; if(!env)return;
  function go(){
    var s=document.createElement('style');
    s.textContent='#envcinta{position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#c0392b;color:#fff;text-align:center;font:700 12px/1.6 system-ui,sans-serif;letter-spacing:.06em;padding:1px 8px;pointer-events:none}';
    document.head.appendChild(s);
    var d=document.createElement('div'); d.id='envcinta'; d.textContent='ENTORNO DE '+String(env).toUpperCase()+' · los datos de aquí no son los reales';
    document.body.appendChild(d); document.title='['+String(env).toUpperCase()+'] '+document.title;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
})();
