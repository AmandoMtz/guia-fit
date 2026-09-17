/* Web Push: activo por defecto cuando el navegador lo permite; el usuario puede desactivarlo. */
(function(root){
  'use strict';
  let context=null, owner=null, revision=0, wrongAccount=null;
  const autoPrepared=new Set();
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
    try{const prepared=await prepare(c);await subscribePrepared(c,prepared);return true;}catch{return false;}
  }
  function scheduleDefaultPermission(c){
    if(!eligible(c)||!supported()||disabledByUser(c.state.user.id))return;
    const id=c.state.user.id;
    if(Notification.permission==='granted'){autoEnableGranted(c);return;}
    if(Notification.permission!=='default'||autoPrepared.has(id))return;
    autoPrepared.add(id);
    const ask=()=>{
      cleanup();
      if(!eligible(c)||c.state.user?.id!==id||disabledByUser(id))return;
      // Se pide en la primera interacción para respetar las reglas de Chrome/Safari.
      Promise.resolve(Notification.requestPermission()).then(permission=>{
        if(permission==='granted'&&eligible(c)&&c.state.user?.id===id&&!disabledByUser(id))autoEnableGranted(c);
      }).catch(()=>{});
    };
    const cleanup=()=>{
      document.removeEventListener('pointerdown',ask,true);
      document.removeEventListener('keydown',ask,true);
    };
    document.addEventListener('pointerdown',ask,true);
    document.addEventListener('keydown',ask,true);
  }

  async function settings(c,host){
    const token=revision,id=c.state.user.id;
    const current=()=>host.isConnected&&token===revision&&c.state.user?.id===id;
    host.innerHTML='<h2>Notificaciones en tu dispositivo</h2><p>Los avisos están activados por defecto cuando tu navegador lo permite. Recibirás un aviso cuando un cliente o vendedor te escriba, aunque no tengas abierta la página.</p><p class="hint">En iPhone o iPad, agrega Guía FIT a la pantalla de inicio y ábrela desde su ícono. El navegador siempre conserva el control final del permiso.</p><p data-push-status role="status">Comprobando disponibilidad…</p><div class="button-row"><button type="button" class="btn" data-push-enable hidden>Permitir notificaciones</button><button type="button" class="btn secondary" data-push-disable hidden>Desactivar notificaciones</button><button type="button" class="btn secondary" data-push-test hidden>Enviar prueba</button></div>';
    const status=host.querySelector('[data-push-status]'),enable=host.querySelector('[data-push-enable]'),disable=host.querySelector('[data-push-disable]'),test=host.querySelector('[data-push-test]');
    if(!supported()){status.textContent='Este navegador no permite estos avisos aquí. Prueba un navegador compatible o, en iPhone, abre Guía FIT desde la pantalla de inicio.';return;}
    let prepared=null,sub=null,enabled=false;
    function paint(){
      const userOff=disabledByUser(id);
      enable.hidden=enabled||Notification.permission==='denied';
      disable.hidden=!enabled;
      test.hidden=!enabled;
      enable.disabled=false;
      enable.textContent=userOff?'Volver a activar':'Permitir notificaciones';
      status.textContent=enabled
        ?'Activadas para esta cuenta y dispositivo.'
        :userOff
          ?'Desactivadas por ti en este dispositivo.'
          :Notification.permission==='denied'
            ?'El navegador bloqueó los avisos. Habilítalos en los permisos del sitio para volver a activarlos.'
            :'Se activarán por defecto al permitir el aviso del navegador.';
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
    }catch(e){if(current()){paint();status.textContent=friendlyError(e);}return;}

    enable.onclick=async()=>{
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
  function route(chatId,recipientId){
    const c=context;if(!eligible(c))return;
    if(recipientId&&recipientId!==c.state.user.id){if(wrongAccount!==recipientId){wrongAccount=recipientId;c.toast('Este aviso pertenece a otra cuenta. Inicia sesión con la cuenta que recibió el mensaje.');}return;}
    if(chatId&&!/^[a-f0-9-]{36}$/i.test(chatId))return;
    const u=new URL(location.href);u.searchParams.delete('fitChat');u.searchParams.delete('fitUser');u.searchParams.delete('fitPush');history.replaceState(null,'',u);
    c.state.view=chatId?'food':'profile';if(chatId){c.state.foodTab='chats';c.state.foodFocusChat=chatId;}c.render();
  }
  function mount(c){
    context=c;
    if(owner!==c.state.user?.id){owner=c.state.user?.id;revision++;wrongAccount=null;}
    if(!eligible(c))return;
    scheduleDefaultPermission(c);
    const q=new URLSearchParams(location.search);
    if(q.has('fitPush')){route(q.get('fitChat'),q.get('fitUser'));return;}
    if(c.state.view==='profile'){
      const view=document.querySelector('#view');if(!view||view.querySelector('#push-settings'))return;
      const panel=document.createElement('section');panel.className='panel';panel.id='push-settings';panel.style.marginTop='24px';view.append(panel);settings(c,panel);
    }
  }
  navigator.serviceWorker?.addEventListener('message',e=>{
    if(e.data?.type==='fit-push-open'){
      if(eligible(context))route(e.data.chatId,e.data.recipientId);
      else{const u=new URL(location.href);u.searchParams.set('fitPush','1');if(e.data.chatId)u.searchParams.set('fitChat',e.data.chatId);if(e.data.recipientId)u.searchParams.set('fitUser',e.data.recipientId);history.replaceState(null,'',u);}
    }
  });
  root.FIT_PUSH={mount};
})(window);
