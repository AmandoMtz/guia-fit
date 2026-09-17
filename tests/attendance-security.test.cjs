const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite'),request=require('supertest');
const {createApp}=require('../server/app.cjs'),{hashToken}=require('../server/security.cjs');
const {checkLocation}=require('../server/attendance-security.cjs');
const {geo,enroll,proof}=require('./fixtures/attendance.cjs');
test('geocerca: frontera conservadora, precisión, valores inválidos y antigüedad',()=>{
 const loc={latitude:geo.latitude,longitude:geo.longitude,accuracy:5,timestamp:Date.now()};
 assert.ok(checkLocation(geo,loc).distance<0.1);
 for(const change of [{latitude:23},{longitude:NaN},{latitude:null},{accuracy:0},{accuracy:31},{timestamp:Date.now()-31000},{timestamp:Date.now()+10000}])assert.throws(()=>checkLocation(geo,{...loc,...change}));
 assert.throws(()=>checkLocation({...geo,latitude:null},loc));
 assert.throws(()=>checkLocation({...geo,radius_m:3},loc));
});
test('asistencia protegida, bitácora atómica y notificaciones por destinatario',async t=>{
 const engine=new PGlite();
 for(const file of fs.readdirSync(path.join(__dirname,'../backend/migrations')).sort())await engine.exec(fs.readFileSync(path.join(__dirname,'../backend/migrations',file),'utf8'));
 // PGlite has one connection: emulate a pool with exclusive clients for concurrent transactions.
 let tail=Promise.resolve();async function acquire(){let release;const prior=tail;tail=new Promise(r=>release=r);await prior;return release;}
 const db={async query(sql,args){const release=await acquire();try{return await engine.query(sql,args);}finally{release();}},async connect(){const release=await acquire();return {query:(...a)=>engine.query(...a),release};}};
 const app=createApp({db,siteUrl:'https://fit.example.test'}),api=request(app);
 t.after(async()=>{app.locals.fitPush.stop();await tail;await engine.close();});
 async function account(email,role='user'){
 const id=randomUUID(),token=randomUUID();await db.query("insert into users(id,email,password_hash,role,email_confirmed_at) values($1,$2,'DO_NOT_LOG_PASSWORD',$3,now())",[id,email,role]);await db.query("insert into profiles(id,full_name,career) values($1,'Prueba FIT','Sistemas')",[id]);await db.query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')",[hashToken(token),id]);return {id,token};
 }
 const admin=await account('admin@test.example','admin'),student=await account('a100@alumnos.uat.edu.mx'),other=await account('a101@alumnos.uat.edu.mx');
 const call=(who,method,url)=>api[method](url).set('Authorization','Bearer '+who.token);
 const key=await enroll(call,student,admin);
 const body={...geo,title:'Evento protegido',location:'Auditorio',audience:'students',visibility:'public',starts_at:new Date(Date.now()-60000),ends_at:new Date(Date.now()+3600000)};
 const event=(await call(admin,'post','/api/events').send(body).expect(201)).body.data;
 const token=(await call(admin,'post',`/api/events/${event.id}/qr`).expect(200)).body.data.token;
 await t.test('la clave del compañero no puede vincularse a otra cuenta',async()=>{
 await call(other,'post','/api/attendance-security/device').send({public_key:key.publicKey.export({format:'jwk'})}).expect(403);
 await call(other,'post','/api/attendance-security/challenge').send({device_id:key.id,token}).expect(403);
 await call(student,'patch','/api/attendance-security/devices/'+key.id).send({status:'approved',reason:'Intento de aprobación'}).expect(403);
 });
 await t.test('QR compartido, falta de GPS, firma alterada y lectura antigua no registran',async()=>{
 await call(student,'post','/api/events/checkin').send({token}).expect(403);
 for(const override of [{latitude:23},{accuracy:80},{timestamp:Date.now()-60000}])await call(student,'post','/api/events/checkin').send(await proof(call,student,key,token,override)).expect(403);
 const tampered=await proof(call,student,key,token);tampered.location.latitude+=0.00001;
 const response=await call(student,'post','/api/events/checkin').send(tampered).expect(403);assert.equal(response.body.error.code,'invalid_signature');
 assert.equal((await db.query('select count(*)::int n from event_attendance')).rows[0].n,0);
 });
 await t.test('una prueba de dispositivo no puede reutilizarse, incluso simultáneamente',async()=>{
 const p=await proof(call,student,key,token);
 const results=await Promise.all([call(student,'post','/api/events/checkin').send(p),call(student,'post','/api/events/checkin').send(p)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,403]);
 assert.equal((await db.query('select count(*)::int n from event_attendance')).rows[0].n,1);
 const log=(await db.query("select * from audit_log where entity='event_attendance' and action='INSERT'")).rows;
 assert.equal(log.length,1);assert.equal(log[0].actor_id,student.id);assert.ok(log[0].request_id);
 assert.ok(log[0].after_data.device_id);assert.ok(log[0].after_data.distance_m<0.1);
 });
 await t.test('revocación y horarios no pueden saltarse con un QR vigente',async()=>{
 const p=await proof(call,student,key,token);
 await call(admin,'patch','/api/attendance-security/devices/'+key.id).send({status:'revoked',reason:'Teléfono reportado perdido'}).expect(200);
 await call(student,'post','/api/events/checkin').send(p).expect(403);
 await call(admin,'patch','/api/attendance-security/devices/'+key.id).send({status:'approved',reason:'Identidad verificada nuevamente'}).expect(200);
 await db.query("update events set ends_at=now()-interval '1 second' where id=$1",[event.id]);
 const r=await call(student,'post','/api/events/checkin').send(await proof(call,student,key,token)).expect(400);assert.equal(r.body.error.code,'checkin_closed');
 await db.query("update events set latitude=null,ends_at=now()+interval '1 hour' where id=$1",[event.id]);
 const missing=await call(student,'post','/api/events/checkin').send(await proof(call,student,key,token)).expect(403);assert.equal(missing.body.error.code,'geofence_missing');
 });
 await t.test('auditoría restringida, sin secretos y resistente a edición; rollback no deja cambios falsos',async()=>{
 await call(student,'get','/api/attendance-security/audit').expect(403);
 const r=await call(admin,'get','/api/attendance-security/audit?entity=event_attendance').expect(200);assert.equal(r.body.data.length,1);
 const all=JSON.stringify((await db.query('select * from audit_log')).rows);
 assert.ok(!all.includes('DO_NOT_LOG_PASSWORD'));assert.ok(!all.includes(token));assert.ok(!all.includes(hashToken(student.token)));
 await assert.rejects(db.query("delete from audit_log"));await assert.rejects(db.query("truncate audit_log"));
 const c=await db.connect();await c.query('begin');await c.query("update profiles set full_name='Cambio revertido' where id=$1",[student.id]);await c.query('rollback');c.release();
 assert.equal((await db.query("select count(*)::int n from audit_log where after_data->>'full_name'='Cambio revertido'")).rows[0].n,0);
 });
 await t.test('avisos de asistencia y evento quedan en cola y cada usuario solo consulta los suyos',async()=>{
 const mine=(await call(student,'get','/api/push/activity').expect(200)).body.data;
 assert.ok(mine.some(n=>n.kind==='event_attendance'));assert.ok(mine.some(n=>n.kind==='event'));
 const theirs=(await call(other,'get','/api/push/activity').expect(200)).body.data;assert.ok(!theirs.some(n=>n.kind==='event_attendance'));
 const queued=(await db.query("select * from fit_push_outbox where user_id=$1 and payload->>'body'='Tu asistencia al evento quedó registrada.'",[student.id])).rows;
 assert.equal(queued.length,1);
 const notice=mine.find(n=>n.kind==='event_attendance');await call(other,'patch','/api/push/activity/read').send({}).expect(200);
 assert.equal((await db.query('select read_at from fit_activity_notifications where id=$1',[notice.id])).rows[0].read_at,null);
 });
});
