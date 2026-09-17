/* Mensajes push procesados aunque no haya ninguna pestana abierta. */
self.addEventListener('push',event=>{
  let data;try{data=event.data?.json();}catch{return;}
  if(!data||typeof data.recipientId!=='string')return;
  const valid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
  event.waitUntil(self.registration.showNotification('Guía FIT',{
    body:valid(data.chatId)?'Tienes un mensaje nuevo en Comidas. Toca para abrir el chat.':String(data.body||'Tienes una actualización en Guía FIT.').slice(0,250),
    icon:'/assets/push-icon-192.png',
    tag:valid(data.chatId)?'fit-chat-'+data.chatId:String(data.tag||'fit-push-test').slice(0,100),
    data:{view:['food','events','profile'].includes(data.view)?data.view:'profile',chatId:valid(data.chatId)?data.chatId:null,recipientId:data.recipientId},
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const data=event.notification.data||{},u=new URL('/',self.location.origin);
  u.searchParams.set('fitPush','1');
  if(data.view)u.searchParams.set('fitView',data.view);
  if(data.chatId)u.searchParams.set('fitChat',data.chatId);
  if(data.recipientId)u.searchParams.set('fitUser',data.recipientId);
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const page=windows.find(c=>new URL(c.url).origin===self.location.origin&&new URL(c.url).pathname==='/');
    if(page){await page.focus();page.postMessage({type:'fit-push-open',...data});}
    else await self.clients.openWindow(u.href);
  })());
});
