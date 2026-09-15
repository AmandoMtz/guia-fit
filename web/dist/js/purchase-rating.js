(function(root){
 async function open(c,id){
  const r=await c.client.request('/api/gamification/orders','GET');if(r.error){c.toast(r.error.message);return;}
  const order=r.data.find(o=>o.id===id);if(!order){c.toast('Solo puedes valorar tus pedidos entregados.');return;}
  const stars=(name,title)=>`<fieldset class="purchase-stars"><legend>${title}</legend>${[1,2,3,4,5].map(n=>`<label><input type="radio" name="${name}" value="${n}" required><span aria-hidden="true">★</span><small>${n}</small><span class="sr-only">${n} de 5 estrellas</span></label>`).join('')}</fieldset>`;
  const d=c.dialog(`<div class="dialog-content"><h2>${c.esc(order.business_name)}</h2><p>${c.esc(order.product_name)}</p>${order.stars?`<p>Valoración enviada: ${order.service_stars?'Trato '+order.service_stars+'/5 · Producto '+order.product_stars+'/5':order.stars+'/5'}</p>`:`<form id="purchase-rating-form">${stars('service_stars','¿Cómo fue el trato del vendedor?')}${stars('product_stars','¿Qué te pareció el producto?')}<label class="field">Categoría<select name="category">${order.categories.map(x=>`<option>${c.esc(x)}</option>`).join('')}</select></label><p class="hint">Una opinión por pedido entregado. Tus estrellas no se podrán cambiar después de enviarlas.</p><p role="status"></p><button class="btn" type="submit">Enviar valoración</button></form>`}</div>`);
  const form=d.querySelector('form');if(!form)return;
  form.onchange=()=>{for(const group of form.querySelectorAll('fieldset')){const selected=Number(group.querySelector('input:checked')?.value||0);group.querySelectorAll('label').forEach((el,i)=>el.classList.toggle('star-on',i<selected));}};
  form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');if(b.disabled)return;b.disabled=true;const f=new FormData(form);const result=await c.client.request('/api/gamification/ratings','POST',{order_id:id,service_stars:Number(f.get('service_stars')),product_stars:Number(f.get('product_stars')),category:f.get('category')});if(result.error){form.querySelector('[role=status]').textContent=result.error.message;b.disabled=false;return;}d.close();c.toast('Gracias por compartir tu opinión.');if(c.state.view==='rewards')root.FIT_REWARDS.render(c);};
 }
 root.FIT_PURCHASE_RATING={open};
})(window);
