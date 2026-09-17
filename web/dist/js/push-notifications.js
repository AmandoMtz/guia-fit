/* Web Push: activo por defecto cuando el navegador lo permite; el usuario puede desactivarlo. */
(function(root){
  'use strict';
  let context=null, owner=null, revision=0, wrongAccount=null, syncingOwner=null, syncedOwner=null;
  const supported=()=>isSecureContext && 'serviceWorker' in navigator && 'PushManager' in root && 'Notification' in root;
  const eligible=c=>c?.state.user&&!c.state.demo&&!c.state.offline&&c.client;
  const prefKey=id=>'fit_push_disabled:'+id;
  const disabledByUser=id=>{try{return localStorage.getItem(prefKey(id))==='1';}catch{return false;}};
  const setDisabled=(id,value)=>{try{if(value)localStorage.setItem(prefKey(id),'1');else localStorage.removeItem(prefKey(id));}catch{}};

  async function api(c,path,method='GET',body){
    const id=c.state.user?.id;
    const r=await c.client.request('/api/push'+path,method,body);
    if(c.state.user?.id!==id)throw Error('La sesión cambió.');
    if(r.error)throw Error(r.error.message||'No fue posible configurar los avisos.');
    return r.data;
  }
  function toBytes(v){const s=atob(v.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(s,c=>c.charCodeAt(0));}
  async function registration(){
    await navigator.serviceWorker.register('/sw.js');
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_,reject)=>setTimeout(()=>reject(Error('La página todavía se está actualizando. Recarga e inténtalo de nuevo.')),15000)),
    ]);
  }
  function friendlyError(e){
    const raw=String(e?.message||e||'');
    if(/registration failed|push service error|push service/i.test(raw))return 'El servicio de notificaciones del navegador no respondió. Puedes seguir usando Guía FIT y volver a intentarlo desde Mi cuenta.';
    if(/permission|notallowed|denied/i.test(raw))return 'El navegador no permitió los avisos. Revisa los permisos del sitio para volver a activarlos.';
    return raw||'No fue posible configurar las notificaciones en este dispositivo.';
  }
  async function prepare(c){
    const reg=await registration();
    const cfg=await api(c,'/config');
    let sub=await reg.pushManager.getSubscription();
    if(sub && sub.options?.applicationServerKey){
      const actual=new Uint8Array(sub.options.applicationServerKey),expected=toBytes(cfg.publicKey);
      if(actual.length!==expected.length||actual.some((v,i)=>v!==expected[i])){await sub.unsubscribe();sub=null;}
    }
    return {reg,publicKey:cfg.publicKey,sub};
  }
  async function subscribePrepared(c,prepared){
    let {reg,publicKey,sub}=prepared;
    sub=sub||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(publicKey)});
    await api(c,'/subscription','POST',sub.toJSON());
    setDisabled(c.state.user.id,false);
    return sub;
  }
  async function autoEnableGranted(c){
    if(!eligible(c)||!supported()||disabledByUser(c.state.user.id)||Notification.permission!=='granted')return false;
    const id=c.state.user.id;
    if(syncedOwner===id||syncingOwner===id)return true;
    syncingOwner=id;
    try{const prepared=await prepare(c);if(c.state.user?.id!==id)return false;await subscribePrepared(c,prepared);if(c.state.user?.id===id)syncedOwner=id;return true;}catch{return false;}finally{if(syncingOwner===id)syncingOwner=null;}
  }

  async function settings(c,host){
    const token=revision,id=c.state.user.id;
    const current=()=>host.isConnected&&token===revision&&c.state.user?.id===id;
    host.innerHTML='<h2>Notificaciones en tu dispositivo</h2><p>Permite las notificaciones para recibir mensajes, cambios de pedidos, eventos, asistencias, autorizaciones y recompensas aunque no tengas abierta la página. Debes conservar la sesión iniciada.</p><p class="hint">En iPhone o iPad, agrega Guía FIT a la pantalla de inicio y ábrela desde su ícono. El navegador siempre conserva el control final del permiso.</p><p data-push-status role="status">Comprobando disponibilidad…</p><div class="button-row"><button type="button" class="btn" data-push-enable disabled>Permitir notificaciones</button><button type="button" class="btn secondary" data-push-disable hidden>Desactivar notificaciones</button><button type="button" class="btn secondary" data-push-test hidden>Enviar prueba</button></div>';
    const status=host.querySelector('[data-push-status]'),enable=host.querySelector('[data-push-enable]'),disable=host.querySelector('[data-push-disable]'),test=host.querySelector('[data-push-test]');
    if(!supported()){status.textContent='En iPhone o iPad (iOS 16.4 o posterior): Compartir → Agregar a pantalla de inicio; abre el ícono y vuelve a Mi cuenta. En otros equipos usa HTTPS y un navegador con notificaciones push.';enable.disabled=false;enable.textContent='Cómo activar notificaciones';enable.onclick=()=>c.toast(status.textContent);return;}
    let prepared=null,sub=null,enabled=false;
    function paint(){
      const userOff=disabledByUser(id);
      enable.hidden=enabled;
      disable.hidden=!enabled;
      test.hidden=!enabled;
      enable.disabled=false;
      enable.textContent=Notification.permission==='denied'?'Cómo habilitar los avisos':userOff?'Volver a activar':'Permitir notificaciones';
      status.textContent=enabled
        ?'Activadas para esta cuenta y dispositivo.'
        :userOff
          ?'Desactivadas por ti en este dispositivo.'
          :Notification.permission==='denied'
            ?'El navegador bloqueó los avisos. Habilítalos en los permisos del sitio para volver a activarlos.'
            :'Pulsa Permitir notificaciones para activarlas en este dispositivo.';
    }
    try{
      prepared=await prepare(c);if(!current())return;
      sub=prepared.sub;
      if(sub)enabled=(await api(c,'/status','POST',{endpoint:sub.endpoint})).enabled;
      if(!current())return;
      if(!enabled&&!disabledByUser(id)&&Notification.permission==='granted'){
        sub=await subscribePrepared(c,prepared);enabled=true;
      }
      if(current())paint();
    }catch(e){if(current()){paint();status.textContent=friendlyError(e);}}

    enable.onclick=async()=>{
      if(Notification.permission==='denied'){status.textContent='Abre los permisos del sitio en tu navegador, permite Notificaciones y recarga. En iPhone revisa Ajustes → Notificaciones para la app instalada.';return;}
      enable.disabled=true;setDisabled(id,false);
      try{
        const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
        if(!current())return;
        if(permission!=='granted'){paint();return;}
        prepared=prepared||await prepare(c);
        sub=await subscribePrepared(c,{...prepared,sub});enabled=true;
        if(current())paint();
      }catch(e){if(current())status.textContent=friendlyError(e);}finally{if(current())enable.disabled=false;}
    };
    disable.onclick=async()=>{
      disable.disabled=true;
      try{
        if(sub){await api(c,'/subscription','DELETE',{endpoint:sub.endpoint});await sub.unsubscribe();}
        sub=null;enabled=false;setDisabled(id,true);if(current())paint();
      }catch(e){if(current())status.textContent=friendlyError(e);}finally{if(current())disable.disabled=false;}
    };
    test.onclick=async()=>{
      test.disabled=true;
      try{await api(c,'/test','POST',{endpoint:sub.endpoint});if(current())status.textContent='Prueba enviada. Revisa los avisos del dispositivo.';}
      catch(e){if(current())status.textContent=friendlyError(e);}finally{if(current())test.disabled=false;}
    };
  }
  function route(chatId,recipientId,view){
    const c=context;if(!eligible(c))return;
    if(recipientId&&recipientId!==c.state.user.id){if(wrongAccount!==recipientId){wrongAccount=recipientId;c.toast('Este aviso pertenece a otra cuenta. Inicia sesión con la cuenta que recibió el mensaje.');}return;}
    if(chatId&&!/^[a-f0-9-]{36}$/i.test(chatId))return;
    const u=new URL(location.href);u.searchParams.delete('fitChat');u.searchParams.delete('fitUser');u.searchParams.delete('fitPush');u.searchParams.delete('fitView');history.replaceState(null,'',u);
    const target=['food','events','profile','messages'].includes(view)?view:'profile';c.state.view=chatId?(target==='messages'?'messages':'food'):target;if(chatId){if(c.state.view==='messages')c.state.messagesFocusChat=chatId;else{c.state.foodTab='chats';c.state.foodFocusChat=chatId;}}c.render();
  }
  async function activity(c,view){
    const panel=document.createElement('section');panel.className='panel';panel.style.marginTop='24px';view.append(panel);
    const user=c.state.user.id;
    try{const rows=await api(c,'/activity');if(!panel.isConnected||c.state.user?.id!==user)return;
      const allowed=new Set(['food','events','profile','messages']);
      panel.innerHTML='<h2>Mis avisos</h2><button class="btn secondary" data-read>Marcar como leídos</button>'+ (rows.map(n=>`<article><p><strong>${c.esc(n.title)}${n.read_at?'':' · Nuevo'}</strong><br>${c.esc(n.body)}<br><small>${c.esc(new Date(n.created_at).toLocaleString())}</small></p>${allowed.has(n.view_name)?`<button type="button" class="btn secondary small" data-activity-view="${c.esc(n.view_name)}">Abrir</button>`:''}</article>`).join('')||'<p>No tienes avisos recientes.</p>');
      panel.querySelector('[data-read]').onclick=async()=>{try{await api(c,'/activity/read','PATCH',{});panel.remove();activity(c,view);}catch(e){c.toast(e.message);}};
      panel.querySelectorAll('[data-activity-view]').forEach(b=>b.onclick=()=>{c.state.view=b.dataset.activityView;c.render();});
    }catch(e){panel.textContent=e.message;}
  }
  function mount(c){
    context=c;
    if(owner!==c.state.user?.id){owner=c.state.user?.id;revision++;wrongAccount=null;syncedOwner=null;}
    if(!eligible(c))return;
    autoEnableGranted(c);
    const q=new URLSearchParams(location.search);
    if(q.has('fitPush')){route(q.get('fitChat'),q.get('fitUser'),q.get('fitView'));return;}
    if(['profile','notifications'].includes(c.state.view)){
      const view=document.querySelector('#view');if(!view||view.querySelector('#push-settings'))return;
      const panel=document.createElement('section');panel.className='panel';panel.id='push-settings';panel.style.marginTop='24px';view.prepend(panel);settings(c,panel);activity(c,view);
    }
  }
  navigator.serviceWorker?.addEventListener('message',e=>{
    if(e.data?.type==='fit-push-open'){
      if(eligible(context))route(e.data.chatId,e.data.recipientId,e.data.view);
      else{const u=new URL(location.href);u.searchParams.set('fitPush','1');if(e.data.view)u.searchParams.set('fitView',e.data.view);if(e.data.chatId)u.searchParams.set('fitChat',e.data.chatId);if(e.data.recipientId)u.searchParams.set('fitUser',e.data.recipientId);history.replaceState(null,'',u);}
    }
  });
  root.FIT_PUSH={mount};
})(window);
