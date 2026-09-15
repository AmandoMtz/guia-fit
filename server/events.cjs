const express = require("express");
const { randomBytes } = require("node:crypto");
const { transaction } = require("./db.cjs");
const { accountType } = require("./account.cjs");
const { hashToken } = require("./security.cjs");
const { svg: qrSvg } = require("./qr.cjs");
const { createPdf } = require("./pdf.cjs");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const clean = (v, max = 2500) => String(v ?? "").trim().slice(0, max);
const QR_DEFAULT_HOURS = 6;
const QR_MAX_HOURS = 168;
function qrDuration(value, fallback = QR_DEFAULT_HOURS) {
  const raw = value === undefined || value === null || value === "" ? fallback : Number(value);
  if (!Number.isInteger(raw) || raw < 1 || raw > QR_MAX_HOURS)
    throw fail(400, "validation_error", `La duración del QR debe ser de 1 a ${QR_MAX_HOURS} horas.`);
  return raw;
}
async function managedEvent(db, id, user) {
  if (!UUID.test(id)) throw fail(404, "not_found", "Evento no encontrado.");
  const event = (await db.query("select * from events where id=$1", [id])).rows[0];
  if (!event) throw fail(404, "not_found", "Evento no encontrado.");
  if (!(await canManage(db, event, user))) throw fail(403, "forbidden", "No puedes administrar el QR de este evento.");
  return event;
}
function qrPayloadData(siteUrl, tokenRow, eventDay) {
  const directLink = `${String(siteUrl || "").replace(/\/$/, "")}/?e=${tokenRow.token_value}`;
  const payload = Buffer.byteLength(directLink, "utf8") <= 53
    ? directLink
    : `FIT-EVENT:${tokenRow.token_value}`;
  return {
    token: tokenRow.token_value,
    payload,
    svg: qrSvg(payload),
    expires_at: tokenRow.expires_at,
    duration_hours: Number(tokenRow.duration_hours || QR_DEFAULT_HOURS),
    active: tokenRow.active === true || tokenRow.active === "t",
    event_day: eventDay,
  };
}
async function eventDay(db, startsAt) {
  // `day` puede ser interpretado como palabra reservada por algunos motores
  // compatibles con PostgreSQL (por ejemplo PGlite). Usamos un alias explícito.
  return (await db.query("select to_char($1::timestamptz at time zone 'America/Monterrey','YYYY-MM-DD') as event_day", [startsAt])).rows[0].event_day;
}
async function currentQr(db, eventId) {
  return (await db.query("select token_value,expires_at,duration_hours,(expires_at>now()) as active from event_checkin_tokens where event_id=$1", [eventId])).rows[0] || null;
}
async function issueQr(db, event, userId, { action = "generate", durationHours } = {}) {
  const existing = await currentQr(db, event.id);
  if (!["generate", "extend", "regenerate"].includes(action))
    throw fail(400, "validation_error", "Acción de QR no válida.");
  if (action === "extend" && !existing)
    throw fail(404, "not_found", "Este evento todavía no tiene un QR para extender.");
  const hours = qrDuration(durationHours, existing?.duration_hours || QR_DEFAULT_HOURS);
  const preserveToken = !!existing && action !== "regenerate";
  const token = preserveToken ? existing.token_value : randomBytes(16).toString("base64url");
  return (await db.query(`insert into event_checkin_tokens(event_id,token_hash,token_value,created_by,expires_at,duration_hours)
    values($1,$2,$3,$4,now()+($5::int * interval '1 hour'),$5)
    on conflict(event_id) do update set token_hash=excluded.token_hash,token_value=excluded.token_value,created_by=excluded.created_by,created_at=now(),expires_at=excluded.expires_at,duration_hours=excluded.duration_hours
    returning token_value,expires_at,duration_hours,(expires_at>now()) as active`, [event.id, hashToken(token), token, userId, hours])).rows[0];
}
const isTeacherEmail = (email) => {
  const e = String(email || "").toLowerCase();
  return /@docentes\.uat\.edu\.mx$/.test(e) || (/@uat\.edu\.mx$/.test(e) && !/@alumnos\.uat\.edu\.mx$/.test(e));
};
const isStudentEmail = (email) => /^a\d+@alumnos\.uat\.edu\.mx$/i.test(String(email || "").trim());
function documentCode() {
  return `FIT-${new Date().getFullYear()}-${randomBytes(6).toString("hex").toUpperCase()}`;
}
function eventPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw fail(400, "validation_error", "Completa los datos del evento.");
  const title = clean(body.title, 160), description = clean(body.description, 2500), location = clean(body.location, 180);
  const audience = body.audience, visibility = body.visibility || "public";
  const starts = new Date(body.starts_at), ends = new Date(body.ends_at);
  if (title.length < 3 || location.length < 2 || !["students", "teachers"].includes(audience) || !["public", "targeted"].includes(visibility) || Number.isNaN(starts.valueOf()) || Number.isNaN(ends.valueOf()) || ends <= starts)
    throw fail(400, "validation_error", "Revisa título, lugar, público y fecha del evento.");
  const careers = [...new Set((Array.isArray(body.careers) ? body.careers : []).map((x) => clean(x, 160)).filter((x) => x.length >= 2))].slice(0, 30);
  const invitees = [...new Set((Array.isArray(body.invitees) ? body.invitees : []).filter((x) => UUID.test(String(x))))].slice(0, 200);
  if (visibility === "targeted" && audience === "students" && !careers.length) throw fail(400, "validation_error", "Selecciona al menos una carrera para el evento cerrado.");
  if (visibility === "targeted" && audience === "teachers" && !invitees.length) throw fail(400, "validation_error", "Invita al menos a un docente para el evento cerrado.");
  return { title, description, location, audience, visibility, starts_at: starts.toISOString(), ends_at: ends.toISOString(), careers, invitees };
}
async function canManage(db, event, user) {
  if (user.role === "admin") return true;
  return event.audience === "teachers" && event.created_by === user.id && accountType(user.email, user.role) === "teacher";
}
async function replaceTargets(client, id, data) {
  await client.query("delete from event_careers where event_id=$1", [id]);
  await client.query("delete from event_teacher_invites where event_id=$1", [id]);
  if (data.visibility !== "targeted") return;
  if (data.audience === "students") {
    for (const career of data.careers) await client.query("insert into event_careers(event_id,career) values($1,$2)", [id, career]);
  } else {
    if (data.invitees.length) {
      const { rows } = await client.query("select id,email from users where id=any($1::uuid[])", [data.invitees]);
      if (rows.length !== data.invitees.length || rows.some((x) => !isTeacherEmail(x.email))) throw fail(400, "validation_error", "Uno de los invitados no corresponde a una cuenta docente registrada.");
      for (const idUser of data.invitees) await client.query("insert into event_teacher_invites(event_id,user_id) values($1,$2)", [id, idUser]);
    }
  }
}
async function decorate(db, rows, user) {
  if (!rows.length) return [];
  const ids = rows.map((x) => x.id);
  const managedIds = rows.filter(row => user.role === "admin" || (row.audience === "teachers" && row.created_by === user.id && accountType(user.email, user.role) === "teacher")).map(row => row.id);
  const [careers, invites, attend] = await Promise.all([
    db.query("select event_id,career from event_careers where event_id=any($1::uuid[]) order by career", [ids]),
    db.query("select i.event_id,i.user_id,p.full_name,u.email from event_teacher_invites i join users u on u.id=i.user_id join profiles p on p.id=i.user_id where i.event_id=any($1::uuid[]) order by p.full_name", [managedIds]),
    db.query("select event_id from event_attendance where user_id=$1 and event_id=any($2::uuid[])", [user.id, ids]),
  ]);
  const attended = new Set(attend.rows.map((x) => x.event_id));
  return rows.map((row) => ({
    ...row,
    careers: careers.rows.filter((x) => x.event_id === row.id).map((x) => x.career),
    invitees: invites.rows.filter((x) => x.event_id === row.id).map((x) => ({ id: x.user_id, full_name: x.full_name, email: x.email })),
    attended: attended.has(row.id),
    can_manage: user.role === "admin" || (row.audience === "teachers" && row.created_by === user.id && accountType(user.email, user.role) === "teacher"),
  }));
}

