const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const request = require("supertest");
const { createApp } = require("../server/app.cjs");
const { createGeminiClient, localAnswer } = require("../server/chatbot.cjs");
const { hashToken } = require("../server/security.cjs");

const root = path.resolve(__dirname, "..");

test("Castor FIT usa contexto real, historial temporal y registra la conversación", async () => {
  const engine = new PGlite();
  for (const file of fs.readdirSync(path.join(root, "backend/migrations")).sort()) {
    if (file.endsWith(".sql"))
      await engine.exec(fs.readFileSync(path.join(root, "backend/migrations", file), "utf8"));
  }
  const query = (sql, params) => engine.query(sql, params);
  const db = { query, connect: async () => ({ query, release() {} }) };
  const userId = randomUUID(), token = randomUUID();
  await query("insert into users(id,email,password_hash,email_confirmed_at) values($1,$2,'fixture',now())", [userId, "a2213332176@alumnos.uat.edu.mx"]);
  await query("insert into profiles(id,full_name,student_id,career) values($1,$2,$3,$4)", [userId, "Alumno Prueba", "2213332176", "ING. SISTEMAS"]);
  await query("insert into institutional_verifications(user_id) values($1)", [userId]);
  await query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')", [hashToken(token), userId]);
  await query(`insert into events(title,description,location,audience,visibility,starts_at,ends_at,created_by)
    values('Semana de Ingeniería','Conferencias','Auditorio','students','public',now()+interval '1 hour',now()+interval '3 hours',$1)`, [userId]);
  const vendor = (await query(`insert into food_vendors(user_id,business_name,description,pickup_location,hours_text,status,review_source,reviewed_by,reviewed_at)
    values($1,'Café Castor','','Cafetería','10:00-14:00','approved','Validación de prueba',$1,now()) returning id`, [userId])).rows[0];
  await query(`insert into food_products(vendor_id,name,price_cents,sale_unit,units_per_lot)
    values($1,'Torta de prueba',5500,'unit',1)`, [vendor.id]);

  const calls = [];
  const chatbot = {
    provider: "test-provider",
    model: "test-model",
    async complete(input) {
      calls.push(input);
      return {
        model: "test-model",
        text: JSON.stringify({
          reply: calls.length === 1 ? "Tienes la Semana de Ingeniería en el Auditorio." : "Sí, seguimos hablando de tus eventos.",
          category: "system",
          escalate: false,
        }),
      };
    },
  };
  const api = request(createApp({ db, siteUrl: "https://castoresfit.com", chatbot }));
  const auth = { Authorization: "Bearer " + token };
  const first = await api.post("/api/chatbot/message").set(auth).send({
    message: "¿Qué me recomiendas priorizar esta tarde con la información disponible?",
    device_context: {
      schedule: {
        career: "ING. SISTEMAS",
        classes: [{ subject: "Redes Neuronales", classroom: "POSGRADO-A", day: 1, start: "11:00", end: "12:00" }],
      },
    },
  }).expect(200);
  assert.match(first.body.data.reply, /Semana de Ingeniería/);
  assert.match(calls[0].system, /Semana de Ingeniería/);
  assert.match(calls[0].system, /Torta de prueba/);
  assert.match(calls[0].system, /Redes Neuronales/);

  await api.post("/api/chatbot/message").set(auth).send({ message: "y de que hablabamos?" }).expect(200);
  assert.ok(calls[1].messages.some((x) => x.role === "assistant" && /Semana de Ingeniería/.test(x.content)));
  const history = await api.get("/api/chatbot/history").set(auth).expect(200);
  assert.equal(history.body.data.messages.length, 4);
  const logs = (await query("select * from chatbot_logs where user_id=$1 order by id", [userId])).rows;
  assert.equal(logs.length, 2);
  assert.equal(logs[0].provider, "test-provider");
  await engine.close();
});

