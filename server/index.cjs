const { createPool } = require("./db.cjs");
const { createMailer } = require("./mail.cjs");
const { createApp } = require("./app.cjs");
const { createGeminiClient } = require("./chatbot.cjs");
const { migrate } = require("./migrate.cjs");
(async () => {
  const db = createPool(),
    production = process.env.NODE_ENV === "production";
  const siteUrl =
    process.env.SITE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:3000";
  if (production && !siteUrl.startsWith("https://"))
    throw new Error("SITE_URL debe usar HTTPS.");
  if (db && process.env.AUTO_MIGRATE !== "false") await migrate(db);
  const app = createApp({
    db,
    sendMail: createMailer(),
    siteUrl,
    production,
    corsOrigins: (process.env.CORS_ORIGINS || "").split(",").filter(Boolean),
    chatbot: createGeminiClient(),
  });
  app.locals.fitPush?.start();
  const server = app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
    console.log(
      "Guía FIT iniciada" +
        (db ? " con PostgreSQL." : " en modo demostración."),
    ),
  );
  const cleanup = db
    ? setInterval(
        () =>
          db
            .query(
              "delete from sessions where expires_at<now(); delete from auth_tokens where expires_at<now(); delete from rate_limits where expires_at<now(); delete from chatbot_logs where created_at < now()-interval '90 days'; delete from academic_chat_messages where expires_at<=now(); delete from academic_chats c where c.created_at < now()-interval '7 days' and not exists(select 1 from academic_chat_messages m where m.chat_id=c.id and m.expires_at>now())",
            )
            .catch(() => {}),
        900000,
      )
    : null;
  cleanup?.unref();
  const stop = () => {
    app.locals.fitPush?.stop();
    if (cleanup) clearInterval(cleanup);
    server.close(async () => {
      await db?.end();
      process.exit(0);
    });
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
})().catch(() => {
  console.error(
    "No se pudo iniciar Guía FIT. Revisa la configuración de Aiven, el certificado TLS y las migraciones.",
  );
  process.exitCode = 1;
});
