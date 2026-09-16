/* Web Push: se solicita permiso solo tras pulsar Activar. */
(function(root){
  'use strict';
  let context=null, owner=null, revision=0, wrongAccount=null;
  const supported=()=>isSecureContext && 'serviceWorker' in navigator && 'PushManager' in root && 'Notification' in root;
  const eligible=c=>c?.state.user&&!c.state.demo&&!c.state.offline&&c.client;
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
    return Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('La página todavía se está actualizando. Recarga e inténtalo de nuevo.')),15000))]);
  }
  async function settings(c,host){
    const token=revision, id=c.state.user.id;
    const current=()=>host.isConnected&&token===revision&&c.state.user?.id===id;
    host.innerHTML='<h2>Notificaciones en tu dispositivo</h2><p>Recibe un aviso cuando un cliente o vendedor te escriba, aunque no tengas abierta la página.</p><p class="hint">En iPhone o iPad, agrega Guía FIT a la pantalla de inicio y ábrela desde su ícono para activar los avisos.</p><p data-push-status role="status">Comprobando disponibilidad…</p><div class="button-row"><button type="button" class="btn" data-push-enable disabled>Activar notificaciones</button><button type="button" class="btn secondary" data-push-disable hidden>Desactivar en este dispositivo</button><button type="button" class="btn secondary" data-push-test hidden>Enviar prueba</button></div>';
    const status=host.querySelector('[data-push-status]'),enable=host.querySelector('[data-push-enable]'),disable=host.querySelector('[data-push-disable]'),test=host.querySelector('[data-push-test]');
    if(!supported()){status.textContent='Este navegador no permite estos avisos aquí. Prueba un navegador compatible o, en iPhone, abre Guía FIT desde la pantalla de inicio.';return;}
    let reg,sub,publicKey,enabled=false;
    function paint(){enable.hidden=enabled;enable.disabled=Notification.permission==='denied';disable.hidden=test.hidden=!enabled;status.textContent=enabled?'Activadas para esta cuenta y dispositivo.':Notification.permission==='denied'?'El navegador bloqueó los avisos. Habilítalos en los permisos del sitio y vuelve a intentarlo.':'Desactivadas. Pulsa Activar y acepta el permiso del navegador.';}
    try {
      const results=await Promise.all([registration(),api(c,'/config')]);
      if(!current())return;reg=results[0];publicKey=results[1].publicKey;sub=await reg.pushManager.getSubscription();
      if(sub)enabled=(await api(c,'/status','POST',{endpoint:sub.endpoint})).enabled;
      if(!current())return;paint();
    } catch(e){if(current())status.textContent=e.message;return;}
    enable.onclick=async()=>{
      enable.disabled=true;
      try {
        // Esta llamada debe conservar la activacion directa del usuario (Safari).
        const permission=await Notification.requestPermission();
        if(!current())return;
        if(permission!=='granted'){paint();return;}
        if(sub && sub.options?.applicationServerKey){
          const actual=new Uint8Array(sub.options.applicationServerKey),expected=toBytes(publicKey);
          if(actual.length!==expected.length||actual.some((v,i)=>v!==expected[i])){await sub.unsubscribe();sub=null;}
        }
        sub=sub||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(publicKey)});
        if(!current())return;
        await api(c,'/subscription','POST',sub.toJSON());enabled=true;
        if(current())paint();
      }catch(e){if(current())status.textContent=e.message;}finally{if(current())enable.disabled=Notification.permission==='denied';}
    };
    disable.onclick=async()=>{
      disable.disabled=true;
      try {await api(c,'/subscription','DELETE',{endpoint:sub.endpoint});await sub.unsubscribe();sub=null;enabled=false;if(current())paint();}
      catch(e){if(current())status.textContent=e.message;}finally{if(current())disable.disabled=false;}
    };
    test.onclick=async()=>{test.disabled=true;try{await api(c,'/test','POST',{endpoint:sub.endpoint});if(current())status.textContent='Prueba enviada al servicio de notificaciones. Revisa los avisos del dispositivo.';}catch(e){if(current())status.textContent=e.message;}finally{if(current())test.disabled=false;}};
  }
  function route(chatId,recipientId){
    const c=context;if(!eligible(c))return;
    if(recipientId && recipientId!==c.state.user.id){if(wrongAccount!==recipientId){wrongAccount=recipientId;c.toast('Este aviso pertenece a otra cuenta. Inicia sesión con la cuenta que recibió el mensaje.');}return;}
    if(chatId&&!/^[a-f0-9-]{36}$/i.test(chatId))return;
    const u=new URL(location.href);u.searchParams.delete('fitChat');u.searchParams.delete('fitUser');u.searchParams.delete('fitPush');history.replaceState(null,'',u);
    c.state.view=chatId?'food':'profile';if(chatId){c.state.foodTab='chats';c.state.foodFocusChat=chatId;}c.render();
  }
  function mount(c){
    context=c;
    if(owner!==c.state.user?.id){owner=c.state.user?.id;revision++;wrongAccount=null;}
    if(!eligible(c))return;
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
      else {const u=new URL(location.href);u.searchParams.set('fitPush','1');if(e.data.chatId)u.searchParams.set('fitChat',e.data.chatId);if(e.data.recipientId)u.searchParams.set('fitUser',e.data.recipientId);history.replaceState(null,'',u);}
    }
  });
  root.FIT_PUSH={mount};
})(window);
