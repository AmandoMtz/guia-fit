/* Lógica compartida, sin acceso al DOM. CommonJS habilitado para pruebas. */
(function (root) {
  "use strict";
  const text = (value) => String(value ?? "").trim();
  const normalize = (value) =>
    text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  function validate(values, mode) {
    const errors = {};
    if (
      mode !== "reset" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(values.email))
    )
      errors.email = "Escribe un correo electrónico válido.";
    if (
      mode === "register" &&
      (text(values.full_name).length < 2 ||
        text(values.full_name).length > 100 ||
        /[\x00-\x1f]/.test(values.full_name))
    )
      errors.full_name =
        "Escribe tu nombre completo (entre 2 y 100 caracteres).";
    if (["register", "reset"].includes(mode)) {
  const pw = String(values.password || "");
  if (pw.length < 8) errors.password = "Usa al menos 8 caracteres.";
  else if (pw.length > 128) errors.password = "Usa como máximo 128 caracteres.";
  else if (!/[A-Za-z]/.test(pw)) errors.password = "Incluye al menos una letra.";
  else if (!/[0-9]/.test(pw)) errors.password = "Incluye al menos un número.";
  else if (!/[^A-Za-z0-9]/.test(pw)) errors.password = "Incluye al menos un carácter especial.";
  if (values.password !== values.confirm)
    errors.confirm = "Las contraseñas no coinciden.";
}
    return errors;
  }
  function findRoute(
    locations,
    edges,
    origin,
    destination,
    accessible = false,
    demo = false,
  ) {
    const nodes = new Map(locations.map((x) => [x.id, x]));
    if (!nodes.has(origin) || !nodes.has(destination)) return null;
    if (origin === destination) return [];
    if (
      !demo &&
      (!nodes.get(origin).verified || !nodes.get(destination).verified)
    )
      return null;
    const queue = [origin],
      seen = new Set([origin]),
      previous = new Map();
    while (queue.length) {
      const current = queue.shift();
      for (const edge of edges) {
        if (edge.from_id !== current || !nodes.has(edge.to_id)) continue;
        if (!demo && (!edge.verified || !nodes.get(edge.to_id).verified))
          continue;
        if (accessible && !edge.accessible) continue;
        if (seen.has(edge.to_id)) continue;
        seen.add(edge.to_id);
        previous.set(edge.to_id, edge);
        if (edge.to_id === destination) {
          const route = [];
          let at = destination;
          while (at !== origin) {
            const step = previous.get(at);
            route.unshift(step);
            at = step.from_id;
          }
          return route;
        }
        queue.push(edge.to_id);
      }
    }
    return null;
  }
  function filterPlaces(items, query, category, building) {
    const q = normalize(query);
    return items.filter(
      (p) =>
        (!category || p.category === category) &&
        (!building || p.building === building) &&
        normalize([p.name, p.code, p.building, p.floor].join(" ")).includes(q),
    );
  }
  function authMessage(error) {
    if (
      [
        "mail_unavailable",
        "not_configured",
        "validation_error",
        "network_error",
        "token_expired",
      ].includes(error?.code)
    )
      return error.message;
    const code = error?.code || "";
    const message = String(error?.message || "");
    if (code === "email_not_confirmed" || /email not confirmed/i.test(message))
      return "Confirma tu correo antes de iniciar sesión. Puedes reenviar el enlace.";
    if (code === "invalid_credentials" || /invalid login/i.test(message))
      return "El correo o la contraseña son incorrectos.";
    if (/rate|too many/i.test(code + message))
      return "Has realizado varios intentos. Espera un momento y vuelve a intentarlo.";
    if (/weak_password|password/i.test(code))
      return "La contraseña no cumple los requisitos del servicio.";
    if (/fetch|network|timeout/i.test(message))
      return "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.";
    if (/expired|otp_expired/i.test(code + message))
      return "El enlace venció. Solicita uno nuevo.";
    return "No se pudo completar la solicitud. Revisa tus datos o inténtalo más tarde.";
  }
  function photoUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value);
      return url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname))
        ? url.href
        : "";
    } catch {
      return "";
    }
  }
  const api = {
    validate,
    normalize,
    findRoute,
    filterPlaces,
    authMessage,
    photoUrl,
  };
  root.FIT_CORE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
