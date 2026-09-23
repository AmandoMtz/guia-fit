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
 async function refresh(){
  if(!ctx||document.hidden)return;
  const current=version,ids=[...new Set([...document.querySelectorAll('[data-presence-user]')].map(el=>el.dataset.presenceUser))];
  try{for(let i=0;i<ids.length;i+=100){const rows=await request('?ids='+encodeURIComponent(ids.slice(i,i+100).join(',')));if(current!==version)return;for(const row of rows||[])cache.set(row.id,row.status);}paint();}
  catch{if(current===version){cache.clear();paint();}}
 }
 async function heartbeat(nextMode){
  if(!ctx||busy)return;
  busy=true;const current=version;
  try{
   const data=await request('','POST',{tab_id:tab,idle_ms:Math.min(86400000,Date.now()-lastActive),...(nextMode?{mode:nextMode}:{})});
   if(current!==version)return;
   mode=data.mode;const select=document.querySelector('#fit-presence-mode');if(select)select.value=mode;
   await refresh();
  }finally{busy=false;}
 }
 function badge(id){
  if(!/^[0-9a-f-]{36}$/i.test(String(id||'')))return '';
  clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,80);
  const status=cache.get(id);
  return `<span class="fit-presence" data-presence-user="${id}" data-presence-status="${status||'unknown'}">${labels[status]||'Comprobando estado…'}</span>`;
 }
 function mount(c){
  const id=c.state.user?.id;
  if(!id||c.state.demo||c.state.offline||!c.client){ctx=null;owner=null;version++;clearInterval(timer);timer=null;cache.clear();return;}
  ctx=c;
  if(owner!==id){owner=id;version++;lastActive=Date.now();mode='online';cache.clear();clearInterval(timer);timer=setInterval(()=>heartbeat().catch(()=>{}),25000);heartbeat().catch(()=>{});}
  const target=document.querySelector('.top-actions');
  if(target&&!document.querySelector('#fit-presence-mode')){
   const label=document.createElement('label');label.className='fit-presence-control';
   label.innerHTML=`<span>Mi estado</span>${badge(id)}<select id="fit-presence-mode" aria-label="Mi estado de conexión" title="En línea cambia a Ausente tras 10 minutos sin actividad. No molestar silencia las notificaciones externas.">${Object.entries(labels).map(([value,text])=>`<option value="${value}">${text}</option>`).join('')}</select>`;
   target.prepend(label);const select=label.querySelector('select');select.value=mode;
   select.onchange=async()=>{
    const chosen=select.value;select.disabled=true;
    try{while(busy)await new Promise(resolve=>setTimeout(resolve,50));await heartbeat(chosen);}
    catch(e){select.value=mode;c.toast(e.message);}finally{select.disabled=false;}
   };
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
 root.FIT_PRESENCE={mount,leave,badge,refresh};
})(window);
