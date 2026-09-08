const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const request = require("supertest");
const { createApp } = require("../server/app.cjs");
const root = path.resolve(__dirname, "..");
test("API Render/Aiven: autenticación real, permisos y verificación", async (t) => {
  const engine = new PGlite();
  await engine.exec(
    fs.readFileSync(
      path.join(root, "backend/migrations/001_initial.sql"),
      "utf8",
    ),
  );
  await engine.exec(
    fs.readFileSync(path.join(root, "backend/02_catalog.sql"), "utf8"),
  );
  const query = (sql, args) => engine.query(sql, args);
  const db = { query, connect: async () => ({ query, release() {} }) };
  const emails = [];
  const app = createApp({
    db,
    sendMail: async (msg) => emails.push(msg),
    siteUrl: "https://guia.example.test",
    production: true,
  });
  const api = request(app),
    password = "Mi frase larga de prueba";
  let a, b, admin, tokenA, tokenB, tokenAdmin;
  const post = (url, body) =>
    api.post(url).set("X-FIT-Client", "mobile").send(body);
  const user = async (email, name) => {
    await post("/api/auth/register", {
      email,
      full_name: name,
      password,
      role: "admin",
    }).expect(201);
    const msg = emails.find(
      (x) => x.email === email && x.purpose === "confirm",
    );
    assert.ok(msg);
    await post("/api/auth/confirm", { token: msg.token }).expect(200);
    const login = await post("/api/auth/login", { email, password }).expect(
      200,
    );
    return login.body.data;
  };
  await t.test(
    "requiere confirmar el correo; no confía en roles del formulario",
    async () => {
      await post("/api/auth/register", {
        email: "a@example.test",
        full_name: "José Amando Martínez Hernández",
        password,
        role: "admin",
      }).expect(201);
      await post("/api/auth/login", {
        email: "a@example.test",
        password,
      }).expect(403);
      const msg = emails.find((x) => x.email === "a@example.test");
      await post("/api/auth/confirm", { token: msg.token }).expect(200);
      await post("/api/auth/confirm", { token: msg.token }).expect(400);
      const result = await post("/api/auth/login", {
        email: "a@example.test",
        password,
      }).expect(200);
      a = result.body.data.user.id;
      tokenA = result.body.data.sessionToken;
      const stored = (await query("select * from users where id=$1", [a]))
        .rows[0];
      assert.equal(stored.role, "user");
      assert.notEqual(stored.password_hash, password);
      assert.ok(stored.password_hash.startsWith("scrypt$"));
      assert.notEqual(
        (await query("select token_hash from sessions where user_id=$1", [a]))
          .rows[0].token_hash,
        tokenA,
      );
      ({
        user: { id: b },
        sessionToken: tokenB,
      } = await user("b@example.test", "María Hernández"));
      ({
        user: { id: admin },
        sessionToken: tokenAdmin,
      } = await user("admin@example.test", "Administración FIT"));
      await query("update users set role='admin' where id=$1", [admin]);
    },
  );
  await t.test(
    "las sesiones web usan cookies HttpOnly y no exponen tokens en JSON",
    async () => {
      const login = await api
        .post("/api/auth/login")
        .set("Origin", "https://guia.example.test")
        .send({ email: "b@example.test", password })
        .expect(200);
      assert.equal(login.body.data.sessionToken, undefined);
      const cookie = login.headers["set-cookie"][0];
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /Secure/);
      assert.match(cookie, /SameSite=Lax/);
      await api
        .patch("/api/data/profiles")
        .set("Cookie", cookie.split(";")[0])
        .set("Origin", "https://malicioso.example.test")
        .send({ full_name: "Otro nombre", student_id: null })
        .expect(403);
    },
  );
  await t.test(
    "aísla perfiles y bloquea privilegios y tablas no autorizadas",
    async () => {
      const me = await api
        .get("/api/data/profiles")
        .set("Authorization", "Bearer " + tokenA)
        .expect(200);
      assert.equal(me.body.data[0].id, a);
      await api
        .get("/api/data/profiles?id=" + b)
        .set("Authorization", "Bearer " + tokenA)
        .expect(403);
      await api
        .patch("/api/data/profiles?id=" + b)
        .set("Authorization", "Bearer " + tokenA)
        .send({ full_name: "Intruso", student_id: null })
        .expect(403);
      await api
        .patch("/api/data/profiles")
        .set("Authorization", "Bearer " + tokenA)
        .send({ full_name: "Nombre", student_id: null, role: "admin" })
        .expect(400);
      await api
        .get("/api/data/users")
        .set("Authorization", "Bearer " + tokenA)
        .expect(404);
      await api
        .post("/api/data/places")
        .set("Authorization", "Bearer " + tokenA)
        .send({ name: "Salón inventado" })
        .expect(403);
      await api
        .post("/api/admin/verify")
        .set("Authorization", "Bearer " + tokenA)
        .send({ p_user_id: a, p_source: "Padrón de prueba" })
        .expect(403);
    },
  );
  await t.test(
    "administrador verifica con evidencia; editar la identidad invalida la verificación",
    async () => {
      await api
        .post("/api/admin/verify")
        .set("Authorization", "Bearer " + tokenAdmin)
        .send({ p_user_id: a, p_source: "Padrón autorizado de prueba" })
        .expect(200);
      let row = await api
        .get("/api/data/institutional_verifications")
        .set("Authorization", "Bearer " + tokenA);
      assert.equal(row.body.data[0].status, "verified");
      assert.equal(row.body.data[0].source, undefined);
      await api
        .patch("/api/data/profiles")
        .set("Authorization", "Bearer " + tokenA)
        .send({
          full_name: "José Amando Martínez Hernández",
          student_id: "ACTUALIZADA",
        })
        .expect(200);
      row = await api
        .get("/api/data/institutional_verifications")
        .set("Authorization", "Bearer " + tokenA);
      assert.equal(row.body.data[0].status, "pending");
      await api
        .patch("/api/data/places?id=sala-a")
        .set("Authorization", "Bearer " + tokenAdmin)
        .send({ verified: true })
        .expect(400);
      await api
        .patch("/api/data/places?id=sala-a")
        .set("Authorization", "Bearer " + tokenAdmin)
        .send({
          verified: true,
          source: "Inspección de prueba",
          source_date: "2026-09-08",
        })
        .expect(200);
    },
  );
  await t.test(
    "reset: token de un solo uso e invalidación de todas las sesiones previas",
    async () => {
      await post("/api/auth/recover", { email: "b@example.test" }).expect(200);
      const msg = emails.find(
        (x) => x.email === "b@example.test" && x.purpose === "recovery",
      );
      const next = "Nueva frase muy larga";
      await post("/api/auth/reset", {
        token: msg.token,
        password: next,
      }).expect(200);
      await post("/api/auth/reset", {
        token: msg.token,
        password: next,
      }).expect(400);
      await api
        .get("/api/auth/me")
        .set("Authorization", "Bearer " + tokenB)
        .expect(401);
      await post("/api/auth/login", {
        email: "b@example.test",
        password,
      }).expect(401);
      await post("/api/auth/login", {
        email: "b@example.test",
        password: next,
      }).expect(200);
    },
  );
  await t.test(
    "el contenido sin sesión está protegido y los errores no muestran consultas SQL",
    async () => {
      await api.get("/api/data/profiles").expect(401);
      await api.get("/api/data/places").expect(401);
      const res = await api
        .post("/api/data/route_edges")
        .set("Authorization", "Bearer " + tokenAdmin)
        .send({
          from_id: "desconocido",
          to_id: "sala-a",
          instruction: "Tramo de prueba",
        })
        .expect(400);
      assert.ok(!JSON.stringify(res.body).includes("insert into"));
    },
  );
  await t.test(
    "fotografías: solo administradores; bytes persistentes y tipo de archivo comprobado",
    async () => {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQWQAAAAASUVORK5CYII=",
        "base64",
      );
      await api
        .post("/api/photos")
        .set("Authorization", "Bearer " + tokenA)
        .attach("file", png, {
          filename: "entrada.png",
          contentType: "image/png",
        })
        .expect(403);
      await api
        .post("/api/photos")
        .set("Authorization", "Bearer " + tokenAdmin)
        .attach("file", Buffer.from("<script>alert(1)</script>"), {
          filename: "falsa.png",
          contentType: "image/png",
        })
        .expect(400);
      const result = await api
        .post("/api/photos")
        .set("Authorization", "Bearer " + tokenAdmin)
        .attach("file", png, {
          filename: "entrada.png",
          contentType: "image/png",
        })
        .expect(201);
      const photo = await api
        .get(new URL(result.body.data.url).pathname)
        .expect(200)
        .expect("Content-Type", /image\/png/);
      assert.deepEqual(photo.body, png);
      assert.equal(
        (await query("select count(*)::int as n from photos")).rows[0].n,
        1,
      );
    },
  );
  await engine.close();
});
