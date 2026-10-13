'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {randomUUID,createECDH,randomBytes}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite'),request=require('supertest');
const {createApp}=require('../server/app.cjs'),{hashToken}=require('../server/security.cjs');
const {campusClock,dueClasses,queueClassReminders}=require('../server/class-reminders.cjs');
const {createPushService}=require('../server/push.cjs');
test('campus clock, valid hours, five-minute catch-up and ended classes',()=>{
 const clock=campusClock(new Date('2026-10-13T14:02:00Z'));
 assert.deepEqual(clock,{date:'2026-10-13',day:2,minute:482});
 const c={day:2,start:'08:00',end:'09:00',subject:'Matemáticas'};
 assert.equal(dueClasses({classes:[c]},clock).length,1);
 for(const change of [{day:1},{end:'08:01'},{start:'8 am'},{start:'08:03'},{end:'25:00'}])assert.equal(dueClasses({classes:[{...c,...change}]},clock).length,0);
 assert.equal(dueClasses({classes:[c]},{...clock,minute:485}).length,0);
 assert.equal(campusClock(new Date('2026-10-13T05:59:00Z')).date,'2026-10-12');
});
test('identity, reviewed sheet, reminders, admin broadcast authorization and device fan-out',async t=>{
 const engine=new PGlite();t.after(()=>engine.close());
 for(const file of fs.readdirSync(path.join(__dirname,'../backend/migrations')).filter(x=>x.endsWith('.sql')).sort())await engine.exec(fs.readFileSync(path.join(__dirname,'../backend/migrations',file),'utf8'));
 const query=(sql,args)=>engine.query(sql,args),db={query,connect:async()=>({query,release(){}})};
 const app=createApp({db,siteUrl:'https://fit.example.test'});t.after(()=>app.locals.fitPush.stop());const api=request(app);
 async function account(n,role='user'){
  const id=randomUUID(),token=randomUUID();
  await query("insert into users(id,email,password_hash,email_confirmed_at,role) values($1,$2,'test',now(),$3)",[id,`a${n}@alumnos.uat.edu.mx`,role]);
  await query("insert into profiles(id,full_name) values($1,'Nombre original')",[id]);
  await query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')",[hashToken(token),id]);
  return {id,token,auth:{Authorization:'Bearer '+token}};
 }
 const student=await account(100),other=await account(200),admin=await account(300,'admin');
 const profile={full_name:'Lexiss Lorenzo Sánchez',username:'Windsumi',student_id:null};
 await api.patch('/api/data/profiles').set(student.auth).send(profile).expect(200);
 await api.patch('/api/data/profiles').set(other.auth).send({...profile,username:'windsumi'}).expect(409);
 await api.patch('/api/data/profiles').set(student.auth).send({...profile,username:'bad handle'}).expect(400);
 let saved=(await query('select * from profiles where id=$1',[student.id])).rows[0];assert.equal(saved.username,'Windsumi');assert.equal(saved.full_name,profile.full_name);
 const sheet={userId:student.id,studentName:'Nombre de la ficha',accountType:'student',classes:[{id:'a',day:2,start:'08:00',end:'09:00',subject:'Matemáticas',classroom:'401'}]};
 await api.put('/api/schedule').set(student.auth).send({revision:0,data:sheet}).expect(200);
 saved=(await query('select * from profiles where id=$1',[student.id])).rows[0];assert.equal(saved.full_name,sheet.studentName);assert.equal(saved.username,'Windsumi');
 await api.patch('/api/data/profiles').set(student.auth).send(profile).expect(200);
 await api.put('/api/schedule').set(student.auth).send({revision:1,data:{...sheet,career:'Sistemas'}}).expect(200);
 assert.equal((await query('select full_name from profiles where id=$1',[student.id])).rows[0].full_name,profile.full_name,'An unchanged imported name must not revert a manual correction');
 await api.put('/api/schedule').set(student.auth).send({revision:1,data:{...sheet,studentName:'Obsoleto'}}).expect(409);
 assert.equal((await query('select full_name from profiles where id=$1',[student.id])).rows[0].full_name,profile.full_name);
 const timedDb={query:(sql,args)=>sql==='select now() as now'?Promise.resolve({rows:[{now:'2026-10-13T14:02:00Z'}]}):query(sql,args)};
 await queueClassReminders(timedDb);await queueClassReminders(timedDb);
 let notices=(await query("select * from fit_activity_notifications where kind='class_start'")).rows;assert.equal(notices.length,1);assert.equal(notices[0].user_id,student.id);
 let jobs=(await query("select payload,expires_at from fit_push_outbox where id=$1",[notices[0].id])).rows;assert.equal(jobs[0].payload.view,'schedule');assert.equal(jobs[0].payload.title,'Tu clase está comenzando');
 await api.patch('/api/push/preferences').set(student.auth).send({class_reminders:false}).expect(200);
 await query('delete from fit_class_notice_keys');await queueClassReminders(timedDb);
 assert.equal((await query("select count(*)::int n from fit_activity_notifications where kind='class_start'")).rows[0].n,1);
 await api.post('/api/push/admin/test').set(student.auth).send({}).expect(403);
 await api.get('/api/push/admin/status').set(student.auth).expect(403);
 await api.post('/api/push/admin/test').send({}).expect(401);
 for(let i=0;i<2;i++){
  const ec=createECDH('prime256v1');ec.generateKeys();
  await query('insert into fit_push_subscriptions(endpoint,user_id,session_hash,p256dh,auth) values($1,$2,$3,$4,$5)',[`https://fcm.googleapis.com/fcm/send/test${i}`,student.id,hashToken(student.token),ec.getPublicKey().toString('base64url'),randomBytes(16).toString('base64url')]);
 }
 let status=await api.get('/api/push/admin/status').set(admin.auth).expect(200);assert.equal(status.body.data.devices,2);assert.equal(status.body.data.users,1);
 const broadcast=await api.post('/api/push/admin/test').set(admin.auth).send({}).expect(200);app.locals.fitPush.stop();assert.equal(broadcast.body.data.queued,1);
 // Remove class job to isolate the test broadcast; external push is always mocked.
 await query("delete from fit_push_outbox where payload->>'view'='schedule'");
 const sends=[];const service=createPushService({db,siteUrl:'https://fit.example.test',transport:{sendNotification:async(sub,payload)=>sends.push({sub,payload:JSON.parse(payload)})}});t.after(()=>service.stop());
 await service.run();assert.equal(sends.length,2);assert.ok(sends.every(x=>x.payload.recipientId===student.id));
 assert.equal((await api.get('/api/push/admin/status').set(admin.auth)).body.data.pending,0);
});

test('two-line identity escapes untrusted names and keeps the full handle',()=>{
 const {identityHtml}=require('../web/dist/js/core.js');
 assert.equal(identityHtml('Lexiss Lorenzo Sánchez · @Windsumi'),'<span class="fit-identity">Lexiss Lorenzo Sánchez<small class="fit-handle">@Windsumi</small></span>');
 assert.ok(!identityHtml('<img onerror=alert(1)> · @Windsumi').includes('<img'));
});
