const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const request = require('supertest');
const { createApp } = require('../server/app.cjs');
const { hashToken } = require('../server/security.cjs');

const root = path.resolve(__dirname, '..');

test('eventos: públicos cerrados, docentes, QR, asistencia y PDF validable', async (t) => {
  const engine = new PGlite();
  for (const file of fs.readdirSync(path.join(root, 'backend/migrations')).sort()) {
    if (file.endsWith('.sql')) await engine.exec(fs.readFileSync(path.join(root, 'backend/migrations', file), 'utf8'));
  }
  const query = (sql, params) => engine.query(sql, params);
  const db = { query, connect: async () => ({ query, release() {} }) };
  const api = request(createApp({ db, siteUrl: 'https://castoresfit.com' }));

  async function account(email, fullName, { role = 'user', career = null } = {}) {
    const id = randomUUID(), token = randomUUID();
    await query("insert into users(id,email,password_hash,email_confirmed_at,role) values($1,$2,'fixture',now(),$3)", [id, email, role]);
    await query('insert into profiles(id,full_name,career) values($1,$2,$3)', [id, fullName, career]);
    await query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')", [hashToken(token), id]);
    return { id, token, email, fullName };
  }
  const admin = await account('admin@example.test', 'Administración FIT', { role: 'admin' });
  const student = await account('a2213332176@alumnos.uat.edu.mx', 'Alumno Sistemas', { career: 'ING. SISTEMAS' });
  const otherStudent = await account('a2213332177@alumnos.uat.edu.mx', 'Alumno Civil', { career: 'ING. CIVIL' });
  const teacher = await account('andrea.ortega@uat.edu.mx', 'Andrea Ortega');
  const invitedTeacher = await account('numericos@docentes.uat.edu.mx', 'Docente Invitado');
  const otherTeacher = await account('calculo@uat.edu.mx', 'Docente No Invitado');
  const call = (who, method, url) => api[method](url).set('Authorization', 'Bearer ' + who.token);

  const clock = (await query(`select
    (((now() at time zone 'America/Monterrey')::date + time '12:00') at time zone 'America/Monterrey') as today_start,
    (((now() at time zone 'America/Monterrey')::date + time '14:00') at time zone 'America/Monterrey') as today_end,
    ((((now() at time zone 'America/Monterrey')::date + 1) + time '12:00') at time zone 'America/Monterrey') as tomorrow_start,
    ((((now() at time zone 'America/Monterrey')::date + 1) + time '14:00') at time zone 'America/Monterrey') as tomorrow_end`)).rows[0];
  const iso = (v) => new Date(v).toISOString();

  await t.test('la sesión expone la clasificación solicitada por correo', async () => {
    assert.equal((await call(student, 'get', '/api/auth/me').expect(200)).body.data.user.account_type, 'student');
    assert.equal((await call(teacher, 'get', '/api/auth/me').expect(200)).body.data.user.account_type, 'teacher');
    assert.equal((await call(admin, 'get', '/api/auth/me').expect(200)).body.data.user.account_type, 'admin');
  });

  let studentEvent, studentQr;
  await t.test('solo administración crea eventos estudiantiles y puede dirigirlos a varias carreras', async () => {
    const body = {
      title: 'Encuentro de Sistemas y Negocios', description: 'Evento conjunto', location: 'Auditorio',
      audience: 'students', visibility: 'targeted', starts_at: iso(clock.today_start), ends_at: iso(clock.today_end),
      careers: ['ING. SISTEMAS', 'ING. NEGOCIOS'], invitees: [],
    };
    await call(teacher, 'post', '/api/events').send(body).expect(403);
    studentEvent = (await call(admin, 'post', '/api/events').send(body).expect(201)).body.data;
    const visible = (await call(student, 'get', '/api/events').expect(200)).body.data;
    assert.ok(visible.some((x) => x.id === studentEvent.id));
    const hidden = (await call(otherStudent, 'get', '/api/events').expect(200)).body.data;
    assert.ok(!hidden.some((x) => x.id === studentEvent.id));
  });

  await t.test('QR registra una asistencia una sola vez y bloquea alumnos fuera del público', async () => {
    studentQr = (await call(admin, 'get', `/api/events/${studentEvent.id}/qr`).expect(200)).body.data;
    assert.match(studentQr.svg, /^<svg/);
    assert.match(studentQr.payload, /^https:\/\/castoresfit\.com\/\?e=/);
    const first = await call(student, 'post', '/api/events/checkin').send({ token: studentQr.token }).expect(200);
    assert.equal(first.body.data.already_registered, false);
    const duplicate = await call(student, 'post', '/api/events/checkin').send({ token: studentQr.token }).expect(200);
    assert.equal(duplicate.body.data.already_registered, true);
    await call(otherStudent, 'post', '/api/events/checkin').send({ token: studentQr.token }).expect(403);
    const rows = (await call(admin, 'get', `/api/events/${studentEvent.id}/attendees`).expect(200)).body.data;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, student.email);
  });

  await t.test('la verificación se cierra fuera del día del evento', async () => {
    const future = (await call(admin, 'post', '/api/events').send({
      title: 'Evento de mañana', description: '', location: 'Sala 1', audience: 'students', visibility: 'public',
      starts_at: iso(clock.tomorrow_start), ends_at: iso(clock.tomorrow_end), careers: [], invitees: [],
    }).expect(201)).body.data;
    const qr = (await call(admin, 'get', `/api/events/${future.id}/qr`).expect(200)).body.data;
    await call(student, 'post', '/api/events/checkin').send({ token: qr.token }).expect(400);
  });

  await t.test('historial personal y lista administrativa generan PDF con código validable', async () => {
    const history = (await call(student, 'get', '/api/events/attendance/me').expect(200)).body.data;
    assert.equal(history.length, 1);
    const personal = await call(student, 'get', '/api/events/attendance/me.pdf').expect(200).expect('Content-Type', /pdf/);
    assert.equal(personal.body.subarray(0, 4).toString(), '%PDF');
    const personalCode = personal.body.toString('latin1').match(/FIT-\d{4}-[A-F0-9]{12}/)?.[0];
    assert.ok(personalCode);
    const validation = await api.get('/api/events/documents/' + personalCode).expect(200);
    assert.equal(validation.body.data.valid, true);
    assert.equal(validation.body.data.document_type, 'my_attendance');

    const attendeesPdf = await call(admin, 'get', `/api/events/${studentEvent.id}/attendees.pdf`).expect(200).expect('Content-Type', /pdf/);
    const attendeeCode = attendeesPdf.body.toString('latin1').match(/FIT-\d{4}-[A-F0-9]{12}/)?.[0];
    assert.ok(attendeeCode);
    const attendeeValidation = await api.get('/api/events/documents/' + attendeeCode).expect(200);
    assert.equal(attendeeValidation.body.data.document_type, 'event_attendees');
    assert.equal(attendeeValidation.body.data.item_count, 1);
  });

  let teacherEvent;
  await t.test('un docente crea un evento cerrado e invita docentes registrados', async () => {
    teacherEvent = (await call(teacher, 'post', '/api/events').send({
      title: 'Junta docente', description: 'Reunión académica', location: 'Sala de maestros', audience: 'teachers', visibility: 'targeted',
      starts_at: iso(clock.today_start), ends_at: iso(clock.today_end), careers: [], invitees: [invitedTeacher.id],
    }).expect(201)).body.data;
    const invited = (await call(invitedTeacher, 'get', '/api/events').expect(200)).body.data;
    assert.ok(invited.some((x) => x.id === teacherEvent.id));
    const hidden = (await call(otherTeacher, 'get', '/api/events').expect(200)).body.data;
    assert.ok(!hidden.some((x) => x.id === teacherEvent.id));
    await call(invitedTeacher, 'patch', `/api/events/${teacherEvent.id}`).send({
      title: 'Intento', description: '', location: 'Sala', audience: 'teachers', visibility: 'public',
      starts_at: iso(clock.today_start), ends_at: iso(clock.today_end), careers: [], invitees: [],
    }).expect(403);
  });

  await t.test('el creador docente puede reagendar y el QR anterior queda invalidado', async () => {
    const oldQr = (await call(teacher, 'get', `/api/events/${teacherEvent.id}/qr`).expect(200)).body.data;
    await call(invitedTeacher, 'post', '/api/events/checkin').send({ token: oldQr.token }).expect(200);
    await call(teacher, 'patch', `/api/events/${teacherEvent.id}`).send({
      title: 'Junta docente reagendada', description: 'Reunión académica', location: 'Sala de maestros', audience: 'teachers', visibility: 'targeted',
      starts_at: iso(clock.tomorrow_start), ends_at: iso(clock.tomorrow_end), careers: [], invitees: [invitedTeacher.id],
    }).expect(200);
    await call(invitedTeacher, 'post', '/api/events/checkin').send({ token: oldQr.token }).expect(400);
    const nextQr = (await call(teacher, 'get', `/api/events/${teacherEvent.id}/qr`).expect(200)).body.data;
    assert.notEqual(nextQr.token, oldQr.token);
  });

  await engine.close();
});
