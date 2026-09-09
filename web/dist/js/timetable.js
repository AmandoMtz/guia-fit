(function (root) {
  function render(c, saved, monday, conflicts) {
    const S = root.FIT_SCHEDULE_CORE,
      today = new Date();
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
            return `<td>${classes.length ? classes.map((x) => `<article class="class-card color-${saved.classes.indexOf(x) % 4}"><h3>${c.esc(x.subject)}</h3><p>${c.esc(x.teacher)}</p><div class="table-class-meta"><span>Grupo <b>${c.esc(x.group || "—")}</b></span><span>Salón <b>${c.esc(x.classroom)}</b></span></div>${conflicts.includes(x.id) ? '<small class="conflict-label">Cruce de horario</small>' : ""}<div class="table-class-actions"><button class="text-button" data-table-edit="${c.esc(x.id)}">Editar</button>${x.place_id ? `<button class="text-button" data-class-place="${c.esc(x.place_id)}">Cómo llegar</button>` : ""}</div></article>`).join("") : '<span class="empty-cell" aria-label="Sin clase">—</span>'}</td>`;
          })
          .join("")}</tr>`;
      })
      .join(
        "",
      )}</tbody></table></div><p class="table-mobile-hint">Desliza la tabla para consultar todos los días.</p>`;
  }
  root.FIT_TIMETABLE = { render };
})(window);
