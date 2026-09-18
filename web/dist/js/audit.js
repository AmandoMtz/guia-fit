/* Solo consulta: los permisos se verifican nuevamente en el servidor. */
(() => {
  const groups={events:'Eventos y asistencias',chats:'Chats',food:'Comidas y pedidos',rewards:'Monedas y recompensas',accounts:'Cuentas y accesos',notifications:'Notificaciones',campus:'Campus',http:'Solicitudes y resultados'};
  const actions={INSERT:'Creación / registro',UPDATE:'Actualización',DELETE:'Eliminación',MESSAGE:'Mensaje enviado',REQUEST:'Solicitud',RESPONSE:'Resultado de solicitud'};
  const entities={events:'Evento',event_attendance:'Asistencia confirmada',event_teacher_invites:'Invitación / respuesta docente',event_careers:'Carreras del evento',event_documents:'Documento del evento',event_checkin_tokens:'QR del evento',academic_chats:'Conversación alumno-docente',academic_chat_messages:'Movimiento de mensaje académico',academic_chat_content:'Mensaje alumno-docente',food_chats:'Conversación de comidas',food_chat_messages:'Mensaje de comidas',food_orders:'Pedido',food_products:'Producto',food_vendors:'Vendedor',fit_progress:'Saldo y experiencia',fit_rewards:'Recompensa obtenida',fit_inventory:'Inventario / canje',admin_benefit_grants:'Beneficio administrativo',users:'Cuenta',profiles:'Perfil',sessions:'Sesión',http:'Solicitud al servidor'};
  window.FIT_AUDIT={render(ctx){
    const {state,client,esc}=ctx,host=document.querySelector('#view');
    if(!state.admin||state.offline||state.demo){host.innerHTML='<div class="notice">Acceso exclusivo para administración con conexión.</div>';return;}
    host.innerHTML=`<section class="panel"><p>Historial permanente de acciones. Incluye los textos de mensajes nuevos; las imágenes de comidas se registran como envío de imagen.</p><form id="audit-filters" class="profile-grid"><label class="field">Buscar usuario, evento, conversación o contenido<input name="search" type="search" maxlength="150" placeholder="Nombre, correo, identificador o texto"></label><label class="field">Módulo<select name="group"><option value="">Todos los módulos</option>${Object.entries(groups).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label class="field">Acción<select name="action"><option value="">Todas las acciones</option>${Object.entries(actions).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label class="field">Desde (UTC)<input name="from" type="date"></label><label class="field">Hasta (UTC)<input name="to" type="date"></label><div><button class="btn" type="submit">Buscar / actualizar</button> <button class="btn secondary" type="reset">Limpiar filtros</button></div></form><p class="hint">Fechas del registro en tu hora local. Los datos anteriores aparecen cuando ya existía un registro; no se reconstruyen mensajes eliminados.</p><p id="audit-status" role="status" aria-live="polite"></p><div id="audit-results"></div><div class="row"><button class="btn secondary" id="audit-prev">Anterior</button><button class="btn secondary" id="audit-next">Siguiente</button></div></section>`;
    const form=host.querySelector('form'),results=host.querySelector('#audit-results'),status=host.querySelector('#audit-status'),prev=host.querySelector('#audit-prev'),next=host.querySelector('#audit-next');
    let filters=new URLSearchParams(),pages=[null],page=0,cursor=null,busy=false;
    const json=data=>esc(JSON.stringify(data,null,2)||'Sin datos');
    async function load(){
      if(busy)return;busy=true;prev.disabled=next.disabled=true;status.textContent='Cargando registros…';results.replaceChildren();
      const params=new URLSearchParams(filters);if(pages[page])params.set('before',pages[page]);
      try{
        const response=await client.request('/api/admin/audit?'+params);
        if(!host.isConnected||state.view!=='audit')return;
        if(response.error)throw new Error(response.error.message||'No se pudieron consultar los registros.');
        const data=response.data;if(!data?.items)throw new Error('Respuesta no disponible. Vuelve a intentarlo.');
        cursor=data.next;
        status.textContent=`Página ${page+1} · ${data.items.length} registros · Más recientes primero`;
        results.innerHTML=data.items.length?data.items.map(r=>{
          const after=r.after_data||{},text=after.body||after.text;
          return `<article class="panel" style="overflow-wrap:anywhere"><div class="row"><strong>${esc(entities[r.entity]||r.entity)}</strong><span>${esc(actions[r.action]||r.action)}</span></div><p><b>${esc(r.actor_name||r.actor_email||(r.actor_id?'Cuenta '+r.actor_id:'Sistema / sin sesión identificada'))}</b>${r.actor_email?' · '+esc(r.actor_email):''}</p><p class="hint">${esc(new Date(r.created_at).toLocaleString('es-MX'))} · Registro #${esc(r.id)}</p>${text?`<blockquote style="white-space:pre-wrap">${esc(text)}</blockquote>`:''}<details><summary>Ver detalles del movimiento</summary><p>Identificador: ${esc(r.record_id||'—')}<br>Solicitud: ${esc(r.request_id||'—')}</p><h3>Antes</h3><pre style="white-space:pre-wrap">${json(r.before_data)}</pre><h3>Después</h3><pre style="white-space:pre-wrap">${json(r.after_data)}</pre></details></article>`;
        }).join(''):'<div class="empty">No hay registros con estos filtros.</div>';
      }catch(e){cursor=null;status.textContent=e.message||'Error de conexión. Intenta actualizar.';}
      finally{busy=false;prev.disabled=page===0;next.disabled=!cursor;}
    }
    form.onsubmit=e=>{e.preventDefault();if(busy)return;filters=new URLSearchParams(new FormData(form));pages=[null];page=0;load();};
    form.onreset=()=>{if(busy)return;filters=new URLSearchParams();pages=[null];page=0;load();};
    prev.onclick=()=>{if(!busy&&page>0){page--;load();}};
    next.onclick=()=>{if(!busy&&cursor){pages[++page]=cursor;load();}};
    load();
  }};
})();
