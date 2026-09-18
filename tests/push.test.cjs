const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID,createECDH,randomBytes}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createPushService,validateSubscription}=require('../server/push.cjs');
function sub(name='device'){const ec=createECDH('prime256v1');ec.generateKeys();return {endpoint:'https://fcm.googleapis.com/fcm/send/'+name,keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};}
test('Push: rechaza destinos internos, credenciales y claves invalidas',()=>{
 assert.ok(validateSubscription(sub()));
 for(const endpoint of ['http://fcm.googleapis.com/a','https://127.0.0.1/a','https://fcm.googleapis.com.evil.test/a','https://user:pass@fcm.googleapis.com/a','https://fcm.googleapis.com:8443/a'])assert.throws(()=>validateSubscription({...sub(),endpoint}));
 assert.throws(()=>validateSubscription({...sub(),keys:{p256dh:'x',auth:'x'}}));
});
test('Push: solo destinatario, sesiones vigentes, bajas 410 y reintentos',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 for(const name of fs.readdirSync(path.join(__dirname,'../backend/migrations')).sort().filter(n=>n.endsWith('.sql')))await db.exec(fs.readFileSync(path.join(__dirname,'../backend/migrations',name),'utf8'));
 const buyer=randomUUID(),seller=randomUUID(),chat=randomUUID();
 for(const id of [buyer,seller]){await db.query("insert into users(id,email,password_hash) values($1,$2,'fixture')",[id,id+'@example.test']);await db.query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')",[id,id]);}
 const devices=[sub('buyer'),sub('seller'),sub('gone'),sub('retry')];
 for(let i=0;i<devices.length;i++){const s=devices[i],id=i===0?buyer:seller;await db.query('insert into fit_push_subscriptions(endpoint,user_id,session_hash,p256dh,auth) values($1,$2,$3,$4,$5)',[s.endpoint,id,id,s.keys.p256dh,s.keys.auth]);}
 let sends=[],retry=true;
 const service=createPushService({db,siteUrl:'https://fit.example.test',transport:{async sendNotification(s,payload,options){
   if(s.endpoint.endsWith('gone'))throw {statusCode:410};
   if(s.endpoint.endsWith('retry')&&retry)throw {statusCode:503};
   sends.push({endpoint:s.endpoint,payload:JSON.parse(payload),options});
 }}});t.after(()=>service.stop());
 const before=await service.keys();assert.equal((await service.keys()).public_key,before.public_key);
 const id=randomUUID();await db.query("insert into fit_push_outbox(id,user_id,chat_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",[id,seller,chat]);
 await service.run();assert.equal(sends.length,1);assert.ok(sends[0].endpoint.endsWith('seller'));assert.equal(sends[0].payload.recipientId,seller);assert.equal(sends[0].payload.chatId,chat);assert.ok(sends[0].options.TTL>0);
 assert.equal((await db.query('select * from fit_push_subscriptions where endpoint=$1',[devices[2].endpoint])).rows.length,0);
 assert.equal((await db.query('select attempts from fit_push_outbox')).rows[0].attempts,1);
 retry=false;await db.query('update fit_push_outbox set next_attempt=now()');await service.run();assert.equal((await db.query('select * from fit_push_outbox')).rows.length,0);
 sends=[];await db.query('delete from sessions where token_hash=$1',[seller]);await db.query("insert into fit_push_outbox(id,user_id,chat_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",[randomUUID(),seller,chat]);await service.run();assert.equal(sends.length,0);
 await db.query("insert into fit_push_outbox(id,user_id,chat_id,expires_at) values($1,$2,$3,now()-interval '1 minute')",[randomUUID(),buyer,chat]);await service.run();assert.equal(sends.length,0);
});
test('Chat: texto e imagen notifican a la otra persona; acceso ajeno no envia push',async t=>{
 const {createTemporaryFoodChat}=require('../server/food-chat.cjs');
 const buyer=randomUUID(),seller=randomUUID(),product=randomUUID(),received=[];
 const engine=new PGlite();t.after(()=>engine.close());
 for(const name of fs.readdirSync(path.join(__dirname,'../backend/migrations')).sort().filter(n=>n.endsWith('.sql')))await engine.exec(fs.readFileSync(path.join(__dirname,'../backend/migrations',name),'utf8'));
 const query=(s,a)=>engine.query(s,a),db={query,connect:async()=>({query,release(){}})};
 for(const id of [buyer,seller]){await query("insert into users(id,email,password_hash) values($1,$2,'x')",[id,id+'@test.mx']);await query('insert into profiles(id,full_name) values($1,$2)',[id,'Nombre Apellidos']);}
 const vendor=(await query("insert into food_vendors(user_id,business_name,pickup_location,status,review_source,reviewed_by,reviewed_at) values($1,'Puesto','Local','approved','Fuente verificada',$1,now()) returning id",[seller])).rows[0].id;
 await query("insert into food_products(id,vendor_id,name,price_cents,sale_unit) values($1,$2,'Producto',100,'unit')",[product,vendor]);
 const chat=createTemporaryFoodChat({db,onMessage:info=>received.push(info)});

 const c=await chat.create(buyer,product);
 await chat.addText(buyer,c.id,'Hola');await new Promise(resolve=>setImmediate(resolve));assert.equal(received[0].userId,seller);
 await chat.addText(seller,c.id,'Hola cliente');await new Promise(resolve=>setImmediate(resolve));assert.equal(received[1].userId,buyer);
 await assert.rejects(()=>chat.addText(randomUUID(),c.id,'intruso'));assert.equal(received.length,2);
 const sharp=require('sharp');const buffer=await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer();
 await chat.addImage(buyer,c.id,{buffer,mimetype:'image/png'});await new Promise(resolve=>setImmediate(resolve));assert.equal(received[2].userId,seller);
 assert.equal(received[0].chatId,c.id);assert.equal(received[0].text,undefined);await chat.purgeExpired();
});
test('Service worker: muestra avisos sin ventanas y abre enlace seguro',async()=>{
 const handlers={},shown=[],opened=[];let task;
 const self={addEventListener:(name,fn)=>handlers[name]=fn,location:{origin:'https://fit.example.test'},registration:{showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>[],openWindow:async u=>opened.push(u)}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../web/dist/push-worker.js'),'utf8'),{self,URL});
 const data={chatId:randomUUID(),recipientId:randomUUID(),url:'https://evil.test'};
 handlers.push({data:{json:()=>data},waitUntil:p=>task=p});await task;assert.equal(shown.length,1);assert.equal(shown[0][1].data.chatId,data.chatId);
 handlers.notificationclick({notification:{close(){},data},waitUntil:p=>task=p});await task;
 const url=new URL(opened[0]);assert.equal(url.origin,self.location.origin);assert.equal(url.searchParams.get('fitChat'),data.chatId);
 let post;self.clients.matchAll=async()=>[{url:self.location.origin+'/',focus:async()=>{},postMessage:d=>post=d}];
 handlers.notificationclick({notification:{close(){},data},waitUntil:p=>task=p});await task;assert.equal(post.chatId,data.chatId);assert.equal(opened.length,1);
});
test('API push: alta, estado y baja ligados a la cuenta autenticada',async t=>{
 const express=require('express'),request=require('supertest'),engine=new PGlite();
 t.after(()=>engine.close());
 for(const name of fs.readdirSync(path.join(__dirname,'../backend/migrations')).sort().filter(n=>n.endsWith('.sql')))await engine.exec(fs.readFileSync(path.join(__dirname,'../backend/migrations',name),'utf8'));
 const ids=[randomUUID(),randomUUID()];for(const id of ids){await engine.query("insert into users(id,email,password_hash) values($1,$2,'fixture')",[id,id+'@example.test']);await engine.query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')",[id,id]);}
 const query=(...args)=>engine.query(...args),db={query,connect:async()=>({query,release(){}})};
 const push=createPushService({db,siteUrl:'https://fit.example.test'});t.after(()=>push.stop());
 const app=express();app.use(express.json());app.use((req,res,next)=>{const id=req.get('x-fixture-user');if(!ids.includes(id))return res.sendStatus(401);req.user={id};req.sessionHash=id;next();});app.use('/api/push',push.router(async()=>{}));app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
 const api=request(app),device=sub('ownership');
 await api.get('/api/push/config').expect(401);
 const config=await api.get('/api/push/config').set('x-fixture-user',ids[0]).expect(200);assert.ok(config.body.data.publicKey);assert.equal(config.body.data.private_key,undefined);
 await api.post('/api/push/subscription').set('x-fixture-user',ids[0]).send({...device,user_id:ids[1]}).expect(200);
 assert.equal((await engine.query('select user_id from fit_push_subscriptions')).rows[0].user_id,ids[0]);
 const other=await api.post('/api/push/status').set('x-fixture-user',ids[1]).send({endpoint:device.endpoint}).expect(200);assert.equal(other.body.data.enabled,false);
 await api.delete('/api/push/subscription').set('x-fixture-user',ids[1]).send({endpoint:device.endpoint}).expect(200);assert.equal((await engine.query('select * from fit_push_subscriptions')).rows.length,1);
 await api.delete('/api/push/subscription').set('x-fixture-user',ids[0]).send({endpoint:device.endpoint}).expect(200);assert.equal((await engine.query('select * from fit_push_subscriptions')).rows.length,0);
});
