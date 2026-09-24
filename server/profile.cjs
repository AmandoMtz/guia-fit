const express = require("express");
const multer = require("multer");
const { normalizeImage, imageUploadSlot } = require("./images.cjs");
const { transaction } = require("./db.cjs");
const fail = (status, code, message) =>
  Object.assign(new Error(message), { status, code });

function createProfileRouter({ db, limit }) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5242880, files: 1, fields: 0, parts: 2 },
  });
  router.use(async (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method))
      await limit(req, "profile-write:" + req.user.id, 30);
    next();
  });
  router.patch("/mode", async (req, res) => {
    if (
      !req.body ||
      Object.keys(req.body).some((k) => k !== "mode") ||
      !["student", "student_seller"].includes(req.body.mode)
    )
      throw fail(
        400,
        "validation_error",
        "Selecciona Alumno o Alumno vendedor.",
      );
    const seller = req.body.mode === "student_seller";
    await transaction(db, async (client) => {
      await client.query("update users set food_seller_intent=$1 where id=$2", [
        seller,
        req.user.id,
      ]);
      await client.query(
        "update food_vendors set is_active=$1,updated_at=now() where user_id=$2 and deleted_at is null",
        [seller, req.user.id],
      );
    });
    res.json({ data: { food_seller_intent: seller, mode: req.body.mode } });
  });
  router.get("/photo", async (req, res) => {
    const row = (
      await db.query("select mime,bytes from profile_photos where user_id=$1", [
        req.user.id,
      ])
    ).rows[0];
    if (!row) throw fail(404, "not_found", "Aún no tienes foto de perfil.");
    res
      .set({
        "Content-Type": row.mime,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
      })
      .send(Buffer.from(row.bytes));
  });
  router.post(
    "/photo",
    imageUploadSlot,
    (req, res, next) =>
      upload.single("file")(req, res, (error) => {
        if (error)
          return next(
            fail(
              error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
              "invalid_image",
              "Sube una sola imagen JPG, PNG o WebP de hasta 5 MB.",
            ),
          );
        next();
      }),
    async (req, res) => {
      const bytes = await normalizeImage(req.file, { size: 512, fit: "cover", maxBytes: 524288 });
      const row = (
        await db.query(
          "insert into profile_photos(user_id,bytes) values($1,$2) on conflict(user_id) do update set bytes=excluded.bytes,updated_at=clock_timestamp() returning updated_at",
          [req.user.id, bytes],
        )
      ).rows[0];
      res.status(201).json({ data: { photo_updated_at: row.updated_at } });
    },
  );
  router.delete("/photo", async (req, res) => {
    await db.query("delete from profile_photos where user_id=$1", [
      req.user.id,
    ]);
    res.json({ data: { photo_updated_at: null } });
  });
  return router;
}
module.exports = { createProfileRouter };
