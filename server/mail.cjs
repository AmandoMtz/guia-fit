const nodemailer = require("nodemailer");
function createMailer(env = process.env) {
  if (!env.MAIL_FROM) return null;
  const useHttp = !!env.RESEND_API_KEY;
  if (!useHttp && (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD))
    return null;
  const port = Number(env.SMTP_PORT || 587);
  const transport = useHttp
    ? null
    : nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        secure: port === 465,
        requireTLS: port !== 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
        connectionTimeout: 10000,
        socketTimeout: 15000,
      });
  return async ({ email, purpose, token, siteUrl }) => {
    const action =
      purpose === "confirm" ? "Confirma tu correo" : "Recupera tu acceso";
    const url = new URL("/", siteUrl);
    url.searchParams.set("flow", purpose);
    url.hash = "token=" + token;
    const message = {
      from: env.MAIL_FROM,
      to: email,
      subject: `Guía FIT · ${action}`,
      text: `${action} en Guía FIT:\n\n${url.href}\n\nEl enlace se utiliza una sola vez y vence ${purpose === "confirm" ? "en 24 horas" : "en una hora"}. Si no solicitaste este correo, puedes ignorarlo.`,
    };
    if (useHttp) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...message, to: [email] }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error("El proveedor de correo no aceptó el envío.");
    } else {
      await transport.sendMail(message);
    }
  };
}
module.exports = { createMailer };
