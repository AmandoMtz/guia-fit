(function(root){
 'use strict';
 const labels={online:'En línea',away:'Ausente',dnd:'No molestar',offline:'Desconectado'};
 const tab=crypto.randomUUID();
 let ctx=null,owner=null,lastActive=Date.now(),mode='online',timer=null,refreshTimer=null,busy=false,version=0;
 const cache=new Map();
 async function request(path,method='GET',body){
  const c=ctx;if(!c)return null;
  const result=await c.client.request('/api/presence'+path,method,body);
  if(result.error)throw Error(result.error.message||'No se pudo actualizar tu estado.');
  return result.data;
 }
 function paint(){
  document.querySelectorAll('[data-presence-user]').forEach(el=>{
   const status=cache.get(el.dataset.presenceUser);
   el.dataset.presenceStatus=status||'unknown';el.textContent=labels[status]||'Comprobando estado…';
  });
 }
 async function refresh(strict=false){
  if(!ctx||document.hidden)return;
  const current=version,ids=[...new Set([...document.querySelectorAll('[data-presence-user]')].map(el=>el.dataset.presenceUser))];
  try{for(let i=0;i<ids.length;i+=100){const rows=await request('?ids='+encodeURIComponent(ids.slice(i,i+100).join(',')));if(current!==version)return;for(const row of rows||[])cache.set(row.id,row.status);}paint();}
  catch(e){if(current===version){cache.clear();paint();}if(strict)throw e;}
 }
 async function heartbeat(nextMode){
  if(!ctx||busy)return;
  busy=true;const current=version;
  try{
   const data=await request('','POST',{tab_id:tab,idle_ms:Math.min(86400000,Date.now()-lastActive),...(nextMode?{mode:nextMode}:{})});
   if(current!==version)return;
   mode=data.mode;syncMenu();
   await refresh();
  }finally{busy=false;}
 }
 function badge(id){
  if(!/^[0-9a-f-]{36}$/i.test(String(id||'')))return '';
  clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,80);
  const status=cache.get(id);
  return `<span class="fit-presence" data-presence-user="${id}" data-presence-status="${status||'unknown'}">${labels[status]||'Comprobando estado…'}</span>`;
 }
 function syncMenu(){
  const summary=document.querySelector('#fit-presence-mode');
  if(summary)summary.innerHTML=`<span class="presence-dot" data-status="${mode}"></span><span>${labels[mode]}</span><span class="presence-chevron" aria-hidden="true">⌄</span>`;
  document.querySelectorAll('[data-mode-value]').forEach(button=>button.setAttribute('aria-checked',String(button.dataset.modeValue===mode)));
 }
 function mount(c){
  const id=c.state.user?.id;
  if(!id||c.state.demo||c.state.offline||!c.client){ctx=null;owner=null;version++;clearInterval(timer);timer=null;cache.clear();return;}
  ctx=c;
  if(owner!==id){owner=id;version++;lastActive=Date.now();mode='online';cache.clear();clearInterval(timer);timer=setInterval(()=>heartbeat().catch(()=>{}),25000);heartbeat().catch(()=>{});}
  const target=document.querySelector('.top-actions');
  if(target&&!document.querySelector('#fit-presence-mode')){
   const label=document.createElement('div');label.className='fit-presence-control';
   label.innerHTML=`<span class="presence-caption">Mi estado</span>${badge(id)}<details class="presence-picker"><summary id="fit-presence-mode" aria-label="Cambiar mi estado" aria-haspopup="menu" aria-expanded="false"></summary><div class="presence-options" role="menu" aria-label="Estado de conexión">${Object.entries(labels).map(([value,text])=>`<button type="button" role="menuitemradio" data-mode-value="${value}" aria-checked="false"><span class="presence-dot" data-status="${value}"></span><span><strong>${text}</strong><small>${{online:'Ausente tras 10 min sin actividad',away:'Estoy disponible más tarde',dnd:'Silenciar notificaciones externas',offline:'Aparecer sin conexión'}[value]}</small></span><span class="presence-check" aria-hidden="true">✓</span></button>`).join('')}</div></details>`;
   target.prepend(label);syncMenu();
   const picker=label.querySelector('details'),summary=label.querySelector('summary');
   const options=[...label.querySelectorAll('[data-mode-value]')];
   picker.addEventListener('toggle',()=>summary.setAttribute('aria-expanded',String(picker.open)));
   options.forEach(option=>option.onclick=async()=>{
    const chosen=option.dataset.modeValue;
    options.forEach(b=>b.disabled=true);summary.setAttribute('aria-busy','true');
    try{while(busy)await new Promise(resolve=>setTimeout(resolve,50));await heartbeat(chosen);picker.open=false;summary.focus();}
    catch(e){c.toast(e.message);}finally{options.forEach(b=>b.disabled=false);summary.removeAttribute('aria-busy');syncMenu();}
   });
   picker.addEventListener('keydown',event=>{
    if(event.key==='Escape'){picker.open=false;summary.focus();event.preventDefault();}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
     event.preventDefault();picker.open=true;
     const index=options.indexOf(document.activeElement);
     const next=event.key==='Home'?0:event.key==='End'?options.length-1:event.key==='ArrowDown'?(index+1)%options.length:(index<=0?options.length:index)-1;
     options[next].focus();
    }
   });
   picker.addEventListener('focusout',()=>setTimeout(()=>{if(!picker.contains(document.activeElement))picker.open=false;},0));
  }
 }
 async function leave(){
  try{await request('/'+tab,'DELETE');}catch{}
  ctx=null;owner=null;version++;clearInterval(timer);timer=null;cache.clear();
 }
 function activity(){
  if(document.hidden)return;
  const wasIdle=Date.now()-lastActive>=600000;lastActive=Date.now();
  if(wasIdle)heartbeat().catch(()=>{});
 }
 ['pointerdown','pointermove','keydown','scroll','touchstart'].forEach(event=>document.addEventListener(event,activity,{passive:true,capture:true}));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)heartbeat().catch(()=>{});});
 root.addEventListener('online',()=>heartbeat().catch(()=>{}));
 document.addEventListener('pointerdown',event=>{document.querySelectorAll('.presence-picker[open]').forEach(picker=>{if(!picker.contains(event.target))picker.open=false;});});
 root.FIT_PRESENCE={mount,leave,badge,refresh};
})(window);