test("Castor FIT mantiene respuestas locales aunque no haya proveedor de IA", async () => {
  const engine = new PGlite();
  for (const file of fs.readdirSync(path.join(root, "backend/migrations")).sort()) {
    if (file.endsWith(".sql"))
      await engine.exec(fs.readFileSync(path.join(root, "backend/migrations", file), "utf8"));
  }
  const query = (sql, params) => engine.query(sql, params);
  const db = { query, connect: async () => ({ query, release() {} }) };
  const userId = randomUUID(), token = randomUUID();
  await query("insert into users(id,email,password_hash,email_confirmed_at) values($1,$2,'fixture',now())", [userId, "a2213332177@alumnos.uat.edu.mx"]);
  await query("insert into profiles(id,full_name) values($1,'Alumno Dos')", [userId]);
  await query("insert into institutional_verifications(user_id) values($1)", [userId]);
  await query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')", [hashToken(token), userId]);
  const api = request(createApp({ db, siteUrl: "https://castoresfit.com" }));
  const status = await api.get("/api/chatbot/status").set("Authorization", "Bearer " + token).expect(200);
  assert.equal(status.body.data.enabled, true);
  assert.equal(status.body.data.local_enabled, true);
  assert.equal(status.body.data.ai_enabled, false);
  const response = await api.post("/api/chatbot/message").set("Authorization", "Bearer " + token).send({ message: "hola" }).expect(200);
  assert.equal(response.body.data.source, "local");
  assert.match(response.body.data.reply, /Castor FIT/i);
  await engine.close();
});


test("cliente Gemini usa la API del nivel gratuito sin exponer la clave en el cuerpo", async () => {
  assert.equal(createGeminiClient({}), null);
  const previousFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      async json() {
        return {
          modelVersion: "gemini-2.5-flash-lite",
          candidates: [{ content: { parts: [{ text: '{"reply":"Hola desde Gemini","category":"casual","escalate":false}' }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8 },
        };
      },
    };
  };
  try {
    const client = createGeminiClient({ GEMINI_API_KEY: "clave-de-prueba" });
    assert.equal(client.provider, "google-gemini");
    assert.equal(client.model, "gemini-2.5-flash-lite");
    const result = await client.complete({
      system: "Eres Castor FIT",
      messages: [
        { role: "user", content: "hola" },
        { role: "assistant", content: "qué tal" },
        { role: "user", content: "mi horario" },
      ],
    });
    assert.match(request.url, /gemini-2\.5-flash-lite:generateContent$/);
    assert.equal(request.options.headers["x-goog-api-key"], "clave-de-prueba");
    assert.ok(!request.options.body.includes("clave-de-prueba"));
    assert.equal(request.body.systemInstruction.parts[0].text, "Eres Castor FIT");
    assert.deepEqual(request.body.contents.map((x) => x.role), ["user", "model", "user"]);
    assert.equal(request.body.generationConfig.responseMimeType, "application/json");
    assert.match(result.text, /Hola desde Gemini/);
  } finally {
    global.fetch = previousFetch;
  }
});

test("cliente Gemini cambia a Flash-Lite si el modelo configurado no está disponible", async () => {
  const previousFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("gemini-2.5-flash:generateContent")) {
      return {
        ok: false,
        status: 404,
        async json() { return { error: { status: "NOT_FOUND", message: "model unavailable" } }; },
      };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          modelVersion: "gemini-2.5-flash-lite",
          candidates: [{ content: { parts: [{ text: '{"reply":"Fallback listo","category":"system","escalate":false}' }] } }],
        };
      },
    };
  };
  try {
    const client = createGeminiClient({ GEMINI_API_KEY: "clave-de-prueba", CHATBOT_MODEL: "gemini-2.5-flash" });
    const result = await client.complete({ system: "Eres Castor FIT", messages: [{ role: "user", content: "hola" }] });
    assert.equal(calls.length, 2);
    assert.match(calls[0], /gemini-2\.5-flash:generateContent$/);
    assert.match(calls[1], /gemini-2\.5-flash-lite:generateContent$/);
    assert.match(result.text, /Fallback listo/);
  } finally {
    global.fetch = previousFetch;
  }
});

