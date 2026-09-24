(function(root){
 'use strict';
 let ctx=null,identity=null,data=null,tab='progress',category='',vendorSort='score',communitySort='xp',communityRole='all',busy=false,version=0;
 setInterval(()=>{if(!document.hidden)refresh();},5*60*1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 const eligible=c=>c?.state?.user&&!c.state.demo&&!c.state.offline&&['student','teacher','admin'].includes(c.state.user.account_type|| (c.state.admin?'admin':''));
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const previewText=item=>item.slot==='frame'?'FIT':item.slot==='theme'?'Tema FIT':item.slot==='font'?'Aa FIT':'Hola, ¿cómo va tu día?';
 const api=async(path,body)=>{const c=ctx;if(!c)throw Error('Inicia sesión.');const r=await c.client.request('/api/gamification'+path,body===undefined?'GET':'POST',body);if(r.error)throw Error(r.error.message||'No pudimos completar la operación.');return r.data;};
 let previewDesign=null;
 const effectSymbols={sparkles:'✦',flames:'♨',candy:'🍬',snow:'❄',hearts:'♥',petals:'✿',confetti:'▰'};
 function customCSS(items){
  let style=document.querySelector('#custom-reward-styles');if(!style){style=document.createElement('style');style.id='custom-reward-styles';document.head.append(style);}
  style.textContent=items.filter(x=>x.design&&/^custom-[a-z0-9-]+$/.test(x.id)).map(x=>{
   const d=x.design;if(![d.primary,d.secondary,d.surface,d.ink].every(v=>/^#[0-9a-f]{6}$/i.test(v)))return '';
   const sel=`body[data-fit${x.slot}="${x.id}"]`,card=`.reward-preview.${x.id}`;
   if(x.slot==='frame')return `${sel} .profile-avatar,${card}>span{--frame-a:${d.primary};--frame-b:${d.secondary};border:4px solid ${d.primary};border-radius:50%;overflow:visible;position:relative;animation:fit-frame-shimmer ${d.speed}s ease-in-out infinite} ${sel} .profile-avatar img{border-radius:50%}`;
   if(x.slot==='background')return `${sel} .fit-chat-panel,${sel} .fit-chat-messages,${card}{background:${d.surface};color:${d.ink}} ${sel} .fit-chat-header,${sel} .fit-chat-send{background:${d.primary};color:${d.ink}}`;
   return `${sel}{--read-action:${d.primary};--read-hover:${d.secondary};--read-link:${d.primary};--read-muted:${d.ink};--read-on-action:${d.ink};--fit-accent:${d.primary};--fit-accent-dark:${d.secondary};--fit-bg:${d.surface};--fit-surface:${d.surface};--fit-soft:${d.surface};--fit-line:${d.secondary};--fit-ink:${d.ink};--fit-muted:${d.ink};--orange:${d.primary};--orange-dark:${d.secondary};--red:${d.primary};--navy:${d.primary};--line:${d.secondary};--soft:${d.surface};--ink:${d.ink};--muted:${d.ink}} ${card}{background:${d.surface};color:${d.ink};border:3px solid ${d.primary}}`;
  }).join('\n');
 }
 function decorate(scope=document){

  const seasonal={'frame-halloween':['flames','candy'],'frame-christmas':['snow'],'frame-mexico':['confetti'],'frame-muertos':['petals'],'frame-newyear':['sparkles'],'frame-valentine':['hearts']};
  scope.querySelectorAll('.profile-avatar,.reward-preview>span').forEach(el=>{
   const card=el.closest('.reward-preview');
   const id=card?Array.from(card.classList).find(x=>x.startsWith('frame-')||x.startsWith('custom-')):document.body.dataset.fitframe;
   const d=(id==='custom-preview'?previewDesign:data?.catalog?.find(x=>x.id===id)?.design);
   const item=data?.catalog?.find(x=>x.id===id);
   const effects=d?(((item&&item.slot!=='frame')||(id==='custom-preview'&&d.slot!=='frame'))||d.effect==='none'?[]:[d.effect]):seasonal[id]||[];
   const old=el.querySelector(':scope > .fit-frame-particles');
   const signature=JSON.stringify([id,effects,d]);
   if(!effects.length){old?.remove();el.classList.remove('fit-particle-host');return;}
   el.classList.add('fit-particle-host');
   if(old?.dataset.signature===signature)return;
   old?.remove();
   const layer=document.createElement('span');layer.className='fit-frame-particles';layer.dataset.signature=signature;layer.setAttribute('aria-hidden','true');
   for(let i=0;i<4;i++){const e=document.createElement('i'),effect=effects[i%effects.length];e.textContent=effectSymbols[effect]||'✦';e.dataset.effect=effect;e.style.setProperty('--n',i);e.style.left=(50+40*Math.cos(i*Math.PI/2))+'%';e.style.top=(50+40*Math.sin(i*Math.PI/2))+'%';e.style.setProperty('--duration',(d?.speed||4)+'s');if(d)e.style.color=d.secondary;layer.append(e);}
   el.append(layer);
  });
 }
 function preview(item){
  previewDesign=item.design;
  apply();if(item.id==='custom-preview')customCSS([...data.catalog,item]);document.body.dataset['fit'+item.slot]=item.id;
  const avatar=document.querySelector('.profile-hero .profile-avatar,.top-actions .profile-avatar');
  const modal=ctx.dialog(`<section class="style-preview-dialog"><h2>${esc(item.name)}</h2><div class="style-preview-stage">${avatar?avatar.outerHTML:'<span class="avatar profile-avatar">FIT</span>'}</div>${item.slot!=='frame'?'<div class="panel"><h3>Así se verá tu espacio</h3><p>Guía FIT · Tu campus, tu estilo.</p><button class="btn" type="button">Botón de ejemplo</button></div><div class="fit-chat-panel"><div class="fit-chat-header">Castor FIT</div><div class="fit-chat-messages">Hola, ¿en qué puedo ayudarte?</div></div>':''}<p>Vista previa sin gastar monedas. Cierra para volver a tu estilo.</p><button class="btn" data-close type="button">Cerrar vista previa</button></section>`);
  modal.classList.add('reward-preview-modal');decorate();
  modal.addEventListener('close',()=>{apply();decorate();},{once:true});
 }
 function editor(content){
  content.innerHTML=`<section class="panel"><h3>Crear marcos y temas</h3><p>Publica un diseño para que la comunidad pueda canjearlo.</p><form id="style-editor" class="style-editor"><label>Nombre<input name="name" maxlength="70" required></label><label>Tipo<select name="slot"><option value="frame">Marco de perfil</option><option value="theme">Tema de la aplicación</option><option value="background">Tema del chatbot</option></select></label><label>Color principal<input name="primary" type="color" value="#ff0000"></label><label>Color secundario<input name="secondary" type="color" value="#33cc77"></label><label>Fondo<input name="surface" type="color" value="#ffffff"></label><label>Texto<input name="ink" type="color" value="#322024"></label><label data-frame-option>Efecto del marco<select name="effect">${Object.entries({none:'Sin partículas',sparkles:'Destellos',flames:'Llamitas verdes',candy:'Dulces',snow:'Nieve',hearts:'Corazones',petals:'Flores',confetti:'Confeti'}).map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label><label data-frame-option>Duración del ciclo (segundos)<input name="speed" type="number" min="2" max="12" value="4" required></label><label>Precio en monedas<input name="price" type="number" min="0" max="100000" value="50" required></label><label>Nivel mínimo<input name="minLevel" type="number" min="1" max="1000" value="1" required></label><div class="button-row"><button class="btn secondary" type="button" id="style-try">Previsualizar</button><button class="btn" type="submit">Publicar diseño</button></div><p role="status" id="style-result"></p></form></section>`;
  const form=content.querySelector('form'),read=()=>{const b=Object.fromEntries(new FormData(form));for(const k of ['price','minLevel','speed'])b[k]=Number(b[k]);return b;};
  form.elements.slot.onchange=()=>form.querySelectorAll('[data-frame-option]').forEach(x=>x.hidden=form.elements.slot.value!=='frame');
  content.querySelector('#style-try').onclick=()=>{if(!form.reportValidity())return;const b=read(),item={...b,id:'custom-preview',design:b};customCSS([...data.catalog,item]);preview(item);};
  form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{await api('/custom',read());data=await api('/me');apply();form.querySelector('#style-result').textContent='Diseño publicado. Ya está disponible en Personalizar.';form.elements.name.value='';}catch(e){form.querySelector('#style-result').textContent=e.message;}finally{button.disabled=false;}};
 }

 function apply(){
  customCSS(data?.catalog||[]);
  const b=document.body;for(const slot of ['frame','chat','background','motion','theme','font'])b.dataset['fit'+slot]=data?.equipped?.[slot]||'';
  b.classList.toggle('fit-no-motion',data?.animations===false);
  b.classList.toggle('fit-force-motion',data?.animations===true);
  decorate();
 }
 function clear(){identity=null;data=null;version++;apply();}
 async function refresh(){
  if(!eligible(ctx))return;
  const v=version;
  try{const result=await api('/sync',{});const next=await api('/me');if(v!==version)return;data=next;apply();if(result.earned)ctx.toast(`+${result.earned} EXP · Nivel ${data.level}`);}catch(e){if(v===version&&ctx?.state.view==='rewards')ctx.toast(e.message);}
 }
 function mount(c){ctx=c;if(!eligible(c)){clear();return;}if(identity!==c.state.user.id){clear();identity=c.state.user.id;refresh();}else apply();}
 async function scheduleSaved(uid,saved){if(!eligible(ctx)||uid!==identity)return;try{const r=await api('/schedule',{classes:saved.classes.map(x=>({subject:x.subject,day:x.day,start:x.start,end:x.end}))});if(r.earned)ctx.toast(`+${r.earned} EXP por tu primer horario`);await refresh();}catch(e){ctx?.toast('Tu horario quedó guardado. La recompensa se comprobará al volver a entrar.');}}
 async function profilePreview(c,host){
  ctx=c;if(!host||!eligible(c)){if(host)host.innerHTML='<p class="hint">Inicia sesión con una cuenta institucional para ver las recompensas.</p>';return;}
  host.innerHTML='<p role="status">Cargando vista previa de recompensas…</p>';
  try{
   if(identity!==c.state.user.id){identity=c.state.user.id;data=null;}
   if(!data)data=await api('/me');
   if(!host.isConnected)return;
   const items=data.catalog||[];
   host.innerHTML=`<div class="account-reward-preview-head"><div><b>${data.coins} monedas disponibles</b><span>Nivel ${data.level} · ${data.xp} EXP</span></div><div class="button-row"><button class="btn secondary small" type="button" data-preview-reset hidden>Restaurar mis estilos</button><button class="btn small" type="button" data-open-rewards>Ver todos los premios</button></div></div><div class="account-reward-grid">${items.map(item=>`<article class="account-reward-item"><div class="reward-preview ${esc(item.id)}" aria-hidden="true"><span>${previewText(item)}</span></div><div><strong>${esc(item.name)}</strong><small>${esc(item.description)}</small><b>${item.minLevel&&data.level<item.minLevel?'Nivel '+item.minLevel:data.inventory.includes(item.id)?'Ya es tuyo':item.price+' monedas'}</b></div><button class="text-button" type="button" data-preview-item="${esc(item.id)}">Previsualizar</button></article>`).join('')}</div><p class="hint" data-preview-status>Prueba un estilo aquí sin gastar monedas. Solo se guarda cuando lo canjeas y lo equipas desde Mi progreso y premios.</p>`;
   decorate();
   const reset=host.querySelector('[data-preview-reset]'),status=host.querySelector('[data-preview-status]');
   const restore=()=>{apply();reset.hidden=true;status.textContent='Prueba un estilo aquí sin gastar monedas. Solo se guarda cuando lo canjeas y lo equipas desde Mi progreso y premios.';};
   reset.onclick=restore;
   host.querySelector('[data-open-rewards]').onclick=()=>{restore();c.state.view='rewards';c.render();};
   host.querySelectorAll('[data-preview-item]').forEach(button=>button.onclick=()=>{
    const item=items.find(x=>x.id===button.dataset.previewItem);if(!item)return;
    preview(item);
   });
  }catch(e){if(host.isConnected)host.innerHTML=`<div class="notice error">${esc(e.message||'No se pudo cargar la vista previa de premios.')}</div>`;}
 }
 async function mutate(path,body){if(busy)return;busy=true;try{await api(path,body);await render(ctx);}catch(e){ctx.toast(e.message);}finally{busy=false;}}
 const label=a=>a.startsWith('day:')?'Visita diaria':a.startsWith('week:')?'Semana completa':a.startsWith('event:')?'Asistencia a evento':a.startsWith('rating:')?'Valoración recibida':a.startsWith('admin:')?'Reconocimiento administrativo':'Primer horario';
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
   host.innerHTML=`<section class="reward-hero"><div><span class="eyebrow">TU CAMINO EN LA FIT</span><h2>Nivel ${data.level}</h2><p>Cada actividad cuenta. Cada nivel es tuyo.</p></div><div class="reward-balance"><strong>${data.coins}</strong><span>monedas disponibles</span></div><div class="reward-progress"><progress max="100" value="${data.xp%100}" aria-label="Progreso del nivel"></progress><span>${data.xp} EXP total · Faltan ${data.next} EXP para subir</span></div></section><nav class="reward-tabs" aria-label="Progreso y premios">${[['progress','Mi actividad'],['shop','Personalizar'],['ranking','Mejores vendedores'],['community','Ranking de la comunidad'],['ratings','Mis valoraciones'],...(c.state.admin?[['editor','Crear diseños']]:[])].map(([id,name])=>`<button class="btn ${tab===id?'':'secondary'}" data-tab="${id}" aria-pressed="${tab===id}">${name}</button>`).join('')}</nav><section id="reward-content"></section>`;
   host.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render(c);});
   const content=host.querySelector('#reward-content');
   if(tab==='editor'&&c.state.admin){editor(content);
   }else if(tab==='progress'){
    content.innerHTML=`<div class="reward-grid"><article class="reward-card"><h3>Tu semana FIT</h3><div class="reward-week">${['L','M','M','J','V'].map((d,i)=>{const hit=data.days.some(date=>new Date(date+'T12:00:00').getDay()===i+1);return `<span class="${hit?'earned':''}" aria-label="${['Lunes','Martes','Miércoles','Jueves','Viernes'][i]}: ${hit?'completado':'pendiente'}">${d}<small>${hit?'✓':'—'}</small></span>`;}).join('')}</div><p>10 EXP por día. Completa lunes a viernes y recibe 50 EXP extra.</p></article><article class="reward-card"><h3>Así creces</h3><p>Primer horario: <b>30 EXP</b><br>Asistencia con QR: <b>40 EXP</b><br>Valoración recibida: <b>10 EXP</b></p><p>Cada 100 EXP subes un nivel y recibes 50 monedas. Tus canjes son permanentes y no restan EXP.</p><small>Valoraciones: hasta 5 recompensas diarias y una por comprador cada semana. Asistencias contadas una vez por evento.</small></article></div><h3>Tu actividad reciente</h3><div class="reward-history">${data.history.map(x=>`<div><span>${label(x.activity)}<small>${new Date(x.created_at).toLocaleDateString('es-MX')}</small></span><b>+${x.xp} EXP</b></div>`).join('')||'<p>Aquí aparecerán tus primeras actividades.</p>'}</div>`;
   }else if(tab==='shop'){
    content.innerHTML=`<div class="reward-settings"><label><input type="checkbox" id="reward-motion" ${data.animations?'checked':''}> Activar animaciones suaves</label><p>Los temas cambian toda tu experiencia al iniciar sesión: menú lateral, encabezados, fondos, botones, tarjetas, ventanas y detalles visuales. También puedes combinar tipografías, marcos y estilos del chat.</p></div><div class="reward-grid">${data.catalog.map(item=>{const owned=data.inventory.includes(item.id),active=data.equipped[item.slot]===item.id,locked=item.minLevel&&data.level<item.minLevel;return `<article class="reward-card ${locked?'reward-locked':''}"><div class="reward-preview ${esc(item.id)}" aria-hidden="true"><span>${previewText(item)}</span></div><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><p><b>${locked?'Se desbloquea en nivel '+item.minLevel:owned?'Ya es tuyo':item.price+' monedas'}</b></p><button type="button" class="text-button" data-try="${esc(item.id)}">Previsualizar</button><button class="btn ${active?'secondary':''}" data-item="${item.id}" ${locked||(!owned&&data.coins<item.price)?'disabled':''}>${locked?'Nivel '+item.minLevel:active?'Quitar':owned?'Equipar':'Canjear'}</button></article>`;}).join('')}</div>`;
    decorate();
    content.querySelectorAll('[data-try]').forEach(b=>b.onclick=()=>preview(data.catalog.find(x=>x.id===b.dataset.try)));
    content.querySelector('#reward-motion').onchange=e=>mutate('/animations',{enabled:e.target.checked});
    content.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{const item=data.catalog.find(x=>x.id===b.dataset.item);mutate(data.inventory.includes(item.id)?'/equip':'/buy',data.inventory.includes(item.id)?{slot:item.slot,item:data.equipped[item.slot]===item.id?null:item.id}:{item:item.id});});
   }else if(tab==='ranking'){
    const rows=await api('/ranking?category='+encodeURIComponent(category)+'&sort='+vendorSort);if(!content.isConnected)return;
    content.innerHTML=`<label>Categoría <select id="reward-category"><option value="">Todas</option>${data.categories.map(x=>`<option ${category===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Ordenar<select id="vendor-sort">${[['score','Mejor puntuación ajustada'],['stars','Más estrellas'],['reviews','Más reseñas']].map(([v,t])=>`<option value="${v}" ${vendorSort===v?'selected':''}>${t}</option>`).join('')}</select></label><p>Ordenamos por valoración ajustada y número de opiniones. Solo cuentan pedidos entregados; los puestos sin opiniones aparecen al final.</p><div class="reward-history">${rows.map((x,i)=>`<article><span class="reward-rank">${i+1}</span><div><h3>${esc(x.business_name)}</h3><p>${esc(x.pickup_location)} · ${x.categories.map(esc).join(', ')}</p><small>${x.votes?Number(x.average).toFixed(1)+' / 5 · '+x.votes+' opiniones · puntuación '+Number(x.score).toFixed(2):'Aún sin valoraciones'}</small></div></article>`).join('')||'<p>Todavía no hay puestos aprobados en esta categoría.</p>'}</div>`;
    content.querySelector('#reward-category').onchange=e=>{category=e.target.value;render(c);};
    content.querySelector('#vendor-sort').onchange=e=>{vendorSort=e.target.value;render(c);};
   }else if(tab==='community'){
    const rows=await api('/community-ranking?sort='+communitySort+'&role='+communityRole);if(!content.isConnected)return;
    content.innerHTML=`<h3>La comunidad FIT</h3><div class="reward-tabs"><label>Ordenar por<select id="community-sort"><option value="xp" ${communitySort==='xp'?'selected':''}>Más XP</option><option value="coins" ${communitySort==='coins'?'selected':''}>Más monedas disponibles</option></select></label><label>Participantes<select id="community-role">${[['all','Alumnos y docentes'],['student','Alumnos'],['teacher','Docentes']].map(([v,t])=>`<option value="${v}" ${communityRole===v?'selected':''}>${t}</option>`).join('')}</select></label></div><p>Primeras 100 posiciones. Las monedas son el saldo actual: disminuyen al canjear premios. En empates usamos el otro saldo y después el nombre.</p><div class="reward-history">${rows.map(x=>`<article><strong class="reward-rank">${x.position}</strong><div><h3>${esc(x.name)}${x.is_me?' · Tú':''}</h3><small>${x.account_type==='teacher'?'Docente':'Alumno'} · Nivel ${x.level}</small><p>${x.xp} XP · ${x.coins} monedas</p></div></article>`).join('')||'<p>Aún no hay participantes.</p>'}</div>`;
    content.querySelector('#community-sort').onchange=e=>{communitySort=e.target.value;render(c);};content.querySelector('#community-role').onchange=e=>{communityRole=e.target.value;render(c);};
   }else{
    const [orders,vendor]=await Promise.all([api('/orders'),api('/categories')]);if(!content.isConnected)return;
    content.innerHTML=`${vendor?`<form id="vendor-categories" class="reward-card"><h3>Categorías de mi puesto</h3><p>Selecciona lo que vendes para aparecer en sus rankings.</p>${data.categories.map(x=>`<label><input type="checkbox" name="category" value="${x}" ${vendor.categories.includes(x)?'checked':''}> ${x}</label> `).join('')}<p><button class="btn">Guardar categorías</button></p></form>`:''}<h3>Califica tus pedidos entregados</h3><p>Una valoración por pedido. Las estrellas no se pueden modificar después de enviarlas.</p><div class="reward-grid">${orders.map(o=>`<form class="reward-card" data-order="${o.id}"><h3>${esc(o.business_name)}</h3><p>${esc(o.product_name)}</p>${o.stars?`<b>${o.stars} / 5 · Valoración enviada</b>`:`<label>Tu valoración<select name="stars" required><option value="">Elige las estrellas</option>${[5,4,3,2,1].map(n=>`<option value="${n}">${n} ${n===1?'estrella':'estrellas'}</option>`).join('')}</select></label><label>Categoría<select name="category">${o.categories.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><button class="btn">Enviar valoración</button>`}</form>`).join('')||'<p>Cuando recibas un pedido, podrás calificarlo aquí.</p>'}</div>`;
    content.querySelector('#vendor-categories')?.addEventListener('submit',e=>{e.preventDefault();mutate('/categories',{categories:new FormData(e.target).getAll('category')});});
    content.querySelectorAll('[data-order]').forEach(f=>{const o=orders.find(o=>o.id===f.dataset.order);f.innerHTML=`<h3>${esc(o.business_name)}</h3><p>${esc(o.product_name)}</p><button class="btn" type="button">${o.stars?'Ver mi valoración':'Calificar trato y producto ★'}</button>`;f.querySelector('button').onclick=()=>root.FIT_PURCHASE_RATING.open(c,o.id);});
   }
  }catch(e){if(host.isConnected){host.innerHTML='<p role="alert">'+esc(e.message)+'</p><button class="btn" id="reward-retry">Reintentar</button>';host.querySelector('button').onclick=()=>render(c);}}
 }
 root.FIT_REWARDS={mount,render,refresh,scheduleSaved,profilePreview,clearIfGuest:s=>{if(!s.user||s.demo||s.offline)clear();}};
})(window);
