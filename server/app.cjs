const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("node:path");
const { transaction } = require("./db.cjs");
const S = require("./security.cjs");
const { createFoodRouter } = require("./food.cjs");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const generic =
  "Si corresponde a una cuenta válida, recibirás un correo con los siguientes pasos.";
function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
function createApp({
  db,
  sendMail,
  siteUrl = "http://localhost:3000",
  production = false,
  corsOrigins = [],
}) {
  const app = express(),
    origin = new URL(siteUrl).origin,
    allowed = new Set([origin, ...corsOrigins]);
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "https:", "data:"],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
      referrerPolicy: { policy: "no-referrer" },
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use(
    cors({
      credentials: true,
      origin: (value, cb) =>
        cb(
          value && !allowed.has(value)
            ? fail(403, "origin_denied", "Origen no permitido.")
            : null,
          !!value,
        ),
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.cookies.fit_session &&
      !req.headers.authorization &&
      !allowed.has(req.get("origin"))
    ) {
      return next(fail(403, "origin_denied", "Origen no permitido."));
    }
    next();
  });
  app.get("/api/config", (req, res) =>
    res.json({ data: { enabled: !!db, registrationEnabled: !!sendMail } }),
  );
  app.get("/api/health", async (req, res) => {
    if (!db) return res.json({ status: "demo" });
    await db.query("select 1");
    res.json({ status: "ok" });
  });
  app.use("/api", (req, res, next) =>
    db
      ? next()
      : next(
          fail(
            503,
            "not_configured",
            "El acceso todavía no está habilitado. Puedes explorar la demostración.",
          ),
        ),
  );
  async function limit(req, scope, max, windowMs = 15 * 60 * 1000) {
    const bucket = S.hashToken(scope + ":" + Math.floor(Date.now() / windowMs));
    const { rows } = await db.query(
      "insert into rate_limits(bucket,hits,expires_at) values($1,1,$2) on conflict(bucket) do update set hits=rate_limits.hits+1 returning hits",
      [bucket, new Date(Date.now() + windowMs * 2)],
    );
    if (rows[0].hits > max)
      throw fail(
        429,
        "rate_limited",
        "Espera un momento antes de volver a intentarlo.",
      );
  }
  app.use("/api/auth", async (req, res, next) => {
    await limit(req, "auth-ip:" + req.ip, 40);
    if (req.body?.email)
      await limit(
        req,
        "auth-email:" + String(req.body.email).trim().toLowerCase(),
        12,
      );
    next();
  });
  async function authenticate(req, res, next) {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : req.cookies.fit_session;
    if (!token || token.length > 256)
      throw fail(401, "session_expired", "Inicia sesión para continuar.");
    const { rows } = await db.query(
      "select u.id,u.email,u.role,u.email_confirmed_at,u.food_seller_intent from sessions s join users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now()",
      [S.hashToken(token)],
    );
    if (!rows[0])
      throw fail(
        401,
        "session_expired",
        "La sesión terminó. Inicia sesión de nuevo.",
      );
    req.user = rows[0];
    req.sessionHash = S.hashToken(token);
    next();
  }
  function administrator(req, res, next) {
    if (req.user.role !== "admin")
      throw fail(403, "forbidden", "Permisos insuficientes.");
    next();
  }
  async function emailToken(user, purpose) {
    if (!sendMail)
      throw fail(
        503,
        "mail_unavailable",
        "El envío de correos todavía no está habilitado.",
      );
    const token = S.randomToken(),
      hash = S.hashToken(token),
      hours = purpose === "confirm" ? 24 : 1;
    await db.query(
      "insert into auth_tokens(token_hash,user_id,purpose,expires_at) values($1,$2,$3,$4)",
      [hash, user.id, purpose, new Date(Date.now() + hours * 3600000)],
    );
    try {
      await sendMail({ email: user.email, purpose, token, siteUrl });
    } catch {
      await db.query("delete from auth_tokens where token_hash=$1", [hash]);
      throw fail(
        503,
        "mail_unavailable",
        "No se pudo enviar el correo. Inténtalo más tarde.",
      );
    }
  }
  app.post("/api/auth/register", async (req, res) => {
    const {
      email,
      password,
      full_name,
      account_type = "buyer",
    } = req.body || {};
    if (!["buyer", "seller"].includes(account_type))
      throw fail(
        400,
        "validation_error",
        "Selecciona un tipo de cuenta válido.",
      );
    if (
      !S.emailValid(email) ||
      !S.nameValid(full_name) ||
      !S.passwordValid(password)
    )
      throw fail(
        400,
        "validation_error",
        "La contraseña debe tener al menos 8 caracteres, con letras, números y un carácter especial.",
      );
    if (!sendMail)
      throw fail(
        503,
        "mail_unavailable",
        "El registro requiere configurar el envío de correos.",
      );
    const normalized = email.trim().toLowerCase(),
      passwordHash = await S.hashPassword(password);
    const user = await transaction(db, async (client) => {
      const { rows } = await client.query(
        "insert into users(email,password_hash,food_seller_intent) values($1,$2,$3) on conflict(email) do nothing returning id,email",
        [normalized, passwordHash, account_type === "seller"],
      );
      if (!rows[0]) return null;
      await client.query("insert into profiles(id,full_name) values($1,$2)", [
        rows[0].id,
        full_name.trim(),
      ]);
      await client.query(
        "insert into institutional_verifications(user_id) values($1)",
        [rows[0].id],
      );
      return rows[0];
    });
    if (user) await emailToken(user, "confirm");
    res.status(201).json({ data: { message: generic } });
  });
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (
      !S.emailValid(email) ||
      typeof password !== "string" ||
      password.length > 128
    )
      throw fail(400, "validation_error", "Revisa tu correo y contraseña.");
    const user = (
      await db.query("select * from users where email=$1", [
        email.trim().toLowerCase(),
      ])
    ).rows[0];
    // Mismo trabajo criptográfico cuando el correo no existe.
    if (!user) {
      await S.hashPassword(password);
      throw fail(
        401,
        "invalid_credentials",
        "El correo o la contraseña son incorrectos.",
      );
    }
    if (!(await S.verifyPassword(password, user.password_hash)))
      throw fail(
        401,
        "invalid_credentials",
        "El correo o la contraseña son incorrectos.",
      );
    if (!user.email_confirmed_at)
      throw fail(
        403,
        "email_not_confirmed",
        "Confirma tu correo antes de iniciar sesión.",
      );
    const token = S.randomToken();
    await db.query(
      "insert into sessions(token_hash,user_id,expires_at) values($1,$2,$3)",
      [S.hashToken(token), user.id, new Date(Date.now() + 7 * 86400000)],
    );
    const payload = {
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        food_seller_intent: user.food_seller_intent,
      },
    };
    if (req.get("X-FIT-Client") === "mobile") payload.sessionToken = token;
    else
      res.cookie("fit_session", token, {
        httpOnly: true,
        secure: production,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 86400000,
      });
    res.json({ data: payload });
  });
  for (const [route, purpose] of [
    ["resend", "confirm"],
    ["recover", "recovery"],
  ])
    app.post("/api/auth/" + route, async (req, res) => {
      const { email } = req.body || {};
      if (!S.emailValid(email))
        throw fail(400, "validation_error", "Escribe un correo válido.");
      if (!sendMail)
        throw fail(
          503,
          "mail_unavailable",
          "El envío de correos todavía no está habilitado.",
        );
      const user = (
        await db.query(
          "select id,email,email_confirmed_at from users where email=$1",
          [email.trim().toLowerCase()],
        )
      ).rows[0];
      if (user && (purpose === "recovery" || !user.email_confirmed_at))
        await emailToken(user, purpose);
      res.json({ data: { message: generic } });
    });
  app.post("/api/auth/confirm", async (req, res) => {
    const token = req.body?.token;
    if (typeof token !== "string" || token.length > 256)
      throw fail(400, "invalid_token", "Enlace inválido.");
    await transaction(db, async (client) => {
      const { rows } = await client.query(
        "delete from auth_tokens where token_hash=$1 and purpose='confirm' and expires_at>now() returning user_id",
        [S.hashToken(token)],
      );
      if (!rows[0])
        throw fail(
          400,
          "token_expired",
          "El enlace venció o ya fue utilizado.",
        );
      await client.query(
        "update users set email_confirmed_at=now() where id=$1",
        [rows[0].user_id],
      );
    });
    res.json({
      data: { message: "Correo confirmado. Ya puedes iniciar sesión." },
    });
  });
  app.post("/api/auth/reset", async (req, res) => {
    const { token, password } = req.body || {};
    if (
      typeof token !== "string" ||
      token.length > 256 ||
      !S.passwordValid(password)
    )
      throw fail(
        400,
        "validation_error",
        "Revisa el enlace y la nueva contraseña.",
      );
    const hash = await S.hashPassword(password);
    await transaction(db, async (client) => {
      const { rows } = await client.query(
        "delete from auth_tokens where token_hash=$1 and purpose='recovery' and expires_at>now() returning user_id",
        [S.hashToken(token)],
      );
      if (!rows[0])
        throw fail(
          400,
          "token_expired",
          "El enlace venció o ya fue utilizado.",
        );
      const id = rows[0].user_id;
      await client.query("update users set password_hash=$1 where id=$2", [
        hash,
        id,
      ]);
      await client.query("delete from sessions where user_id=$1", [id]);
      await client.query("delete from auth_tokens where user_id=$1", [id]);
    });
    res.clearCookie("fit_session", {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: "/",
    });
    res.json({
      data: { message: "Contraseña actualizada. Inicia sesión de nuevo." },
    });
  });
  app.get("/api/auth/me", authenticate, (req, res) =>
    res.json({ data: { user: req.user } }),
  );
  app.post("/api/auth/logout", authenticate, async (req, res) => {
    await db.query("delete from sessions where token_hash=$1", [
      req.sessionHash,
    ]);
    res.clearCookie("fit_session", {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: "/",
    });
    res.json({ data: {} });
  });
  app.get("/api/photos/:id", async (req, res) => {
    if (!UUID.test(req.params.id))
      throw fail(404, "not_found", "Fotografía no disponible.");
    const photo = (
      await db.query("select mime,bytes from photos where id=$1", [
        req.params.id,
      ])
    ).rows[0];
    if (!photo) throw fail(404, "not_found", "Fotografía no disponible.");
    res
      .set({
        "Content-Type": photo.mime,
        "Content-Disposition": "inline",
        "Cache-Control": "public,max-age=86400",
        "Cross-Origin-Resource-Policy": "cross-origin",
      })
      .send(Buffer.from(photo.bytes));
  });
  app.use("/api/data", authenticate);
  app.get("/api/data/:table", async (req, res) => {
    const { table } = req.params;
    if (
      ["profiles", "institutional_verifications", "app_roles"].includes(table)
    ) {
      const target = req.query.id || req.query.user_id;
      if (target && target !== req.user.id)
        throw fail(403, "forbidden", "Solo puedes consultar tu perfil.");
      if (table === "app_roles")
        return res.json({
          data: //
            req.user.role === "admin"
              ? [{ user_id: req.user.id, role: "admin" }]
              : [],
        });
      const sql =
        table === "profiles"
          ? "select id,full_name,student_id,updated_at from profiles where id=$1"
          : "select user_id,status,verified_at from institutional_verifications where user_id=$1";
      return res.json({ data: (await db.query(sql, [req.user.id])).rows });
    }
    if (!["places", "route_edges"].includes(table))
      throw fail(404, "not_found", "Recurso no encontrado.");
    res.json({
      data: (
        await db.query(
          table === "places"
            ? "select * from places order by name"
            : "select * from route_edges",
        )
      ).rows,
    });
  });
  app.patch("/api/data/profiles", async (req, res) => {
    if (req.query.id && req.query.id !== req.user.id)
      throw fail(403, "forbidden", "No puedes modificar ese perfil.");
    const { full_name, student_id } = req.body || {};
    if (
      Object.keys(req.body).some(
        (k) => !["full_name", "student_id"].includes(k),
      ) ||
      !S.nameValid(full_name) ||
      (student_id !== null &&
        (typeof student_id !== "string" ||
          student_id.trim().length < 1 ||
          student_id.length > 64))
    )
      throw fail(400, "validation_error", "Revisa el nombre y la matrícula.");
    const { rows } = await db.query(
      "update profiles set full_name=$1,student_id=$2 where id=$3 returning id,full_name,student_id",
      [full_name.trim(), student_id, req.user.id],
    );
    res.json({ data: rows });
  });
  const columns = {
    places: [
      "id",
      "name",
      "code",
      "category",
      "building",
      "floor",
      "description",
      "x",
      "y",
      "photo_url",
      "source",
      "source_date",
      "verified",
    ],
    route_edges: [
      "from_id",
      "to_id",
      "instruction",
      "accessible",
      "verified",
      "source",
      "source_date",
    ],
  };
  for (const method of ["post", "patch", "delete"])
    app[method]("/api/data/:table", administrator, async (req, res) => {
      const table = req.params.table,
        fields = columns[table];
      if (!fields) throw fail(404, "not_found", "Recurso no encontrado.");
      const id = req.query.id;
      if (method !== "post" && (!id || typeof id !== "string"))
        throw fail(400, "validation_error", "Falta el identificador.");
      if (method === "delete") {
        await db.query(`delete from ${table} where id=$1`, [id]);
        return res.json({ data: [] });
      }
      if (
        !req.body ||
        Array.isArray(req.body) ||
        Object.keys(req.body).some((k) => !fields.includes(k))
      )
        throw fail(400, "validation_error", "Campos no permitidos.");
      const keys = Object.keys(req.body);
      if (!keys.length)
        throw fail(400, "validation_error", "Completa los datos.");
      if (
        ["verified", "accessible"].some(
          (k) => k in req.body && typeof req.body[k] !== "boolean",
        )
      )
        throw fail(400, "validation_error", "Estado inválido.");
      const vals = keys.map((k) => req.body[k]);
      const sql =
        method === "post"
          ? `insert into ${table}(${keys.join(",")}) values(${keys.map((_, i) => "$" + (i + 1)).join(",")}) returning *`
          : `update ${table} set ${keys.map((k, i) => k + "=$" + (i + 1)).join(",")},updated_at=now() where id=$${vals.length + 1} returning *`;
      if (method === "patch") vals.push(id);
      res.json({ data: (await db.query(sql, vals)).rows });
    });
  app.post(
    "/api/admin/verify",
    authenticate,
    administrator,
    async (req, res) => {
      const { p_user_id, p_source } = req.body || {};
      if (
        !UUID.test(p_user_id || "") ||
        typeof p_source !== "string" ||
        p_source.trim().length < 5
      )
        throw fail(
          400,
          "validation_error",
          "Revisa el identificador y la fuente.",
        );
      await transaction(db, async (client) => {
        const { rows } = await client.query(
          "select p.id,u.email_confirmed_at from profiles p join users u on p.id=u.id where p.id=$1 for update of p",
          [p_user_id],
        );
        if (!rows[0]?.email_confirmed_at)
          throw fail(
            400,
            "unconfirmed",
            "La cuenta no existe o su correo no está confirmado.",
          );
        await client.query(
          "update institutional_verifications set status='verified',source=$1,verified_at=now(),verified_by=$2 where user_id=$3",
          [p_source.trim(), req.user.id, p_user_id],
        );
      });
      res.json({ data: {} });
    },
  );
  app.get(
    "/api/admin/users/:id",
    authenticate,
    administrator,
    async (req, res) => {
      if (!UUID.test(req.params.id))
        throw fail(400, "validation_error", "Identificador inválido.");
      const { rows } = await db.query(
        "select p.id,p.full_name,p.student_id,u.email,u.email_confirmed_at from profiles p join users u on p.id=u.id where p.id=$1",
        [req.params.id],
      );
      if (!rows[0]) throw fail(404, "not_found", "Cuenta no encontrada.");
      res.json({ data: rows[0] });
    },
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5242880, files: 1 },
    fileFilter: (req, file, cb) =>
      cb(
        null,
        ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype),
      ),
  });
  app.post(
    "/api/photos",
    authenticate,
    administrator,
    upload.single("file"),
    async (req, res) => {
      const f = req.file,
        b = f?.buffer;
      const valid =
        b &&
        ((f.mimetype === "image/png" &&
          b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
          (f.mimetype === "image/jpeg" &&
            b[0] === 255 &&
            b[1] === 216 &&
            b[2] === 255) ||
          (f.mimetype === "image/webp" &&
            b.subarray(0, 4).toString() === "RIFF" &&
            b.subarray(8, 12).toString() === "WEBP"));
      if (!valid)
        throw fail(
          400,
          "invalid_image",
          "Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.",
        );
      const { rows } = await db.query(
        "insert into photos(mime,bytes,created_by) values($1,$2,$3) returning id",
        [f.mimetype, b, req.user.id],
      );
      res
        .status(201)
        .json({ data: { url: origin + "/api/photos/" + rows[0].id } });
    },
  );
  app.use(
    "/api/food",
    authenticate,
    createFoodRouter({ db, siteUrl, administrator, limit }),
  );
  app.use("/api", (req, res, next) =>
    next(fail(404, "not_found", "Recurso no encontrado.")),
  );
  app.use(
    express.static(path.join(__dirname, "../web/dist"), {
      index: "index.html",
      setHeaders: (res, file) => {
        if (file.endsWith(".html") || file.endsWith("config.js"))
          res.set("Cache-Control", "no-cache");
      },
    }),
  );
  app.use((error, req, res, next) => {
    const sqlError = [
      "23514",
      "23502",
      "23503",
      "22P02",
      "22001",
      "23505",
    ].includes(error.code);
    const status =
      error.status ||
      (error.code === "LIMIT_FILE_SIZE" ? 413 : sqlError ? 400 : 500);
    res.status(status).json({
      error: {
        code: error.status
          ? error.code
          : sqlError
            ? "validation_error"
            : "service_error",
        message: error.status
          ? error.message
          : sqlError
            ? "Revisa los datos, sus referencias y la evidencia de verificación."
            : status === 413
              ? "La imagen supera 5 MB."
              : "No se pudo completar la solicitud. Inténtalo más tarde.",
      },
    });
  });
  return app;
}
module.exports = { createApp };