function createPublicEventsRouter({ db, limit }) {
  const router = express.Router();
  router.get("/documents/:code", async (req, res) => {
    if (limit) await limit(req, "event-document-ip:" + req.ip, 60);
    const code = clean(req.params.code, 64).toUpperCase();
    if (!/^FIT-\d{4}-[A-F0-9]{12}$/.test(code)) throw fail(404, "not_found", "Código de validación no encontrado.");
    const row = (await db.query("select code,document_type,event_title,subject_name,item_count,generated_at from event_documents where code=$1", [code])).rows[0];
    if (!row) throw fail(404, "not_found", "Código de validación no encontrado.");
    res.json({ data: { valid: true, ...row } });
  });
  return router;
}

function createEventsRouter({ db, limit, siteUrl }) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) await limit(req, "events-write:" + req.user.id, 80);
    if (req.method === "GET" && /\.pdf$/.test(req.path)) await limit(req, "events-pdf:" + req.user.id, 15);
    next();
  });

  router.get("/options", async (req, res) => {
    const type = accountType(req.user.email, req.user.role);
    const data = { careers: [], teachers: [] };
    if (req.user.role === "admin") {
      data.careers = (await db.query("select distinct career from profiles p join users u on u.id=p.id where career is not null and u.email ~* '^a[0-9]+@alumnos\\.uat\\.edu\\.mx$' order by career")).rows.map((x) => x.career);
    }
    if (req.user.role === "admin" || type === "teacher") {
      data.teachers = (await db.query("select u.id,p.full_name,u.email from users u join profiles p on p.id=u.id where u.email_confirmed_at is not null and (u.email ~* '@docentes\\.uat\\.edu\\.mx$' or (u.email ~* '@uat\\.edu\\.mx$' and u.email !~* '@alumnos\\.uat\\.edu\\.mx$')) order by p.full_name,u.email")).rows;
    }
    res.json({ data });
  });

  router.get("/", async (req, res) => {
    const type = accountType(req.user.email, req.user.role);
    let sql = `select e.*,p.full_name as creator_name,
      to_char(e.starts_at at time zone 'America/Monterrey','YYYY-MM-DD') as event_day,
      ((e.starts_at at time zone 'America/Monterrey')::date=(now() at time zone 'America/Monterrey')::date) as checkin_open,
      (select count(*)::int from event_attendance a where a.event_id=e.id) as attendance_count
      from events e join profiles p on p.id=e.created_by`;
    const params = [];
    if (req.user.role !== "admin") {
      if (type === "student") {
        params.push(req.user.id);
        sql += ` where e.audience='students' and (e.visibility='public' or exists(select 1 from event_careers c join profiles me on me.id=$1 where c.event_id=e.id and me.career is not null and lower(btrim(c.career))=lower(btrim(me.career))))`;
      } else if (type === "teacher") {
        params.push(req.user.id);
        // Los docentes pueden consultar todos los eventos para alumnos como información
        // de la facultad, además de los eventos docentes públicos/propios/invitados.
        // La asistencia QR sigue validando el público, así que un docente no puede
        // registrar asistencia en un evento estudiantil.
        sql += ` where e.audience='students' or (e.audience='teachers' and (e.visibility='public' or e.created_by=$1 or exists(select 1 from event_teacher_invites i where i.event_id=e.id and i.user_id=$1)))`;
      } else {
        return res.json({ data: [] });
      }
    }
    sql += " order by e.starts_at desc";
    const rows = (await db.query(sql, params)).rows;
    res.json({ data: await decorate(db, rows, req.user) });
  });

  router.post("/", async (req, res) => {
    const data = eventPayload(req.body), type = accountType(req.user.email, req.user.role);
    if (data.audience === "students" && req.user.role !== "admin") throw fail(403, "forbidden", "Solo administración puede crear eventos para alumnos.");
    if (data.audience === "teachers" && req.user.role !== "admin" && type !== "teacher") throw fail(403, "forbidden", "Solo docentes y administración pueden crear eventos para docentes.");
    const row = await transaction(db, async (client) => {
      const { rows } = await client.query("insert into events(title,description,location,audience,visibility,starts_at,ends_at,created_by) values($1,$2,$3,$4,$5,$6,$7,$8) returning *", [data.title, data.description, data.location, data.audience, data.visibility, data.starts_at, data.ends_at, req.user.id]);
      await replaceTargets(client, rows[0].id, data);
      return rows[0];
    });
    res.status(201).json({ data: row });
  });

  router.patch("/:id", async (req, res) => {
    if (!UUID.test(req.params.id)) throw fail(404, "not_found", "Evento no encontrado.");
    const data = eventPayload(req.body);
    const current = (await db.query("select * from events where id=$1", [req.params.id])).rows[0];
    if (!current) throw fail(404, "not_found", "Evento no encontrado.");
    if (!(await canManage(db, current, req.user))) throw fail(403, "forbidden", "No puedes modificar este evento.");
    if (current.audience === "students" && data.audience !== "students" && req.user.role !== "admin") throw fail(403, "forbidden", "No puedes cambiar el público del evento.");
    if (data.audience === "students" && req.user.role !== "admin") throw fail(403, "forbidden", "Solo administración puede gestionar eventos para alumnos.");
    const row = await transaction(db, async (client) => {
      const { rows } = await client.query("update events set title=$1,description=$2,location=$3,audience=$4,visibility=$5,starts_at=$6,ends_at=$7,updated_at=now() where id=$8 returning *", [data.title, data.description, data.location, data.audience, data.visibility, data.starts_at, data.ends_at, req.params.id]);
      await replaceTargets(client, req.params.id, data);
      await client.query("delete from event_checkin_tokens where event_id=$1", [req.params.id]);
      return rows[0];
    });
    res.json({ data: row });
  });

  router.delete("/:id", async (req, res) => {
    if (!UUID.test(req.params.id)) throw fail(404, "not_found", "Evento no encontrado.");
    const current = (await db.query("select * from events where id=$1", [req.params.id])).rows[0];
    if (!current) throw fail(404, "not_found", "Evento no encontrado.");
    if (!(await canManage(db, current, req.user))) throw fail(403, "forbidden", "No puedes eliminar este evento.");
    await db.query("delete from events where id=$1", [req.params.id]);
    res.json({ data: {} });
  });

  router.get("/:id/qr/status", async (req, res) => {
    const event = await managedEvent(db, req.params.id, req.user);
    const tokenRow = await currentQr(db, event.id);
    if (!tokenRow)
      return res.json({ data: { exists: false, active: false, duration_hours: QR_DEFAULT_HOURS, max_duration_hours: QR_MAX_HOURS, event_day: await eventDay(db, event.starts_at) } });
    res.json({ data: { exists: true, max_duration_hours: QR_MAX_HOURS, ...qrPayloadData(siteUrl, tokenRow, await eventDay(db, event.starts_at)) } });
  });

  router.get("/:id/qr", async (req, res) => {
    const event = await managedEvent(db, req.params.id, req.user);
    const tokenRow = await currentQr(db, event.id);
    if (!tokenRow || !tokenRow.active) throw fail(409, "qr_inactive", "Genera el QR desde el panel del evento.");
    res.json({ data: qrPayloadData(siteUrl, tokenRow, await eventDay(db, event.starts_at)) });
  });

  router.post("/:id/qr", async (req, res) => {
    const event = await managedEvent(db, req.params.id, req.user);
    const action = clean(req.body?.action || "generate", 20).toLowerCase();
    const tokenRow = await issueQr(db, event, req.user.id, { action, durationHours: req.body?.duration_hours });
    res.json({ data: qrPayloadData(siteUrl, tokenRow, await eventDay(db, event.starts_at)) });
  });

  router.post("/checkin", async (req, res) => {
    let token = clean(req.body?.token, 200);
    if (/^https?:\/\//i.test(token)) { try { token = new URL(token).searchParams.get("e") || ""; } catch { token = ""; } }
    if (token.startsWith("FIT-EVENT:")) token = token.slice(10);
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(token)) throw fail(400, "invalid_qr", "El código QR no es válido.");
    const row = (await db.query(`select e.* from event_checkin_tokens t join events e on e.id=t.event_id
      where t.token_hash=$1 and t.expires_at>now() and (e.starts_at at time zone 'America/Monterrey')::date=(now() at time zone 'America/Monterrey')::date`, [hashToken(token)])).rows[0];
    if (!row) throw fail(400, "checkin_closed", "La verificación solo está habilitada el día del evento o el QR ya no es válido.");
    const type = accountType(req.user.email, req.user.role);
    if (row.audience === "students") {
      if (type !== "student") throw fail(403, "forbidden", "Este evento corresponde a alumnos.");
      if (row.visibility === "targeted") {
        const eligible = (await db.query("select 1 from event_careers c join profiles p on p.id=$1 where c.event_id=$2 and p.career is not null and lower(btrim(c.career))=lower(btrim(p.career)) limit 1", [req.user.id, row.id])).rows[0];
        if (!eligible) throw fail(403, "forbidden", "Este evento no está dirigido a tu carrera registrada.");
      }
    } else {
      if (type !== "teacher") throw fail(403, "forbidden", "Este evento corresponde a docentes.");
      if (row.visibility === "targeted" && row.created_by !== req.user.id) {
        const invited = (await db.query("select 1 from event_teacher_invites where event_id=$1 and user_id=$2", [row.id, req.user.id])).rows[0];
        if (!invited) throw fail(403, "forbidden", "No estás en la lista de docentes invitados.");
      }
    }
    const result = await db.query("insert into event_attendance(event_id,user_id) values($1,$2) on conflict(event_id,user_id) do nothing returning checked_in_at", [row.id, req.user.id]);
    res.json({ data: { event_id: row.id, title: row.title, already_registered: !result.rows[0], checked_in_at: result.rows[0]?.checked_in_at || (await db.query("select checked_in_at from event_attendance where event_id=$1 and user_id=$2", [row.id, req.user.id])).rows[0].checked_in_at } });
  });

  router.get("/attendance/me", async (req, res) => {
    const rows = (await db.query(`select e.id,e.title,e.location,e.audience,e.starts_at,e.ends_at,a.checked_in_at
      from event_attendance a join events e on e.id=a.event_id where a.user_id=$1 order by e.starts_at desc`, [req.user.id])).rows;
    res.json({ data: rows });
  });

  router.get("/attendance/me.pdf", async (req, res) => {
    const person = (await db.query("select p.full_name,u.email from profiles p join users u on u.id=p.id where p.id=$1", [req.user.id])).rows[0];
    const rows = (await db.query(`select e.title,e.location,e.starts_at,a.checked_in_at from event_attendance a join events e on e.id=a.event_id where a.user_id=$1 order by e.starts_at`, [req.user.id])).rows;
    const code = documentCode();
    await db.query("insert into event_documents(code,document_type,owner_user_id,subject_name,item_count) values($1,'my_attendance',$2,$3,$4)", [code, req.user.id, person.full_name, rows.length]);
    const lines = rows.length ? rows.map((x, i) => `${i + 1}. ${x.title} · ${new Date(x.starts_at).toLocaleDateString("es-MX", { timeZone: "America/Monterrey" })} · ${x.location}`) : ["No hay asistencias verificadas por QR registradas."];
    const pdf = createPdf({ title: "Historial de eventos verificados", subtitle: `${person.full_name} · ${person.email} · ${rows.length} asistencia(s) verificada(s)`, lines, validationCode: code });
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="mis-eventos-fit.pdf"', "Cache-Control": "no-store" }).send(pdf);
  });

  router.get("/:id/attendees", async (req, res) => {
    if (!UUID.test(req.params.id)) throw fail(404, "not_found", "Evento no encontrado.");
    const event = (await db.query("select * from events where id=$1", [req.params.id])).rows[0];
    if (!event) throw fail(404, "not_found", "Evento no encontrado.");
    if (!(await canManage(db, event, req.user))) throw fail(403, "forbidden", "No puedes consultar esta lista.");
    const rows = (await db.query(`select p.full_name,u.email,p.student_id,p.career,a.checked_in_at from event_attendance a join users u on u.id=a.user_id join profiles p on p.id=a.user_id where a.event_id=$1 order by p.full_name`, [event.id])).rows;
    res.json({ data: rows });
  });

  router.get("/:id/attendees.pdf", async (req, res) => {
    if (!UUID.test(req.params.id)) throw fail(404, "not_found", "Evento no encontrado.");
    const event = (await db.query("select * from events where id=$1", [req.params.id])).rows[0];
    if (!event) throw fail(404, "not_found", "Evento no encontrado.");
    if (!(await canManage(db, event, req.user))) throw fail(403, "forbidden", "No puedes generar este reporte.");
    const rows = (await db.query(`select p.full_name,u.email,p.student_id,p.career,a.checked_in_at from event_attendance a join users u on u.id=a.user_id join profiles p on p.id=a.user_id where a.event_id=$1 order by p.full_name`, [event.id])).rows;
    const code = documentCode();
    await db.query("insert into event_documents(code,document_type,event_id,event_title,item_count) values($1,'event_attendees',$2,$3,$4)", [code, event.id, event.title, rows.length]);
    const lines = rows.length ? rows.map((x, i) => `${i + 1}. ${x.full_name} · ${x.email}${x.student_id ? " · " + x.student_id : ""}${x.career ? " · " + x.career : ""}`) : ["No hay asistentes verificados por QR."];
    const pdf = createPdf({ title: `Asistentes · ${event.title}`, subtitle: `${new Date(event.starts_at).toLocaleString("es-MX", { timeZone: "America/Monterrey" })} · ${event.location} · ${rows.length} registro(s)`, lines, validationCode: code });
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="asistentes-evento-fit.pdf"', "Cache-Control": "no-store" }).send(pdf);
  });

  return router;
}
module.exports = { createEventsRouter, createPublicEventsRouter };
