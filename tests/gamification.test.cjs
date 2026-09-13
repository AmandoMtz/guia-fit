const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');const request=require('supertest');const express=require('express');
const {createGamificationRouter,award}=require('../server/gamification.cjs');

test('recompensas, canjes, categorías y valoraciones se validan en servidor',async t=>{
 const engine=new PGlite();
 for(const file of fs.readdirSync(path.join(__dirname,'../backend/migrations')).sort())await engine.exec(fs.readFileSync(path.join(__dirname,'../backend/migrations',file),'utf8'));
 const query=(sql,p)=>engine.query(sql,p);let tail=Promise.resolve();
 const db={query,connect:async()=>{const prev=tail;let release;tail=new Promise(r=>release=r);await prev;return {query,release};}};
 const buyer=randomUUID(),seller=randomUUID(),stranger=randomUUID();
 for(const uid of [buyer,seller,stranger])await query("insert into users(id,email,password_hash,email_confirmed_at) values($1,$2,'fixture',now())",[uid,uid+'@uat.edu.mx']);
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:req.headers['x-user']||buyer,email:req.headers['x-external']?'guest@gmail.com':'teacher@uat.edu.mx',role:'user'};next();});app.use('/g',createGamificationRouter({db}));app.use((e,req,res,next)=>{if(!e.status) console.error(e.message);res.status(e.status||500).json({message:e.message});});const api=request(app);
 await t.test('día único, primer horario único y semana lunes a viernes',async()=>{
  await Promise.all([api.post('/g/sync').send({}).expect(200),api.post('/g/sync').send({}).expect(200)]);
  assert.equal((await api.get('/g/me')).body.data.xp,10);
  await api.post('/g/schedule').send({classes:[]}).expect(400);
  for(let i=0;i<2;i++)await api.post('/g/schedule').send({classes:[{subject:'Redes',day:1,start:'08:00',end:'09:00'}]}).expect(200);
  assert.equal((await api.get('/g/me')).body.data.xp,40);
  const dates=(await query("select to_char(date_trunc('week',now() at time zone 'America/Monterrey')::date+i,'YYYY-MM-DD') as day from generate_series(0,4) i")).rows;
  for(const d of dates)await query("insert into fit_rewards(user_id,activity,xp) values($1,$2,10) on conflict do nothing",[buyer,'day:'+d.day]);
  await api.post('/g/sync').send({}).expect(200);await api.post('/g/sync').send({}).expect(200);
  assert.equal((await query("select count(*)::int n from fit_rewards where activity like 'week:%' and user_id=$1",[buyer])).rows[0].n,1);
 });
 await t.test('EXP de asistencias proviene solo de registros reales',async()=>{
  const event=(await query("insert into events(title,location,audience,visibility,starts_at,ends_at,created_by) values('Evento FIT','Auditorio','teachers','public',now(),now()+interval '1 hour',$1) returning id",[seller])).rows[0];
  await query('insert into event_attendance(event_id,user_id) values($1,$2)',[event.id,buyer]);
  await api.post('/g/sync').send({xp:99999,event_id:randomUUID()}).expect(200);
  await api.post('/g/sync').send({}).expect(200);
  assert.equal((await api.get('/g/me')).body.data.coins,50);
  assert.equal((await query("select count(*)::int n from fit_rewards where activity like 'event:%' and user_id=$1",[buyer])).rows[0].n,1);
 });
 await t.test('saldo no negativo, propiedad y canjes concurrentes',async()=>{
  await api.post('/g/buy').set('x-user',stranger).send({item:'frame-gold',price:0}).expect(409);
  await api.post('/g/equip').set('x-user',stranger).send({slot:'frame',item:'frame-ruby'}).expect(403);
  await query('update fit_progress set coins=50 where user_id=$1',[buyer]);
  await Promise.all([api.post('/g/buy').send({item:'frame-ruby'}).expect(200),api.post('/g/buy').send({item:'frame-ruby'}).expect(200)]);
  const p=(await api.get('/g/me')).body.data;assert.equal(p.coins,0);assert.deepEqual(p.inventory,['frame-ruby']);
  await api.post('/g/equip').send({slot:'frame',item:'frame-ruby'}).expect(200);
  await api.post('/g/equip').send({slot:'motion',item:'frame-ruby'}).expect(400);
  await api.post('/g/animations').send({enabled:false}).expect(200);
  assert.equal((await api.get('/g/me')).body.data.animations,false);
 });
 const vendor=(await query("insert into food_vendors(user_id,business_name,pickup_location,status,review_source,reviewed_by,reviewed_at) values($1,'Postres FIT','Entrada','approved','prueba',$1,now()) returning id",[seller])).rows[0];
 const product=(await query("insert into food_products(vendor_id,name,price_cents,sale_unit,units_per_lot) values($1,'Pastel',5000,'unit',1) returning id",[vendor.id])).rows[0];
 async function order(status='completed',uid=buyer){return (await query("insert into food_orders(buyer_id,vendor_id,product_id,request_id,product_name,price_cents,sale_unit,units_per_lot,quantity,total_cents,pickup_location,status) values($1,$2,$3,$4,'Pastel',5000,'unit',1,1,5000,'Entrada',$5) returning id",[uid,vendor.id,product.id,randomUUID(),status])).rows[0].id;}
 await t.test('solo el comprador califica entregas; sin duplicados ni autoevaluación',async()=>{
  await api.post('/g/categories').set('x-user',seller).send({categories:['postres','bebidas']}).expect(200);
  const pending=await order('requested');await api.post('/g/ratings').send({order_id:pending,stars:5,category:'postres'}).expect(403);
  const id=await order();await api.post('/g/ratings').set('x-user',stranger).send({order_id:id,stars:5,category:'postres'}).expect(403);
  await api.post('/g/ratings').send({order_id:id,stars:6,category:'postres'}).expect(400);
  await api.post('/g/ratings').send({order_id:id,stars:5,category:'comida'}).expect(400);
  await api.post('/g/ratings').send({order_id:id,stars:5,category:'postres'}).expect(200);
  await api.post('/g/ratings').send({order_id:id,stars:1,category:'postres'}).expect(409);
  const own=await order('completed',seller);await api.post('/g/ratings').set('x-user',seller).send({order_id:own,stars:5,category:'postres'}).expect(403);
 });
 await t.test('rating repetido del comprador no vuelve a dar EXP y ranking por categoría',async()=>{
  const id=await order();await api.post('/g/ratings').send({order_id:id,stars:3,category:'bebidas'}).expect(200);
  assert.equal((await api.get('/g/me').set('x-user',seller)).body.data.xp,10);
  const all=(await api.get('/g/ranking')).body.data[0];assert.equal(all.votes,2);assert.equal(all.average,4);
  const desserts=(await api.get('/g/ranking?category=postres')).body.data[0];assert.equal(desserts.votes,1);assert.equal(desserts.average,5);
  await api.get('/g/me').set('x-external','1').expect(403);
 });
 await t.test('limita EXP de valoraciones a cinco recompensas diarias',async()=>{
  for(let i=0;i<6;i++){
   const uid=randomUUID();await query("insert into users(id,email,password_hash,email_confirmed_at) values($1,$2,'fixture',now())",[uid,uid+'@uat.edu.mx']);
   const id=await order('completed',uid);await api.post('/g/ratings').set('x-user',uid).send({order_id:id,stars:5,category:'postres'}).expect(200);
  }
  assert.equal((await api.get('/g/me').set('x-user',seller)).body.data.xp,50);
 });
 await engine.close();
});
