const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite'),request=require('supertest');
const {createApp}=require('../server/app.cjs'),S=require('../server/security.cjs');
const {effectiveStatus}=require('../server/presence.cjs');
test('presencia: límite de 10 minutos, estados manuales y pérdida de conexión',()=>{
 const now=1000000;
 assert.equal(effectiveStatus('online',now,now-599999,now),'online');
 assert.equal(effectiveStatus('online',now,now-600000,now),'away');
 for(const mode of ['away','dnd','offline'])assert.equal(effectiveStatus(mode,now,now,now),mode);
 assert.equal(effectiveStatus('online',now-90001,now,now),'offline');
});
test('presencia autenticada, varias pestañas, preferencias persistentes y cierre de sesión',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 for(const name of fs.readdirSync(path.join(__dirname,'../backend/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec(fs.readFileSync(path.join(__dirname,'../backend/migrations',name),'utf8'));
 const user=randomUUID(),token='presence-test',hash=S.hashToken(token),a=randomUUID(),b=randomUUID();
 await db.query("insert into users(id,email,password_hash,email_confirmed_at) values($1,'presence@uat.edu.mx','fixture',now())",[user]);
 await db.query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')",[hash,user]);
 const query=(sql,args)=>db.query(sql,args);
 const pool={query,connect:async()=>({query,release(){}})};
 const api=request(createApp({db:pool,siteUrl:'https://fit.example.test',production:true}));
 const auth={Authorization:'Bearer '+token};
 const beat=(tab,idle,mode)=>api.post('/api/presence').set(auth).send({tab_id:tab,idle_ms:idle,...(mode?{mode}:{})});
 const status=async()=>{const res=await api.get('/api/presence?ids='+user).set(auth).expect(200);return res.body.data[0].status;};
 await api.get('/api/presence?ids='+user).expect(401);
 await beat(a,0).expect(200);assert.equal(await status(),'online');
 await beat(a,600100).expect(200);assert.equal(await status(),'away');
 await beat(b,0).expect(200);assert.equal(await status(),'online');
 for(const mode of ['away','dnd','offline']){await beat(a,0,mode).expect(200);await beat(b,0).expect(200);assert.equal(await status(),mode);}
 await beat(a,0,'online').expect(200);
 await api.delete('/api/presence/'+a).set(auth).expect(200);assert.equal(await status(),'online');
 await db.query("update user_presence_sessions set seen_at=now()-interval '2 minutes'");assert.equal(await status(),'offline');
 await beat(b,0,'fake').expect(400);
 await db.query('delete from sessions where token_hash=$1',[hash]);
 assert.equal((await db.query('select * from user_presence_sessions')).rows.length,0);
 await beat(a,0).expect(401);
});
