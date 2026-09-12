const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const request = require("supertest");
const { createApp } = require("../server/app.cjs");
const { createGeminiClient } = require("../server/chatbot.cjs");
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
    message: "que eventos tengo?",
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

test("Castor FIT no finge IA si falta la clave/proveedor", async () => {
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
  assert.equal(status.body.data.enabled, false);
  const response = await api.post("/api/chatbot/message").set("Authorization", "Bearer " + token).send({ message: "hola" }).expect(503);
  assert.equal(response.body.error.code, "chatbot_unavailable");
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
          modelVersion: "gemini-2.5-flash",
          candidates: [{ content: { parts: [{ text: '{"reply":"Hola desde Gemini","category":"casual","escalate":false}' }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8 },
        };
      },
    };
  };
  try {
    const client = createGeminiClient({ GEMINI_API_KEY: "clave-de-prueba" });
    assert.equal(client.provider, "google-gemini");
    assert.equal(client.model, "gemini-2.5-flash");
    const result = await client.complete({
      system: "Eres Castor FIT",
      messages: [
        { role: "user", content: "hola" },
        { role: "assistant", content: "qué tal" },
        { role: "user", content: "mi horario" },
      ],
    });
    assert.match(request.url, /gemini-2\.5-flash:generateContent$/);
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
