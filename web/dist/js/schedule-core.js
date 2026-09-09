(function (root) {
  "use strict";
  const days = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ];
  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const aliases = [
    ["lunes", "lun", "lu"],
    ["martes", "mar", "ma"],
    ["miercoles", "mie", "mi"],
    ["jueves", "jue", "ju"],
    ["viernes", "vie", "vi"],
    ["sabado", "sab", "sa"],
    ["domingo", "dom", "do"],
  ];
  const dayOf = (s) => {
    const a = norm(s).replace(/[.:]/g, "").trim();
    return aliases.findIndex((xs) => xs.includes(a)) + 1;
  };
  const time = (s) => {
    const m = String(s || "")
      .trim()
      .match(/^(\d{1,2}):(\d{2})$/);
    return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : -1;
  };
  const fmt = (h, m) => `${String(h).padStart(2, "0")}:${m || "00"}`;
  function range(s) {
    const m = String(s).match(
      /\b(\d{1,2})(?::(\d{2}))?\s*(?:-|–|—|a)\s*(\d{1,2})(?::(\d{2}))?\b/i,
    );
    if (!m) return null;
    const start = fmt(m[1], m[2]),
      end = fmt(m[3], m[4]);
    return time(start) >= 0 && time(end) > time(start)
      ? { start, end, raw: m[0] }
      : null;
  }
  function validate(c) {
    if ((c.group || "").length > 40)
      return "El grupo debe tener hasta 40 caracteres.";
    if (!c.subject?.trim() || c.subject.length > 160)
      return "Escribe el nombre de la materia (hasta 160 caracteres).";
    if (!c.teacher?.trim() || c.teacher.length > 160)
      return "Escribe el nombre del maestro (hasta 160 caracteres).";
    if (!c.classroom?.trim() || c.classroom.length > 100)
      return "Escribe el salón (hasta 100 caracteres).";
    if (!Number.isInteger(c.day) || c.day < 1 || c.day > 7)
      return "Selecciona un día de la semana.";
    if (time(c.start) < 0 || time(c.end) <= time(c.start))
      return "La hora de salida debe ser posterior a la entrada.";
    return "";
  }
  function overlaps(classes) {
    const set = new Set();
    for (let i = 0; i < classes.length; i++)
      for (let j = i + 1; j < classes.length; j++) {
        const a = classes[i],
          b = classes[j];
        if (
          a.day === b.day &&
          time(a.start) < time(b.end) &&
          time(b.start) < time(a.end)
        ) {
          set.add(a.id);
          set.add(b.id);
        }
      }
    return [...set];
  }
  // El orden visual de la página se conserva; los espacios anchos delimitan celdas.
  function rowsFromItems(items) {
    const rows = [];
    for (const item of items.filter((i) => i.str?.trim())) {
      const y = item.transform[5],
        x = item.transform[4];
      let row = rows.find((r) => Math.abs(r.y - y) < 4);
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push({ text: item.str, x, end: x + (item.width || 0) });
    }
    return rows
      .sort((a, b) => b.y - a.y)
      .map((r) => {
        const xs = r.items.sort((a, b) => a.x - b.x);
        let out = "",
          last;
        for (const x of xs) {
          if (last) out += x.x - last.end > 12 ? " | " : " ";
          out += x.text;
          last = x;
        }
        return out;
      });
  }
  function rowsFromBoxes(boxes) {
    const rows = [];
    for (const b of boxes.filter((x) => x.text?.trim())) {
      const center = (b.y0 + b.y1) / 2;
      let r = rows.find(
        (x) => Math.abs(x.y - center) < Math.max(5, (b.y1 - b.y0) * 0.48),
      );
      if (!r) {
        r = { y: center, items: [] };
        rows.push(r);
      }
      r.items.push(b);
    }
    return rows
      .sort((a, b) => a.y - b.y)
      .map((r) => {
        const xs = r.items.sort((a, b) => a.x0 - b.x0);
        let line = "",
          prior;
        for (const b of xs) {
          if (prior)
            line +=
              b.x0 - prior.x1 > Math.max(18, (b.y1 - b.y0) * 1.2) ? " | " : " ";
          line += b.text.trim();
          prior = b;
        }
        return line;
      });
  }
  function parse(lines) {
    const text = lines.join("\n"),
      careerMatch = text.match(
        /(?:carrera|programa(?:\s+educativo)?)\s*[:|]\s*([^\n|]+)/i,
      ),
      studentMatch = norm(text).match(
        /(?:matricula|no\.?\s*(?:de\s*)?control)\s*[:|]?\s*([a-z0-9-]{3,30})/i,
      );
    const career =
      careerMatch?.[1]?.trim() ||
      lines
        .find((l) => /^\s*(ingenier[ií]a|licenciatura)\s+/i.test(l))
        ?.split("|")[0]
        ?.trim() ||
      "";
    const classes = [];
    let header = null;
    for (const line of lines) {
      const cells = line.split(/\s*\|\s*|\t+/).map((x) => x.trim()),
        ns = cells.map(norm);
      if (
        ns.some((x) =>
          /^(materia|asignatura|nombre de (?:la )?materia)$/.test(x),
        ) &&
        ns.some(
          (x) =>
            /docente|maestro|profesor|horario|hora|dia/.test(x) || dayOf(x),
        )
      ) {
        header = ns;
        continue;
      }
      const add = (subject, teacher, classroom, day, r, group = "") => {
        if (!r || !day || !subject) return;
        classes.push({
          id: `import-${classes.length + 1}`,
          subject: subject.trim().slice(0, 160),
          teacher: (teacher || "").trim().slice(0, 160),
          classroom: (classroom || "").trim().slice(0, 100),
          group: group.trim().slice(0, 40),
          day,
          start: r.start,
          end: r.end,
          place_id: "",
        });
      };
      if (header && cells.length > 1) {
        const value = (re) => {
          const index = header.findIndex((h) => re.test(h));
          return index >= 0 ? cells[index] || "" : "";
        };
        const subject = value(
            /^(materia|asignatura|nombre de (?:la )?materia)$/,
          ),
          teacher = value(/docente|maestro|profesor/),
          room = value(/salon|aula/),
          group = value(/^grupo/);
        const daily = header
          .map((h, i) => ({ day: dayOf(h), cell: cells[i] || "" }))
          .filter((x) => x.day);
        if (daily.length) {
          for (const x of daily) {
            const r = range(x.cell);
            add(
              subject,
              teacher,
              room ||
                x.cell.match(/(?:sal[oó]n|aula)\s*:?\s*([^|,;]+)/i)?.[1] ||
                "",
              x.day,
              r,
              group,
            );
          }
          continue;
        }
        const dayCell = value(/^dia/),
          r = range(value(/horario|hora/)) || range(line);
        const hits = dayCell
          .split(/[,;/]+/)
          .map(dayOf)
          .filter(Boolean);
        for (const day of hits) add(subject, teacher, room, day, r, group);
        if (hits.length) continue;
      }
      // Respaldo para filas: Materia | Maestro | Salón | Día | 08:00–09:00.
      const dayIndex = cells.findIndex((c) => dayOf(c)),
        rangeIndex = cells.findIndex((c) => range(c));
      if (cells.length >= 5 && dayIndex >= 0 && rangeIndex >= 0) {
        const remaining = cells.filter(
          (_, i) => i !== dayIndex && i !== rangeIndex,
        );
        add(
          remaining[0],
          remaining[1],
          remaining[2],
          dayOf(cells[dayIndex]),
          range(cells[rangeIndex]),
          remaining[3] || "",
        );
      }
    }
    const unique = classes.filter(
      (c, i, a) =>
        a.findIndex(
          (x) =>
            x.subject === c.subject &&
            x.day === c.day &&
            x.start === c.start &&
            x.end === c.end,
        ) === i,
    );
    const studentName =
      text
        .match(
          /(?:nombre(?:\s+del?)?(?:\s+alumno|\s+estudiante)?|alumno|estudiante)\s*[:|]\s*([^\n|]+)/i,
        )?.[1]
        ?.trim() || "";
    return {
      career,
      studentName,
      studentId: studentMatch?.[1]?.toUpperCase() || "",
      classes: unique.slice(0, 120),
      text: text.slice(0, 160000),
    };
  }
  const api = {
    days,
    norm,
    dayOf,
    time,
    range,
    validate,
    overlaps,
    rowsFromItems,
    rowsFromBoxes,
    parse,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FIT_SCHEDULE_CORE = api;
})(typeof window !== "undefined" ? window : globalThis);