test("Castor FIT también atiende visitantes desde la pantalla de inicio sin exponer datos privados", async () => {
  const engine = new PGlite();
  for (const file of fs.readdirSync(path.join(root, "backend/migrations")).sort()) {
    if (file.endsWith(".sql"))
      await engine.exec(fs.readFileSync(path.join(root, "backend/migrations", file), "utf8"));
  }
  const query = (sql, params) => engine.query(sql, params);
  const db = { query, connect: async () => ({ query, release() {} }) };
  const creator = randomUUID();
  await query("insert into users(id,email,password_hash,email_confirmed_at) values($1,$2,'fixture',now())", [creator, "admin@uat.edu.mx"]);
  await query("insert into profiles(id,full_name) values($1,'Admin Prueba')", [creator]);
  await query(`insert into events(title,description,location,audience,visibility,starts_at,ends_at,created_by)
    values('Evento público FIT','Información pública','Auditorio','students','public',now()+interval '1 hour',now()+interval '3 hours',$1)`, [creator]);

  const calls = [];
  const chatbot = {
    provider: "test-provider",
    model: "test-model",
    async complete(input) {
      calls.push(input);
      return {
        model: "test-model",
        text: JSON.stringify({ reply: "Puedes registrarte desde Crear cuenta. También veo el Evento público FIT.", category: "system", escalate: false }),
      };
    },
  };
  const api = request(createApp({ db, siteUrl: "https://castoresfit.com", chatbot }));
  const guestId = "visitante_prueba_123456";
  const reply = await api.post("/api/chatbot/public/message").send({
    guest_id: guestId,
    message: "dame una bienvenida creativa usando el contexto público disponible",
  }).expect(200);
  assert.match(reply.body.data.reply, /registrarte/i);
  assert.match(calls[0].system, /TODAVÍA NO ha iniciado sesión/);
  assert.match(calls[0].system, /Evento público FIT/);
  assert.doesNotMatch(calls[0].system, /student_id|password_hash|fit_session/i);

  const history = await api.get("/api/chatbot/public/history").query({ guest_id: guestId }).expect(200);
  assert.equal(history.body.data.messages.length, 2);
  const logs = (await query("select * from chatbot_logs where user_id is null order by id")).rows;
  assert.equal(logs.length, 1);
  assert.equal(logs[0].account_type, "other");
  await engine.close();
});


test("respuestas locales cubren preguntas frecuentes sin llamar a Gemini", () => {
  const publicContext = {
    public_events: [{ title: "Feria FIT", starts_at: "2026-09-15T16:00:00Z", location: "Auditorio" }],
    available_food: [{ name: "Torta", price_cents: 5500, business_name: "Café Castor", pickup_location: "Cafetería" }],
    verified_places: [{ name: "Sala A", code: "SALA-A", building: "Posgrado", floor: "PB", description: "Sala de clases" }],
  };
  assert.match(localAnswer("¿Qué eventos públicos hay disponibles?", publicContext, { authenticated: false }).reply, /Feria FIT/);
  assert.match(localAnswer("¿Qué comida está disponible?", publicContext, { authenticated: false }).reply, /Torta/);
  assert.match(localAnswer("Soy docente, ¿cómo me registro?", publicContext, { authenticated: false }).reply, /@uat\.edu\.mx/);
  assert.match(localAnswer("¿Dónde está Sala A?", publicContext, { authenticated: false }).reply, /Posgrado/);
});

test("si Gemini falla una pregunta habitual todavía responde localmente", async () => {
  const engine = new PGlite();
  for (const file of fs.readdirSync(path.join(root, "backend/migrations")).sort()) {
    if (file.endsWith(".sql")) await engine.exec(fs.readFileSync(path.join(root, "backend/migrations", file), "utf8"));
  }
  const query = (sql, params) => engine.query(sql, params);
  const db = { query, connect: async () => ({ query, release() {} }) };
  const creator = randomUUID();
  await query("insert into users(id,email,password_hash,email_confirmed_at) values($1,$2,'fixture',now())", [creator, "admin2@uat.edu.mx"]);
  await query("insert into profiles(id,full_name) values($1,'Admin Local')", [creator]);
  await query(`insert into events(title,description,location,audience,visibility,starts_at,ends_at,created_by)
    values('Conferencia Local','Evento visible','Auditorio','students','public',now()+interval '2 hours',now()+interval '4 hours',$1)`, [creator]);
  const brokenChatbot = { provider: "google-gemini", model: "broken", async complete() { throw new Error("provider down"); } };
  const api = request(createApp({ db, siteUrl: "https://castoresfit.com", chatbot: brokenChatbot }));
  const reply = await api.post("/api/chatbot/public/message").send({
    guest_id: "visitante_local_123456",
    message: "¿Qué eventos públicos hay disponibles?",
  }).expect(200);
  assert.equal(reply.body.data.source, "local");
  assert.match(reply.body.data.reply, /Conferencia Local/);
  await engine.close();
});

