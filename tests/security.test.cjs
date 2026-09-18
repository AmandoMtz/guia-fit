const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { EventEmitter } = require("node:events");
const request = require("supertest");
const sharp = require("sharp");
const { PGlite } = require("@electric-sql/pglite");
const { createApp } = require("../server/app.cjs");
const { hashToken } = require("../server/security.cjs");
const { normalizeImage, imageUploadSlot } = require("../server/images.cjs");
const { createTemporaryFoodChat, CHAT_TTL_MS } = require("../server/food-chat.cjs");
const { createHistoryStore } = require("../server/history-store.cjs");

const sampleImage = async () => sharp({ create: { width: 10, height: 10, channels: 3, background: "#8a102b" } }).png().toBuffer();

test("seguridad API: SQL adversario, acceso entre cuentas y sesiones", async t => {
  const engine = new PGlite();
  t.after(() => engine.close());
  const folder = path.join(__dirname, "../backend/migrations");
  for (const file of fs.readdirSync(folder).filter(n => n.endsWith(".sql")).sort())
    await engine.exec(fs.readFileSync(path.join(folder, file), "utf8"));
  const query = (sql, params) => engine.query(sql, params);
  const db = { query, connect: async () => ({ query, release() {} }) };
  const api = request(createApp({ db, siteUrl: "https://fit.example.test", production: true }));
  async function account(role = "user", confirmed = true) {
    const id = randomUUID(), token = randomUUID();
    await query("insert into users(id,email,password_hash,role,email_confirmed_at) values($1,$2,'fixture',$3,$4)", [id, id + "@example.test", role, confirmed ? new Date() : null]);
    await query("insert into profiles(id,full_name) values($1,'Persona de prueba')", [id]);
    await query("insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')", [hashToken(token), id]);
    return { id, token };
  }
  const owner = await account(), other = await account(), admin = await account("admin"), unconfirmed = await account("user", false);
  const call = (who, method, url) => api[method](url).set("Authorization", "Bearer " + who.token);
  await t.test("SQL en valores es texto; tablas, columnas y roles tienen lista permitida", async () => {
    const attack = "Aula'); DROP TABLE users; --";
    const place = (await call(admin, "post", "/api/data/places").send({ name: attack, description: "' OR 1=1 --" }).expect(200)).body.data[0];
    assert.equal((await query("select name from places where id=$1", [place.id])).rows[0].name, attack);
    await call(admin, "delete", "/api/data/places").query({ id: "' OR 1=1 --" }).expect(200);
    assert.equal((await query("select count(*)::int n from places")).rows[0].n, 1);
    for (const table of ["users", "__proto__", "constructor", "places;DROP TABLE users;--"])
      await call(admin, "delete", "/api/data/" + encodeURIComponent(table)).query({ id: place.id }).expect(404);
    await call(admin, "patch", "/api/data/places").query({ id: place.id }).send({ "name=$1; DELETE FROM users;--": "test" }).expect(400);
    await call(owner, "patch", "/api/data/profiles").send({ full_name: "Persona", student_id: null, role: "admin" }).expect(400);
    await call(owner, "post", "/api/data/places").send({ name: "Ataque" }).expect(403);
    await call(owner, "get", "/api/data/users").expect(404);
    await call(owner, "get", "/api/data/profiles").query({ id: other.id }).expect(403);
    await call(owner, "patch", "/api/data/profiles").query({ id: other.id }).send({ full_name: "Otro", student_id: null }).expect(403);
    const login = await api.post("/api/auth/login").send({ email: "'OR'1'='1@example.test", password: "Injected1!" }).expect(401);
    assert.equal(login.headers["set-cookie"], undefined);
    assert.equal((await query("select count(*)::int n from users")).rows[0].n, 4);
  });
  await t.test("una cabecera Authorization arbitraria no permite modificar con cookies sin Origin", async () => {
    const profile = { full_name: "Nombre seguro", student_id: null };
    await api.patch("/api/data/profiles").set("Cookie", "fit_session=" + owner.token).set("Authorization", "Basic arbitrary").send(profile).expect(403);
    await api.patch("/api/data/profiles").set("Cookie", "fit_session=" + owner.token).set("Origin", "https://evil.example").send(profile).expect(403);
    await api.patch("/api/data/profiles").set("Cookie", "fit_session=" + owner.token).set("Origin", "https://fit.example.test").send(profile).expect(200);
    await call(unconfirmed, "get", "/api/data/profiles").expect(401);
    await query("update sessions set expires_at=now()-interval '1 second' where user_id=$1", [other.id]);
    await call(other, "get", "/api/data/profiles").expect(401);
  });
  await t.test("las fotos se publican por referencia y dejan de ser accesibles al retirarlas", async () => {
    const png = await sampleImage();
    const upload = (await call(admin, "post", "/api/photos").attach("file", png, { filename: "photo.png", contentType: "image/png" }).expect(201)).body.data;
    const url = new URL(upload.url).pathname;
    await api.get(url).expect(404);
    await call(owner, "get", url).expect(404);
    await call(admin, "get", url).expect(200).expect("Cache-Control", "private, no-store");
    await query("update places set photo_url=$1", [upload.url]);
    await api.get(url).expect(200).expect("Content-Type", "image/webp");
    await query("update places set photo_url=null");
    await api.get(url).expect(404);
  });
  await t.test("errores y cabeceras no revelan cuerpos, SQL ni archivos del servidor", async () => {
    const bad = await api.post("/api/auth/login").set("Content-Type", "application/json").send('{"secret":"do-not-echo",BAD').expect(400);
    assert.equal(bad.body.error.code, "invalid_json");
    assert.doesNotMatch(JSON.stringify(bad.body), /do-not-echo|SyntaxError|stack/);
    await api.post("/api/auth/login").send({ email: "a".repeat(40000) }).expect(413);
    const response = await api.get("/api/config").expect(200);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.match(response.headers["content-security-policy"], /frame-ancestors 'none'/);
    assert.ok(response.headers["strict-transport-security"]);
    for (const url of ["/server/app.cjs", "/backend/migrations/001_initial.sql", "/.env", "/.git/config"]) await api.get(url).expect(404);
  });
});

