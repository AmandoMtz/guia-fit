const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const request=require('supertest');
const {randomUUID}=require('node:crypto');
const {createApp}=require('../server/app.cjs');
const S=require('../server/security.cjs');
test('Auditorio: solo admin, filtros, paginación, texto persistente y secretos excluidos',async t=>{
 const engine=new PGlite();t.after(()=>engine.close());
 for(const file of fs.readdirSync(path.join(__dirname,'../backend/migrations')).filter(f=>f.endsWith('.sql')).sort())await engine.exec(fs.readFileSync(path.join(__dirname,'../backend/migrations',file),'utf8'));
 const query=(sql,args)=>engine.query(sql,args),db={query,connect:async()=>({query,release(){}})};
 const ids=[randomUUID(),randomUUID(),randomUUID()];
 for(let i=0;i<3;i++){
  await query("insert into users(id,email,password_hash,role,email_confirmed_at) values($1,$2,'SECRET',$3,now())",[ids[i],['admin@example.test','a123@alumnos.uat.edu.mx','profe@uat.edu.mx'][i],i===0?'admin':'user']);
  await query('insert into profiles(id,full_name) values($1,$2)',[ids[i],['Administración','Estudiante Prueba','Docente Prueba'][i]]);
  await query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')",[S.hashToken(ids[i]),ids[i]]);
 }
 const api=request(createApp({db,siteUrl:'https://fit.example.test',production:true}));
 const auth=i=>({Authorization:'Bearer '+ids[i]});
 await api.get('/api/admin/audit').expect(401);
 for(const i of [1,2])await api.get('/api/admin/audit').set(auth(i)).expect(403);
 const chat=(await api.post('/api/academic-chat/chats').set(auth(1)).send({counterpart_id:ids[2]}).expect(201)).body.data;
 const msg=(await api.post(`/api/academic-chat/chats/${chat.id}/messages`).set(auth(1)).send({text:'Mensaje <script> de prueba'}).expect(201)).body.data;
 const filtered=await api.get('/api/admin/audit?group=chats&action=MESSAGE&search=Mensaje').set(auth(0)).expect(200);
 assert.match(filtered.headers['cache-control'],/no-store/);
 assert.equal(filtered.body.data.items.length,1);assert.equal(filtered.body.data.items[0].actor_id,ids[1]);assert.equal(filtered.body.data.items[0].after_data.body,'Mensaje <script> de prueba');
 await query('delete from academic_chat_messages where id=$1',[msg.id]);
 assert.equal((await request(createApp({db,siteUrl:'https://fit.example.test'})).get('/api/admin/audit?group=chats&action=MESSAGE').set(auth(0))).body.data.items.length,1);
 for(const suffix of ['group=bad','from=2026-02-30','before=-1','before=9999999999999999999','action=bad'])await api.get('/api/admin/audit?'+suffix).set(auth(0)).expect(400);
 const logs=await api.get('/api/admin/audit?group=accounts').set(auth(0)).expect(200);assert.ok(!JSON.stringify(logs.body).includes('SECRET'));assert.ok(!JSON.stringify(logs.body).includes('token_hash'));
 for(let i=0;i<55;i++)await query("insert into audit_log(action,entity,record_id) values('INSERT','places',$1)",['test'+i]);
 const first=(await api.get('/api/admin/audit?group=campus').set(auth(0))).body.data;
 assert.equal(first.items.length,50);assert.ok(first.next);
 const second=(await api.get('/api/admin/audit?group=campus&before='+first.next).set(auth(0))).body.data;
 assert.equal(second.items.length,5);assert.ok(!second.next);assert.ok(!first.items.some(a=>second.items.some(b=>a.id===b.id)));
 await assert.rejects(query('delete from audit_log'),/append-only/);
});
test('Pantalla: contenido escapado, filtros y navegación entre páginas',async()=>{
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<div id="view"></div>',{runScripts:'outside-only'});
 const w=dom.window;w.eval(fs.readFileSync(path.join(__dirname,'../web/dist/js/audit.js'),'utf8'));
 const calls=[];const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 w.FIT_AUDIT.render({state:{admin:true,view:'audit'},esc,client:{async request(url){calls.push(url);return {data:{items:[{id:'5',entity:'academic_chat_content',action:'MESSAGE',created_at:new Date().toISOString(),after_data:{body:'<img src=x onerror=alert(1)>'}}],next:calls.length===1?'5':null}};}}});
 await new Promise(r=>setImmediate(r));assert.equal(w.document.querySelectorAll('#audit-results img').length,0);assert.match(w.document.querySelector('#audit-results').textContent,/<img/);
 w.document.querySelector('#audit-next').click();await new Promise(r=>setImmediate(r));assert.match(calls[1],/before=5/);
 w.document.querySelector('[name=search]').value='Docente';w.document.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));assert.match(calls[2],/search=Docente/);assert.ok(!calls[2].includes('before='));dom.window.close();
});