test('interpreta saludos con preguntas, errores y seguimiento sin IA', () => {
  assert.match(localAnswer('Hola komo puedo registarme', {}).reply, /Crear cuenta/);
  assert.match(localAnswer('Soy docente', {}).reply, /@docentes/);
  assert.match(localAnswer('No recuerdo la contraseña', {}).reply, /Olvidé mi contraseña/);
  assert.match(localAnswer('y no me llega', {}, { history:[{role:'user',content:'recuperar contraseña'}] }).reply, /spam/);
  assert.match(localAnswer('Hola como inicar secion', {}).reply, /Iniciar sesión/);
});

test('prioriza privacidad y asistencia sobre listados generales', () => {
  assert.match(localAnswer('mi pedido de comida', {recent_orders:[{product_name:'PRIVADO'}]}).reply, /Inicia sesión/);
  assert.doesNotMatch(localAnswer('mi pedido de comida', {recent_orders:[{product_name:'PRIVADO'}]}).reply, /PRIVADO/);
  assert.match(localAnswer('como registro asistencia en eventos', {}, {authenticated:true}).reply, /QR/);
  assert.equal(localAnswer('necesito hablar con alguien', {}).escalate, true);
});

test('consulta entidades y precios del contexto actualizado', () => {
  const context = {available_food:[{name:'Pizza',price_cents:8000},{name:'Torta',price_cents:3500}],verified_places:[{name:'Biblioteca',building:'Edificio B'}]};
  assert.match(localAnswer('Biblioteca', context).reply, /Edificio B/);
  assert.doesNotMatch(localAnswer('cuanto cuesta la torta', context).reply, /Pizza/);
  const answer = localAnswer('comida mas barata', context).reply;
  assert.ok(answer.indexOf('Torta') < answer.indexOf('Pizza'));
  assert.match(localAnswer('eventos', {unavailable:true}).reply, /No pude consultar/);
});

test('calcula día y próxima clase con hora de Tampico y semana recurrente', () => {
  const context = {now:'2026-09-14T15:00:00Z', schedule:{classes:[{subject:'Redes',day:'1',start:'11:00',end:'12:00',room:'A'},{subject:'Álgebra',day:'2',start:'08:00',end:'09:00'}]}};
  assert.match(localAnswer('proxima clase', context, {authenticated:true}).reply, /Redes/);
  assert.doesNotMatch(localAnswer('clases mañana', context, {authenticated:true}).reply, /Redes/);
  assert.match(localAnswer('clases mañana', context, {authenticated:true}).reply, /Álgebra/);
  assert.match(localAnswer('clases viernes', context, {authenticated:true}).reply, /No encuentro clases/);
});

test('conversa con afecto, agradecimientos y disculpas sin una lista genérica', () => {
  for (const message of ['te amo','te quiero mucho','tqm','gracias amigo','perdón','cómo estás']) {
    const answer = localAnswer(message, {});
    assert.equal(answer.handled, true);
    assert.equal(answer.category, 'casual');
    assert.doesNotMatch(answer.reply, /Mi horario, Eventos|No pude usar/);
  }
  assert.match(localAnswer('te amo pero como me registro', {}).reply, /Crear cuenta/);
});

