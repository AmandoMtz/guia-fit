const { Router } = require("express");
const { accountType } = require("./account.cjs");
const { transaction } = require("./db.cjs");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT = 1500;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function fail(status, message, code = "validation_error") {
  return Object.assign(new Error(message), { status, code });
}
function id(value) {
  if (!UUID.test(String(value || ""))) throw fail(400, "Identificador inválido.");
  return String(value);
}
function cleanText(value) {
  if (typeof value !== "string") throw fail(400, "Escribe un mensaje antes de enviarlo.");
  const text = value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  if (!text || text.length > MAX_TEXT || /[\x00-\x1f]/.test(text))
    throw fail(400, `El mensaje debe tener entre 1 y ${MAX_TEXT} caracteres.`);
  return text;
}
function eligibleType(user) {
  const type = user?.account_type || accountType(user?.email, user?.role);
  if (!['student', 'teacher'].includes(type))
    throw fail(403, "El chat está disponible para cuentas de alumnos y docentes.", "forbidden");
  return type;
}
function opposite(type) { return type === 'student' ? 'teacher' : 'student'; }

function createAcademicChatRouter({ db, limit }) {
  const router = Router();
  let lastCleanup = 0;

  async function cleanup() {
    if (Date.now() - lastCleanup < 15 * 60 * 1000) return;
    lastCleanup = Date.now();
    await db.query("delete from academic_chat_messages where expires_at<=now()");
    await db.query(`delete from academic_chats c
      where c.created_at < now()-interval '7 days'
      and not exists(select 1 from academic_chat_messages m where m.chat_id=c.id and m.expires_at>now())`);
  }
  async function ownChat(userId, chatId) {
    const row = (await db.query(`select c.*,
      case when c.student_id=$1 then c.teacher_id else c.student_id end as counterpart_id,
      case when c.student_id=$1 then tp.full_name else sp.full_name end as counterpart_name,
      case when c.student_id=$1 then 'teacher' else 'student' end as counterpart_type,
      case when c.student_id=$1 then tu.email else substring(su.email from '^a([0-9]+)@') end as counterpart_identity,
      case when c.student_id=$1 then c.student_read_at else c.teacher_read_at end as my_read_at
      from academic_chats c
      join profiles sp on sp.id=c.student_id
      join profiles tp on tp.id=c.teacher_id
      join users su on su.id=c.student_id join users tu on tu.id=c.teacher_id
      where c.id=$2 and $1 in (c.student_id,c.teacher_id)`, [userId, chatId])).rows[0];
    if (!row) throw fail(404, "Conversación no encontrada.", "not_found");
    return row;
  }
  async function markRead(userId, chat) {
    const column = chat.student_id === userId ? 'student_read_at' : 'teacher_read_at';
    await db.query(`update academic_chats c set ${column}=x.last_at
      from (select max(created_at) as last_at from academic_chat_messages
        where chat_id=$1 and sender_id<>$2 and expires_at>now()) x
      where c.id=$1 and x.last_at is not null and x.last_at>c.${column}`, [chat.id, userId]);
  }
  async function summaryRows(userId) {
    return (await db.query(`select c.id,
      case when c.student_id=$1 then c.teacher_id else c.student_id end as counterpart_id,
      case when c.student_id=$1 then tp.full_name else sp.full_name end as counterpart_name,
      case when c.student_id=$1 then 'teacher' else 'student' end as counterpart_type,
      case when c.student_id=$1 then tu.email else substring(su.email from '^a([0-9]+)@') end as counterpart_identity,
      c.created_at,c.updated_at,
      lm.body as last_message,lm.created_at as last_message_at,lm.sender_id=$1 as last_message_mine,
      coalesce(unread.count,0)::int as unread_count
      from academic_chats c
      join profiles sp on sp.id=c.student_id
      join profiles tp on tp.id=c.teacher_id
      join users su on su.id=c.student_id join users tu on tu.id=c.teacher_id
      left join lateral (
        select m.body,m.created_at,m.sender_id from academic_chat_messages m
        where m.chat_id=c.id and m.expires_at>now() order by m.created_at desc limit 1
      ) lm on true
      left join lateral (
        select count(*)::int as count from academic_chat_messages m
        where m.chat_id=c.id and m.expires_at>now() and m.sender_id<>$1
          and m.created_at > case when c.student_id=$1 then c.student_read_at else c.teacher_read_at end
      ) unread on true
      where $1 in (c.student_id,c.teacher_id)
      order by coalesce(lm.created_at,c.updated_at) desc
      limit 200`, [userId])).rows;
  }

  router.use(async (req, res, next) => {
    eligibleType(req.user);
    await cleanup();
    next();
  });

  router.get('/contacts', async (req, res) => {
    await limit(req, 'academic-chat-search:' + req.user.id, 120);
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ data: [] });
    if (q.length > 80) throw fail(400, 'La búsqueda es demasiado larga.');
    const mine = eligibleType(req.user), target = opposite(mine), normalized = q.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(), pattern = `%${normalized}%`;
    const roleFilter = target === 'teacher'
      ? `u.role='user' and (u.email like '%@docentes.uat.edu.mx' or (u.email like '%@uat.edu.mx' and u.email not like '%@alumnos.uat.edu.mx'))`
      : `u.role='user' and u.email ~ '^a[0-9]+@alumnos\\.uat\\.edu\\.mx$'`;
    const rows = (await db.query(`select u.id,p.full_name,p.career,case when u.email ~ '^a[0-9]+@alumnos\\.uat\\.edu\\.mx$' then substring(u.email from '^a([0-9]+)@') else u.email end as identity
      from users u join profiles p on p.id=u.id
      where u.id<>$1 and u.email_confirmed_at is not null and ${roleFilter}
        and (translate(lower(p.full_name),'áéíóúüñ','aeiouun') like $2 or lower(u.email) like $2)
      order by p.full_name asc limit 30`, [req.user.id, pattern])).rows.map(r => ({...r, account_type: target}));
    res.json({ data: rows });
  });

  router.get('/unread', async (req, res) => {
    const row = (await db.query(`select count(*)::int as count
      from academic_chat_messages m join academic_chats c on c.id=m.chat_id
      where $1 in(c.student_id,c.teacher_id) and m.sender_id<>$1 and m.expires_at>now()
        and m.created_at > case when c.student_id=$1 then c.student_read_at else c.teacher_read_at end`, [req.user.id])).rows[0];
    res.json({ data: { unread_count: Number(row?.count || 0) } });
  });

  router.get('/chats', async (req, res) => {
    const items = await summaryRows(req.user.id);
    res.json({ data: { items, unread_count: items.reduce((n, row) => n + Number(row.unread_count || 0), 0) } });
  });

  router.post('/chats', async (req, res) => {
    await limit(req, 'academic-chat-create:' + req.user.id, 60);
    if (!req.body || Object.keys(req.body).some(k => k !== 'counterpart_id'))
      throw fail(400, 'La solicitud contiene campos no permitidos.');
    const counterpartId = id(req.body.counterpart_id), mine = eligibleType(req.user), wanted = opposite(mine);
    const other = (await db.query(`select u.id,u.email,u.role,u.email_confirmed_at,p.full_name
      from users u join profiles p on p.id=u.id where u.id=$1`, [counterpartId])).rows[0];
    if (!other || !other.email_confirmed_at || accountType(other.email, other.role) !== wanted)
      throw fail(404, wanted === 'teacher' ? 'Docente no disponible.' : 'Alumno no disponible.', 'not_found');
    const studentId = mine === 'student' ? req.user.id : other.id;
    const teacherId = mine === 'teacher' ? req.user.id : other.id;
    const chatId = await transaction(db, async client => {
      const inserted = (await client.query(`insert into academic_chats(student_id,teacher_id)
        values($1,$2) on conflict(student_id,teacher_id) do nothing returning id`, [studentId, teacherId])).rows[0];
      if (inserted) return inserted.id;
      return (await client.query('select id from academic_chats where student_id=$1 and teacher_id=$2', [studentId, teacherId])).rows[0].id;
    });
    const chat = await ownChat(req.user.id, chatId);
    res.status(201).json({ data: { id: chat.id, counterpart_id: chat.counterpart_id, counterpart_name: chat.counterpart_name, counterpart_identity: chat.counterpart_identity, counterpart_type: chat.counterpart_type } });
  });

  router.get('/chats/:id', async (req, res) => {
    const chat = await ownChat(req.user.id, id(req.params.id));
    const messages = (await db.query(`select id,sender_id,body,created_at,expires_at
      from academic_chat_messages where chat_id=$1 and expires_at>now()
      order by created_at asc limit 1000`, [chat.id])).rows.map(m => ({...m, mine: m.sender_id === req.user.id}));
    await markRead(req.user.id, chat);
    res.json({ data: {
      id: chat.id,
      counterpart_id: chat.counterpart_id,
      counterpart_name: chat.counterpart_name,
      counterpart_identity: chat.counterpart_identity, counterpart_type: chat.counterpart_type,
      retention_days: 7,
      messages,
    }});
  });

  router.post('/chats/:id/read', async (req, res) => {
    if (req.body && Object.keys(req.body).length) throw fail(400, 'La solicitud contiene campos no permitidos.');
    const chat = await ownChat(req.user.id, id(req.params.id));
    await markRead(req.user.id, chat);
    res.json({ data: {} });
  });

  router.post('/chats/:id/messages', async (req, res) => {
    await limit(req, 'academic-chat-write:' + req.user.id, 180);
    if (!req.body || Object.keys(req.body).some(k => k !== 'text'))
      throw fail(400, 'La solicitud contiene campos no permitidos.');
    const chat = await ownChat(req.user.id, id(req.params.id));
    const body = cleanText(req.body.text);
    const active = Number((await db.query('select count(*)::int as count from academic_chat_messages where chat_id=$1 and expires_at>now()', [chat.id])).rows[0]?.count || 0);
    if (active >= 1000) throw fail(409, 'Esta conversación alcanzó temporalmente su límite de mensajes. Espera a que venzan mensajes antiguos.', 'conflict');
    const sender = (await db.query('select full_name from profiles where id=$1', [req.user.id])).rows[0];
    const recipientId = chat.student_id === req.user.id ? chat.teacher_id : chat.student_id;
    const row = await transaction(db, async client => {
      const message = (await client.query(`insert into academic_chat_messages(chat_id,sender_id,body)
        values($1,$2,$3) returning id,sender_id,body,created_at,expires_at`, [chat.id, req.user.id, body])).rows[0];
      const readColumn = chat.student_id === req.user.id ? 'student_read_at' : 'teacher_read_at';
      await client.query(`update academic_chats set ${readColumn}=now() where id=$1`, [chat.id]);
      const notice = (await client.query(`insert into fit_activity_notifications(user_id,kind,title,body,view_name)
        values($1,'academic_chat','Nuevo mensaje',$2,'messages') returning id`, [recipientId, `${sender?.full_name || 'Alguien de la FIT'} te envió un mensaje.`])).rows[0];
      await client.query(`update fit_push_outbox
        set chat_id=$2::uuid,
            payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('chatId',$2::text)
        where id=$1::uuid`, [notice.id, chat.id]);
      return message;
    });
    res.status(201).json({ data: {...row, mine: true} });
  });

  return router;
}

module.exports = { createAcademicChatRouter, MAX_TEXT };