test("imágenes: decodificación real, metadatos, límite de píxeles y concurrencia", async () => {
  const png = await sampleImage();
  const malicious = Buffer.concat([png, Buffer.from("<script>example-payload</script>")]);
  const bytes = await normalizeImage({ buffer: malicious, mimetype: "image/png" });
  assert.equal((await sharp(bytes).metadata()).format, "webp");
  assert.ok(!bytes.includes(Buffer.from("example-payload")));
  const withMeta = await sharp(png).withExif({ IFD0: { Artist: "Private metadata" } }).jpeg().toBuffer();
  const clean = await normalizeImage({ buffer: withMeta, mimetype: "image/jpeg" });
  assert.equal((await sharp(clean).metadata()).exif, undefined);
  await assert.rejects(normalizeImage({ buffer: png.subarray(0, 24), mimetype: "image/png" }), { code: "invalid_image" });
  await assert.rejects(normalizeImage({ buffer: png, mimetype: "image/jpeg" }), { code: "invalid_image" });
  await assert.rejects(normalizeImage({ buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), mimetype: "image/png" }), { code: "invalid_image" });
  const huge = await sharp({ create: { width: 5001, height: 5000, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(normalizeImage({ buffer: huge, mimetype: "image/png" }), { code: "invalid_image" });
  const responses = Array.from({ length: 5 }, () => new EventEmitter());
  for (const res of responses.slice(0, 4)) imageUploadSlot({}, res, err => assert.equal(err, undefined));
  imageUploadSlot({}, responses[4], err => assert.equal(err.status, 503));
  responses[0].emit("close"); responses[0].emit("finish");
  imageUploadSlot({}, responses[4], err => assert.equal(err, undefined));
  for (const res of responses) res.emit("finish");
});

test("historial: capacidad global, expiración y aislamiento de claves", async () => {
  let now = 100;
  const store = createHistoryStore({ max: 2, ttlMs: 1000, maxMessages: 2, now: () => now });
  store.set("a", ["privado"]); store.set("b", ["uno", "dos", "tres"]);
  assert.deepEqual(store.get("b"), ["dos", "tres"]);
  assert.deepEqual(store.get("unknown"), []);
  store.set("c", ["nuevo"]);
  assert.deepEqual(store.get("a"), []);
  now += 1001;
  assert.deepEqual(store.get("b"), []);
  store.clear();
  const expiring = createHistoryStore({ ttlMs: 10, maxMessages: 2 });
  expiring.set("x", ["vence"]);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(expiring.get("x"), []);
});

test("chat temporal: límites concurrentes, expiración y lectores lentos", async t => {
  const engine=new PGlite();t.after(()=>engine.close());
  for(const n of fs.readdirSync(path.join(__dirname,'../backend/migrations')).filter(n=>n.endsWith('.sql')).sort())await engine.exec(fs.readFileSync(path.join(__dirname,'../backend/migrations',n),'utf8'));
  const query=(sql,args)=>engine.query(sql,args);let queue=Promise.resolve();
  const db={query,connect:async()=>{let unlock;const previous=queue;queue=new Promise(r=>unlock=r);await previous;return {query,release:unlock};}};
  const buyer=randomUUID(),seller=randomUUID(),overflow=randomUUID();
  for(const id of [buyer,seller,overflow]){await query("insert into users(id,email,password_hash) values($1,$2,'x')",[id,id+'@test.mx']);await query('insert into profiles(id,full_name) values($1,$2)',[id,'Nombre Apellidos']);}
  const vendor=(await query("insert into food_vendors(user_id,business_name,pickup_location,status,review_source,reviewed_by,reviewed_at) values($1,'Puesto','Local','approved','Fuente verificada',$1,now()) returning id",[seller])).rows[0].id;
  const product=(await query("insert into food_products(vendor_id,name,price_cents,sale_unit) values($1,'Producto',100,'unit') returning id",[vendor])).rows[0].id;
  const chat=createTemporaryFoodChat({db}),c=await chat.create(buyer,product);
  const file={buffer:await sampleImage(),mimetype:'image/png'};
  for(let i=0;i<23;i++)await chat.addImage(buyer,c.id,file);
  const race=await Promise.allSettled([chat.addImage(buyer,c.id,file),chat.addImage(seller,c.id,file)]);
  assert.equal(race.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(race.find(x=>x.status==='rejected').reason.status,409);
  assert.equal((await chat.detail(buyer,c.id)).messages.length,24);
  await query("update food_chats set expires_at=now()-interval '1 second' where id=$1",[c.id]);
  await assert.rejects(chat.addImage(buyer,c.id,file),{status:404});
  await chat.purgeExpired();
  await query("insert into food_chats(buyer_id,seller_user_id,vendor_id,product_id,product_name,business_name,buyer_name,pickup_location) select $1,$2,$3,$4,'Producto','Puesto','Nombre','Local' from generate_series(1,250)",[buyer,seller,vendor,product]);
  await assert.rejects(chat.create(overflow,product),{code:'chat_storage_full'});
  class Response extends EventEmitter {
    set() {} flushHeaders() {} write() { return !this.slow; }
    destroy() { this.destroyed = true; this.emit("close"); }
    end() { this.writableEnded = true; this.emit("finish"); }
  }
  const streams = Array.from({ length: 3 }, () => new Response());
  for (const res of streams) chat.connect("buyer", null, res);
  assert.throws(() => chat.connect("buyer", null, new Response()), { status: 429 });
  streams[0].end();
  const slow = new Response(); slow.slow = true; chat.connect("buyer", null, slow);
  assert.equal(slow.destroyed, true);
  for (const res of streams) res.end();
  const global = Array.from({ length: 128 }, () => new Response());
  for (const [i, res] of global.entries()) chat.connect("reader-" + i, null, res);
  assert.throws(() => chat.connect("one-more", null, new Response()), { status: 429 });
  for (const res of global) res.end();
});
