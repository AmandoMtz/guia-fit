(function (root) {
  "use strict";
  const S = root.FIT_SCHEDULE_CORE;
  let pdfLibrary;
  const storage = (method, key, value) =>
    root.FIT_SCHEDULE_STORE.operation(method, key, value);
  async function pdfjs() {
    if (!pdfLibrary) {
      pdfLibrary = await import("../vendor/pdfjs/pdf.mjs");
      pdfLibrary.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.mjs";
    }
    return pdfLibrary;
  }
  async function openPdf(bytes) {
    const lib = await pdfjs();
    return lib.getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      useWasm: false,
      cMapUrl: "vendor/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "vendor/pdfjs/standard_fonts/",
    }).promise;
  }
  function blank(c) {
    const teacher = c.state.user?.account_type === "teacher";
    return {
      userId: c.state.user.id,
      accountType: teacher ? "teacher" : "student",
      career: teacher ? "Horario docente" : (c.state.profile?.career || ""),
      studentName: c.state.profile?.full_name || "",
      studentId: teacher ? c.state.user.email : (c.state.profile?.student_id || ""),
      classes: [],
      reviewedAt: null,
    };
  }
  function button(c, el, fn) {
    el.onclick = async () => {
      if (el.disabled) return;
      el.disabled = true;
      try {
        await fn();
      } catch (e) {
        c.toast(e.message);
      } finally {
        el.disabled = false;
      }
    };
  }
  async function render(c) {
    const host = c.$("#view");
    if (c.state.demo) {
      host.innerHTML = `<section class="schedule-welcome panel"><div class="calendar-art" aria-hidden="true">${c.icon("calendar")}</div><span class="eyebrow">TU SEMANA EN ORDEN</span><h2>De tu horario<br>a tu próximo salón.</h2><p>Guarda tu horario en este dispositivo, revisa tus clases y consulta tu semana de un vistazo.</p><button class="btn" id="schedule-login">Iniciar sesión ${c.icon("arrow")}</button></section>`;
      c.$("#schedule-login").onclick = c.signOut;
      return;
    }
    host.innerHTML = '<p role="status">Abriendo tu horario local…</p>';
    try {
      const saved = await storage("get", c.state.user.id);
      if (!host.isConnected) return;
      draw(c, host, saved);
    } catch (e) {
      if (host.isConnected)
        host.innerHTML = `<div class="notice error">${c.esc(e.message)}</div>`;
    }
  }
  function draw(c, host, saved) {
    if (!saved) {
      const teacher = c.state.user?.account_type === "teacher";
      if (c.state.offline) {
        host.innerHTML = `<section class="schedule-welcome panel"><div class="calendar-art" aria-hidden="true">${c.icon("calendar")}</div><span class="eyebrow">MODO SIN CONEXIÓN</span><h2>No hay un horario guardado<br>en este dispositivo.</h2><p>Para usar el horario sin internet, primero debes cargarlo y guardarlo mientras tu sesión está disponible en línea.</p><div class="notice">Conéctate a internet, abre <b>Mi horario</b> y guarda tu horario al menos una vez.</div></section>`;
        return;
      }
      host.innerHTML = `<section class="schedule-welcome panel"><div class="calendar-art" aria-hidden="true">${c.icon("calendar")}</div><span class="eyebrow">${teacher ? "HORARIO DOCENTE" : "TU SEMANA EN ORDEN"}</span><h2>${teacher ? "Tus clases,<br>sin datos de más." : "Cada clase,<br>en su lugar."}</h2><p>${teacher ? "Carga una imagen/PDF o captura manualmente. Como docente solo necesitas materia, salón, día y hora." : "Sube una imagen o el PDF de tu horario. Revisa tu carrera, matrícula y materias, y organiza tu semana."}</p><div class="button-row"><button class="btn" id="import-pdf">${c.icon("calendar")} Subir imagen o PDF</button><button class="btn secondary" id="manual-schedule">Capturar manualmente</button></div><div class="schedule-steps"><span><b>01</b> Importa tu horario</span><span><b>02</b> Revisa los datos</span><span><b>03</b> Consulta tu semana</span></div><p class="hint">Solo en este dispositivo y navegador. Se guardan los datos estructurados; la app descarta el archivo después de leerlo. Hasta 8 MB y 20 páginas.</p></section>`;
      host.querySelector("#manual-schedule").onclick = () =>
        review(c, blank(c));
      button(c, host.querySelector("#import-pdf"), () => importPdf(c));
      return;
    }
    const week = c.state.scheduleWeek || 0,
      today = new Date(),
      monday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - ((today.getDay() + 6) % 7) + week * 7,
      );
    const date = (d) =>
      new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + d);
    const conflicts = S.overlaps(saved.classes),
      total = saved.classes.reduce(
        (n, x) => n + S.time(x.end) - S.time(x.start),
        0,
      );
    const subjectCount = new Set(saved.classes.map((x) => S.norm(x.subject)))
      .size;
    const teacher = saved.accountType === "teacher" || c.state.user?.account_type === "teacher",
      offline = !!c.state.offline;
    host.innerHTML = `${offline ? '<div class="notice offline-readonly"><b>Horario disponible sin conexión.</b> Puedes consultarlo y cambiar de semana, pero para editarlo o vincular salones necesitas internet.</div>' : ""}<section class="schedule-header"><div><span class="eyebrow">${teacher ? "DOCENTE · MI HORARIO" : `${c.esc(saved.studentId)} · MI HORARIO`}</span><h2>${teacher ? c.esc(saved.studentName || c.state.profile?.full_name || "Horario docente") : c.esc(saved.career)}</h2><p class="student-line">${c.esc(c.state.user.email)}</p><p>Revisado por ti el ${new Date(saved.reviewedAt).toLocaleDateString("es-MX")}. No es una validación institucional.</p></div><div class="schedule-numbers"><div><b>${subjectCount}</b><span>materias</span></div><div><b>${Math.round(total / 6) / 10}</b><span>horas / semana</span></div></div></section><div class="schedule-toolbar"><div class="button-row"><button class="btn secondary small" id="week-prev" aria-label="Semana anterior">←</button><strong>${date(0).toLocaleDateString("es-MX", { day: "numeric", month: "short" })} — ${date(6).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</strong><button class="btn secondary small" id="week-next" aria-label="Semana siguiente">→</button><button class="text-button" id="week-today">Hoy</button></div>${offline ? "" : '<div class="button-row"><button class="btn small" id="edit-schedule">Editar horario</button></div>'}</div>${conflicts.length ? `<div class="notice">Hay clases que se superponen.${offline ? "" : " Revisa las horas en Editar horario."}</div>` : ""}<details class="subject-table-panel" open><summary>${teacher ? "Mis clases · Materia, salón y horario" : "Mis materias · Tabla de 11 columnas"}</summary>${root.FIT_TIMETABLE.renderSubjects(c, saved)}</details>${root.FIT_TIMETABLE.render(c, saved, monday, conflicts)}<p class="hint">Semana recurrente. No incorpora vacaciones ni cambios oficiales. Guardado solo en este dispositivo; borrar los datos del navegador elimina el horario.</p>${offline ? "" : '<div class="button-row"><button class="text-button" id="replace-pdf">Importar otro horario</button><button class="text-button danger" id="delete-schedule">Eliminar horario</button></div>'}`;
    host.querySelector("#week-prev").onclick = () => {
      c.state.scheduleWeek = week - 1;
      draw(c, host, saved);
    };
    host.querySelector("#week-next").onclick = () => {
      c.state.scheduleWeek = week + 1;
      draw(c, host, saved);
    };
    host.querySelector("#week-today").onclick = () => {
      c.state.scheduleWeek = 0;
      draw(c, host, saved);
    };
    if (!offline) {
      host.querySelector("#edit-schedule").onclick = () =>
        review(c, structuredClone(saved));
      button(c, host.querySelector("#replace-pdf"), () => importPdf(c));
      button(c, host.querySelector("#delete-schedule"), async () => {
        if (!confirm("¿Eliminar de este dispositivo los datos de tu horario?"))
          return;
        await storage("delete", saved.userId);
        c.toast("Horario eliminado de este dispositivo.");
        c.render();
      });
      host
        .querySelectorAll("[data-table-edit]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              review(c, structuredClone(saved), false, b.dataset.tableEdit)),
        );
      host
        .querySelectorAll("[data-class-place]")
        .forEach(
          (b) => (b.onclick = () => c.navigate("route", b.dataset.classPlace)),
        );
    }
  }
  async function imageCanvas(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const scale = Math.min(
        1,
        3200 / Math.max(img.naturalWidth, img.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function importPdf(c) {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept =
      "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";
    picker.onchange = async () => {
      const file = picker.files[0];
      if (!file) return;
      if (file.size > 8388608) {
        c.toast("El archivo debe pesar hasta 8 MB.");
        return;
      }
      const userId = c.state.user?.id;
      const progress = c.dialog(
        '<div class="dialog-content"><h2>Importando tu horario…</h2><p role="status">El documento se procesa en este dispositivo.</p><p class="hint">La lectura de imágenes puede tardar un momento. Después podrás corregir todos los datos.</p></div>',
      );
      let doc;
      const announce = (message) => {
        const el = progress.querySelector("[role=status]");
        if (el) el.textContent = message;
      };
      const ocr = async (canvas) => {
        const result = await root.FIT_OCR.read(
          canvas.toDataURL("image/png"),
          announce,
        );
        return S.rowsFromOcr
          ? S.rowsFromOcr(result)
          : result.boxes.length
            ? S.rowsFromBoxes(result.boxes)
            : result.text.split(/\r?\n/).filter(Boolean);
      };
      try {
        const bytes = await file.arrayBuffer(),
          lines = [];
        const isPdf = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
        let source;
        if (isPdf) {
          doc = await openPdf(bytes.slice(0));
          if (doc.numPages > 20)
            throw Error("Selecciona un PDF de hasta 20 páginas.");
          for (let n = 1; n <= doc.numPages; n++) {
            if (!progress.isConnected) return;
            announce(`Leyendo página ${n} de ${doc.numPages}…`);
            const page = await doc.getPage(n),
              content = await page.getTextContent();
            const textLines = S.rowsFromItems(content.items);
            if (textLines.join("").trim().length > 30) {
              lines.push(...textLines);
            } else {
              const first = page.getViewport({ scale: 1 }),
                viewport = page.getViewport({
                  scale: Math.min(
                    2.5,
                    2800 / Math.max(first.width, first.height),
                  ),
                }),
                canvas = document.createElement("canvas");
              canvas.width = Math.ceil(viewport.width);
              canvas.height = Math.ceil(viewport.height);
              await page.render({
                canvasContext: canvas.getContext("2d"),
                viewport,
              }).promise;
              lines.push(...(await ocr(canvas)));
            }
          }
        } else {
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
            throw Error("Selecciona una imagen JPG, PNG, WebP o un PDF.");
          source = new Blob([bytes], { type: file.type });
          lines.push(...(await ocr(await imageCanvas(source))));
        }
        if (c.state.user?.id !== userId || !progress.isConnected) return;
        const parsed = S.parse(lines),
          next = { ...blank(c), ...parsed };
        picker.value = "";
        await doc?.destroy();
        doc = null;
        source = null;
        progress.close();
        review(c, next, true);
      } catch (e) {
        c.toast(
          e.name === "PasswordException"
            ? "El PDF está protegido. Usa una copia sin contraseña."
            : e.message ||
                "No se pudo leer el archivo. Puedes capturar el horario manualmente.",
        );
      } finally {
        picker.value = "";
        await doc?.destroy();
        if (progress.isConnected) progress.close();
      }
    };
    picker.click();
  }
  function review(c, draft, imported = false, editId = null) {
    const teacherMode = draft.accountType === "teacher" || c.state.user?.account_type === "teacher";
    if (teacherMode) {
      draft.accountType = "teacher";
      draft.studentName = c.state.profile?.full_name || "Docente";
      draft.studentId = c.state.user.email;
      draft.career = "Horario docente";
      draft.classes = (draft.classes || []).map((x) => ({ ...x, teacher: c.state.profile?.full_name || "Docente", group: "" }));
    }
    const studentFields = teacherMode ? "" : `<label class="field">Nombre del estudiante<input name="studentName" value="${c.esc(draft.studentName || c.state.profile?.full_name || "")}" maxlength="160"></label><div class="form-grid"><label class="field">Carrera<input name="career" value="${c.esc(draft.career)}" required minlength="3" maxlength="160"></label><label class="field">Matrícula<input name="studentId" value="${c.esc(draft.studentId)}" required minlength="3" maxlength="30" pattern="[A-Za-z0-9-]+"></label></div>`;
    const d = c.dialog(
      `<div class="dialog-content schedule-review"><span class="eyebrow">REVISA ANTES DE GUARDAR</span><h2>${teacherMode ? "Horario docente" : "Tu horario, a tu manera."}</h2><p>${imported ? `${draft.classes.length} clases detectadas. ${teacherMode ? "Revisa materia, salón, días y horas." : "Revisa las 11 columnas, los días y las horas."} El archivo ya fue descartado por la app.` : teacherMode ? "Edita tus materias, salones, días y horas." : "Edita tu carrera, matrícula y clases."}</p>${imported && !draft.classes.length ? '<div class="notice">No se reconocieron clases automáticamente. Puedes completar los datos manualmente.</div>' : ""}<form id="schedule-review-form">${studentFields}<div class="section-heading"><h3>Clases de la semana</h3><div class="button-row"><button class="btn secondary small" type="button" id="add-class">+ Agregar clase</button></div></div><div id="review-grid"></div><div id="review-classes"></div>${draft.warnings?.length ? `<div class="notice"><b>Hay datos por revisar</b><ul>${draft.warnings.map((w) => `<li>${c.esc(w)}</li>`).join("")}</ul></div>` : ""}${draft.text ? `<details class="pdf-text"><summary>Consultar texto detectado del archivo</summary><pre>${c.esc(draft.text)}</pre></details>` : ""}<label class="check review-check"><input type="checkbox" name="confirmed" required> ${teacherMode ? "Revisé las materias, salones, días y horas." : "Revisé la matrícula, carrera y las clases contra mi horario."}</label><p class="hint">Se guarda localmente para tu cuenta en este dispositivo. Esta revisión no acredita información institucional.</p><p class="field-error" role="alert" id="review-error"></p><button class="btn full" type="submit">Guardar mi horario</button></form></div>`,
    );
    const f = d.querySelector("form");
    const redraw = () => {
      f.confirmed.checked = false;
      d.querySelector("#review-grid").innerHTML = root.FIT_TIMETABLE.renderSubjects(c, draft);
      d.querySelector("#review-classes").innerHTML = draft.classes.length
        ? draft.classes.map((x) => `<div class="review-row"><div><b>${c.esc(x.subject || "Materia por completar")}</b><span>${S.days[x.day - 1] || "Día por confirmar"} · ${c.esc(x.start)}–${c.esc(x.end)}</span><small>${teacherMode ? `Salón ${c.esc(x.classroom || "pendiente")}` : `${c.esc(x.teacher || "Maestro pendiente")} · Grupo ${c.esc(x.group || "—")} · ${c.esc(x.classroom || "Salón pendiente")}`}</small>${S.validate(x) ? '<small class="field-error">Completa los datos de esta clase</small>' : ""}</div><div class="button-row"><button class="btn secondary small" type="button" data-edit-class="${c.esc(x.id)}">Editar</button><button class="text-button danger" type="button" data-remove-class="${c.esc(x.id)}">Quitar</button></div></div>`).join("")
        : '<div class="empty">Agrega la primera clase. Usa una entrada por día y bloque horario.</div>';
      d.querySelectorAll("[data-edit-class]").forEach((b) => b.onclick = () => editClass(c, draft, draft.classes.find((x) => x.id === b.dataset.editClass), redraw));
      d.querySelectorAll("[data-remove-class]").forEach((b) => b.onclick = () => { draft.classes = draft.classes.filter((x) => x.id !== b.dataset.removeClass); redraw(); });
    };
    d.querySelector("#add-class").onclick = () => {
      if (draft.classes.length >= 120) { c.toast("Puedes guardar hasta 120 bloques de clase."); return; }
      editClass(c, draft, null, redraw);
    };
    if (!teacherMode) {
      f.studentName.oninput = f.career.oninput = f.studentId.oninput = () => { f.confirmed.checked = false; };
    }
    f.onsubmit = async (e) => {
      e.preventDefault(); const b = f.querySelector("[type=submit]"); if (b.disabled) return; b.disabled = true;
      try {
        if (!draft.classes.length) throw Error("Agrega al menos una clase para generar el calendario.");
        if (teacherMode) draft.classes = draft.classes.map((x) => ({ ...x, teacher: c.state.profile?.full_name || "Docente", group: "" }));
        const invalid = draft.classes.find((x) => S.validate(x));
        if (invalid) throw Error(`Revisa ${invalid.subject || "la clase"}: ${S.validate(invalid)}`);
        if (c.state.user?.id !== draft.userId) throw Error("La sesión cambió. Abre el horario desde tu cuenta.");
        if (!teacherMode) {
          draft.studentName = f.studentName.value.trim(); draft.career = f.career.value.trim(); draft.studentId = f.studentId.value.trim(); draft.accountType = "student";
        } else {
          draft.studentName = c.state.profile?.full_name || "Docente"; draft.career = "Horario docente"; draft.studentId = c.state.user.email; draft.accountType = "teacher";
        }
        draft.reviewedAt = new Date().toISOString(); delete draft.text; delete draft.warnings;
        await storage("put", draft.userId, draft); d.close(); c.toast("Horario guardado en este dispositivo."); c.render();
      } catch (e) { d.querySelector("#review-error").textContent = e.message; }
      finally { b.disabled = false; }
    };
    redraw();
    if (editId) { const current = draft.classes.find((x) => x.id === editId); if (current) editClass(c, draft, current, redraw); }
  }
  function editClass(c, draft, current, done) {
    const teacherMode = draft.accountType === "teacher" || c.state.user?.account_type === "teacher";
    const x = current || { id: crypto.randomUUID(), subject: "", teacher: teacherMode ? (c.state.profile?.full_name || "Docente") : "", classroom: "", group: "", day: 1, start: "08:00", end: "09:00", place_id: "" };
    const identityFields = teacherMode
      ? `<label class="field">Materia<input name="subject" required maxlength="160" value="${c.esc(x.subject)}"></label><label class="field">Salón<input name="classroom" required maxlength="100" value="${c.esc(x.classroom)}"></label>`
      : [["subject", "Materia", 160], ["teacher", "Maestro", 160], ["classroom", "Salón", 100], ["group", "Grupo", 40]].map(([n,l,max]) => `<label class="field">${l}<input name="${n}" ${n === "group" ? "" : "required"} maxlength="${max}" value="${c.esc(x[n])}"></label>`).join("");
    const d = c.dialog(`<div class="dialog-content"><h2>${current ? "Editar clase" : "Agregar clase"}</h2><form>${identityFields}<div class="form-grid"><label class="field">Día<select name="day">${S.days.map((n, i) => `<option value="${i + 1}" ${x.day === i + 1 ? "selected" : ""}>${n}</option>`).join("")}</select></label><label class="field">Entrada<input type="time" name="start" required value="${c.esc(x.start)}"></label><label class="field">Salida<input type="time" name="end" required value="${c.esc(x.end)}"></label></div><label class="field">Vincular con el directorio (opcional)<select name="place_id"><option value="">Sin vincular</option>${c.state.places.map((p) => `<option value="${c.esc(p.id)}" ${p.id === x.place_id ? "selected" : ""}>${c.esc(p.name)}</option>`).join("")}</select></label><p class="hint">Elige el espacio solo si corresponde al salón de tu horario.</p><p class="field-error" role="alert"></p><button class="btn full" type="submit">Guardar clase</button></form></div>`);
    d.querySelector("form").onsubmit = (e) => {
      e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget));
      const next = { ...x, ...data, day: Number(data.day), teacher: teacherMode ? (c.state.profile?.full_name || "Docente") : data.teacher, group: teacherMode ? "" : (data.group || "") };
      const err = S.validate(next); if (err) { d.querySelector("[role=alert]").textContent = err; return; }
      if (current) draft.classes[draft.classes.indexOf(current)] = next; else draft.classes.push(next);
      d.close(); done();
    };
  }
  root.FIT_SCHEDULE = { render };
})(window);
