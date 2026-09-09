const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const request = require("supertest");
const { createApp } = require("../server/app.cjs");
const { hashToken } = require("../server/security.cjs");

test("Comidas: permisos, dinero, pedidos y notificaciones persistentes", async (t) => {
  const engine = new PGlite();
  t.after(() => engine.close());
  for (const name of ["001_initial.sql", "002_food.sql"])
    await engine.exec(
      fs.readFileSync(
        path.join(__dirname, "../backend/migrations", name),
        "utf8",
      ),
    );
  const query = (sql, args) => engine.query(sql, args),
    db = { query, connect: async () => ({ query, release() {} }) };
  const emails = [];
  const api = request(
    createApp({
      db,
      sendMail: async (msg) => emails.push(msg),
      siteUrl: "https://fit.example.test",
      production: true,
    }),
  );
  const fixture = async (name, role = "user") => {
    const id = randomUUID(),
      token = randomUUID();
    await query(
      "insert into users(id,email,password_hash,email_confirmed_at,role) values($1,$2,$3,now(),$4)",
      [id, id + "@example.test", "fixture-hash", role],
    );
    await query("insert into profiles(id,full_name) values($1,$2)", [id, name]);
    await query(
      "insert into sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')",
      [hashToken(token), id],
    );
    return { id, token };
  };
  const admin = await fixture("Administrador", "admin"),
    seller = await fixture("Vendedor Uno"),
    seller2 = await fixture("Vendedor Dos"),
    buyer = await fixture("Comprador Uno"),
    stranger = await fixture("Comprador Dos");
  const req = (who, method, url, body) => {
    const r = api[method]("/api/food" + url).set(
      "Authorization",
      "Bearer " + who.token,
    );
    return body === undefined ? r : r.send(body);
  };
  let vendor, otherVendor, product, order, photo;
  const vendorBody = {
    business_name: "Puesto de prueba",
    description: "Datos ficticios de prueba automatizada",
    pickup_location: "Punto de entrega de prueba",
    hours_text: "Lunes 9 a 12",
  };
  const productBody = {
    name: "Lote de tacos de prueba",
    description: "Solo prueba",
    photo_id: null,
    price_cents: 8550,
    sale_unit: "lot",
    units_per_lot: 3,
    available: true,
  };
  await t.test(
    "la intención de vender no concede aprobación ni rol administrativo",
    async () => {
      await api
        .post("/api/auth/register")
        .send({
          full_name: "Persona de prueba",
          email: "intent@example.test",
          password: "Una frase extensa de prueba",
          account_type: "seller",
          role: "admin",
        })
        .expect(201);
      const user = (
        await query(
          "select id,role,food_seller_intent from users where email=$1",
          ["intent@example.test"],
        )
      ).rows[0];
      assert.equal(user.role, "user");
      assert.equal(user.food_seller_intent, true);
      assert.equal(
        (
          await query(
            "select count(*)::int as n from food_vendors where user_id=$1",
            [user.id],
          )
        ).rows[0].n,
        0,
      );
      await req(buyer, "get", "/admin/vendors").expect(403);
      await api.get("/api/food/catalog").expect(401);
    },
  );
  await t.test(
    "alta pendiente permite preparar productos, pero no publicarlos ni recibir pedidos",
    async () => {
      await req(seller, "post", "/vendor", {
        ...vendorBody,
        status: "approved",
      }).expect(400);
      vendor = (await req(seller, "post", "/vendor", vendorBody).expect(200))
        .body.data;
      otherVendor = (
        await req(seller2, "post", "/vendor", {
          ...vendorBody,
          business_name: "Otro puesto de prueba",
        }).expect(200)
      ).body.data;
      assert.equal(vendor.status, "pending");
      product = (
        await req(seller, "post", "/products", productBody).expect(201)
      ).body.data;
      const catalog = (await req(buyer, "get", "/catalog").expect(200)).body
        .data;
      assert.equal(catalog.vendors.length, 0);
      assert.equal(catalog.products.length, 0);
      await req(buyer, "post", "/orders", {
        product_id: product.id,
        request_id: randomUUID(),
        quantity: 1,
        note: "",
        expected_price_cents: 8550,
      }).expect(409);
    },
  );
  await t.test(
    "fotos persistentes y productos solo pueden ser asignados o editados por su dueño",
    async () => {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQWQAAAAASUVORK5CYII=",
        "base64",
      );
      await req(buyer, "post", "/photos")
        .attach("file", png, { filename: "a.png", contentType: "image/png" })
        .expect(403);
      await req(seller, "post", "/photos")
        .attach("file", Buffer.from("<svg></svg>"), {
          filename: "a.png",
          contentType: "image/png",
        })
        .expect(400);
      photo = (
        await req(seller, "post", "/photos")
          .attach("file", png, { filename: "a.png", contentType: "image/png" })
          .expect(201)
      ).body.data;
      assert.deepEqual(
        (await api.get(new URL(photo.url).pathname).expect(200)).body,
        png,
      );
      await req(seller2, "post", "/products", {
        ...productBody,
        photo_id: photo.id,
      }).expect(403);
      await req(
        seller2,
        "patch",
        "/products/" + product.id,
        productBody,
      ).expect(404);
      await req(seller2, "delete", "/products/" + product.id).expect(404);
      await req(seller, "patch", "/products/" + product.id, {
        ...productBody,
        photo_id: photo.id,
      }).expect(200);
      await req(seller, "post", "/products", {
        ...productBody,
        price_cents: 1.1,
      }).expect(400);
      await req(seller, "post", "/products", {
        ...productBody,
        sale_unit: "unit",
      }).expect(400);
    },
  );
  await t.test(
    "solo un administrador con evidencia publica el puesto y avisa al vendedor",
    async () => {
      await req(seller, "patch", "/admin/vendors/" + vendor.id, {
        status: "approved",
        source: "Verificado",
      }).expect(403);
      await req(admin, "patch", "/admin/vendors/" + vendor.id, {
        status: "approved",
        source: "",
      }).expect(400);
      await req(admin, "patch", "/admin/vendors/" + vendor.id, {
        status: "approved",
        source: "Padrón autorizado de prueba, inspección 08/09/2026",
      }).expect(200);
      const data = (await req(buyer, "get", "/catalog").expect(200)).body.data;
      assert.equal(data.vendors.length, 1);
      assert.equal(data.products.length, 1);
      assert.equal(data.vendors[0].email, undefined);
      assert.ok(data.products[0].photo_url);
      assert.equal(
        (await req(seller, "get", "/notifications")).body.data.unread_count,
        1,
      );
    },
  );
  await t.test(
    "precio y total se calculan en servidor; una repetición no duplica el pedido ni aviso",
    async () => {
      const body = {
        product_id: product.id,
        request_id: randomUUID(),
        quantity: 2,
        note: "Recoger al salir de clase",
        expected_price_cents: 8550,
      };
      await req(buyer, "post", "/orders", { ...body, total_cents: 1 }).expect(
        400,
      );
      await req(buyer, "post", "/orders", { ...body, quantity: 0 }).expect(400);
      await req(buyer, "post", "/orders", {
        ...body,
        expected_price_cents: 1,
      }).expect(409);
      await req(seller, "post", "/orders", body).expect(400);
      order = (await req(buyer, "post", "/orders", body).expect(201)).body.data;
      assert.equal(order.total_cents, 17100);
      assert.equal(order.units_per_lot, 3);
      assert.equal(order.sale_unit, "lot");
      const again = (await req(buyer, "post", "/orders", body).expect(201)).body
        .data;
      assert.equal(again.id, order.id);
      await req(buyer, "post", "/orders", { ...body, quantity: 3 }).expect(409);
      assert.equal(
        (
          await query(
            "select count(*)::int as n from notifications where order_id=$1",
            [order.id],
          )
        ).rows[0].n,
        1,
      );
      await req(seller, "patch", "/products/" + product.id, {
        ...productBody,
        price_cents: 9999,
      }).expect(200);
      assert.equal(
        (await req(buyer, "get", "/orders")).body.data[0].total_cents,
        17100,
      );
    },
  );
  await t.test(
    "compradores y vendedores ven solo sus pedidos; estados inválidos y accesos ajenos se bloquean",
    async () => {
      assert.equal((await req(stranger, "get", "/orders")).body.data.length, 0);
      assert.equal(
        (await req(seller2, "get", "/orders?role=seller")).body.data.length,
        0,
      );
      assert.equal(
        (await req(seller, "get", "/orders?role=seller")).body.data[0]
          .buyer_name,
        "Comprador Uno",
      );
      await req(stranger, "patch", "/orders/" + order.id, {
        status: "cancelled",
      }).expect(404);
      await req(buyer, "patch", "/orders/" + order.id, {
        status: "accepted",
      }).expect(409);
      await req(seller, "patch", "/orders/" + order.id, {
        status: "completed",
      }).expect(409);
      await req(seller, "patch", "/orders/" + order.id, {
        status: "accepted",
      }).expect(200);
      await req(buyer, "patch", "/orders/" + order.id, {
        status: "cancelled",
      }).expect(409);
      await req(seller, "patch", "/orders/" + order.id, {
        status: "ready",
      }).expect(200);
      await req(seller, "patch", "/orders/" + order.id, {
        status: "completed",
      }).expect(200);
      await req(seller, "patch", "/orders/" + order.id, {
        status: "rejected",
      }).expect(409);
      const second = (
        await req(buyer, "post", "/orders", {
          product_id: product.id,
          request_id: randomUUID(),
          quantity: 1,
          note: "",
          expected_price_cents: 9999,
        }).expect(201)
      ).body.data;
      await req(buyer, "patch", "/orders/" + second.id, {
        status: "cancelled",
      }).expect(200);
      await req(seller, "patch", "/orders/" + second.id, {
        status: "accepted",
      }).expect(409);
    },
  );
  await t.test(
    "avisos sobreviven a otra instancia de la API y marcar leídos respeta la cuenta",
    async () => {
      const notes = (await req(seller, "get", "/notifications")).body.data;
      assert.ok(notes.unread_count >= 3);
      await req(stranger, "patch", "/notifications/read", {
        ids: notes.items.map((n) => n.id),
      }).expect(200);
      assert.equal(
        (await req(seller, "get", "/notifications")).body.data.unread_count,
        notes.unread_count,
      );
      const fresh = request(
        createApp({
          db,
          siteUrl: "https://fit.example.test",
          production: true,
        }),
      );
      assert.equal(
        (
          await fresh
            .get("/api/food/notifications")
            .set("Authorization", "Bearer " + seller.token)
            .expect(200)
        ).body.data.unread_count,
        notes.unread_count,
      );
      await req(seller, "patch", "/notifications/read", { all: true }).expect(
        200,
      );
      assert.equal(
        (await req(seller, "get", "/notifications")).body.data.unread_count,
        0,
      );
      assert.ok(
        (await req(buyer, "get", "/notifications")).body.data.unread_count > 0,
      );
    },
  );
  await t.test(
    "cambiar la identidad del puesto invalida aprobación; borrar producto conserva pedidos",
    async () => {
      await req(seller, "post", "/vendor", {
        ...vendorBody,
        hours_text: "Lunes a viernes",
      }).expect(200);
      assert.equal(
        (await req(seller, "get", "/mine")).body.data.vendor.status,
        "approved",
      );
      await req(seller, "post", "/vendor", {
        ...vendorBody,
        pickup_location: "Nueva ubicación de prueba",
      }).expect(200);
      const mine = (await req(seller, "get", "/mine")).body.data;
      assert.equal(mine.vendor.status, "pending");
      assert.equal(mine.vendor.review_source, null);
      assert.equal(
        (await req(buyer, "get", "/catalog")).body.data.vendors.length,
        0,
      );
      await req(seller, "delete", "/products/" + product.id).expect(200);
      assert.equal(
        (await req(seller, "get", "/mine")).body.data.products.length,
        0,
      );
      assert.equal(
        (await req(buyer, "get", "/orders")).body.data.find(
          (o) => o.id === order.id,
        ).product_name,
        productBody.name,
      );
      await req(admin, "patch", "/admin/vendors/" + otherVendor.id, {
        status: "suspended",
        source: "Suspensión ficticia de prueba",
      }).expect(200);
      await req(seller2, "post", "/vendor", vendorBody).expect(403);
    },
  );
});
