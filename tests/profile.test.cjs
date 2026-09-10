const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite"),
  request = require("supertest"),
  sharp = require("sharp");
const { createApp } = require("../server/app.cjs"),
  { hashToken } = require("../server/security.cjs");
test("perfil: fotos privadas, límites, reemplazo y modo vendedor sin perder pedidos", async (t) => {
  const engine = new PGlite();
  for (const file of fs
    .readdirSync(path.join(__dirname, "../backend/migrations"))
    .sort())
    await engine.exec(
      fs.readFileSync(
        path.join(__dirname, "../backend/migrations", file),
        "utf8",
      ),
    );
  const query = (sql, params) => engine.query(sql, params),
    db = { query, connect: async () => ({ query, release() {} }) };
  const api = request(createApp({ db, siteUrl: "https://fit.example.test" }));
  async function account(role = "user") {
    const id = randomUUID(),
      token = randomUUID();
    await query(
      "insert into users(id,email,password_hash,email_confirmed_at,role) values($1,$2,'fixture',now(),$3)",
      [id, id + "@example.test", role],
    );
    await query(
      "insert into profiles(id,full_name) values($1,'Alumno de prueba')",
      [id],
    );
    await query(
      "insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')",
      [hashToken(token), id],
    );
    return { id, token };
  }
  const a = await account(),
    b = await account(),
    admin = await account("admin");
  const call = (who, method, url) =>
    api[method](url).set("Authorization", "Bearer " + who.token);
  let photo;
  await t.test(
    "solo cada cuenta consulta, reemplaza y elimina su propia foto",
    async () => {
      await api.get("/api/profile/photo").expect(401);
      photo = await sharp({
        create: { width: 900, height: 600, channels: 3, background: "#cc5500" },
      })
        .png()
        .withMetadata()
        .toBuffer();
      const r = await call(a, "post", "/api/profile/photo")
        .attach("file", photo, {
          filename: "avatar.png",
          contentType: "image/png",
        })
        .expect(201);
      assert.ok(r.body.data.photo_updated_at);
      const read = await call(a, "get", "/api/profile/photo").expect(200);
      const meta = await sharp(read.body).metadata();
      assert.equal(meta.format, "webp");
      assert.equal(meta.width, 512);
      assert.equal(meta.height, 512);
      assert.equal(meta.exif, undefined);
      assert.match(read.headers["cache-control"], /no-store/);
      await call(b, "get", "/api/profile/photo").expect(404);
      await call(admin, "get", "/api/profile/photo").expect(404);
      await call(a, "post", "/api/profile/photo")
        .attach("file", photo, {
          filename: "otra.png",
          contentType: "image/png",
        })
        .expect(201);
      assert.equal(
        (await query("select count(*)::int as n from profile_photos")).rows[0]
          .n,
        1,
      );
      await call(b, "delete", "/api/profile/photo").expect(200);
      await call(a, "get", "/api/profile/photo").expect(200);
      await call(a, "delete", "/api/profile/photo").expect(200);
      await call(a, "get", "/api/profile/photo").expect(404);
    },
  );
  await t.test(
    "rechaza falsos archivos, SVG, exceso de tamaño y campos de otra cuenta",
    async () => {
      await call(a, "post", "/api/profile/photo")
        .attach("file", Buffer.from("no es png"), {
          filename: "foto.png",
          contentType: "image/png",
        })
        .expect(400);
      await call(a, "post", "/api/profile/photo")
        .attach("file", Buffer.from("<svg/>"), {
          filename: "foto.svg",
          contentType: "image/svg+xml",
        })
        .expect(400);
      await call(a, "post", "/api/profile/photo")
        .attach("file", Buffer.alloc(5242881), {
          filename: "foto.png",
          contentType: "image/png",
        })
        .expect(413);
      await call(a, "post", "/api/profile/photo")
        .field("user_id", b.id)
        .attach("file", photo, {
          filename: "foto.png",
          contentType: "image/png",
        })
        .expect(400);
      assert.equal(
        (await query("select count(*)::int as n from profile_photos")).rows[0]
          .n,
        0,
      );
    },
  );
  let vendor, product, order;
  await t.test(
    "una cuenta antigua activa alumno vendedor sin elevar permisos ni verificarse",
    async () => {
      assert.equal(
        (
          await query("select food_seller_intent from users where id=$1", [
            a.id,
          ])
        ).rows[0].food_seller_intent,
        false,
      );
      await call(a, "patch", "/api/profile/mode")
        .send({ mode: "student_seller", role: "admin" })
        .expect(400);
      await call(a, "patch", "/api/profile/mode")
        .send({ mode: "student_seller", user_id: b.id })
        .expect(400);
      await call(a, "patch", "/api/profile/mode")
        .send({ mode: "student_seller" })
        .expect(200);
      const me = (await call(a, "get", "/api/auth/me").expect(200)).body.data
        .user;
      assert.equal(me.food_seller_intent, true);
      assert.equal(me.role, "user");
      vendor = (
        await call(a, "post", "/api/food/vendor")
          .send({
            business_name: "Comidas de prueba",
            description: "",
            pickup_location: "Entrada de prueba",
            hours_text: "",
          })
          .expect(200)
      ).body.data;
      assert.equal(vendor.status, "pending");
      await call(admin, "patch", "/api/food/admin/vendors/" + vendor.id)
        .send({ status: "approved", source: "Evidencia de prueba autorizada" })
        .expect(200);
      product = (
        await call(a, "post", "/api/food/products")
          .send({
            name: "Comida de prueba",
            description: "",
            photo_id: null,
            price_cents: 5000,
            sale_unit: "unit",
            units_per_lot: 1,
            available: true,
          })
          .expect(201)
      ).body.data;
      order = (
        await call(b, "post", "/api/food/orders")
          .send({
            product_id: product.id,
            request_id: randomUUID(),
            expected_price_cents: 5000,
            quantity: 1,
            note: "",
          })
          .expect(201)
      ).body.data;
    },
  );
  await t.test(
    "volver a alumno pausa nuevas ventas, conserva aprobación y permite terminar pedidos",
    async () => {
      await call(a, "patch", "/api/profile/mode")
        .send({ mode: "student" })
        .expect(200);
      const catalog = (await call(b, "get", "/api/food/catalog").expect(200))
        .body.data;
      assert.equal(catalog.vendors.length, 0);
      assert.equal(catalog.products.length, 0);
      await call(b, "post", "/api/food/orders")
        .send({
          product_id: product.id,
          request_id: randomUUID(),
          expected_price_cents: 5000,
          quantity: 1,
          note: "",
        })
        .expect(409);
      assert.equal(
        (await call(a, "get", "/api/food/orders?role=seller").expect(200)).body
          .data.length,
        1,
      );
      for (const status of ["accepted", "ready", "completed"])
        await call(a, "patch", "/api/food/orders/" + order.id)
          .send({ status })
          .expect(200);
      await call(a, "patch", "/api/profile/mode")
        .send({ mode: "student_seller" })
        .expect(200);
      assert.equal(
        (await call(b, "get", "/api/food/catalog").expect(200)).body.data
          .products.length,
        1,
      );
      await call(admin, "patch", "/api/food/admin/vendors/" + vendor.id)
        .send({
          status: "suspended",
          source: "Suspensión de prueba documentada",
        })
        .expect(200);
      await call(a, "patch", "/api/profile/mode")
        .send({ mode: "student" })
        .expect(200);
      await call(a, "patch", "/api/profile/mode")
        .send({ mode: "student_seller" })
        .expect(200);
      assert.equal(
        (await call(b, "get", "/api/food/catalog").expect(200)).body.data
          .products.length,
        0,
      );
      assert.equal(
        (await call(a, "get", "/api/food/mine").expect(200)).body.data.vendor
          .status,
        "suspended",
      );
    },
  );
  await engine.close();
});
