const nodemailer = require("nodemailer");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function emailHtml({ url, purpose, siteUrl }) {
  const confirm = purpose === "confirm";
  const title = confirm ? "Confirma tu correo" : "Recupera tu acceso";
  const button = confirm ? "Confirmar mi correo" : "Restablecer mi contraseña";
  const link = escapeHtml(url.href);
  const logo = escapeHtml(new URL("/assets/guia-fit-mascota.png", siteUrl).href);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:0;background:#f6f3f4;font-family:Arial,sans-serif;color:#30262a;">
<div style="display:none;max-height:0;overflow:hidden;">${title} en Guía FIT con este enlace de un solo uso.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:520px;background:#ffffff;border:1px solid #ead7dc;border-radius:20px;">
<tr><td align="center" style="padding:32px 24px 20px;"><img src="${logo}" width="80" height="80" alt="Mascota de Guía FIT" style="display:block;border:0;object-fit:contain;"><p style="margin:14px 0 0;color:#7b0d29;font-size:24px;font-weight:bold;">Guía FIT</p><p style="margin:6px 0;color:#76636b;font-size:13px;">Facultad de Ingeniería Tampico</p></td></tr>
<tr><td style="padding:0 28px 32px;"><h1 style="font-size:25px;line-height:1.3;color:#7b0d29;margin:8px 0 16px;text-align:center;">${title}</h1><p style="font-size:16px;line-height:1.6;margin:0 0 24px;text-align:center;">${confirm ? "Ya casi estás dentro. Confirma tu dirección para comenzar a explorar Guía FIT." : "Recibimos una solicitud para cambiar tu contraseña. Usa el botón para elegir una nueva."}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td align="center" bgcolor="#8a102b" style="border-radius:12px;mso-padding-alt:16px 24px;"><a href="${link}" style="display:inline-block;padding:16px 24px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;border-radius:12px;">${button}</a></td></tr></table>
<p style="clear:both;padding-top:24px;margin:0;font-size:13px;line-height:1.6;color:#76636b;text-align:center;">El enlace se utiliza una sola vez y vence ${confirm ? "en 24 horas" : "en una hora"}. Si no solicitaste este correo, puedes ignorarlo.</p>
<p style="font-size:12px;line-height:1.6;color:#76636b;margin:24px 0 8px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p><p style="margin:0;word-break:break-all;overflow-wrap:anywhere;font-size:12px;line-height:1.5;"><a href="${link}" style="color:#8a102b;">${link}</a></p></td></tr></table>
<p style="font-size:12px;color:#76636b;">Guía FIT · Tu campus, a un paso.</p></td></tr></table></body></html>`;
}
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
      html: emailHtml({ url, purpose, siteUrl }),
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
