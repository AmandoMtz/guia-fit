const test = require("node:test");
const assert = require("node:assert/strict");
const { createMailer } = require("../server/mail.cjs");
test("el correo HTTPS usa el remitente configurado y enlaces de un solo propósito", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return { ok: true };
  });
  const mail = createMailer({
    RESEND_API_KEY: "solo-prueba-sin-acceso",
    MAIL_FROM: "Guía FIT <acceso@example.test>",
  });
  for (const purpose of ["confirm", "recovery"]) {
    await mail({
      email: "persona@example.test",
      purpose,
      token: "token-simulado-de-prueba",
      siteUrl: "https://guia.example.test",
    });
    const item = calls.at(-1),
      body = JSON.parse(item.options.body);
    assert.equal(item.url, "https://api.resend.com/emails");
    assert.deepEqual(body.to, ["persona@example.test"]);
    assert.equal(body.from, "Guía FIT <acceso@example.test>");
    const link = new URL(body.text.match(/https:\/\/[^\s]+/)[0]);
    assert.equal(link.searchParams.get("flow"), purpose);
    assert.equal(
      new URLSearchParams(link.hash.slice(1)).get("token"),
      "token-simulado-de-prueba",
    );
    assert.equal(link.searchParams.has("token"), false);
  }
});
test("sin configuración no se simula el envío de verificación", () => {
  assert.equal(createMailer({}), null);
  assert.equal(createMailer({ RESEND_API_KEY: "sin-remitente" }), null);
});
test("el fallo del proveedor se propaga sin revelar su clave", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 403 }));
  const mail = createMailer({
    RESEND_API_KEY: "clave-no-publica",
    MAIL_FROM: "acceso@example.test",
  });
  await assert.rejects(
    mail({
      email: "persona@example.test",
      purpose: "confirm",
      token: "prueba",
      siteUrl: "https://guia.example.test",
    }),
    (error) => !error.message.includes("clave-no-publica"),
  );
});
