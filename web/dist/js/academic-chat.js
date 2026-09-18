(function(root){
  'use strict';
  let ctx=null, activeChat=null, pollTimer=null, listTimer=null, generation=0, searchTimer=null, detailSignature='';
  const maxText=1500;

  const academicRole=user=>{
    const explicit=String(user?.account_type||'').toLowerCase();
    if(['student','teacher'].includes(explicit))return explicit;
    const email=String(user?.email||'').trim().toLowerCase();
    if(/^a\d+@alumnos\.uat\.edu\.mx$/.test(email))return 'student';
    if(/@docentes\.uat\.edu\.mx$/.test(email))return 'teacher';
    if(/@uat\.edu\.mx$/.test(email)&&!/@alumnos\.uat\.edu\.mx$/.test(email))return 'teacher';
    return null;
  };
  const eligible=c=>!!academicRole(c?.state?.user)&&!c.state.demo&&!c.state.offline&&c.client;
  const api=async(c,path,method='GET',body)=>{
    const owner=c.state.user?.id;
    const r=await c.client.request('/api/academic-chat'+path,method,body);
    if(c.state.user?.id!==owner) throw Error('La sesión cambió.');
    if(r.error) throw Error(r.error.message||'No se pudo cargar el chat.');
    return r.data;
  };
  const roleLabel=type=>type==='teacher'?'Docente':'Alumno';
  const time=value=>{
    if(!value)return '';
    const d=new Date(value),now=new Date();
    return d.toDateString()===now.toDateString()
      ? d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})
      : d.toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
  };
  const initials=name=>String(name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();

  function disconnect(){
    generation++;
    clearInterval(pollTimer);clearInterval(listTimer);clearTimeout(searchTimer);
    pollTimer=listTimer=searchTimer=null;ctx=null;activeChat=null;detailSignature='';
  }
  function updateUnreadBadge(count){
    const el=document.querySelector('#academic-chat-count');
    if(!el)return;
    const n=Number(count||0);el.textContent=n>99?'99+':String(n);el.hidden=n===0;
  }
  function skeleton(c){
    const target=academicRole(c.state.user)==='student'?'docente':'alumno';
    return `<div class="academic-chat-grid">
      <aside class="panel academic-chat-side">
        <div class="academic-chat-side-head"><div><span class="eyebrow">CONTACTOS FIT</span><h2>Mensajes</h2></div><span class="academic-retention-chip">7 días</span></div>
        <p class="muted">Busca un ${target} registrado y comienza una conversación.</p>
        <label class="field academic-contact-search">Buscar ${target}<input type="search" id="academic-contact-query" placeholder="Escribe un nombre" maxlength="80" autocomplete="off"></label>
        <div id="academic-contact-results" class="academic-contact-results"></div>
        <div class="academic-chat-list-head"><strong>Conversaciones</strong><button type="button" class="text-button" id="academic-refresh">Actualizar</button></div>
        <div id="academic-chat-list" class="academic-chat-list"><p class="muted">Cargando conversaciones…</p></div>
      </aside>
      <section class="panel academic-chat-main" id="academic-chat-main">
        <div class="academic-chat-empty"><div class="academic-chat-empty-icon">${c.icon('chat')}</div><h2>Selecciona una conversación</h2><p>Los mensajes se conservan durante 7 días y después se eliminan automáticamente.</p></div>
      </section>
    </div>`;
  }
  function paintContacts(c,rows){
    const host=document.querySelector('#academic-contact-results');if(!host)return;
    if(!rows.length){host.innerHTML='<p class="hint academic-search-hint">No encontramos coincidencias.</p>';return;}
    host.innerHTML=rows.map(x=>`<button type="button" class="academic-contact-card" data-contact="${c.esc(x.id)}"><span class="academic-avatar">${c.esc(initials(x.full_name))}</span><span><strong>${c.esc(x.full_name)}</strong><small>${roleLabel(x.account_type)}${x.career?` · ${c.esc(x.career)}`:''}</small></span><span class="academic-contact-plus">+</span></button>`).join('');
    host.querySelectorAll('[data-contact]').forEach(btn=>btn.onclick=async()=>{
      btn.disabled=true;
      try{
        const chat=await api(c,'/chats','POST',{counterpart_id:btn.dataset.contact});
        activeChat=chat.id;c.state.messagesFocusChat=chat.id;
        const q=document.querySelector('#academic-contact-query');if(q)q.value='';host.innerHTML='';
        await Promise.all([loadList(c),loadDetail(c,chat.id)]);
      }catch(e){c.toast(e.message);}finally{btn.disabled=false;}
    });
  }
  async function searchContacts(c,q){
    const host=document.querySelector('#academic-contact-results');if(!host)return;
    if(q.trim().length<2){host.innerHTML='<p class="hint academic-search-hint">Escribe al menos 2 letras.</p>';return;}
    host.innerHTML='<p class="hint academic-search-hint">Buscando…</p>';
    try{paintContacts(c,await api(c,'/contacts?q='+encodeURIComponent(q.trim())));}catch(e){host.innerHTML=`<p class="hint academic-search-hint">${c.esc(e.message)}</p>`;}
  }
  function paintList(c,data){
    updateUnreadBadge(data.unread_count);
    const host=document.querySelector('#academic-chat-list');if(!host)return;
    const items=data.items||[];
    if(!items.length){host.innerHTML='<div class="academic-list-empty"><p>Aún no tienes conversaciones.</p><small>Busca un contacto arriba para comenzar.</small></div>';return;}
    host.innerHTML=items.map(x=>`<button type="button" class="academic-chat-row ${activeChat===x.id?'active':''}" data-chat="${c.esc(x.id)}">
      <span class="academic-avatar">${c.esc(initials(x.counterpart_name))}</span>
      <span class="academic-chat-row-body"><span class="academic-chat-row-top"><strong>${c.esc(x.counterpart_name)}</strong><small>${c.esc(time(x.last_message_at||x.updated_at))}</small></span><span class="academic-chat-row-bottom"><small>${x.last_message?`${x.last_message_mine?'Tú: ':''}${c.esc(x.last_message)}`:'Conversación nueva'}</small>${Number(x.unread_count||0)?`<b>${Number(x.unread_count)>99?'99+':Number(x.unread_count)}</b>`:''}</span></span>
    </button>`).join('');
    host.querySelectorAll('[data-chat]').forEach(btn=>btn.onclick=async()=>{
      activeChat=btn.dataset.chat;c.state.messagesFocusChat=activeChat;
      host.querySelectorAll('.academic-chat-row').forEach(x=>x.classList.toggle('active',x.dataset.chat===activeChat));
      await loadDetail(c,activeChat);
    });
  }
  async function loadList(c){
    if(!eligible(c)||c.state.view!=='messages')return;
    try{
      const data=await api(c,'/chats');
      paintList(c,data);
      if(!activeChat&&c.state.messagesFocusChat){activeChat=c.state.messagesFocusChat;await loadDetail(c,activeChat);}
    }catch(e){const host=document.querySelector('#academic-chat-list');if(host)host.innerHTML=`<p class="hint">${c.esc(e.message)}</p>`;}
  }
  function paintDetail(c,chat,draft='',refocus=false){
    const host=document.querySelector('#academic-chat-main');if(!host)return;
    const messages=chat.messages||[];
    detailSignature=messages.map(m=>m.id).join('|');
    host.innerHTML=`<div class="academic-chat-header"><div class="academic-person"><span class="academic-avatar large">${c.esc(initials(chat.counterpart_name))}</span><div><h2>${c.esc(chat.counterpart_name)}</h2><p>${roleLabel(chat.counterpart_type)}</p></div></div><span class="academic-retention-chip">Mensajes por 7 días</span></div>
      <div class="academic-retention-note">${c.icon('chat')}<span>Los mensajes se guardan durante una semana. Al cumplir 7 días se eliminan automáticamente.</span></div>
      <div class="academic-message-list" id="academic-message-list">${messages.length?messages.map(m=>`<article class="academic-message ${m.mine?'mine':'theirs'}"><p>${c.esc(m.body)}</p><small>${c.esc(new Date(m.created_at).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}))}</small></article>`).join(''):'<div class="academic-conversation-empty"><p>Aún no hay mensajes.</p><small>Escribe el primero para iniciar la conversación.</small></div>'}</div>
      <form id="academic-message-form" class="academic-message-form"><textarea name="text" rows="2" maxlength="${maxText}" placeholder="Escribe un mensaje…" aria-label="Mensaje"></textarea><button class="btn" type="submit">${c.icon('send')} Enviar</button></form>`;
    const list=host.querySelector('#academic-message-list');if(list)list.scrollTop=list.scrollHeight;
    const form=host.querySelector('#academic-message-form');
    if(draft){form.elements.text.value=draft;if(refocus)form.elements.text.focus();}
    form.onsubmit=async e=>{
      e.preventDefault();const input=form.elements.text,text=input.value.trim();if(!text)return;
      const button=form.querySelector('button');button.disabled=true;input.disabled=true;
      try{await api(c,`/chats/${encodeURIComponent(chat.id)}/messages`,'POST',{text});input.value='';await Promise.all([loadDetail(c,chat.id),loadList(c)]);}
      catch(err){c.toast(err.message);}finally{if(input.isConnected){input.disabled=false;button.disabled=false;input.focus();}}
    };
    form.elements.text.onkeydown=e=>{
      if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}
    };
  }
  async function loadDetail(c,id){
    if(!eligible(c)||c.state.view!=='messages'||!id)return;
    const token=++generation;
    try{
      const before=document.querySelector('#academic-message-form textarea');
      const draft=before?.value||'',refocus=document.activeElement===before;
      const chat=await api(c,`/chats/${encodeURIComponent(id)}`);
      if(token!==generation||c.state.view!=='messages'||activeChat!==id)return;
      const signature=(chat.messages||[]).map(m=>m.id).join('|');
      if(signature!==detailSignature||!document.querySelector('#academic-message-form'))paintDetail(c,chat,draft,refocus);
      await loadListQuiet(c);
    }catch(e){
      if(token!==generation)return;
      const host=document.querySelector('#academic-chat-main');if(host)host.innerHTML=`<div class="academic-chat-empty"><h2>No pudimos abrir la conversación</h2><p>${c.esc(e.message)}</p></div>`;
      if(/no encontrada/i.test(e.message)){activeChat=null;delete c.state.messagesFocusChat;}
    }
  }
  async function loadListQuiet(c){
    try{paintList(c,await api(c,'/chats'));}catch{}
  }
  function startPolling(c){
    clearInterval(pollTimer);clearInterval(listTimer);
    pollTimer=setInterval(()=>{if(document.hidden||c.state.view!=='messages'||!activeChat)return;loadDetail(c,activeChat);},5000);
    listTimer=setInterval(()=>{if(document.hidden||c.state.view!=='messages')return;loadListQuiet(c);},15000);
  }
  function render(c){
    disconnect();ctx=c;if(!eligible(c))return;
    const host=document.querySelector('#view');if(!host)return;
    activeChat=c.state.messagesFocusChat||null;
    host.innerHTML=skeleton(c);
    const q=host.querySelector('#academic-contact-query');
    q.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>searchContacts(c,q.value),280);};
    q.onfocus=()=>{if(q.value.trim().length<2)document.querySelector('#academic-contact-results').innerHTML='<p class="hint academic-search-hint">Escribe al menos 2 letras.</p>';};
    host.querySelector('#academic-refresh').onclick=()=>loadList(c);
    loadList(c);if(activeChat)loadDetail(c,activeChat);startPolling(c);
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ctx?.state.view==='messages'){loadListQuiet(ctx);if(activeChat)loadDetail(ctx,activeChat);}});
  root.FIT_ACADEMIC_CHAT={render,disconnect,updateUnreadBadge};
})(window);
