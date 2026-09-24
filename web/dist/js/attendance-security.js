/* Clave privada no exportable por Web Crypto. Identifica este navegador, no el hardware. */
(function(root){
 'use strict';
 async function api(c,path,method='GET',body){const r=await c.client.request('/api/attendance-security'+path,method,body);if(r.error)throw Error(r.error.message);return r.data;}
 const bytes=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 async function deviceKey(){
 if(!isSecureContext||!crypto.subtle||!root.indexedDB)throw Error('Necesitas un navegador compatible y una conexión HTTPS.');
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('fit-attendance-key',1);r.onupgradeneeded=()=>r.result.createObjectStore('keys');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('No se pudo abrir el almacenamiento del dispositivo.'));});
 const read=()=>new Promise((resolve,reject)=>{const r=db.transaction('keys').objectStore('keys').get('primary');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{
 let key=await read();if(key)return key;
 key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 try{await new Promise((resolve,reject)=>{const t=db.transaction('keys','readwrite');t.objectStore('keys').add(key,'primary');t.oncomplete=resolve;t.onabort=()=>reject(t.error);});}catch(e){const prior=await read();if(prior)return prior;throw e;}
 return key;
 }finally{db.close();}
 }
 async function locationNow(){
 if(!navigator.geolocation)throw Error('Este dispositivo no ofrece ubicación.');
 return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp}),e=>reject(Error(e.code===1?'Permite la ubicación precisa para registrar asistencia.':'No se pudo obtener una ubicación precisa. Activa la ubicación e inténtalo otra vez.')),{enableHighAccuracy:true,maximumAge:0,timeout:15000}));
 }
 async function checkin(c,token){
 const user=c.state.user.id,key=await deviceKey();
 const public_key=await crypto.subtle.exportKey('jwk',key.publicKey);
 const device=await api(c,'/device','POST',{public_key,label:'Navegador de asistencia'});
 if(device.status!=='approved')throw Error('Este dispositivo necesita autorización de administración. Consulta Mi cuenta.');
 const challenge=await api(c,'/challenge','POST',{device_id:device.id,token});
 const loc=await locationNow();
 const message=JSON.stringify([challenge.nonce,user,token,loc.latitude,loc.longitude,loc.accuracy,loc.timestamp]);
 const signature=bytes(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key.privateKey,new TextEncoder().encode(message)));
 if(c.state.user?.id!==user)throw Error('La sesión cambió. Vuelve a intentarlo.');
 return {token,location:loc,proof:{challenge_id:challenge.id,signature}};
 }
 async function settings(c,host){
 const e=c.esc,uid=c.state.user.id;
 host.innerHTML='<h2>Dispositivo para asistencia</h2><p>La asistencia requiere ubicación precisa y un navegador autorizado para tu cuenta. Al cambiar de teléfono, navegador o borrar sus datos, solicita una nueva autorización.</p><button class="btn" data-enroll>Solicitar autorización de este dispositivo</button><p data-status role="status"></p><div data-devices></div>';
 const status=host.querySelector('[data-status]');
 const render=async()=>{const rows=await api(c,'/device');if(!host.isConnected||c.state.user?.id!==uid)return;host.querySelector('[data-devices]').innerHTML=rows.map(d=>`<p><strong>${e(d.label)}</strong> · ${e({pending:'Pendiente',approved:'Autorizado',revoked:'Revocado'}[d.status])}<br><small>Código: ${e(d.id)}${d.reason?' · '+e(d.reason):''}</small></p>`).join('')||'<p>No tienes dispositivos registrados.</p>';};
 host.querySelector('[data-enroll]').onclick=async ev=>{ev.target.disabled=true;try{const key=await deviceKey();await api(c,'/device','POST',{public_key:await crypto.subtle.exportKey('jwk',key.publicKey),label:'Mi navegador de asistencia'});status.textContent='Solicitud consultada. Presenta tu credencial y el código a administración para autorizar este dispositivo.';await render();}catch(err){status.textContent=err.message;}finally{ev.target.disabled=false;}};
 try{await render();}catch(err){status.textContent=err.message;}
 if(c.state.user.role!=='admin')return;
 const admin=document.createElement('div');host.append(admin);
 admin.innerHTML='<hr><h2>Autorizar dispositivos</h2><p>Comprueba presencialmente la credencial y el código del dispositivo antes de aprobarlo. Aprobar uno nuevo revoca el anterior.</p><button class="btn secondary" data-refresh>Actualizar solicitudes</button><div data-list></div><hr><h2>Bitácora de operaciones</h2><p>Registro de cambios y solicitudes. Los registros conservan su identificador para relacionar cada operación.</p><label class="field">Filtrar por proceso<select data-entity><option value="">Todos</option><option>events</option><option>event_attendance</option><option>attendance_devices</option><option>food_orders</option><option>food_products</option><option>users</option><option>profiles</option><option>admin_benefit_grants</option><option>fit_push_delivery_log</option><option>http</option></select></label><div class="button-row"><button class="btn secondary" data-audit>Consultar bitácora</button><button class="btn secondary" data-export disabled>Descargar registros cargados</button><button class="btn secondary" data-more hidden>Cargar anteriores</button></div><div data-log></div>';
 const refresh=async()=>{try{const rows=await api(c,'/devices');if(c.state.user?.id!==uid||!host.isConnected)return;admin.querySelector('[data-list]').innerHTML=rows.map(d=>`<article class="panel"><strong>${e(d.full_name)}</strong><p>${e(d.email)} · ${e(d.status)}</p><small>${e(d.id)}</small><div class="button-row"><button class="btn" data-review="${e(d.id)}" data-state="approved">Autorizar</button><button class="btn secondary" data-review="${e(d.id)}" data-state="revoked">Revocar</button></div></article>`).join('');admin.querySelectorAll('[data-review]').forEach(b=>b.onclick=async()=>{const reason=prompt('Motivo y referencia de la verificación de identidad (mínimo 8 caracteres):');if(!reason)return;b.disabled=true;try{await api(c,'/devices/'+b.dataset.review,'PATCH',{status:b.dataset.state,reason});await refresh();}catch(err){c.toast(err.message);}finally{b.disabled=false;}});}catch(err){c.toast(err.message);}};
 admin.querySelector('[data-refresh]').onclick=refresh;await refresh();
 let records=[],next=null,filter='';
 async function load(reset){try{if(reset){records=[];next=null;filter=admin.querySelector('[data-entity]').value;}const r=await c.client.request('/api/attendance-security/audit?entity='+encodeURIComponent(filter)+(next?'&before='+encodeURIComponent(next):''),'GET');if(r.error)throw Error(r.error.message);if(c.state.user?.id!==uid||!host.isConnected)return;records.push(...r.data);next=r.next;admin.querySelector('[data-more]').hidden=!next;admin.querySelector('[data-export]').disabled=!records.length;admin.querySelector('[data-log]').innerHTML=records.map(r=>`<details><summary>#${e(r.id)} · ${e(new Date(r.created_at).toLocaleString())} · ${e(r.entity)} · ${e(r.action)}</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${e(JSON.stringify(r,null,2))}</pre></details>`).join('')||'<p>No hay registros.</p>';}catch(err){c.toast(err.message);}}
 admin.querySelector('[data-audit]').onclick=()=>load(true);admin.querySelector('[data-more]').onclick=()=>load(false);
 admin.querySelector('[data-export]').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({exported_at:new Date().toISOString(),filter,records},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='bitacora-fit.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 }
 function mount(c){if(c.state.view!=='profile'||!c.state.user||c.state.demo||c.state.offline||!c.client)return;const view=document.querySelector('#view');if(!view||view.querySelector('#attendance-security'))return;const host=document.createElement('section');host.id='attendance-security';host.className='panel';host.style.marginTop='24px';view.append(host);settings(c,host).catch(err=>c.toast(err.message));}
 root.FIT_ATTENDANCE={checkin,mount,locationNow};
})(window);
