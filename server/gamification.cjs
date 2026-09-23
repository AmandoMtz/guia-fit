const {Router} = require('express');
const {transaction} = require('./db.cjs');
const {accountType} = require('./account.cjs');
const categories = ['comida','postres','botanas','bebidas','otros'];
const catalog = [
 {id:'theme-pink',slot:'theme',name:'Rosa FIT',price:10,description:'Un tema rosa suave, claro y limpio para toda la página.'},
 {id:'theme-blue',slot:'theme',name:'Azul Campus',price:20,description:'Azules frescos para navegar con un estilo distinto.'},
 {id:'theme-purple',slot:'theme',name:'Morado Castor',price:30,description:'Un morado elegante con acentos modernos.'},
 {id:'theme-lilac',slot:'theme',name:'Lila Suave',price:40,description:'Tonos lila claros y tranquilos en toda la interfaz.'},
 {id:'theme-mint',slot:'theme',name:'Verde Menta',price:50,description:'Un verde claro y fresco para cambiar el ambiente de la página.'},
 {id:'theme-dark',slot:'theme',name:'Modo Oscuro FIT',price:100,minLevel:50,description:'Modo oscuro premium. Se desbloquea al llegar al nivel 50.'},
 {id:'font-rounded',slot:'font',name:'Tipografía Redondeada',price:15,description:'Una letra más suave y amigable para toda la página.'},
 {id:'font-classic',slot:'font',name:'Tipografía Clásica',price:25,description:'Un estilo sobrio y elegante para títulos y textos.'},
 {id:'font-compact',slot:'font',name:'Tipografía Compacta',price:35,description:'Una apariencia más moderna y compacta.'},
 {id:'frame-ruby',slot:'frame',name:'Marco Rubí FIT',price:50,description:'Un aro rojo luminoso para tu perfil.'},
 {id:'frame-gold',slot:'frame',name:'Marco Honor',price:150,description:'Dorado con brillo suave.'},
 {id:'frame-orbit',slot:'frame',name:'Órbita Castor',price:250,description:'Un halo animado alrededor de tu foto.'},
 {id:'frame-halloween',slot:'frame',name:'Noche de Halloween',price:180,description:'Destellos naranja y violeta para una noche de sustos.'},
 {id:'frame-mexico',slot:'frame',name:'Viva México · 16 de septiembre',price:160,description:'Un borde tricolor animado para celebrar la Independencia.'},
 {id:'frame-christmas',slot:'frame',name:'Navidad FIT',price:180,description:'Luces rojas y verdes con destellos de nieve.'},
 {id:'frame-muertos',slot:'frame',name:'Flor de Cempasúchil',price:180,description:'Un aro de pétalos dorados y acentos violeta.'},
 {id:'frame-newyear',slot:'frame',name:'Año Nuevo',price:200,description:'Destellos dorados y plateados de celebración.'},
 {id:'frame-valentine',slot:'frame',name:'San Valentín',price:150,description:'Un resplandor rosa que late suavemente.'},
 {id:'chat-ruby',slot:'chat',name:'Chat Rubí',price:50,description:'Bordes rojos para tus conversaciones.'},
 {id:'chat-gold',slot:'chat',name:'Chat Honor',price:100,description:'Marcos dorados en tus chats.'},
 {id:'bot-petals',slot:'background',name:'Pétalos FIT',price:75,description:'Fondo suave de puntos para Castor FIT.'},
 {id:'bot-night',slot:'background',name:'Noche Castor',price:125,description:'Un fondo vino para conversar.'},
 {id:'motion-rise',slot:'motion',name:'Entrada flotante',price:75,description:'Los mensajes aparecen con un movimiento suave.'},
 {id:'motion-glow',slot:'motion',name:'Destello',price:125,description:'Un brillo breve al recibir mensajes.'},
];
const fail=(status,message)=>Object.assign(new Error(message),{status,code:'gamification_error'});
async function lock(c,uid) {
 await c.query('insert into fit_progress(user_id) values($1) on conflict do nothing',[uid]);
 return (await c.query('select * from fit_progress where user_id=$1 for update',[uid])).rows[0];
}
async function award(c,uid,key,xp) {
 const p=await lock(c,uid);
 const inserted=await c.query('insert into fit_rewards(user_id,activity,xp) values($1,$2,$3) on conflict do nothing returning activity',[uid,key,xp]);
 if(!inserted.rows.length)return 0;
 const coins=(Math.floor((p.xp+xp)/100)-Math.floor(p.xp/100))*50;
 await c.query('update fit_progress set xp=xp+$2,coins=coins+$3 where user_id=$1',[uid,xp,coins]);
 return xp;
}
async function sync(c,uid) {
 await lock(c,uid);
 const {day,week}= (await c.query("select to_char(now() at time zone 'America/Monterrey','YYYY-MM-DD') as day,to_char(date_trunc('week',now() at time zone 'America/Monterrey'),'YYYY-MM-DD') as week")).rows[0];
 let earned=await award(c,uid,'day:'+day,10);
 const n=(await c.query("select count(*)::int as n from fit_rewards where user_id=$1 and activity like 'day:%' and substring(activity from 5)::date between $2::date and $2::date+4",[uid,week])).rows[0].n;
 if(n===5)earned+=await award(c,uid,'week:'+week,50);
 const attendances=(await c.query('select event_id from event_attendance where user_id=$1',[uid])).rows;
 for(const a of attendances)earned+=await award(c,uid,'event:'+a.event_id,40);
 return earned;
}
function createGamificationRouter({db,limit}) {
 const r=Router();
 r.use(async(req,res,next)=>{
  if(!['student','teacher','admin'].includes(accountType(req.user.email,req.user.role)))throw fail(403,'Los beneficios están disponibles para alumnos y docentes con correo institucional.');
  if(req.method!=='GET'&&limit)await limit(req,`rewards:${req.user.id}`,90,15*60*1000);
  next();
 });
 r.get('/me',async(req,res)=>{
  const p=(await db.query('select * from fit_progress where user_id=$1',[req.user.id])).rows[0]||{xp:0,coins:0,equipped:{},animations:true};
  const inventory=(await db.query('select item from fit_inventory where user_id=$1',[req.user.id])).rows.map(x=>x.item);
  const history=(await db.query('select activity,xp,created_at from fit_rewards where user_id=$1 order by created_at desc limit 20',[req.user.id])).rows;
  const days=(await db.query("select activity from fit_rewards where user_id=$1 and activity like 'day:%' and substring(activity from 5)::date between date_trunc('week',now() at time zone 'America/Monterrey')::date and date_trunc('week',now() at time zone 'America/Monterrey')::date+4",[req.user.id])).rows.map(x=>x.activity.slice(4));
  res.json({data:{...p,level:1+Math.floor(p.xp/100),next:100-p.xp%100,inventory,catalog,history,days,categories}});
 });
 r.post('/sync',async(req,res)=>res.json({data:{earned:await transaction(db,c=>sync(c,req.user.id))}}));
 r.post('/schedule',async(req,res)=>{
  const rows=req.body?.classes;
  if(!Array.isArray(rows)||!rows.length||rows.length>100||rows.some(x=>!x||typeof x.subject!=='string'||!x.subject.trim()||x.subject.length>180||!Number.isInteger(Number(x.day))||Number(x.day)<1||Number(x.day)>7||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.end)||x.end<=x.start))throw fail(400,'Guarda un horario con materias, días y horas válidas.');
  res.json({data:{earned:await transaction(db,c=>award(c,req.user.id,'first-schedule',30))}});
 });
 r.post('/buy',async(req,res)=>{
  const item=catalog.find(x=>x.id===req.body?.item);if(!item)throw fail(400,'Personalización desconocida.');
  await transaction(db,async c=>{
   const p=await lock(c,req.user.id);
   if((await c.query('select 1 from fit_inventory where user_id=$1 and item=$2',[req.user.id,item.id])).rows.length)return;
   const level=1+Math.floor(p.xp/100);
   if(item.minLevel&&level<item.minLevel)throw fail(409,`Este premio se desbloquea en el nivel ${item.minLevel}.`);
   if(p.coins<item.price)throw fail(409,'Todavía no tienes monedas suficientes.');
   await c.query('update fit_progress set coins=coins-$2 where user_id=$1',[req.user.id,item.price]);
   await c.query('insert into fit_inventory(user_id,item) values($1,$2)',[req.user.id,item.id]);
  });res.json({data:{}});
 });
 r.post('/equip',async(req,res)=>{
  const {slot,item}=req.body||{};
  if(!['frame','chat','background','motion','theme','font'].includes(slot))throw fail(400,'Estilo desconocido.');
  if(item!==null&&!catalog.some(x=>x.id===item&&x.slot===slot))throw fail(400,'Estilo incompatible.');
  await transaction(db,async c=>{
   const p=await lock(c,req.user.id);
   if(item!==null&&!(await c.query('select 1 from fit_inventory where user_id=$1 and item=$2',[req.user.id,item])).rows.length)throw fail(403,'Primero debes canjear este estilo.');
   const chosen=item===null?null:catalog.find(x=>x.id===item);
   const level=1+Math.floor(p.xp/100);
   if(chosen?.minLevel&&level<chosen.minLevel)throw fail(409,`Este premio se desbloquea en el nivel ${chosen.minLevel}.`);
   await c.query('update fit_progress set equipped=$2 where user_id=$1',[req.user.id,JSON.stringify({...p.equipped,[slot]:item})]);
  });res.json({data:{}});
 });
 r.post('/animations',async(req,res)=>{
  if(typeof req.body?.enabled!=='boolean')throw fail(400,'Valor inválido.');
  await transaction(db,async c=>{await lock(c,req.user.id);await c.query('update fit_progress set animations=$2 where user_id=$1',[req.user.id,req.body.enabled]);});res.json({data:{}});
 });
 r.get('/orders',async(req,res)=>res.json({data:(await db.query("select o.id,o.product_name,v.business_name,o.vendor_id,r.stars,r.service_stars,r.product_stars,coalesce((select json_agg(category) from fit_vendor_categories where vendor_id=v.id),'[\"comida\"]'::json) as categories from food_orders o join food_vendors v on v.id=o.vendor_id left join fit_ratings r on r.order_id=o.id where o.buyer_id=$1 and o.status='completed' order by o.updated_at desc limit 100",[req.user.id])).rows}));
 r.post('/ratings',async(req,res)=>{
  const {order_id,category}=req.body||{};
  const service=req.body?.service_stars, product=req.body?.product_stars;
  const detailed=service!==undefined||product!==undefined;
  if(detailed&&![service,product].every(n=>Number.isInteger(n)&&n>=1&&n<=5))throw fail(400,'Califica trato y producto de 1 a 5 estrellas.');
  const stars=detailed?Math.round((service+product)/2):req.body?.stars;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order_id||'')||!Number.isInteger(stars)||stars<1||stars>5||!categories.includes(category))throw fail(400,'Elige de 1 a 5 estrellas y una categoría.');
  await transaction(db,async c=>{
   const o=(await c.query('select o.*,v.user_id as seller from food_orders o join food_vendors v on v.id=o.vendor_id where o.id=$1 for update of o',[order_id])).rows[0];
   if(!o||o.buyer_id!==req.user.id||o.seller===req.user.id||o.status!=='completed')throw fail(403,'Solo puedes calificar tus pedidos entregados.');
   const cats=(await c.query('select category from fit_vendor_categories where vendor_id=$1',[o.vendor_id])).rows.map(x=>x.category);
   if(!(cats.length?cats:['comida']).includes(category))throw fail(400,'Esa categoría no pertenece al puesto.');
   await lock(c,o.seller);
   const inserted=await c.query('insert into fit_ratings(order_id,buyer_id,vendor_id,stars,category,service_stars,product_stars) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing returning order_id',[order_id,req.user.id,o.vendor_id,stars,category,detailed?service:null,detailed?product:null]);
   if(!inserted.rows.length)throw fail(409,'Este pedido ya fue calificado.');
   const {day,week}=(await c.query("select to_char(now() at time zone 'America/Monterrey','YYYY-MM-DD') as day,to_char(date_trunc('week',now() at time zone 'America/Monterrey'),'YYYY-MM-DD') as week")).rows[0];
   const n=(await c.query("select count(*)::int n from fit_rewards where user_id=$1 and activity like 'rating:%' and (created_at at time zone 'America/Monterrey')::date=$2::date",[o.seller,day])).rows[0].n;
   if(n<5)await award(c,o.seller,'rating:'+req.user.id+':'+week,10);
  });res.json({data:{}});
 });
 r.get('/categories',async(req,res)=>res.json({data:(await db.query("select v.id,coalesce((select json_agg(category) from fit_vendor_categories where vendor_id=v.id),'[\"comida\"]'::json) categories from food_vendors v where user_id=$1",[req.user.id])).rows[0]||null}));
 r.post('/categories',async(req,res)=>{
  const list=req.body?.categories;if(!Array.isArray(list)||!list.length||list.length>5||list.some(x=>!categories.includes(x)))throw fail(400,'Elige al menos una categoría.');
  await transaction(db,async c=>{
   const v=(await c.query('select id from food_vendors where user_id=$1 for update',[req.user.id])).rows[0];if(!v)throw fail(403,'Primero registra tu puesto en Comidas.');
   await c.query('delete from fit_vendor_categories where vendor_id=$1',[v.id]);
   for(const category of new Set(list))await c.query('insert into fit_vendor_categories values($1,$2)',[v.id,category]);
  });res.json({data:{}});
 });
 r.get('/ranking',async(req,res)=>{
  const sort=req.query.sort||'score';if(!['score','reviews','stars'].includes(sort))throw fail(400,'Orden inválido.');
  const cat=req.query.category||'';if(cat&&!categories.includes(cat))throw fail(400,'Categoría inválida.');
  const rows=(await db.query(`select v.id,v.business_name,v.pickup_location,count(r.order_id)::int as votes,coalesce(avg(coalesce((r.service_stars+r.product_stars)/2.0,r.stars)),0)::float as average,
   ((coalesce(sum(coalesce((r.service_stars+r.product_stars)/2.0,r.stars)),0)+15.0)/(count(r.order_id)+5))::float as score,
   coalesce((select json_agg(category) from fit_vendor_categories where vendor_id=v.id),'["comida"]'::json) categories
   from food_vendors v left join fit_ratings r on r.vendor_id=v.id and ($1='' or r.category=$1)
   where v.status='approved' and v.is_active=true and ($1='' or exists(select 1 from fit_vendor_categories c where c.vendor_id=v.id and c.category=$1) or ($1='comida' and not exists(select 1 from fit_vendor_categories c where c.vendor_id=v.id)))
   group by v.id order by (count(r.order_id)>0) desc,${sort==='reviews'?'votes desc,average desc':sort==='stars'?'average desc,votes desc':'score desc,votes desc'},v.business_name,v.id limit 100`,[cat])).rows;
  res.json({data:rows});
 });
 r.get('/community-ranking',async(req,res)=>{
  const sort=req.query.sort||'xp',role=req.query.role||'all';
  if(!['xp','coins'].includes(sort)||!['all','student','teacher'].includes(role))throw fail(400,'Filtro inválido.');
  const rows=(await db.query(`select u.id,p.full_name,u.email,u.role,coalesce(g.xp,0)::int xp,coalesce(g.coins,0)::int coins
   from users u join profiles p on p.id=u.id left join fit_progress g on g.user_id=u.id
   where u.email_confirmed_at is not null and u.role<>'admin'
   and (u.email ~* '^a[0-9]+@alumnos\\.uat\\.edu\\.mx$' or u.email ~* '@(docentes\\.)?uat\\.edu\\.mx$')
   and ($1='all' or ($1='student' and u.email ~* '^a[0-9]+@alumnos\\.uat\\.edu\\.mx$') or ($1='teacher' and u.email ~* '@(docentes\\.)?uat\\.edu\\.mx$'))
   order by ${sort==='coins'?'coins desc,xp desc':'xp desc,coins desc'},p.full_name,u.id limit 100`,[role])).rows;
  res.json({data:rows.map((u,i)=>({position:i+1,name:u.full_name||'Integrante FIT',account_type:accountType(u.email,u.role),xp:u.xp,coins:u.coins,level:1+Math.floor(u.xp/100),is_me:u.id===req.user.id}))});
 });
 return r;
}
module.exports={createGamificationRouter,award,sync,catalog};
