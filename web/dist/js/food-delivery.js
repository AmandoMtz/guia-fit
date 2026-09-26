(function(root){
'use strict';
async function open(c,order,seller,onDone){
 const d=c.dialog(`<section class="delivery-dialog"><h2>${seller?'Mostrar QR de entrega':'Confirmar recepción'}</h2><p>${c.esc(order.product_name)} · Pedido ${c.esc(order.id.slice(0,8))}</p><p>${seller?'Muestra este código al cliente al entregarle su compra.':'Escanea el QR del vendedor solo después de recibir tu compra.'}</p><div data-delivery-content></div><p role="status" data-delivery-status></p></section>`);
 const host=d.querySelector('[data-delivery-content]'),status=d.querySelector('[data-delivery-status]');let stream=null,timer=null,closed=false,busy=false;
 const stop=()=>{closed=true;clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());};d.addEventListener('close',stop,{once:true});
 const api=async(path,body)=>{const r=await c.client.request('/api/food/orders/'+order.id+path,'POST',body);if(r.error)throw Error(r.error.message);return r.data;};
 if(seller){
  const load=async()=>{host.innerHTML='Preparando código…';try{const r=await api('/delivery-qr',{});if(closed)return;host.innerHTML=`<div class="delivery-qr">${r.svg}</div><p>Válido hasta ${c.esc(new Date(r.expires_at).toLocaleTimeString('es-MX'))}</p><label>Código para ingreso manual<input readonly value="${c.esc(r.qr)}" aria-label="Código de entrega"></label><button class="btn secondary" type="button" data-renew>Actualizar código</button>`;host.querySelector('[data-renew]').onclick=load;}catch(e){status.textContent=e.message;host.innerHTML='<button class="btn" type="button">Reintentar</button>';host.querySelector('button').onclick=load;}};await load();return;
 }
 host.innerHTML='<video autoplay playsinline muted hidden aria-label="Cámara para QR"></video><button class="btn secondary" type="button" data-camera>Escanear con cámara</button><form><label>Código del vendedor<input name="qr" maxlength="60" autocomplete="off" required placeholder="Pega el código de entrega"></label><label class="check"><input name="received" type="checkbox" required> Ya recibí mi compra</label><button class="btn" type="submit">Confirmar entrega</button></form>';
 const form=host.querySelector('form'),video=host.querySelector('video');
 form.onsubmit=async e=>{e.preventDefault();if(busy||!form.reportValidity())return;busy=true;const b=form.querySelector('button');b.disabled=true;try{await api('/scan-qr',{qr:form.elements.qr.value});stop();d.close();c.toast('Entrega confirmada. Ya puedes calificar tu compra.');await onDone?.();c.poll?.();}catch(e){status.textContent=e.message;}finally{busy=false;b.disabled=false;}};
 host.querySelector('[data-camera]').onclick=async()=>{
  if(stream)return;
  try{
   if(!root.BarcodeDetector||!navigator.mediaDevices?.getUserMedia)throw Error('Este navegador no tiene lector de QR. Usa el código que muestra el vendedor.');
   if(!(await root.BarcodeDetector.getSupportedFormats()).includes('qr_code'))throw Error('Usa el código manual en este navegador.');
   const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});if(closed){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;video.srcObject=stream;video.hidden=false;await video.play();
   const detector=new root.BarcodeDetector({formats:['qr_code']});
   const scan=async()=>{if(closed||!d.isConnected){stop();return;}try{const hits=await detector.detect(video);const hit=hits.find(x=>/^FIT-FOOD:[0-9a-f-]{36}$/i.test(x.rawValue));if(hit){form.elements.qr.value=hit.rawValue;stream.getTracks().forEach(t=>t.stop());stream=null;video.hidden=true;status.textContent='Código leído. Marca que recibiste tu compra y confirma.';return;}}catch{}timer=setTimeout(scan,350);};scan();
  }catch(e){stream?.getTracks().forEach(t=>t.stop());stream=null;status.textContent=e.message;}
 };
}
root.FIT_FOOD_DELIVERY={open};
})(window);
