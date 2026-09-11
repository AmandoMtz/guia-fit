(function (root) {
  function renderSubjects(c, saved) {
    const S = root.FIT_SCHEDULE_CORE,
      rows = new Map();
    const teacherMode = saved.accountType === "teacher" || c.state.user?.account_type === "teacher";
    for (const x of saved.classes) {
      const key = JSON.stringify([
        x.group || "",
        x.subject,
        x.classroom,
        x.teacher,
      ]);
      if (!rows.has(key))
        rows.set(key, { ...x, days: Array.from({ length: 7 }, () => []) });
      if (x.day >= 1 && x.day <= 7)
        rows.get(key).days[x.day - 1].push(x.start + "–" + x.end);
    }
    if (teacherMode) {
      return `<div class="timetable-scroll" role="region" aria-label="Horario docente" tabindex="0"><table class="subjects-table teacher-subjects"><caption class="screen-reader">Materia, salón y horarios del docente</caption><thead><tr><th scope="col">MATERIA</th><th scope="col">SALÓN</th>${S.days.map((n) => `<th scope="col">${c.esc(n.toUpperCase())}</th>`).join("")}</tr></thead><tbody>${[...rows.values()].map((x) => `<tr><th scope="row">${c.esc(x.subject)}</th><td>${c.esc(x.classroom || "—")}</td>${x.days.map((d) => `<td class="${d.length ? "has-class" : "no-class"}">${d.length ? [...new Set(d)].sort().map((t) => `<span>${c.esc(t)}</span>`).join("") : "—"}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="table-mobile-hint">Tu vista docente muestra únicamente materia, salón, día y hora.</p>`;
    }
    return `<div class="timetable-scroll" role="region" aria-label="Materias en once columnas" tabindex="0"><table class="subjects-table"><caption class="screen-reader">GPO, materia, aula, lunes a domingo y profesor</caption><thead><tr>${S.fitColumns.map((n) => `<th scope="col">${c.esc(n)}</th>`).join("")}</tr></thead><tbody>${[
      ...rows.values(),
    ]
      .map(
        (x) =>
          `<tr><td><span class="group-pill">${c.esc(x.group || "—")}</span></td><th scope="row">${c.esc(x.subject)}</th><td>${c.esc(x.classroom || "—")}</td>${x.days
            .map(
              (d) =>
                `<td class="${d.length ? "has-class" : "no-class"}">${
                  d.length
                    ? [...new Set(d)]
                        .sort()
                        .map((t) => `<span>${c.esc(t)}</span>`)
                        .join("")
                    : "—"
                }</td>`,
            )
            .join("")}<td>${c.esc(x.teacher || "Por completar")}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div><p class="table-mobile-hint">Desliza para ver las 11 columnas. Cada fila conserva su materia, grupo, aula y profesor.</p>`;
  }
  function render(c, saved, monday, conflicts) {
    const S = root.FIT_SCHEDULE_CORE,
      today = new Date(),
      teacherMode = saved.accountType === "teacher" || c.state.user?.account_type === "teacher";
    const days = [
      1,
      2,
      3,
      4,
      5,
      ...[6, 7].filter((d) => saved.classes.some((x) => x.day === d)),
    ];
    const slots = [
      ...new Set(saved.classes.map((x) => x.start + "|" + x.end)),
    ].sort(
      (a, b) =>
        S.time(a.split("|")[0]) - S.time(b.split("|")[0]) ||
        S.time(a.split("|")[1]) - S.time(b.split("|")[1]),
    );
    return `<div class="timetable-scroll" role="region" aria-label="Tabla semanal de clases" tabindex="0"><table class="schedule-table"><caption class="screen-reader">Horario semanal de ${c.esc(saved.studentName || saved.studentId)}: materia, maestro, grupo, salón y horas.</caption><thead><tr><th scope="col" class="time-column">HORARIO</th>${days
      .map((day) => {
        const date = new Date(
          monday.getFullYear(),
          monday.getMonth(),
          monday.getDate() + day - 1,
        );
        return `<th scope="col" class="${date.toDateString() === today.toDateString() ? "is-today" : ""}"><span>${S.days[day - 1]}</span><b>${date.getDate()}</b></th>`;
      })
      .join("")}</tr></thead><tbody>${slots
      .map((slot) => {
        const [start, end] = slot.split("|");
        return `<tr><th scope="row" class="time-column"><time>${c.esc(start)}</time><span>a</span><time>${c.esc(end)}</time></th>${days
          .map((day) => {
            const classes = saved.classes.filter(
              (x) => x.day === day && x.start === start && x.end === end,
            );
            return `<td>${classes.length ? classes.map((x) => `<article class="class-card color-${saved.classes.indexOf(x) % 4}"><h3>${c.esc(x.subject)}</h3>${teacherMode ? "" : `<p>${c.esc(x.teacher)}</p>`}<div class="table-class-meta">${teacherMode ? "" : `<span>Grupo <b>${c.esc(x.group || "—")}</b></span>`}<span>Salón <b>${c.esc(x.classroom)}</b></span></div>${conflicts.includes(x.id) ? '<small class="conflict-label">Cruce de horario</small>' : ""}${c.state.offline ? '<div class="table-class-actions"><span class="offline-card-label">Solo lectura</span></div>' : `<div class="table-class-actions"><button class="text-button" data-table-edit="${c.esc(x.id)}">Editar</button>${x.place_id ? `<button class="text-button" data-class-place="${c.esc(x.place_id)}">Cómo llegar</button>` : ""}</div>`}</article>`).join("") : '<span class="empty-cell" aria-label="Sin clase">—</span>'}</td>`;
          })
          .join("")}</tr>`;
      })
      .join(
        "",
      )}</tbody></table></div><p class="table-mobile-hint">Desliza la tabla para consultar todos los días.</p>`;
  }
  root.FIT_TIMETABLE = { render, renderSubjects };
})(window);
