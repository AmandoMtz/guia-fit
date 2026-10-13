const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const request = require('supertest');
const { createApp } = require('../server/app.cjs');
const S = require('../server/security.cjs');

const root = path.resolve(__dirname, '..');

test('chat alumno-docente: busca, persiste 7 días, aísla participantes y encola push', async t => {
  const engine = new PGlite();
  t.after(() => engine.close());
  for (const name of fs.readdirSync(path.join(root, 'backend/migrations')).sort().filter(n => n.endsWith('.sql')))
    await engine.exec(fs.readFileSync(path.join(root, 'backend/migrations', name), 'utf8'));
  const query = (sql, args) => engine.query(sql, args);
  const db = { query, connect: async () => ({ query, release() {} }) };

  const student = randomUUID(), teacher = randomUUID(), outsider = randomUUID();
  const fixtures = [
    [student, 'a2213332176@alumnos.uat.edu.mx', 'José Amando Martínez Hernández'],
    [teacher, 'maria.garcia@uat.edu.mx', 'María García Docente'],
    [outsider, 'a2213332177@alumnos.uat.edu.mx', 'Alumno Externo'],
  ];
  const tokens = new Map();
  for (const [id, email, name] of fixtures) {
    await query("insert into users(id,email,password_hash,email_confirmed_at) values($1,$2,'fixture',now())", [id, email]);
    await query('insert into profiles(id,full_name) values($1,$2)', [id, name]);
    await query('insert into institutional_verifications(user_id) values($1)', [id]);
    const token = 'tok-' + id;
    tokens.set(id, token);
    await query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')", [S.hashToken(token), id]);
  }

  const app = createApp({ db, siteUrl: 'https://fit.example.test', production: true });
  const api = request(app);
  const auth = id => ({ Authorization: 'Bearer ' + tokens.get(id) });

  const contacts = await api.get('/api/academic-chat/contacts?q=Maria').set(auth(student)).expect(200);
  assert.equal(contacts.body.data.length, 1);
  assert.equal(contacts.body.data[0].id, teacher);
  assert.equal(contacts.body.data[0].account_type, 'teacher');
  assert.equal(contacts.body.data[0].identity,'maria.garcia@uat.edu.mx');
  const studentContact=await api.get('/api/academic-chat/contacts?q=2213332176').set(auth(teacher)).expect(200);
  assert.equal(studentContact.body.data[0].identity,'2213332176');
  assert.equal(studentContact.body.data[0].full_name,'José Amando Martínez Hernández');

  const created = await api.post('/api/academic-chat/chats').set(auth(student)).send({ counterpart_id: teacher }).expect(201);
  const chatId = created.body.data.id;
  assert.match(chatId, /^[a-f0-9-]{36}$/i);

  await api.get('/api/academic-chat/chats/' + chatId).set(auth(outsider)).expect(404);

  const sent = await api.post('/api/academic-chat/chats/' + chatId + '/messages').set(auth(student)).send({ text: 'Hola profesora' }).expect(201);
  assert.equal(sent.body.data.body, 'Hola profesora');
  const stored = (await query('select body,expires_at-created_at as lifetime from academic_chat_messages where id=$1', [sent.body.data.id])).rows[0];
  assert.equal(stored.body, 'Hola profesora');

  const notice = (await query("select user_id,view_name from fit_activity_notifications where kind='academic_chat' order by created_at desc limit 1")).rows[0];
  assert.equal(notice.user_id, teacher);
  assert.equal(notice.view_name, 'messages');
  const outbox = (await query("select chat_id,payload->>'view' as view,payload->>'chatId' as payload_chat from fit_push_outbox order by next_attempt desc limit 1")).rows[0];
  assert.equal(outbox.chat_id, chatId);
  assert.equal(outbox.view, 'messages');
  assert.equal(outbox.payload_chat, chatId);

  let unread = await api.get('/api/academic-chat/unread').set(auth(teacher)).expect(200);
  assert.equal(unread.body.data.unread_count, 1);
  const detail = await api.get('/api/academic-chat/chats/' + chatId).set(auth(teacher)).expect(200);
  assert.equal(detail.body.data.messages.length, 1);
  assert.equal(detail.body.data.counterpart_identity,'2213332176');
  assert.equal(detail.body.data.messages[0].mine, false);
  unread = await api.get('/api/academic-chat/unread').set(auth(teacher)).expect(200);
  assert.equal(unread.body.data.unread_count, 0);

  // Simula un deploy: una nueva instancia usa la misma base y conserva la conversación.
  const appAfterDeploy = createApp({ db, siteUrl: 'https://fit.example.test', production: true });
  const again = await request(appAfterDeploy).get('/api/academic-chat/chats/' + chatId).set(auth(student)).expect(200);
  assert.equal(again.body.data.messages[0].body, 'Hola profesora');

  await query("update academic_chat_messages set created_at=now()-interval '8 days', expires_at=now()-interval '1 day' where id=$1", [sent.body.data.id]);
  const expired = await request(appAfterDeploy).get('/api/academic-chat/chats/' + chatId).set(auth(student)).expect(200);
  assert.equal(expired.body.data.messages.length, 0);
});
