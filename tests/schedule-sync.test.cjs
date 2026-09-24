const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite'),request=require('supertest');
const {randomUUID}=require('node:crypto');const {createApp}=require('../server/app.cjs');const {hashToken}=require('../server/security.cjs');
test('Horarios: respaldo por cuenta, otro despliegue, conflictos y borrado persistente; registro docente',async t=>{
 const engine=new PGlite();t.after(()=>engine.close());for(const n of fs.readdirSync(path.join(__dirname,'../backend/migrations')).filter(n=>n.endsWith('.sql')).sort())await engine.exec(fs.readFileSync(path.join(__dirname,'../backend/migrations',n),'utf8'));
 const query=(s,a)=>engine.query(s,a),db={query,connect:async()=>({query,release(){}})},emails=[];
 const make=()=>createApp({db,production:true,siteUrl:'https://fit.example.test',sendMail:async m=>emails.push(m)});const api=request(make());
 const ids=[randomUUID(),randomUUID()];for(const id of ids){await query("insert into users(id,email,password_hash,email_confirmed_at) values($1,$2,'x',now())",[id,id+'@test.mx']);await query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')",[hashToken(id),id]);}
 const auth=i=>({Authorization:'Bearer '+ids[i]});const data={userId:ids[0],studentName:'Alumno Apellidos',reviewedAt:new Date().toISOString(),classes:[{id:'c1',subject:'Cálculo',day:1,start:'08:00',end:'09:00'}]};
 await api.get('/api/schedule').expect(401);
 await api.put('/api/schedule').set(auth(1)).send({data,revision:0}).expect(400);
 const saved=(await api.put('/api/schedule').set(auth(0)).send({data,revision:0}).expect(200)).body.data;assert.equal(saved.revision,1);
 const restored=(await request(make()).get('/api/schedule').set(auth(0)).expect(200)).body.data;assert.equal(restored.data.classes[0].subject,'Cálculo');
 assert.equal((await api.get('/api/schedule').set(auth(1))).body.data.data,null);
 await api.put('/api/schedule').set(auth(0)).send({data,revision:1}).expect(200);
 await api.put('/api/schedule').set(auth(0)).send({data,revision:1}).expect(409);
 await api.delete('/api/schedule').set(auth(0)).send({revision:2}).expect(200);
 assert.equal((await request(make()).get('/api/schedule').set(auth(0))).body.data.data,null);
 const email='Prueba@DOCENTES.UAT.EDU.MX',password='PruebaSegura1!';
 await api.post('/api/auth/register').send({email,full_name:'María García López',password}).expect(201);
 const mail=emails.find(e=>e.email==='prueba@docentes.uat.edu.mx');assert.ok(mail);assert.equal(mail.purpose,'confirm');
 await api.post('/api/auth/confirm').send({token:mail.token}).expect(200);
 const login=await api.post('/api/auth/login').send({email,password}).expect(200);assert.equal(login.body.data.user.account_type,'teacher');
});
