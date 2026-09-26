(function(root){
'use strict';
const campus={latitude:22.277055,longitude:-97.864674},names={'edificio-b':'Edificio B','edificio-c':'Edificio C',posgrado:'Posgrado',administrativo:'Administrativo',cafeteria:'Cafetería',laboratorios:'Laboratorios','administracion-posgrado':'Administración de Posgrado'};
let dispose=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const distance=(a,b)=>{const r=Math.PI/180,p=(b.latitude-a.latitude)*r,q=(b.longitude-a.longitude)*r;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(p/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(q/2)**2)));};
function project(p,z){const n=2**z,lat=Math.max(-85,Math.min(85,p.latitude))*Math.PI/180;return [(p.longitude+180)/360*n*256,(1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2*n*256];}
function mount(c,host){
 dispose?.();if(!host)return;
 let watch=null,fix=null,points=[],closed=false,observer=null;const statusText='Activa tu ubicación para ver tu posición y precisión en tiempo real.';
 host.innerHTML=`<section class="panel live-location"><h2>Ubicación en tiempo real</h2><p>Facultad de Ingeniería Tampico · UAT</p><label>Destino<select data-gps-target><option value="campus">Facultad de Ingeniería Tampico</option>${Object.entries(names).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><div class="button-row"><button class="btn" type="button" data-gps-start>Activar mi ubicación</button><button class="btn secondary" type="button" data-gps-stop disabled>Detener</button></div><p role="status" data-gps-status>${statusText}</p><div data-gps-map></div><p data-gps-detail></p><a class="btn secondary" data-gps-directions target="_blank" rel="noopener">Abrir navegación</a><p class="hint">El GPS orienta en exteriores; no identifica tu planta ni tu salón. Para el interior usa el mapa 3D y selecciona la planta.</p>${c.state.admin?'<details><summary>Administrar ubicación de accesos</summary><p>Selecciona un edificio, colócate en su acceso y espera una precisión de 25 m o mejor antes de guardar.</p><button class="btn secondary" type="button" data-gps-save>Guardar mi posición como acceso</button><p data-gps-save-status role="status"></p></details>':''}</section>`;
 const q=s=>host.querySelector(s),select=q('[data-gps-target]'),status=q('[data-gps-status]');
 function stop(){if(watch!==null)navigator.geolocation?.clearWatch(watch);watch=null;if(!closed){q('[data-gps-start]').disabled=false;q('[data-gps-stop]').disabled=true;}}
 dispose=()=>{stop();closed=true;observer?.disconnect();document.removeEventListener('visibilitychange',pause);root.removeEventListener('pagehide',stop);};
 function pause(){if(document.hidden){stop();if(!closed)status.textContent='Ubicación pausada. Actívala al volver.';}}
 document.addEventListener('visibilitychange',pause);root.addEventListener('pagehide',stop);
 observer=new MutationObserver(()=>{if(!host.isConnected)dispose?.();});observer.observe(document.body,{childList:true,subtree:true});
 function destination(){return select.value==='campus'?campus:points.find(x=>x.id===select.value);}
 function draw(){
  if(closed)return;const dest=destination(),center=dest||campus;
  const href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(dest&&select.value!=='campus'?dest.latitude+','+dest.longitude:'Facultad de Ingeniería Tampico UAT')+'&travelmode=walking';q('[data-gps-directions]').href=href;
  q('[data-gps-detail]').textContent=!dest?'El acceso de este edificio aún no está registrado. La navegación te llevará a la facultad.':select.value==='campus'?'Referencia general del mapa publicado por la facultad; confirma la entrada al llegar.':'Acceso registrado por administración. El GPS no determina el salón.';
  if(!fix){q('[data-gps-map]').innerHTML='<p class="hint">El mapa se mostrará al activar la ubicación.</p>';return;}
  const meters=distance(fix,center),z=meters>50000?8:meters>5000?12:meters>1000?14:16;
  const origin=project(fix,z),target=project(center,z),cx=(origin[0]+target[0])/2,cy=(origin[1]+target[1])/2,w=360,h=260;
  let tiles='';for(let y=Math.floor((cy-h/2)/256);y<=Math.floor((cy+h/2)/256);y++)for(let x=Math.floor((cx-w/2)/256);x<=Math.floor((cx+w/2)/256);x++){if(x>=0&&y>=0&&x<2**z&&y<2**z)tiles+=`<image href="https://tile.openstreetmap.org/${z}/${x}/${y}.png" x="${x*256-cx+w/2}" y="${y*256-cy+h/2}" width="256" height="256"/>`;}
  const ux=origin[0]-cx+w/2,uy=origin[1]-cy+h/2,tx=target[0]-cx+w/2,ty=target[1]-cy+h/2,scale=156543.03392*Math.cos(fix.latitude*Math.PI/180)/2**z;
  q('[data-gps-map]').innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Posición GPS y destino exterior">${tiles}<circle cx="${ux}" cy="${uy}" r="${Math.min(120,fix.accuracy/scale)}" fill="#2878df" fill-opacity=".18"/><circle cx="${ux}" cy="${uy}" r="6" fill="#1474df" stroke="white" stroke-width="2"/><circle cx="${tx}" cy="${ty}" r="7" fill="#c40000" stroke="white" stroke-width="2"/></svg><small>Azul: tú · Rojo: destino exterior · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a></small>`;
  status.textContent=`Precisión aproximada: ±${Math.round(fix.accuracy)} m · Distancia en línea recta: ${meters<1000?Math.round(meters)+' m':(meters/1000).toFixed(1)+' km'}. ${fix.accuracy>50?'Señal imprecisa; espera en un lugar abierto.':''}`;
 }
 select.onchange=draw;
 q('[data-gps-start]').onclick=()=>{
  if(!navigator.geolocation){status.textContent='Este dispositivo no ofrece ubicación.';return;}
  stop();status.textContent='Buscando señal GPS…';q('[data-gps-start]').disabled=true;q('[data-gps-stop]').disabled=false;
  watch=navigator.geolocation.watchPosition(p=>{if(closed||watch===null)return;if(Date.now()-p.timestamp>60000)return;fix={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp};draw();},e=>{if(closed)return;status.textContent=e.code===1?'Permiso de ubicación denegado. Puedes usar la navegación externa.':'No se pudo obtener tu posición. Intenta en un lugar abierto.';stop();},{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
 };
 q('[data-gps-stop]').onclick=()=>{stop();status.textContent='Seguimiento detenido. Se muestra la última ubicación.';};
 q('[data-gps-save]')?.addEventListener('click',async e=>{
  const message=q('[data-gps-save-status]');if(!names[select.value]||!fix||Date.now()-fix.timestamp>30000||fix.accuracy>25){message.textContent='Elige un edificio y obtén una posición reciente con precisión de 25 m o mejor.';return;}
  if(!root.confirm('¿Estás físicamente en el acceso de '+names[select.value]+' y deseas guardar esta posición?'))return;
  e.target.disabled=true;try{const {timestamp,...coords}=fix;const r=await c.client.request('/api/campus-locations/'+select.value,'PUT',coords);if(r.error)throw Error(r.error.message);points=points.filter(x=>x.id!==select.value).concat(r.data);message.textContent='Acceso guardado para la comunidad.';draw();}catch(err){message.textContent=err.message;}finally{e.target.disabled=false;}
 });
 c.client?.request('/api/campus-locations','GET').then(r=>{if(closed)return;if(!r.error&&Array.isArray(r.data))points=r.data;draw();}).catch(()=>{});draw();
}
root.FIT_LIVE_LOCATION={mount,clear:()=>dispose?.(),distance,project};
})(window);
