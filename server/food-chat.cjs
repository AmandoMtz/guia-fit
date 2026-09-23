const { randomUUID } = require('node:crypto');
const { normalizeImage } = require('./images.cjs');
const { transaction } = require('./db.cjs');
const CHAT_TTL_MS=12*60*60*1000, MAX_TEXT=1200, MAX_STREAMS=128, MAX_STREAMS_PER_USER=3;
function chatError(status,message,code='validation_error'){return Object.assign(new Error(message),{status,code});}
function createTemporaryFoodChat({db,onMessage=null}){
 const streams=new Map();
 async function hydrate(row,client=db){
  if(!row)return null;
  row.messages=(await client.query('select id,sender_id,kind,text,created_at from food_chat_messages where chat_id=$1 order by created_at,id',[row.id])).rows;
  row.read_at=new Map([[row.buyer_id,new Date(row.buyer_read_at).getTime()],[row.seller_user_id,new Date(row.seller_read_at).getTime()]]);
  return row;
 }
 async function getChat(chatId,userId,client=db,lock=false){
  const row=(await client.query("select * from food_chats where id=$1 and $2 in(buyer_id,seller_user_id) and expires_at>now()"+(lock?' for update':''),[chatId,userId])).rows[0];
  if(!row)throw chatError(404,'Conversación no encontrada o vencida.','not_found');
  return hydrate(row,client);
 }
 async function purgeExpired(){await db.query('delete from food_chats where expires_at<=now()');}
  function messageFor(message, userId, chatId) {
    return {
      id: message.id,
      kind: message.kind,
      text: message.kind === "text" ? message.text : undefined,
      image_url:
        message.kind === "image"
          ? `/api/food/chats/${chatId}/images/${message.id}`
          : undefined,
      mine: message.sender_id === userId,
      created_at: message.created_at,
    };
  }

  function unreadFor(chat, userId) {
    const since = chat.read_at.get(userId) || 0;
    return chat.messages.filter(
      (message) =>
        message.sender_id !== userId && new Date(message.created_at).getTime() > since,
    ).length;
  }

  function summaryFor(chat, userId) {
    const seller = userId === chat.seller_user_id;
    const last = chat.messages.at(-1);
    return {
      id: chat.id,
      role: seller ? "seller" : "buyer",
      counterpart_id: seller ? chat.buyer_id : chat.seller_user_id,
      counterpart_name: seller ? chat.buyer_name : chat.business_name,
      business_name: chat.business_name,
      buyer_name: chat.buyer_name,
      product_id: chat.product_id,
      product_name: chat.product_name,
      pickup_location: chat.pickup_location,
      created_at: chat.created_at,
      expires_at: chat.expires_at,
      order_id: chat.order_id,
      unread_count: unreadFor(chat, userId),
      last_message: last
        ? {
            kind: last.kind,
            preview:
              last.kind === "image"
                ? "Imagen"
                : last.text.length > 80
                  ? last.text.slice(0, 77) + "…"
                  : last.text,
            mine: last.sender_id === userId,
            created_at: last.created_at,
          }
        : null,
    };
  }

  function detailFor(chat, userId) {
    return {
      ...summaryFor(chat, userId),
      messages: chat.messages.map((message) =>
        messageFor(message, userId, chat.id),
      ),
    };
  }

  function sendEvent(userId, payload) {
    const userStreams = streams.get(userId);
    if (!userStreams) return;
    const data = `event: chat\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const stream of [...userStreams]) {
      if (stream.res.writableEnded || stream.res.destroyed) {
        userStreams.delete(stream);
        continue;
      }
      try {
        if (!stream.res.write(data)) stream.res.destroy();
      } catch {
        stream.res.destroy();
        userStreams.delete(stream);
      }
    }
    if (!userStreams.size) streams.delete(userId);
  }

  function notify(chat, type, senderId = null) {
    // FIT Web Push recipient: solo la otra persona, sin exponer texto o imagenes.
    if (type === "message" && onMessage && senderId) {
      const message = chat.messages.at(-1);
      Promise.resolve().then(() => onMessage({
        id: message.id,
        userId: senderId === chat.buyer_id ? chat.seller_user_id : chat.buyer_id,
        chatId: chat.id,
        expiresAt: chat.expires_at,
      })).catch(() => console.warn("No se pudo encolar el aviso push del chat."));
    }
    for (const userId of [chat.buyer_id, chat.seller_user_id])
      sendEvent(userId, {
        type,
        chat_id: chat.id,
        from_self: senderId ? senderId === userId : false,
        expires_at: chat.expires_at,
      });
  }


 async function create(userId,productId){
  const chat=await transaction(db,async client=>{
   // Serializa aperturas para que dos solicitudes no creen la misma conversación activa.
   await client.query('select pg_advisory_xact_lock(746203)');
   await client.query('delete from food_chats where expires_at<=now()');
   const product=(await client.query("select p.id,p.vendor_id,p.name as product_name,v.user_id as seller_user_id,v.business_name,v.pickup_location,pr.full_name as buyer_name from food_products p join food_vendors v on v.id=p.vendor_id join profiles pr on pr.id=$2 where p.id=$1 and p.deleted_at is null and p.available=true and v.status='approved' and v.is_active=true and v.deleted_at is null",[productId,userId])).rows[0];
   if(!product)throw chatError(409,'El producto ya no está disponible.','conflict');
   if(product.seller_user_id===userId)throw chatError(400,'No puedes abrir un chat con tu propio puesto.');
   const prior=(await client.query('select * from food_chats where buyer_id=$1 and product_id=$2 and seller_user_id=$3 and expires_at>now()',[userId,productId,product.seller_user_id])).rows[0];
   if(prior)return hydrate(prior,client);
   const count=(await client.query('select count(*)::int as total,count(*) filter(where $1 in(buyer_id,seller_user_id))::int as mine from food_chats where expires_at>now()',[userId])).rows[0];
   if(count.mine>=40)throw chatError(429,'Hay demasiadas conversaciones activas. Inténtalo más tarde.','rate_limited');
   if(count.total>=250)throw chatError(503,'Las conversaciones temporales están ocupadas. Inténtalo más tarde.','chat_storage_full');
   const row=(await client.query(`insert into food_chats(buyer_id,seller_user_id,vendor_id,product_id,product_name,business_name,buyer_name,pickup_location)
    values($1,$2,$3,$4,$5,$6,$7,$8) returning *`,[userId,product.seller_user_id,product.vendor_id,product.id,product.product_name,product.business_name,product.buyer_name,product.pickup_location])).rows[0];
   return hydrate(row,client);
  });
  notify(chat,'chat_created',userId);return detailFor(chat,userId);
 }
 async function list(userId){
  const rows=(await db.query('select * from food_chats where $1 in(buyer_id,seller_user_id) and expires_at>now() order by updated_at desc limit 80',[userId])).rows;
  const items=[];for(const row of rows)items.push(summaryFor(await hydrate(row),userId));
  return {items,unread_count:items.reduce((n,r)=>n+r.unread_count,0)};
 }
 async function detail(userId,chatId){return detailFor(await getChat(chatId,userId),userId);}
 async function read(userId,chatId){
  return transaction(db,async client=>{
   const chat=await getChat(chatId,userId,client,true);
   const col=chat.buyer_id===userId?'buyer_read_at':'seller_read_at';
   const row=(await client.query(`update food_chats set ${col}=now() where id=$1 returning ${col}`,[chatId])).rows[0];
   chat.read_at.set(userId,new Date(row[col]).getTime());return summaryFor(chat,userId);
  });
 }
 async function add(userId,chatId,kind,text,bytes){
  const result=await transaction(db,async client=>{
   const chat=await getChat(chatId,userId,client,true);
   if(chat.messages.length>=300||kind==='image'&&chat.messages.filter(m=>m.kind==='image').length>=24)throw chatError(409,'Esta conversación alcanzó su límite de mensajes.','conflict');
   if(bytes){
    await client.query('select pg_advisory_xact_lock(746204)');
    const total=(await client.query('select coalesce(sum(octet_length(m.bytes)),0) as size from food_chat_messages m join food_chats c on c.id=m.chat_id where c.expires_at>now()')).rows[0];
    if(Number(total.size)+bytes.length>64*1024*1024)throw chatError(503,'El almacenamiento de imágenes está ocupado.','chat_storage_full');
   }
   const message=(await client.query('insert into food_chat_messages(chat_id,sender_id,kind,text,bytes,mime) values($1,$2,$3,$4,$5,$6) returning id,sender_id,kind,text,created_at',[chatId,userId,kind,text,bytes,bytes?'image/webp':null])).rows[0];
   const col=chat.buyer_id===userId?'buyer_read_at':'seller_read_at';
   await client.query(`update food_chats set updated_at=now(),${col}=now() where id=$1`,[chatId]);
   // La cola push se confirma en la misma transacción que el mensaje.
   await client.query('insert into fit_push_outbox(id,user_id,chat_id,expires_at) values($1,$2,$3,$4) on conflict(id) do nothing',[message.id,userId===chat.buyer_id?chat.seller_user_id:chat.buyer_id,chat.id,chat.expires_at]);
   chat.messages.push(message);return {chat,message};
  });
  notify(result.chat,'message',userId);return messageFor(result.message,userId,chatId);
 }
 async function addText(userId,chatId,value){
  if(typeof value!=='string'||!value.trim()||value.trim().length>MAX_TEXT||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw chatError(400,'El mensaje debe tener entre 1 y 1200 caracteres.');
  return add(userId,chatId,'text',value.trim(),null);
 }
 async function addImage(userId,chatId,file){await getChat(chatId,userId);return add(userId,chatId,'image',null,await normalizeImage(file));}
 async function image(userId,chatId,messageId){
  const row=(await db.query("select m.bytes,m.mime from food_chat_messages m join food_chats c on c.id=m.chat_id where m.id=$1 and c.id=$2 and $3 in(c.buyer_id,c.seller_user_id) and c.expires_at>now() and m.kind='image'",[messageId,chatId,userId])).rows[0];
  if(!row)throw chatError(404,'Imagen temporal no disponible.','not_found');return row;
 }
 async function validateOrderLink(userId,chatId,productId){const chat=await getChat(chatId,userId);if(chat.buyer_id!==userId||chat.product_id!==productId)throw chatError(403,'Ese chat no corresponde a este pedido.','forbidden');return chat;}
 async function linkOrder(userId,chatId,orderId){
  const row=(await db.query('update food_chats set order_id=$3,updated_at=now() where id=$1 and buyer_id=$2 and expires_at>now() returning *',[chatId,userId,orderId])).rows[0];
  if(row)notify(row,'order_linked',userId);return !!row;
 }
 async function chatIdForOrder(userId,orderId){return (await db.query('select id from food_chats where order_id=$1 and $2 in(buyer_id,seller_user_id) and expires_at>now() limit 1',[orderId,userId])).rows[0]?.id||null;}
 async function unreadCount(userId){return (await list(userId)).unread_count;}
  function connect(userId, sessionHash, res) {

    const count = [...streams.values()].reduce((sum, set) => sum + set.size, 0);
    if ((streams.get(userId)?.size || 0) >= MAX_STREAMS_PER_USER || count >= MAX_STREAMS)
      throw chatError(429, "Hay demasiadas conexiones de chat abiertas. Cierra otras pestañas e inténtalo de nuevo.", "rate_limited");
    const stream = { res, sessionHash };
    if (!streams.has(userId)) streams.set(userId, new Set());
    streams.get(userId).add(stream);
    let heartbeat, checking = false;
    const opened = Date.now();
    const close = () => {
      clearInterval(heartbeat);
      const set = streams.get(userId);
      set?.delete(stream);
      if (set && !set.size) streams.delete(userId);
    };
    res.once("close", close);
    res.once("finish", close);
    const write = (data) => {
      if (res.writableEnded || res.destroyed) { close(); return false; }
      try {
        if (res.write(data)) return true;
      } catch {}
      // A slow/disconnected reader must not retain an unbounded response buffer.
      close();
      res.destroy();
      return false;
    };
    res.set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    if (!write('retry: 3000\nevent: ready\ndata: {"type":"ready"}\n\n')) return;
    heartbeat = setInterval(async () => {
      if (res.writableEnded || res.destroyed) return close();
      if (Date.now() - opened > 3600000) return res.end();
      if (checking) return;
      checking = true;
      try {
        if (sessionHash) {
          const alive = (await db.query(
            "select 1 from sessions s join users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now() and u.email_confirmed_at is not null",
            [sessionHash],
          )).rows.length;
          if (!alive) return res.end();
        }
    
        write(`event: ping\ndata: ${JSON.stringify({ type: "ping", now: new Date().toISOString() })}\n\n`);
      } catch { res.end(); }
      finally { checking = false; }
    }, 25000);
    heartbeat.unref?.();
  }

 return {create,list,detail,read,addText,addImage,image,validateOrderLink,linkOrder,chatIdForOrder,unreadCount,connect,purgeExpired};
}
module.exports={CHAT_TTL_MS,MAX_TEXT,createTemporaryFoodChat};
