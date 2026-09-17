'use strict';
const { createECDH, ECDH } = require('node:crypto');
const fail = (status,message) => Object.assign(new Error(message),{status,code:'push_error'});
function validateSubscription(value) {
  if (!value || typeof value.endpoint !== 'string' || value.endpoint.length > 2048) throw fail(400,'Suscripcion no valida.');
  let u; try { u=new URL(value.endpoint); } catch { throw fail(400,'Suscripcion no valida.'); }
  const allowed = u.hostname === 'fcm.googleapis.com' || u.hostname === 'updates.push.services.mozilla.com' ||
    /^[a-z0-9-]+\.push\.apple\.com$/.test(u.hostname) || /^[a-z0-9.-]+\.notify\.windows\.com$/.test(u.hostname);
  if (u.protocol!=='https:' || u.port || u.username || u.password || u.hash || !allowed) throw fail(400,'Proveedor push no admitido.');
  const key=value.keys?.p256dh, auth=value.keys?.auth;
  if (typeof key!=='string' || !/^[A-Za-z0-9_-]{87}={0,1}$/.test(key) || typeof auth!=='string' || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(auth)) throw fail(400,'Claves de suscripcion no validas.');
  try { ECDH.convertKey(Buffer.from(key,'base64url'),'prime256v1'); } catch { throw fail(400,'Clave publica no valida.'); }
  return {endpoint:u.href,keys:{p256dh:key,auth}};
}
function createPushService({db,siteUrl,transport,logger=console}) {
  let keysPromise, timer, working=false;
  async function keys() {
    if (!keysPromise) keysPromise=(async()=>{
      let row=(await db.query('select public_key,private_key from fit_push_keys where id=1')).rows[0];
      if (!row) {
        const ec=createECDH('prime256v1');ec.generateKeys();
        await db.query('insert into fit_push_keys(id,public_key,private_key) values(1,$1,$2) on conflict(id) do nothing',[ec.getPublicKey().toString('base64url'),Buffer.from(ec.getPrivateKey().toString('hex').padStart(64,'0'),'hex').toString('base64url')]);
        row=(await db.query('select public_key,private_key from fit_push_keys where id=1')).rows[0];
      }
      return row;
    })().catch(e=>{keysPromise=null;throw e;});
    return keysPromise;
  }
  async function send(row,payload,ttl) {
    const key=await keys(), sender=transport || require('web-push');
    return sender.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify(payload),{
      vapidDetails:{subject:new URL(siteUrl).origin,publicKey:key.public_key,privateKey:key.private_key},
      TTL:ttl,urgency:'high',timeout:8000,
    });
  }
  async function run() {
    if (working) return;working=true;
    try {
      await db.query(`with removed as (delete from fit_push_outbox where (expires_at<=now() or attempts>=5) and (lease_until is null or lease_until<now()) returning *) insert into fit_push_delivery_log(job_id,user_id,outcome,attempts) select id,user_id,'expired_or_exhausted',attempts from removed`);
      const jobs=(await db.query(`update fit_push_outbox set lease_until=now()+interval '10 minutes',attempts=attempts+1
        where id in (select id from fit_push_outbox where next_attempt<=now() and (lease_until is null or lease_until<now())
        order by next_attempt for update skip locked limit 5) returning *`)).rows;
      for (const job of jobs) {
        let retry=false, delivered=0, deviceCount=0;
        try {
          const devices=(await db.query(`select p.* from fit_push_subscriptions p join sessions s on s.token_hash=p.session_hash
            where p.user_id=$1 and s.user_id=p.user_id and s.expires_at>now()`,[job.user_id])).rows;
          deviceCount=devices.length;
          const ttl=Math.max(0,Math.min(3600,Math.floor((new Date(job.expires_at)-Date.now())/1000)));
          if (ttl) for (const device of devices) {
            try { await send(device,job.payload||{title:'Nuevo mensaje · Guía FIT',body:'Tienes un mensaje en un chat de Comidas. Toca para abrirlo.',chatId:job.chat_id,recipientId:job.user_id,tag:'fit-chat-'+job.chat_id},ttl); delivered++; }
            catch(e) {
              if ([404,410].includes(e.statusCode)) await db.query('delete from fit_push_subscriptions where endpoint=$1 and user_id=$2',[device.endpoint,job.user_id]);
              else if (!e.statusCode || e.statusCode===429 || e.statusCode>=500) retry=true;
              else logger.warn('Push rechazado por el proveedor:',e.statusCode);
            }
          }
        } catch { retry=true; }
        if (retry) await db.query("update fit_push_outbox set lease_until=null,next_attempt=now()+($2 * interval '1 second') where id=$1",[job.id,Math.min(300,15*2**job.attempts)]);
        else await db.query(`with removed as (delete from fit_push_outbox where id=$1 returning *) insert into fit_push_delivery_log(job_id,user_id,outcome,attempts) select id,user_id,$2,attempts from removed`,[job.id,delivered?'accepted_by_provider':deviceCount?'rejected_or_expired':'no_active_subscription']);
      }
    } finally {working=false;}
  }
  function start() {if(!timer){timer=setInterval(()=>run().catch(()=>logger.warn('Push: reintentando entrega pendiente.')),15000);timer.unref?.();}}
  async function enqueue({id,userId,chatId,expiresAt}) {
    await db.query('insert into fit_push_outbox(id,user_id,chat_id,expires_at) values($1,$2,$3,$4) on conflict(id) do nothing',[id,userId,chatId,expiresAt]);
    start();run().catch(()=>logger.warn('Push pendiente; se reintentara.'));
  }
  function router(limit) {
    const r=require('express').Router();
    r.use(async(req,res,next)=>{await limit(req,'push:'+req.user.id,60);next();});
    r.get('/activity',async(req,res)=>res.json({data:(await db.query('select id,kind,title,body,view_name,created_at,read_at from fit_activity_notifications where user_id=$1 order by created_at desc limit 100',[req.user.id])).rows}));
    r.patch('/activity/read',async(req,res)=>{await db.query('update fit_activity_notifications set read_at=now() where user_id=$1 and read_at is null',[req.user.id]);res.json({data:{}});});
    r.get('/config',async(req,res)=>res.json({data:{publicKey:(await keys()).public_key}}));
    r.post('/subscription',async(req,res)=>{
      const sub=validateSubscription(req.body);
      const c=await db.connect();
      try {
        await c.query('begin');
        await c.query('select pg_advisory_xact_lock(hashtext($1))',['push:'+req.user.id]);
        const n=(await c.query('select count(*)::int as n from fit_push_subscriptions where user_id=$1 and endpoint<>$2',[req.user.id,sub.endpoint])).rows[0].n;
        if(n>=8)throw fail(400,'Ya tienes ocho dispositivos activos. Desactiva uno antes de continuar.');
        await c.query(`insert into fit_push_subscriptions(endpoint,user_id,session_hash,p256dh,auth) values($1,$2,$3,$4,$5)
          on conflict(endpoint) do update set user_id=excluded.user_id,session_hash=excluded.session_hash,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=now()`,[sub.endpoint,req.user.id,req.sessionHash,sub.keys.p256dh,sub.keys.auth]);
        await c.query('commit');
      } catch(e){await c.query('rollback');throw e;} finally{c.release();}
      start();res.json({data:{enabled:true}});
    });
    r.post('/status',async(req,res)=>{
      const endpoint=String(req.body?.endpoint||'');
      const exists=(await db.query('select 1 from fit_push_subscriptions where endpoint=$1 and user_id=$2 and session_hash=$3',[endpoint,req.user.id,req.sessionHash])).rows.length>0;
      res.json({data:{enabled:exists}});
    });
    r.delete('/subscription',async(req,res)=>{
      await db.query('delete from fit_push_subscriptions where endpoint=$1 and user_id=$2',[String(req.body?.endpoint||''),req.user.id]);res.json({data:{enabled:false}});
    });
    r.post('/test',async(req,res)=>{
      await limit(req,'push-test:'+req.user.id,6);
      const device=(await db.query('select * from fit_push_subscriptions where endpoint=$1 and user_id=$2 and session_hash=$3',[String(req.body?.endpoint||''),req.user.id,req.sessionHash])).rows[0];
      if(!device)throw fail(400,'Activa las notificaciones en este dispositivo primero.');
      try{await send(device,{title:'Guía FIT',body:'Las notificaciones de mensajes están activadas.',tag:'fit-push-test',recipientId:req.user.id},60);}
      catch(e){if([404,410].includes(e.statusCode))await db.query('delete from fit_push_subscriptions where endpoint=$1',[device.endpoint]);throw fail(502,'No se pudo entregar la prueba. Desactiva y vuelve a activar las notificaciones.');}
      res.json({data:{sent:true}});
    });
    return r;
  }
  return {keys,router,enqueue,run,start,stop(){clearInterval(timer);timer=null;}};
}
module.exports={createPushService,validateSubscription};