test('pide respeto sin insultar y conserva la ayuda concreta', () => {
  for (const message of ['eres un pendejo','idiota','insúltame','respondeme con groserias','vete al carajo']) {
    const answer = localAnswer(message, {});
    assert.match(answer.reply, /respeto/);
    assert.doesNotMatch(answer.reply, /pendejo|idiota|carajo/i);
  }
  const answer = localAnswer('idiota como recupero mi contraseña', {});
  assert.match(answer.reply, /respeto/);
  assert.match(answer.reply, /Olvidé mi contraseña/);
});

test('no regaña a quien relata maltrato y usa contexto ante frustración', () => {
  const answer = localAnswer('me dijeron pendejo y me amenazaron', {});
  assert.equal(answer.escalate, true);
  assert.doesNotMatch(answer.reply, /Te pido que/);
  assert.match(localAnswer('no entiendo', {}, {history:[{role:'user',content:'mi horario'}]}).reply, /cargar tu horario/);
});

test('defensa de tono filtra respuestas ofensivas del proveedor', () => {
  const {gentleOutput} = require('../server/chatbot-conversation.cjs');
  assert.doesNotMatch(gentleOutput({reply:'Cállate, idiota',category:'casual',escalate:false}).reply, /callate|cállate|idiota/i);
  assert.equal(gentleOutput({reply:'Abre Mi horario.'}).reply, 'Abre Mi horario.');
});

test('IA tiene prioridad incluso cuando hay una respuesta local conocida', async () => {
  const {resolveAnswer} = require('../server/chatbot.cjs');
  let called = 0;
  const chatbot = {provider:'test-ai', async complete(input) {called++; assert.match(input.system,/Crear cuenta/); return {text:JSON.stringify({reply:'Te acompaño paso a paso con tu registro.',category:'system'})};}};
  const response = await resolveAnswer({message:'como me registro',context:{},chatbot});
  assert.equal(called,1);
  assert.equal(response.provider,'test-ai');
  assert.match(response.answer.reply,/Te acompaño/);
});

test('conversación emocional usa IA e historial y conserva respaldo natural', async () => {
  const {resolveAnswer} = require('../server/chatbot.cjs');
  const history = [{role:'user',content:'estoy triste'},{role:'assistant',content:'¿Quieres contarme qué pasó?'}];
  const chatbot = {provider:'test-ai', async complete(input) {assert.deepEqual(input.messages.slice(0,2),history); return {text:'{"reply":"Siento que tu día haya sido difícil. ¿Qué ocurrió en clase?","category":"casual"}'};}};
  const result = await resolveAnswer({message:'me fue mal en clase',context:{},history,chatbot});
  assert.equal(result.provider,'test-ai');
  const local = await resolveAnswer({message:'estoy triste',context:{}});
  assert.equal(local.fallbackReason,'not_configured');
  assert.match(local.answer.reply,/Quieres contarme/);
  assert.doesNotMatch(local.answer.reply,/registro|Mi horario/);
});

test('errores de proveedor, cuota y tono vuelven a ayuda local', async () => {
  const {resolveAnswer} = require('../server/chatbot.cjs');
  for (const [status,reason] of [[429,'quota'],[403,'credentials'],[500,'provider_error']]) {
    const result = await resolveAnswer({message:'estoy triste',context:{},chatbot:{async complete(){throw Object.assign(new Error('fixture'),{status});}}});
    assert.equal(result.fallbackReason,reason);
    assert.match(result.answer.reply,/Quieres contarme/);
  }
  for (const text of ['{"reply":"Eres un idiota"}', '{"wrong":"format"}', '{"reply":""}']) {
    const result = await resolveAnswer({message:'como me registro',context:{},chatbot:{async complete(){return {text};}}});
    assert.equal(result.provider,'local-rules');
    assert.match(result.answer.reply,/Crear cuenta/);
  }
});

test('insultos y relatos de maltrato conservan respuesta controlada', async () => {
  const {resolveAnswer} = require('../server/chatbot.cjs');
  const chatbot = {async complete(){assert.fail('No debe consultar al proveedor en este caso');}};
  assert.match((await resolveAnswer({message:'idiota',context:{},chatbot})).answer.reply,/respeto/);
  assert.equal((await resolveAnswer({message:'me amenazaron',context:{},chatbot})).answer.escalate,true);
});
