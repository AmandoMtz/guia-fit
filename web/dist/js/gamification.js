(function(root){
 'use strict';
 let ctx=null,identity=null,data=null,tab='progress',category='',busy=false,version=0;
 setInterval(()=>{if(!document.hidden)refresh();},5*60*1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 const eligible=c=>c?.state?.user&&!c.state.demo&&!c.state.offline&&['student','teacher','admin'].includes(c.state.user.account_type|| (c.state.admin?'admin':''));
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const api=async(path,body)=>{const c=ctx;if(!c)throw Error('Inicia sesión.');const r=await c.client.request('/api/gamification'+path,body===undefined?'GET':'POST',body);if(r.error)throw Error(r.error.message||'No pudimos completar la operación.');return r.data;};
 function apply(){
  const b=document.body;for(const slot of ['frame','chat','background','motion'])b.dataset['fit'+slot]=data?.equipped?.[slot]||'';
  b.classList.toggle('fit-no-motion',data?.animations===false);
 }
 function clear(){identity=null;data=null;version++;apply();}
 async function refresh(){
  if(!eligible(ctx))return;
  const v=version;
  try{const result=await api('/sync',{});const next=await api('/me');if(v!==version)return;data=next;apply();if(result.earned)ctx.toast(`+${result.earned} EXP · Nivel ${data.level}`);}catch(e){if(v===version&&ctx?.state.view==='rewards')ctx.toast(e.message);}
 }
 function mount(c){ctx=c;if(!eligible(c)){clear();return;}if(identity!==c.state.user.id){clear();identity=c.state.user.id;refresh();}else apply();}
 async function scheduleSaved(uid,saved){if(!eligible(ctx)||uid!==identity)return;try{const r=await api('/schedule',{classes:saved.classes.map(x=>({subject:x.subject,day:x.day,start:x.start,end:x.end}))});if(r.earned)ctx.toast(`+${r.earned} EXP por tu primer horario`);await refresh();}catch(e){ctx?.toast('Tu horario quedó guardado. La recompensa se comprobará al volver a entrar.');}}
 async function mutate(path,body){if(busy)return;busy=true;try{await api(path,body);await render(ctx);}catch(e){ctx.toast(e.message);}finally{busy=false;}}
 const label=a=>a.startsWith('day:')?'Visita diaria':a.startsWith('week:')?'Semana completa':a.startsWith('event:')?'Asistencia a evento':a.startsWith('rating:')?'Valoración recibida':'Primer horario';
 async function render(c){
  ctx=c;const host=document.querySelector('#view');if(!host)return;
  if(!eligible(c)){host.innerHTML='<div class="notice">Los premios están disponibles para alumnos y docentes con correo institucional. Revisa tu cuenta para conocer su clasificación.</div>';return;}
  const v=version;host.innerHTML='<p role="status">Cargando tu progreso…</p>';
  try{
   await api('/sync',{});const next=await api('/me');if(v!==version||!host.isConnected)return;data=next;apply();
   // Recupera la recompensa pendiente de un horario previamente guardado en el dispositivo.
   if(!data.history.some(x=>x.activity==='first-schedule')){
    const saved=await root.FIT_SCHEDULE_STORE?.operation('get',identity).catch(()=>null);
    if(saved?.classes?.length){await api('/schedule',{classes:saved.classes.map(x=>({subject:x.subject,day:x.day,start:x.start,end:x.end}))}).catch(()=>{});data=await api('/me');}
   }
   if(v!==version||!host.isConnected)return;
   host.innerHTML=`<section class="reward-hero"><div><span class="eyebrow">TU CAMINO EN LA FIT</span><h2>Nivel ${data.level}</h2><p>Cada actividad cuenta. Cada nivel es tuyo.</p></div><div class="reward-balance"><strong>${data.coins}</strong><span>monedas disponibles</span></div><div class="reward-progress"><progress max="100" value="${data.xp%100}" aria-label="Progreso del nivel"></progress><span>${data.xp} EXP total · Faltan ${data.next} EXP para subir</span></div></section><nav class="reward-tabs" aria-label="Progreso y premios">${[['progress','Mi actividad'],['shop','Personalizar'],['ranking','Mejores vendedores'],['ratings','Mis valoraciones']].map(([id,name])=>`<button class="btn ${tab===id?'':'secondary'}" data-tab="${id}" aria-pressed="${tab===id}">${name}</button>`).join('')}</nav><section id="reward-content"></section>`;
   host.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render(c);});
   const content=host.querySelector('#reward-content');
   if(tab==='progress'){
    content.innerHTML=`<div class="reward-grid"><article class="reward-card"><h3>Tu semana FIT</h3><div class="reward-week">${['L','M','M','J','V'].map((d,i)=>{const hit=data.days.some(date=>new Date(date+'T12:00:00').getDay()===i+1);return `<span class="${hit?'earned':''}" aria-label="${['Lunes','Martes','Miércoles','Jueves','Viernes'][i]}: ${hit?'completado':'pendiente'}">${d}<small>${hit?'✓':'—'}</small></span>`;}).join('')}</div><p>10 EXP por día. Completa lunes a viernes y recibe 50 EXP extra.</p></article><article class="reward-card"><h3>Así creces</h3><p>Primer horario: <b>30 EXP</b><br>Asistencia con QR: <b>40 EXP</b><br>Valoración recibida: <b>10 EXP</b></p><p>Cada 100 EXP subes un nivel y recibes 50 monedas. Tus canjes son permanentes y no restan EXP.</p><small>Valoraciones: hasta 5 recompensas diarias y una por comprador cada semana. Asistencias contadas una vez por evento.</small></article></div><h3>Tu actividad reciente</h3><div class="reward-history">${data.history.map(x=>`<div><span>${label(x.activity)}<small>${new Date(x.created_at).toLocaleDateString('es-MX')}</small></span><b>+${x.xp} EXP</b></div>`).join('')||'<p>Aquí aparecerán tus primeras actividades.</p>'}</div>`;
   }else if(tab==='shop'){
    content.innerHTML=`<div class="reward-settings"><label><input type="checkbox" id="reward-motion" ${data.animations?'checked':''}> Activar animaciones suaves</label><p>También respetamos la preferencia de movimiento reducido de tu dispositivo. Los estilos se aplican a tu vista del perfil y las conversaciones.</p></div><div class="reward-grid">${data.catalog.map(item=>{const owned=data.inventory.includes(item.id),active=data.equipped[item.slot]===item.id;return `<article class="reward-card"><div class="reward-preview ${esc(item.id)}" aria-hidden="true"><span>${item.slot==='frame'?'FIT':'Hola, ¿cómo va tu día?'}</span></div><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><p><b>${owned?'Ya es tuyo':item.price+' monedas'}</b></p><button class="btn ${active?'secondary':''}" data-item="${item.id}" ${!owned&&data.coins<item.price?'disabled':''}>${active?'Quitar':owned?'Equipar':'Canjear'}</button></article>`;}).join('')}</div>`;
    content.querySelector('#reward-motion').onchange=e=>mutate('/animations',{enabled:e.target.checked});
    content.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{const item=data.catalog.find(x=>x.id===b.dataset.item);mutate(data.inventory.includes(item.id)?'/equip':'/buy',data.inventory.includes(item.id)?{slot:item.slot,item:data.equipped[item.slot]===item.id?null:item.id}:{item:item.id});});
   }else if(tab==='ranking'){
    const rows=await api('/ranking?category='+encodeURIComponent(category));if(!content.isConnected)return;
    content.innerHTML=`<label>Categoría <select id="reward-category"><option value="">Todas</option>${data.categories.map(x=>`<option ${category===x?'selected':''}>${x}</option>`).join('')}</select></label><p>Ordenamos por valoración ajustada y número de opiniones. Solo cuentan pedidos entregados; los puestos sin opiniones aparecen al final.</p><div class="reward-history">${rows.map((x,i)=>`<article><span class="reward-rank">${i+1}</span><div><h3>${esc(x.business_name)}</h3><p>${esc(x.pickup_location)} · ${x.categories.map(esc).join(', ')}</p><small>${x.votes?Number(x.average).toFixed(1)+' / 5 · '+x.votes+' opiniones · puntuación '+Number(x.score).toFixed(2):'Aún sin valoraciones'}</small></div></article>`).join('')||'<p>Todavía no hay puestos aprobados en esta categoría.</p>'}</div>`;
    content.querySelector('select').onchange=e=>{category=e.target.value;render(c);};
   }else{
    const [orders,vendor]=await Promise.all([api('/orders'),api('/categories')]);if(!content.isConnected)return;
    content.innerHTML=`${vendor?`<form id="vendor-categories" class="reward-card"><h3>Categorías de mi puesto</h3><p>Selecciona lo que vendes para aparecer en sus rankings.</p>${data.categories.map(x=>`<label><input type="checkbox" name="category" value="${x}" ${vendor.categories.includes(x)?'checked':''}> ${x}</label> `).join('')}<p><button class="btn">Guardar categorías</button></p></form>`:''}<h3>Califica tus pedidos entregados</h3><p>Una valoración por pedido. Las estrellas no se pueden modificar después de enviarlas.</p><div class="reward-grid">${orders.map(o=>`<form class="reward-card" data-order="${o.id}"><h3>${esc(o.business_name)}</h3><p>${esc(o.product_name)}</p>${o.stars?`<b>${o.stars} / 5 · Valoración enviada</b>`:`<label>Tu valoración<select name="stars" required><option value="">Elige las estrellas</option>${[5,4,3,2,1].map(n=>`<option value="${n}">${n} ${n===1?'estrella':'estrellas'}</option>`).join('')}</select></label><label>Categoría<select name="category">${o.categories.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><button class="btn">Enviar valoración</button>`}</form>`).join('')||'<p>Cuando recibas un pedido, podrás calificarlo aquí.</p>'}</div>`;
    content.querySelector('#vendor-categories')?.addEventListener('submit',e=>{e.preventDefault();mutate('/categories',{categories:new FormData(e.target).getAll('category')});});
    content.querySelectorAll('[data-order]').forEach(f=>f.onsubmit=e=>{e.preventDefault();const values=new FormData(f);mutate('/ratings',{order_id:f.dataset.order,stars:Number(values.get('stars')),category:values.get('category')});});
   }
  }catch(e){if(host.isConnected){host.innerHTML='<p role="alert">'+esc(e.message)+'</p><button class="btn" id="reward-retry">Reintentar</button>';host.querySelector('button').onclick=()=>render(c);}}
 }
 root.FIT_REWARDS={mount,render,refresh,scheduleSaved,clearIfGuest:s=>{if(!s.user||s.demo||s.offline)clear();}};
})(window);
