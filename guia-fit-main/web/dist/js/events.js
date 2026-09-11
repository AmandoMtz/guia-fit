(function (root) {
  "use strict";
  const typeLabel = (type) => ({ student: "Alumno", teacher: "Docente", admin: "Administrador", other: "Cuenta externa" })[type] || "Cuenta";
  const fmt = (iso, opts = {}) => new Date(iso).toLocaleString("es-MX", { timeZone: "America/Monterrey", dateStyle: "medium", timeStyle: "short", ...opts });
  const dateOnly = (iso) => new Date(iso).toLocaleDateString("es-MX", { timeZone: "America/Monterrey", dateStyle: "long" });
  const localInput = (iso) => {
    const d = new Date(iso);
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Monterrey", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
    const g = (x) => p.find((y) => y.type === x)?.value || "";
    return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
  };
  function tokenFrom(value) {
    let token = String(value || "").trim();
    if (/^https?:\/\//i.test(token)) {
      try { token = new URL(token).searchParams.get("e") || ""; } catch { return ""; }
    }
    if (token.startsWith("FIT-EVENT:")) token = token.slice(10);
    return token;
  }
  async function download(c, path, name) {
    const response = await fetch(c.client.base + path, { credentials: "include", headers: { "X-FIT-Client": "web" } });
    if (!response.ok) {
      let message = "No se pudo generar el PDF.";
      try { message = (await response.json()).error?.message || message; } catch {}
      throw Error(message);
    }
    const blob = await response.blob(), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function api(c, path, method = "GET", body) {
    const result = await c.client.request(path, method, body);
    if (result.error) throw result.error;
    return result.data;
  }
  function tabs(c, current, accountType, canCreate) {
    const items = [
      ["events", "Próximos y recientes"],
      ["history", "Mis asistencias"],
      ["validate", "Validar PDF"],
    ];
    if (canCreate) items.splice(1, 0, ["manage", accountType === "admin" ? "Administrar eventos" : "Mis eventos creados"]);
    return `<div class="event-tabs">${items.map(([id, label]) => `<button class="${current === id ? "active" : ""}" data-event-tab="${id}">${c.esc(label)}</button>`).join("")}</div>`;
  }
  function eventCard(c, e, accountType, managed = false) {
    const target = e.visibility === "public"
      ? (e.audience === "students" ? "Todos los alumnos" : "Todos los docentes")
      : e.audience === "students"
        ? `Carreras: ${(e.careers || []).join(", ") || "Por definir"}`
        : `Invitados: ${(e.invitees || []).map((x) => x.full_name).join(", ") || "Por definir"}`;
    const status = e.attended ? '<span class="event-pill attended">Asistencia verificada</span>' : e.checkin_open ? '<span class="event-pill today">Verificación habilitada hoy</span>' : '';
    return `<article class="panel event-card" data-event-id="${c.esc(e.id)}">
      <div class="event-card-top"><div><span class="eyebrow">${e.audience === "students" ? "EVENTO PARA ALUMNOS" : "EVENTO PARA DOCENTES"}</span><h3>${c.esc(e.title)}</h3></div><div class="event-card-badges"><span class="event-pill">${e.visibility === "public" ? "Público" : "Cerrado"}</span>${status}</div></div>
      <p class="event-date">${c.icon("calendar")} <strong>${c.esc(fmt(e.starts_at))}</strong> — ${c.esc(fmt(e.ends_at))}</p>
      <p>${c.icon("pin")} ${c.esc(e.location)}</p>
      ${e.description ? `<p class="muted">${c.esc(e.description)}</p>` : ""}
      <div class="event-audience"><b>${c.esc(target)}</b><span>Creado por ${c.esc(e.creator_name || "Guía FIT")}</span>${managed ? `<span>${Number(e.attendance_count || 0)} asistencia(s) registrada(s)</span>` : ""}</div>
      ${e.can_manage ? `<div class="button-row event-actions"><button class="btn secondary small" data-event-edit="${c.esc(e.id)}">Editar / reagendar</button><button class="btn secondary small" data-event-qr="${c.esc(e.id)}">Generar QR</button><button class="btn secondary small" data-event-attendees="${c.esc(e.id)}">Asistentes</button><button class="text-button danger" data-event-delete="${c.esc(e.id)}">Eliminar</button></div>` : ""}
    </article>`;
  }
  function scanner(c, onToken) {
    const d = c.dialog(`<div class="dialog-content qr-scan-dialog"><span class="eyebrow">VERIFICAR ASISTENCIA</span><h2>Escanea el QR del evento</h2><p>La asistencia solo se registra el día del evento. El QR debe mostrarse por el organizador.</p><div class="qr-camera"><video id="qr-video" playsinline muted></video><div class="qr-frame" aria-hidden="true"></div></div><p class="hint" id="qr-camera-status">Solicitando acceso a la cámara…</p><div class="or">o escribe el código</div><form id="qr-manual"><label class="field">Código del evento<input name="token" autocomplete="off" placeholder="Código impreso debajo del QR"></label><button class="btn full">Registrar asistencia</button></form></div>`);
    let stream, timer, busy = false;
    const stop = () => { if (timer) clearInterval(timer); stream?.getTracks().forEach((x) => x.stop()); };
    d.addEventListener("close", stop, { once: true });
    const submit = async (value) => {
      if (busy) return; busy = true;
      try { await onToken(value); stop(); if (d.open) d.close(); }
      catch (e) { c.toast(e.message || "No se pudo registrar la asistencia."); busy = false; }
    };
    d.querySelector("#qr-manual").onsubmit = (ev) => { ev.preventDefault(); submit(ev.currentTarget.elements.token.value); };
    (async () => {
      const status = d.querySelector("#qr-camera-status"), video = d.querySelector("#qr-video");
      if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
        status.textContent = "Este navegador no permite escanear QR aquí. Usa la cámara del teléfono para abrir el QR o escribe el código.";
        d.querySelector(".qr-camera").hidden = true; return;
      }
      try {
        const supported = await BarcodeDetector.getSupportedFormats();
        if (!supported.includes("qr_code")) throw Error("qr");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        video.srcObject = stream; await video.play(); status.textContent = "Apunta la cámara al código QR.";
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        timer = setInterval(async () => {
          if (busy || video.readyState < 2) return;
          try {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) submit(codes[0].rawValue);
          } catch {}
        }, 450);
      } catch {
        status.textContent = "No se pudo abrir la cámara. Puedes escanear con la cámara del teléfono o escribir el código.";
        d.querySelector(".qr-camera").hidden = true;
      }
    })();
    return d;
  }
  function showQr(c, event, data) {
    const d = c.dialog(`<div class="dialog-content event-qr-dialog"><span class="eyebrow">ASISTENCIA POR QR</span><h2>${c.esc(event.title)}</h2><p>Muéstralo durante el evento. La verificación solo funcionará el <strong>${c.esc(dateOnly(event.starts_at))}</strong>.</p><div class="event-qr-image">${data.svg}</div><label class="field">Código alternativo<input id="event-qr-token" value="${c.esc(data.token)}" readonly></label><div class="button-row"><button class="btn secondary" id="copy-event-code">Copiar código</button></div><p class="hint">El QR abre Guía FIT y registra la asistencia después de iniciar sesión. Si reagendas el evento, se genera un QR nuevo.</p></div>`);
    d.querySelector("#copy-event-code").onclick = async () => {
      try { await navigator.clipboard.writeText(data.token); c.toast("Código copiado."); }
      catch { d.querySelector("#event-qr-token").select(); }
    };
  }
  async function attendees(c, event) {
    const rows = await api(c, `/api/events/${encodeURIComponent(event.id)}/attendees`);
    const d = c.dialog(`<div class="dialog-content event-attendees"><span class="eyebrow">ASISTENCIA VERIFICADA</span><h2>${c.esc(event.title)}</h2><p>${rows.length} persona(s) escanearon el QR.</p><div class="attendee-list">${rows.length ? rows.map((x, i) => `<div><b>${i + 1}. ${c.esc(x.full_name)}</b><span>${c.esc(x.email)}${x.student_id ? ` · ${c.esc(x.student_id)}` : ""}${x.career ? ` · ${c.esc(x.career)}` : ""}</span><small>${c.esc(fmt(x.checked_in_at))}</small></div>`).join("") : '<div class="empty">Todavía no hay asistencias verificadas.</div>'}</div><button class="btn full" id="download-attendees">Generar PDF con código de validación</button></div>`);
    d.querySelector("#download-attendees").onclick = async (ev) => {
      ev.currentTarget.disabled = true;
      try { await download(c, `/api/events/${encodeURIComponent(event.id)}/attendees.pdf`, "asistentes-evento-fit.pdf"); }
      catch (e) { c.toast(e.message); }
      finally { ev.currentTarget.disabled = false; }
    };
  }
  function eventForm(c, accountType, options, event, onSaved) {
    const editing = !!event;
    const defaultAudience = accountType === "teacher" ? "teachers" : "students";
    const audience = event?.audience || defaultAudience;
    const starts = event?.starts_at || new Date(Date.now() + 86400000).toISOString();
    const ends = event?.ends_at || new Date(Date.now() + 90000000).toISOString();
    const d = c.dialog(`<div class="dialog-content event-edit-dialog"><span class="eyebrow">${editing ? "EDITAR EVENTO" : "NUEVO EVENTO"}</span><h2>${editing ? c.esc(event.title) : "Organiza un evento en la FIT"}</h2><form id="event-form">
      <label class="field">Nombre del evento<input name="title" required minlength="3" maxlength="160" value="${c.esc(event?.title || "")}"></label>
      <label class="field">Descripción<textarea name="description" maxlength="2500">${c.esc(event?.description || "")}</textarea></label>
      <label class="field">Lugar<input name="location" required minlength="2" maxlength="180" value="${c.esc(event?.location || "")}"></label>
      ${accountType === "admin" ? `<label class="field">Público<select name="audience"><option value="students" ${audience === "students" ? "selected" : ""}>Alumnos</option><option value="teachers" ${audience === "teachers" ? "selected" : ""}>Docentes</option></select></label>` : `<input type="hidden" name="audience" value="teachers"><div class="notice">Este evento será visible únicamente en el apartado de docentes.</div>`}
      <div class="form-grid"><label class="field">Inicio<input type="datetime-local" name="starts_at" required value="${localInput(starts)}"></label><label class="field">Fin<input type="datetime-local" name="ends_at" required value="${localInput(ends)}"></label></div>
      <label class="field">Visibilidad<select name="visibility"><option value="public" ${event?.visibility !== "targeted" ? "selected" : ""}>Público para su audiencia</option><option value="targeted" ${event?.visibility === "targeted" ? "selected" : ""}>Cerrado / exclusivo</option></select></label>
      <div id="event-targets"></div><p class="field-error" role="alert" id="event-form-error"></p><button class="btn full" type="submit">${editing ? "Guardar cambios" : "Crear evento"}</button></form></div>`);
    const f = d.querySelector("#event-form"), target = d.querySelector("#event-targets");
    const drawTargets = () => {
      if (f.elements.visibility.value !== "targeted") { target.innerHTML = '<p class="hint">Aparecerá a todas las cuentas de ese público.</p>'; return; }
      if (f.elements.audience.value === "students") {
        target.innerHTML = `<label class="field">Carreras permitidas<textarea name="careers" required placeholder="Una carrera por línea o separadas por coma">${c.esc((event?.careers || []).join("\n"))}</textarea></label>${options.careers?.length ? `<p class="hint">Carreras ya registradas: ${options.careers.map(c.esc).join(" · ")}</p>` : '<p class="hint">Escribe exactamente el nombre de cada carrera. Los alumnos deben tenerla registrada en Mi cuenta.</p>'}`;
      } else {
        const selected = new Set((event?.invitees || []).map((x) => x.id));
        target.innerHTML = `<label class="field">Docentes invitados<select name="invitees" multiple size="${Math.min(9, Math.max(4, options.teachers?.length || 4))}" required>${(options.teachers || []).map((x) => `<option value="${c.esc(x.id)}" ${selected.has(x.id) ? "selected" : ""}>${c.esc(x.full_name)} · ${c.esc(x.email)}</option>`).join("")}</select></label><p class="hint">Mantén Ctrl (Windows) o Cmd (Mac) para seleccionar varios docentes.</p>`;
      }
    };
    f.elements.visibility.onchange = drawTargets;
    if (f.elements.audience) f.elements.audience.onchange = drawTargets;
    drawTargets();
    f.onsubmit = async (ev) => {
      ev.preventDefault(); const b = f.querySelector("[type=submit]"); if (b.disabled) return; b.disabled = true;
      try {
        const audienceValue = f.elements.audience.value, visibility = f.elements.visibility.value;
        const body = {
          title: f.elements.title.value.trim(), description: f.elements.description.value.trim(), location: f.elements.location.value.trim(), audience: audienceValue, visibility,
          starts_at: new Date(`${f.elements.starts_at.value}:00-06:00`).toISOString(), ends_at: new Date(`${f.elements.ends_at.value}:00-06:00`).toISOString(), careers: [], invitees: [],
        };
        if (visibility === "targeted" && audienceValue === "students") body.careers = String(f.elements.careers?.value || "").split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
        if (visibility === "targeted" && audienceValue === "teachers") body.invitees = [...(f.elements.invitees?.selectedOptions || [])].map((x) => x.value);
        await api(c, editing ? `/api/events/${event.id}` : "/api/events", editing ? "PATCH" : "POST", body);
        d.close(); c.toast(editing ? "Evento actualizado." : "Evento creado."); await onSaved();
      } catch (e) { d.querySelector("#event-form-error").textContent = e.message || "No se pudo guardar el evento."; }
      finally { b.disabled = false; }
    };
  }
  async function render(c) {
    const host = c.$("#view");
    if (c.state.demo || !c.state.user) {
      host.innerHTML = '<section class="panel"><h2>Eventos de la facultad</h2><p>Inicia sesión para consultar los eventos dirigidos a tu cuenta.</p></section>'; return;
    }
    const accountType = c.state.user.account_type || "other";
    if (accountType === "other") {
      host.innerHTML = `<section class="panel"><h2>Cuenta institucional no identificada</h2><p>Los eventos se separan entre alumnos y docentes usando el correo institucional.</p><div class="notice">Alumno: <b>a##########@alumnos.uat.edu.mx</b><br>Docente: <b>@uat.edu.mx</b> o <b>@docentes.uat.edu.mx</b></div><p class="hint">Si tu correo institucional usa otro formato, administración puede revisar la regla antes de habilitar este módulo.</p></section>`; return;
    }
    host.innerHTML = '<p role="status">Cargando eventos…</p>';
    try {
      const [events, attendanceHistory, options] = await Promise.all([
        api(c, "/api/events"), api(c, "/api/events/attendance/me"), api(c, "/api/events/options"),
      ]);
      if (!host.isConnected) return;
      const canCreate = accountType === "admin" || accountType === "teacher";
      const current = c.state.eventsTab || "events";
      host.innerHTML = `${tabs(c, current, accountType, canCreate)}<div id="event-tab-content"></div>`;
      host.querySelectorAll("[data-event-tab]").forEach((b) => b.onclick = () => { c.state.eventsTab = b.dataset.eventTab; render(c); });
      const content = host.querySelector("#event-tab-content");
      const bind = () => {
        content.querySelectorAll("[data-event-edit]").forEach((b) => b.onclick = () => eventForm(c, accountType, options, events.find((e) => e.id === b.dataset.eventEdit), () => render(c)));
        content.querySelectorAll("[data-event-delete]").forEach((b) => b.onclick = async () => {
          const event = events.find((e) => e.id === b.dataset.eventDelete); if (!confirm(`¿Eliminar “${event.title}”? También se eliminarán sus registros de asistencia.`)) return;
          b.disabled = true; try { await api(c, `/api/events/${event.id}`, "DELETE"); c.toast("Evento eliminado."); await render(c); } catch (e) { c.toast(e.message); b.disabled = false; }
        });
        content.querySelectorAll("[data-event-qr]").forEach((b) => b.onclick = async () => {
          b.disabled = true; try { const event = events.find((e) => e.id === b.dataset.eventQr), data = await api(c, `/api/events/${event.id}/qr`); showQr(c, event, data); } catch (e) { c.toast(e.message); } finally { b.disabled = false; }
        });
        content.querySelectorAll("[data-event-attendees]").forEach((b) => b.onclick = async () => { b.disabled = true; try { await attendees(c, events.find((e) => e.id === b.dataset.eventAttendees)); } catch (e) { c.toast(e.message); } finally { b.disabled = false; } });
      };
      const checkin = async (raw) => {
        const token = tokenFrom(raw); if (!token) throw Error("El código no es válido.");
        const data = await api(c, "/api/events/checkin", "POST", { token });
        c.toast(data.already_registered ? `Tu asistencia a “${data.title}” ya estaba registrada.` : `Asistencia registrada: ${data.title}.`);
        c.state.pendingEventToken = null;
        const url = new URL(location.href); url.searchParams.delete("e"); history.replaceState(null, "", url.pathname + url.search + url.hash);
        await render(c);
      };
      if (c.state.pendingEventToken && !c.state.eventCheckinBusy) {
        c.state.eventCheckinBusy = true;
        setTimeout(async () => { try { await checkin(c.state.pendingEventToken); } catch (e) { c.toast(e.message); c.state.pendingEventToken = null; const url = new URL(location.href); url.searchParams.delete("e"); history.replaceState(null, "", url.pathname + url.search + url.hash); } finally { c.state.eventCheckinBusy = false; } }, 0);
      }
      if (current === "events") {
        const visible = events.filter((e) => e.audience === (accountType === "student" ? "students" : accountType === "teacher" ? "teachers" : e.audience));
        const checkinToday = visible.some((e) => e.checkin_open);
        content.innerHTML = `<section class="events-intro panel"><div><span class="eyebrow">${typeLabel(accountType).toUpperCase()}</span><h2>${accountType === "student" ? "Eventos para ti" : accountType === "teacher" ? "Eventos para docentes" : "Eventos de la facultad"}</h2><p>${accountType === "student" ? "Los eventos cerrados aparecen según la carrera guardada en Mi cuenta." : accountType === "teacher" ? "Aquí verás eventos públicos para docentes y aquellos a los que fuiste invitado." : "Administración puede consultar y gestionar los eventos para alumnos; también puede apoyar con eventos docentes."}</p></div>${accountType !== "admin" ? `<button class="btn" id="scan-event-qr" ${checkinToday ? "" : "disabled"}>${checkinToday ? "Escanear QR de asistencia" : "Verificación disponible el día del evento"}</button>` : ""}</section>${accountType === "student" && !c.state.profile?.career ? '<div class="notice">Completa tu carrera en <b>Mi cuenta</b> para recibir eventos cerrados dirigidos a tu programa académico.</div>' : ""}<div class="event-grid">${visible.length ? visible.map((e) => eventCard(c, e, accountType)).join("") : '<div class="empty">No hay eventos disponibles para tu cuenta.</div>'}</div>`;
        if (content.querySelector("#scan-event-qr")) content.querySelector("#scan-event-qr").onclick = () => scanner(c, checkin);
        bind();
      } else if (current === "manage") {
        const managed = events.filter((e) => e.can_manage);
        content.innerHTML = `<section class="panel events-manage-head"><div><span class="eyebrow">ORGANIZACIÓN</span><h2>${accountType === "admin" ? "Administrar eventos" : "Mis eventos docentes"}</h2><p>${accountType === "admin" ? "Los eventos para alumnos solo pueden crearse, modificarse, reagendarse o eliminarse desde cuentas administradoras." : "Cualquier docente puede crear eventos para todos los docentes o invitar únicamente a cuentas específicas."}</p></div><button class="btn" id="new-event">+ Crear evento</button></section><div class="event-grid">${managed.length ? managed.map((e) => eventCard(c, e, accountType, true)).join("") : '<div class="empty">Todavía no has creado eventos.</div>'}</div>`;
        content.querySelector("#new-event").onclick = () => eventForm(c, accountType, options, null, () => render(c)); bind();
      } else if (current === "history") {
        content.innerHTML = `<section class="panel history-head"><div><span class="eyebrow">REGISTRO PERSONAL</span><h2>Mis asistencias verificadas</h2><p>Solo aparecen eventos cuya asistencia se confirmó mediante el QR del organizador.</p></div><button class="btn" id="my-events-pdf">Generar PDF</button></section><div class="attendance-history">${attendanceHistory.length ? attendanceHistory.map((x) => `<article class="panel"><h3>${c.esc(x.title)}</h3><p>${c.icon("calendar")} ${c.esc(fmt(x.starts_at))}</p><p>${c.icon("pin")} ${c.esc(x.location)}</p><span class="event-pill attended">Verificado ${c.esc(fmt(x.checked_in_at))}</span></article>`).join("") : '<div class="empty">Aún no tienes asistencias verificadas.</div>'}</div>`;
        content.querySelector("#my-events-pdf").onclick = async (b) => { b.currentTarget.disabled = true; try { await download(c, "/api/events/attendance/me.pdf", "mis-eventos-fit.pdf"); } catch (e) { c.toast(e.message); } finally { b.currentTarget.disabled = false; } };
      } else {
        content.innerHTML = `<section class="panel validate-document"><span class="eyebrow">VALIDACIÓN</span><h2>Validar un PDF de eventos</h2><p>Escribe el código FIT que aparece al final del documento.</p><form id="validate-event-document"><label class="field">Código de validación<input name="code" required maxlength="64" placeholder="FIT-2026-XXXXXXXXXXXX"></label><button class="btn">Validar documento</button></form><div id="validation-result"></div></section>`;
        content.querySelector("#validate-event-document").onsubmit = async (ev) => {
          ev.preventDefault(); const b = ev.currentTarget.querySelector("button"), code = ev.currentTarget.elements.code.value.trim().toUpperCase(), out = content.querySelector("#validation-result"); b.disabled = true;
          try {
            const data = await api(c, `/api/events/documents/${encodeURIComponent(code)}`);
            out.innerHTML = `<div class="notice success"><b>Documento válido</b><br>${data.document_type === "my_attendance" ? `Historial de ${c.esc(data.subject_name || "usuario")}` : `Reporte de asistentes: ${c.esc(data.event_title || "evento")}`}<br>${Number(data.item_count || 0)} registro(s) · Emitido ${c.esc(fmt(data.generated_at))}</div>`;
          } catch (e) { out.innerHTML = `<div class="notice error">${c.esc(e.message || "Código no válido.")}</div>`; }
          finally { b.disabled = false; }
        };
      }
    } catch (e) {
      host.innerHTML = `<div class="notice error">${c.esc(e.message || "No se pudieron cargar los eventos.")}</div>`;
    }
  }
  root.FIT_EVENTS = { render };
})(window);
