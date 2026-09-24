const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite'),request=require('supertest'),{createApp}=require('../server/app.cjs'),{hashToken}=require('../server/security.cjs');
test('administración: lista restringida, entrega auditada y reintento sin duplicados',async()=>{
 const engine=new PGlite();try{
 for(const f of fs.readdirSync(path.join(__dirname,'../backend/migrations')).sort())await engine.exec(fs.readFileSync(path.join(__dirname,'../backend/migrations',f),'utf8'));
 const query=(s,p)=>engine.query(s,p);let tail=Promise.resolve();const db={query,connect:async()=>{const before=tail;let release;tail=new Promise(r=>release=r);await before;return{query,release};}};
 const api=request(createApp({db,siteUrl:'https://castoresfit.com'}));
 async function make(role){const id=randomUUID(),token=randomUUID();await query("insert into users(id,email,password_hash,email_confirmed_at,role) values($1,$2,'fixture',now(),$3)",[id,id+'@uat.edu.mx',role]);await query("insert into profiles(id,full_name) values($1,'Persona FIT')",[id]);await query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')",[hashToken(token),id]);return{id,token};}
 const admin=await make('admin'),user=await make('user');const call=(u,m,p)=>api[m](p).set('Authorization','Bearer '+u.token);
 await api.get('/api/admin/users').expect(401);await call(user,'get','/api/admin/users').expect(403);
 const listed=(await call(admin,'get','/api/admin/users').expect(200)).body.data.users;assert.equal(listed.length,2);assert.ok(!JSON.stringify(listed).includes('password_hash'));
 const url='/api/admin/users/'+user.id+'/benefits',body={request_id:randomUUID(),coins:70,xp:100,item:'frame-ruby',note:'Reconocimiento de prueba'};
 await call(user,'post',url).send(body).expect(403);
 await Promise.all([call(admin,'post',url).send(body).expect(200),call(admin,'post',url).send(body).expect(200)]);
 const p=(await query('select xp,coins from fit_progress where user_id=$1',[user.id])).rows[0];assert.deepEqual(p,{xp:100,coins:120});
 assert.equal((await query('select count(*)::int n from admin_benefit_grants')).rows[0].n,1);
 await call(admin,'post',url).send({...body,coins:500}).expect(409);
 await call(admin,'post',url).send({...body,request_id:randomUUID(),xp:-1}).expect(400);
 }finally{await engine.close();}
});
