const { Router } = require("express");
const multer = require("multer");
const { transaction } = require("./db.cjs");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const error = (status, message, code = "validation_error") =>
  Object.assign(new Error(message), { status, code });
function text(value, min, max, label) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)
  )
    throw error(400, `Revisa ${label}.`);
  return value.trim();
}
function fields(body, allowed) {
  if (
    !body ||
    Array.isArray(body) ||
    typeof body !== "object" ||
    Object.keys(body).some((k) => !allowed.includes(k))
  )
    throw error(400, "La solicitud contiene campos no permitidos.");
}
function id(value) {
  if (!uuid.test(value || "")) throw error(400, "Identificador inválido.");
  return value;
}
const statusLabels = {
  requested: "Solicitado",
  accepted: "Aceptado",
  ready: "Listo para recoger",
  completed: "Entregado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};
function createFoodRouter({ db, siteUrl, administrator, limit }) {
  const router = Router(),
    origin = new URL(siteUrl).origin;
  const picture = (r) => ({
    ...r,
    photo_url: r.photo_id ? origin + "/api/photos/" + r.photo_id : null,
  });
  async function ownVendor(userId) {
    return (
      (await db.query("select * from food_vendors where user_id=$1", [userId]))
        .rows[0] || null
    );
  }
  async function notify(client, userId, kind, title, body, orderId = null) {
    await client.query(
      "insert into notifications(user_id,kind,title,body,order_id) values($1,$2,$3,$4,$5)",
      [userId, kind, title, body, orderId],
    );
  }
  async function orderDetails(client, orderId) {
    return (
      await client.query(
        "select o.*,v.business_name,p.full_name as buyer_name from food_orders o join food_vendors v on v.id=o.vendor_id join profiles p on p.id=o.buyer_id where o.id=$1",
        [orderId],
      )
    ).rows[0];
  }
  router.use(async (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method))
      await limit(req, "food-write:" + req.user.id, 120);
    next();
  });
  router.get("/catalog", async (req, res) => {
    const vendors = (
      await db.query(
        "select v.id,v.business_name,v.description,v.pickup_location,v.hours_text,count(p.id)::int as product_count from food_vendors v left join food_products p on p.vendor_id=v.id and p.deleted_at is null and p.available=true where v.status='approved' group by v.id order by v.business_name",
      )
    ).rows;
    const products = (
      await db.query(
        "select p.id,p.vendor_id,p.name,p.description,p.photo_id,p.price_cents,p.sale_unit,p.units_per_lot,p.available,v.business_name,v.pickup_location from food_products p join food_vendors v on v.id=p.vendor_id where v.status='approved' and p.deleted_at is null and p.available=true order by p.created_at desc",
      )
    ).rows.map(picture);
    res.json({ data: { vendors, products } });
  });
  router.get("/mine", async (req, res) => {
    const vendor = await ownVendor(req.user.id);
    const products = vendor
      ? (
          await db.query(
            "select * from food_products where vendor_id=$1 and deleted_at is null order by created_at desc",
            [vendor.id],
          )
        ).rows.map(picture)
      : [];
    res.json({ data: { vendor, products } });
  });
  router.post("/vendor", async (req, res) => {
    fields(req.body, [
      "business_name",
      "description",
      "pickup_location",
      "hours_text",
    ]);
    const name = text(req.body.business_name, 2, 100, "el nombre del puesto"),
      description = text(req.body.description ?? "", 0, 600, "la descripción"),
      pickup = text(req.body.pickup_location, 3, 180, "el punto de entrega"),
      hours = text(req.body.hours_text ?? "", 0, 160, "el horario de atención");
    const result = await transaction(db, async (client) => {
      await client.query("select id from users where id=$1 for update", [
        req.user.id,
      ]);
      const prior = (
        await client.query(
          "select * from food_vendors where user_id=$1 for update",
          [req.user.id],
        )
      ).rows[0];
      if (prior?.status === "suspended")
        throw error(
          403,
          "Tu puesto está suspendido. Contacta al administrador.",
          "forbidden",
        );
      const recheck =
        !prior ||
        prior.status === "rejected" ||
        prior.business_name !== name ||
        prior.pickup_location !== pickup;
      const row = (
        await client.query(
          `insert into food_vendors(user_id,business_name,description,pickup_location,hours_text) values($1,$2,$3,$4,$5) on conflict(user_id) do update set business_name=excluded.business_name,description=excluded.description,pickup_location=excluded.pickup_location,hours_text=excluded.hours_text,updated_at=now(),status=case when $6 then 'pending' else food_vendors.status end,review_source=case when $6 then null else food_vendors.review_source end,reviewed_at=case when $6 then null else food_vendors.reviewed_at end,reviewed_by=case when $6 then null else food_vendors.reviewed_by end returning *`,
          [req.user.id, name, description, pickup, hours, recheck],
        )
      ).rows[0];
      await client.query(
        "update users set food_seller_intent=true where id=$1",
        [req.user.id],
      );
      return row;
    });
    res.status(200).json({ data: result });
  });
  async function productValues(body, userId) {
    fields(body, [
      "name",
      "description",
      "photo_id",
      "price_cents",
      "sale_unit",
      "units_per_lot",
      "available",
    ]);
    const name = text(body.name, 2, 120, "el nombre del producto"),
      description = text(body.description ?? "", 0, 600, "la descripción");
    if (
      !Number.isInteger(body.price_cents) ||
      body.price_cents < 1 ||
      body.price_cents > 1000000
    )
      throw error(400, "El precio debe estar entre $0.01 y $10,000 MXN.");
    if (
      !["unit", "lot"].includes(body.sale_unit) ||
      !Number.isInteger(body.units_per_lot) ||
      body.units_per_lot < 1 ||
      body.units_per_lot > 1000 ||
      (body.sale_unit === "unit" && body.units_per_lot !== 1) ||
      (body.sale_unit === "lot" && body.units_per_lot < 2) ||
      typeof body.available !== "boolean"
    )
      throw error(
        400,
        "Revisa el tipo de venta, la cantidad por lote y la disponibilidad.",
      );
    const photoId = body.photo_id ? id(body.photo_id) : null;
    if (
      photoId &&
      !(
        await db.query("select id from photos where id=$1 and created_by=$2", [
          photoId,
          userId,
        ])
      ).rows.length
    )
      throw error(
        403,
        "Selecciona una fotografía que hayas subido desde tu cuenta.",
        "forbidden",
      );
    return [
      name,
      description,
      photoId,
      body.price_cents,
      body.sale_unit,
      body.units_per_lot,
      body.available,
    ];
  }
  router.post("/products", async (req, res) => {
    const vendor = await ownVendor(req.user.id);
    if (!vendor || !["pending", "approved"].includes(vendor.status))
      throw error(
        403,
        "Completa tu solicitud de vendedor antes de publicar productos.",
        "forbidden",
      );
    const values = await productValues(req.body, req.user.id);
    const result = await transaction(db, async (client) => {
      await client.query("select id from food_vendors where id=$1 for update", [
        vendor.id,
      ]);
      const count = (
        await client.query(
          "select count(*)::int as n from food_products where vendor_id=$1 and deleted_at is null",
          [vendor.id],
        )
      ).rows[0].n;
      if (count >= 80)
        throw error(400, "Puedes mantener hasta 80 productos activos.");
      return (
        await client.query(
          "insert into food_products(vendor_id,name,description,photo_id,price_cents,sale_unit,units_per_lot,available) values($1,$2,$3,$4,$5,$6,$7,$8) returning *",
          [vendor.id, ...values],
        )
      ).rows[0];
    });
    res.status(201).json({ data: picture(result) });
  });
  router.patch("/products/:id", async (req, res) => {
    const vendor = await ownVendor(req.user.id);
    if (!vendor || !["pending", "approved"].includes(vendor.status))
      throw error(
        403,
        "Tu cuenta no puede editar productos en este momento.",
        "forbidden",
      );
    const values = await productValues(req.body, req.user.id);
    const row = (
      await db.query(
        "update food_products set name=$1,description=$2,photo_id=$3,price_cents=$4,sale_unit=$5,units_per_lot=$6,available=$7,updated_at=now() where id=$8 and vendor_id=$9 and deleted_at is null returning *",
        [...values, id(req.params.id), vendor.id],
      )
    ).rows[0];
    if (!row) throw error(404, "Producto no encontrado.", "not_found");
    res.json({ data: picture(row) });
  });
  router.delete("/products/:id", async (req, res) => {
    const row = (
      await db.query(
        "update food_products set deleted_at=now(),available=false,updated_at=now() where id=$1 and vendor_id in(select id from food_vendors where user_id=$2) and deleted_at is null returning id",
        [id(req.params.id), req.user.id],
      )
    ).rows[0];
    if (!row) throw error(404, "Producto no encontrado.", "not_found");
    res.json({ data: {} });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5242880, files: 1, fields: 0, parts: 2 },
  });
  router.post(
    "/photos",
    async (req, res, next) => {
      const vendor = await ownVendor(req.user.id);
      if (!vendor || !["pending", "approved"].includes(vendor.status))
        throw error(
          403,
          "Solicita tu alta de vendedor para agregar fotografías.",
          "forbidden",
        );
      next();
    },
    upload.single("file"),
    async (req, res) => {
      const b = req.file?.buffer,
        mime = req.file?.mimetype;
      const valid =
        b &&
        ((mime === "image/png" &&
          b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
          (mime === "image/jpeg" &&
            b[0] === 255 &&
            b[1] === 216 &&
            b[2] === 255) ||
          (mime === "image/webp" &&
            b.subarray(0, 4).toString() === "RIFF" &&
            b.subarray(8, 12).toString() === "WEBP"));
      if (!valid)
        throw error(
          400,
          "Selecciona una fotografía JPG, PNG o WebP de hasta 5 MB.",
        );
      const row = (
        await db.query(
          "insert into photos(mime,bytes,created_by) values($1,$2,$3) returning id",
          [mime, b, req.user.id],
        )
      ).rows[0];
      res
        .status(201)
        .json({ data: { id: row.id, url: origin + "/api/photos/" + row.id } });
    },
  );
  router.get("/orders", async (req, res) => {
    const role = req.query.role === "seller" ? "seller" : "buyer";
    const rows = (
      await db.query(
        `select o.*,v.business_name,p.full_name as buyer_name from food_orders o join food_vendors v on v.id=o.vendor_id join profiles p on p.id=o.buyer_id where ${role === "seller" ? "v.user_id" : "o.buyer_id"}=$1 order by o.created_at desc limit 300`,
        [req.user.id],
      )
    ).rows;
    res.json({ data: rows });
  });
  router.post("/orders", async (req, res) => {
    fields(req.body, [
      "product_id",
      "quantity",
      "note",
      "request_id",
      "expected_price_cents",
    ]);
    const productId = id(req.body.product_id),
      requestId = id(req.body.request_id),
      quantity = req.body.quantity,
      note = text(req.body.note ?? "", 0, 500, "la nota del pedido");
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 50 ||
      !Number.isInteger(req.body.expected_price_cents)
    )
      throw error(400, "Solicita entre 1 y 50 unidades o lotes.");
    const result = await transaction(db, async (client) => {
      await client.query("select id from users where id=$1 for update", [
        req.user.id,
      ]);
      const prior = (
        await client.query(
          "select * from food_orders where buyer_id=$1 and request_id=$2",
          [req.user.id, requestId],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.product_id !== productId ||
          prior.quantity !== quantity ||
          prior.note !== note
        )
          throw error(
            409,
            "Esta solicitud ya fue utilizada. Actualiza la lista de pedidos.",
            "conflict",
          );
        return orderDetails(client, prior.id);
      }
      const p = (
        await client.query(
          "select p.*,v.user_id as seller_user_id,v.status as vendor_status,v.pickup_location,v.business_name from food_products p join food_vendors v on v.id=p.vendor_id where p.id=$1 for share of p,v",
          [productId],
        )
      ).rows[0];
      if (!p || p.deleted_at || !p.available || p.vendor_status !== "approved")
        throw error(
          409,
          "El producto ya no está disponible. Actualiza el catálogo.",
          "conflict",
        );
      if (p.seller_user_id === req.user.id)
        throw error(400, "No puedes solicitar productos de tu propio puesto.");
      if (req.body.expected_price_cents !== p.price_cents)
        throw error(
          409,
          "El precio cambió. Actualiza el catálogo y revisa el nuevo precio.",
          "conflict",
        );
      const row = (
        await client.query(
          "insert into food_orders(buyer_id,vendor_id,product_id,request_id,product_name,price_cents,sale_unit,units_per_lot,quantity,total_cents,note,pickup_location) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id",
          [
            req.user.id,
            p.vendor_id,
            p.id,
            requestId,
            p.name,
            p.price_cents,
            p.sale_unit,
            p.units_per_lot,
            quantity,
            p.price_cents * quantity,
            note,
            p.pickup_location,
          ],
        )
      ).rows[0];
      await notify(
        client,
        p.seller_user_id,
        "food_order",
        "Nueva solicitud de pedido",
        `${quantity} ${p.sale_unit === "lot" ? "lote(s)" : "unidad(es)"} de ${p.name}.`,
        row.id,
      );
      return orderDetails(client, row.id);
    });
    res.status(201).json({ data: result });
  });
  router.patch("/orders/:id", async (req, res) => {
    fields(req.body, ["status"]);
    const next = req.body.status;
    if (!Object.keys(statusLabels).includes(next))
      throw error(400, "Estado de pedido inválido.");
    const result = await transaction(db, async (client) => {
      const row = (
        await client.query(
          "select o.*,v.user_id as seller_user_id,v.status as vendor_status from food_orders o join food_vendors v on v.id=o.vendor_id where o.id=$1 for update of o",
          [id(req.params.id)],
        )
      ).rows[0];
      if (!row || ![row.buyer_id, row.seller_user_id].includes(req.user.id))
        throw error(404, "Pedido no encontrado.", "not_found");
      if (row.status === next) return orderDetails(client, row.id);
      const buyer = row.buyer_id === req.user.id;
      const allowed = buyer
        ? row.status === "requested"
          ? ["cancelled"]
          : []
        : {
            requested: ["accepted", "rejected"],
            accepted: ["ready", "rejected"],
            ready: ["completed"],
          }[row.status] || [];
      if (!allowed.includes(next))
        throw error(
          409,
          "El pedido cambió o esa acción ya no está disponible.",
          "conflict",
        );
      if (next === "accepted" && row.vendor_status !== "approved")
        throw error(
          403,
          "Solo un vendedor verificado puede aceptar solicitudes nuevas.",
          "forbidden",
        );
      await client.query(
        "update food_orders set status=$1,updated_at=now() where id=$2",
        [next, row.id],
      );
      await notify(
        client,
        buyer ? row.seller_user_id : row.buyer_id,
        "food_order",
        `Pedido: ${statusLabels[next]}`,
        row.product_name,
        row.id,
      );
      return orderDetails(client, row.id);
    });
    res.json({ data: result });
  });
  router.get("/notifications", async (req, res) => {
    const items = (
      await db.query(
        "select id,kind,title,body,order_id,read_at,created_at from notifications where user_id=$1 order by created_at desc limit 80",
        [req.user.id],
      )
    ).rows;
    const count = (
      await db.query(
        "select count(*)::int as n from notifications where user_id=$1 and read_at is null",
        [req.user.id],
      )
    ).rows[0].n;
    res.json({ data: { items, unread_count: count } });
  });
  router.patch("/notifications/read", async (req, res) => {
    fields(req.body, ["ids", "all"]);
    if (req.body.all === true)
      await db.query(
        "update notifications set read_at=now() where user_id=$1 and read_at is null",
        [req.user.id],
      );
    else {
      const ids = req.body.ids;
      if (!Array.isArray(ids) || ids.length > 80)
        throw error(400, "Selecciona los avisos que deseas marcar.");
      ids.forEach(id);
      await db.query(
        "update notifications set read_at=now() where user_id=$1 and id=any($2::uuid[])",
        [req.user.id, ids],
      );
    }
    res.json({ data: {} });
  });
  router.get("/admin/vendors", administrator, async (req, res) => {
    res.json({
      data: (
        await db.query(
          "select v.*,p.full_name,u.email from food_vendors v join profiles p on p.id=v.user_id join users u on u.id=v.user_id order by case when v.status='pending' then 0 else 1 end,v.updated_at desc",
        )
      ).rows,
    });
  });
  router.patch("/admin/vendors/:id", administrator, async (req, res) => {
    fields(req.body, ["status", "source"]);
    if (!["approved", "rejected", "suspended"].includes(req.body.status))
      throw error(400, "Selecciona una resolución válida.");
    const source = text(
      req.body.source,
      5,
      600,
      "la fuente o el motivo de revisión",
    );
    const result = await transaction(db, async (client) => {
      const vendor = (
        await client.query(
          "update food_vendors set status=$1,review_source=$2,reviewed_by=$3,reviewed_at=now(),updated_at=now() where id=$4 returning *",
          [req.body.status, source, req.user.id, id(req.params.id)],
        )
      ).rows[0];
      if (!vendor) throw error(404, "Puesto no encontrado.", "not_found");
      const label = {
        approved: "Tu puesto ya está verificado",
        rejected: "Revisa tu solicitud de vendedor",
        suspended: "Tu puesto está suspendido",
      }[vendor.status];
      await notify(
        client,
        vendor.user_id,
        "vendor_review",
        label,
        vendor.status === "approved"
          ? "Tus productos disponibles ya aparecen en Comidas."
          : source,
      );
      return vendor;
    });
    res.json({ data: result });
  });
  return router;
}
module.exports = { createFoodRouter };
