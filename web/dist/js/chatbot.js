/* Castor FIT: asistente contextual. La API del modelo vive únicamente en el backend. */
(function (root) {
  "use strict";
  let ctx = null;
  let host = null;
  let panel = null;
  let opened = false;
  let busy = false;
  let loadedFor = null;
  let messages = [];
  let nudgeTimer = null;

  const greeting = {
    role: "assistant",
    content:
      "Hola, soy Castor FIT. Puedo ayudarte con tu horario, eventos, comidas, pedidos y espacios de la facultad. ¿Qué necesitas?",
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  }

  function createHost() {
    if (host) return;
    host = document.createElement("div");
    host.id = "fit-chatbot";
    host.className = "fit-chatbot";
    host.innerHTML = `
      <div class="fit-chat-nudge" data-chat-nudge role="button" tabindex="0" aria-label="Abrir ayuda de Castor FIT">
        <strong>¿Necesitas apoyo?</strong>
        <span>Pregúntale a Castor FIT</span>
      </div>
      <button class="fit-chat-launcher" type="button" data-chat-floating aria-label="Abrir asistente Castor FIT" aria-expanded="false">
        <img src="assets/guia-fit-mascota.png" alt="" aria-hidden="true">
        <span class="fit-chat-online-dot" aria-hidden="true"></span>
      </button>
      <section class="fit-chat-panel" aria-label="Chat con Castor FIT" aria-hidden="true">
        <header class="fit-chat-header">
          <div class="fit-chat-agent">
            <span class="fit-chat-avatar"><img src="assets/guia-fit-mascota.png" alt="Mascota Castor FIT"></span>
            <div><strong>Castor FIT</strong><span><i></i> Asistente de Guía FIT</span></div>
          </div>
          <button class="fit-chat-close" type="button" data-chat-close aria-label="Cerrar chat">${ctx?.icon?.("close") || "×"}</button>
        </header>
        <div class="fit-chat-body">
          <div class="fit-chat-messages" data-chat-messages aria-live="polite"></div>
          <div class="fit-chat-quick" data-chat-quick>
            <button type="button" data-chat-prompt="¿Qué clases tengo y cuál es mi próximo horario?">Mi horario</button>
            <button type="button" data-chat-prompt="¿Qué eventos tengo disponibles?">Eventos</button>
            <button type="button" data-chat-prompt="¿Qué comida está disponible y dónde la recojo?">Comidas</button>
            <button type="button" data-chat-prompt="Tengo un problema y necesito orientación de una persona.">Necesito apoyo</button>
          </div>
        </div>
        <form class="fit-chat-form" data-chat-form>
          <label class="sr-only" for="fit-chat-input">Mensaje para Castor FIT</label>
          <textarea id="fit-chat-input" data-chat-input rows="1" maxlength="1200" placeholder="Escribe tu mensaje…" autocomplete="off"></textarea>
          <button type="submit" data-chat-send aria-label="Enviar mensaje">${ctx?.icon?.("send") || "→"}</button>
        </form>
        <p class="fit-chat-foot">Las respuestas pueden variar. Para trámites o casos delicados, Castor FIT te indicará cuándo conviene apoyo humano.</p>
      </section>`;
    document.body.appendChild(host);
    panel = host.querySelector(".fit-chat-panel");
    host.querySelector("[data-chat-floating]").onclick = toggle;
    host.querySelector("[data-chat-close]").onclick = close;
    const nudge = host.querySelector("[data-chat-nudge]");
    nudge.onclick = open;
    nudge.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    };
    host.querySelector("[data-chat-form]").onsubmit = (event) => {
      event.preventDefault();
      const input = host.querySelector("[data-chat-input]");
      const value = input.value.trim();
      if (!value || busy) return;
      input.value = "";
      send(value);
    };
    const input = host.querySelector("[data-chat-input]");
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        host.querySelector("[data-chat-form]").requestSubmit();
      }
    });
    host.querySelectorAll("[data-chat-prompt]").forEach((button) => {
      button.onclick = () => send(button.dataset.chatPrompt);
    });
    renderMessages();
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => host?.classList.add("nudge-soft"), 9000);
  }

  function bindTopLaunchers() {
    document.querySelectorAll("[data-chat-launch]").forEach((button) => {
      button.onclick = open;
      button.setAttribute("aria-expanded", String(opened));
    });
  }

  function setOpen(value) {
    opened = !!value;
    if (!host) return;
    host.classList.toggle("open", opened);
    panel?.setAttribute("aria-hidden", String(!opened));
    host.querySelector("[data-chat-floating]")?.setAttribute("aria-expanded", String(opened));
    document.querySelectorAll("[data-chat-launch]").forEach((button) =>
      button.setAttribute("aria-expanded", String(opened)),
    );
    if (opened) {
      host.classList.add("nudge-soft");
      loadHistory();
      setTimeout(() => host?.querySelector("[data-chat-input]")?.focus(), 120);
    }
  }

  function open() {
    if (!ctx?.state?.user || ctx.state.demo || ctx.state.offline || !navigator.onLine) {
      ctx?.toast?.("Castor FIT necesita conexión a internet para responder.");
      return;
    }
    setOpen(true);
  }
  function close() { setOpen(false); }
  function toggle() { setOpen(!opened); }

  function renderMessages(typing = false) {
    if (!host) return;
    const box = host.querySelector("[data-chat-messages]");
    const visible = messages.length ? messages : [greeting];
    box.innerHTML = visible.map((message) => {
      const who = message.role === "user" ? "user" : "assistant";
      return `<div class="fit-chat-message ${who}"><div class="fit-chat-bubble">${esc(message.content).replace(/\n/g, "<br>")}</div></div>`;
    }).join("") + (typing ? `<div class="fit-chat-message assistant"><div class="fit-chat-bubble fit-chat-typing" aria-label="Castor FIT está escribiendo"><i></i><i></i><i></i></div></div>` : "");
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  }

  async function loadHistory() {
    if (!ctx?.client || !ctx.state.user || loadedFor === ctx.state.user.id) return;
    loadedFor = ctx.state.user.id;
    const result = await ctx.client.request("/api/chatbot/history");
    if (!result.error && Array.isArray(result.data?.messages) && result.data.messages.length) {
      messages = result.data.messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.content || "").slice(0, 4000),
      }));
      renderMessages();
    }
  }

  async function deviceContext() {
    const userId = ctx?.state?.user?.id;
    if (!userId || !root.FIT_SCHEDULE_STORE?.operation) return {};
    try {
      const saved = await root.FIT_SCHEDULE_STORE.operation("get", userId);
      if (!saved) return {};
      return {
        schedule: {
          career: saved.career || null,
          studentName: saved.studentName || null,
          studentId: saved.studentId || null,
          classes: (saved.classes || []).slice(0, 35).map((c) => ({
            subject: c.subject,
            teacher: c.teacher,
            classroom: c.classroom,
            group: c.group,
            day: c.day,
            start: c.start,
            end: c.end,
          })),
        },
      };
    } catch {
      return {};
    }
  }

  async function send(value) {
    const text = String(value || "").trim().slice(0, 1200);
    if (!text || busy || !ctx?.client) return;
    if (!navigator.onLine || ctx.state.offline) {
      ctx.toast("Castor FIT necesita conexión a internet para responder.");
      return;
    }
    if (!opened) setOpen(true);
    busy = true;
    messages.push({ role: "user", content: text });
    renderMessages(true);
    const sendButton = host.querySelector("[data-chat-send]");
    if (sendButton) sendButton.disabled = true;
    const result = await ctx.client.request("/api/chatbot/message", "POST", {
      message: text,
      device_context: await deviceContext(),
    });
    if (result.error) {
      const unavailable = result.error.code === "chatbot_unavailable";
      messages.push({
        role: "assistant",
        content: unavailable
          ? "El asistente inteligente todavía no está configurado en el servidor. Un administrador debe agregar la clave de Claude en Render."
          : (result.error.message || "No pude responder en este momento. Inténtalo de nuevo."),
      });
    } else {
      messages.push({ role: "assistant", content: result.data?.reply || "No pude generar una respuesta." });
      if (result.data?.escalate) {
        messages.push({
          role: "assistant",
          content: "Este caso parece requerir seguimiento humano. Puedes revisar Mi cuenta o acudir con el personal responsable de la facultad; no te daré datos de contacto que no estén verificados en Guía FIT.",
        });
      }
    }
    messages = messages.slice(-24);
    busy = false;
    if (sendButton) sendButton.disabled = false;
    renderMessages(false);
  }

  function mount(nextCtx) {
    ctx = nextCtx;
    if (!ctx?.state?.user || ctx.state.demo || ctx.state.offline) {
      unmount();
      return;
    }
    createHost();
    bindTopLaunchers();
  }

  function unmount() {
    opened = false;
    busy = false;
    loadedFor = null;
    messages = [];
    clearTimeout(nudgeTimer);
    host?.remove();
    host = null;
    panel = null;
    document.querySelectorAll("[data-chat-launch]").forEach((button) => {
      button.onclick = null;
      button.setAttribute("aria-expanded", "false");
    });
  }

  root.FIT_CHATBOT = { mount, unmount, open };
})(window);
