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
    ["miercoles", "miercol", "mier", "mie", "mi"],
    ["jueves", "juev", "jue", "ju"],
    ["viernes", "vier", "vie", "vi"],
    ["sabado", "saba", "sab", "sa"],
    ["domingo", "domi", "dom", "do"],
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
  function rangesInCell(value) {
    const source = String(value || "");
    const explicit = [
      ...source.matchAll(
        /\b\d{1,2}(?::\d{2})?\s*(?:-|–|—|a)\s*\d{1,2}(?::\d{2})?\b/gi,
      ),
    ]
      .map((m) => range(m[0]))
      .filter(Boolean);
    if (explicit.length) return explicit;

    // OCR de tablas puede borrar solo el guion: “9:00 10:00”.
    // Dos horas completas y crecientes en una celda siguen siendo un bloque
    // seguro; nunca completamos una hora si solo apareció un extremo.
    const tokens = [...source.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)]
      .map((m) => `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`);
    if (tokens.length === 2 && time(tokens[1]) > time(tokens[0]))
      return [{ start: tokens[0], end: tokens[1], raw: source.trim() }];
    return [];
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
  const fitColumns = [
    "GPO",
    "MATERIA",
    "AULA",
    ...days.map((x) => x.toUpperCase()),
    "PROFESOR",
  ];
  const columnOf = (s) => {
    const n = norm(s).replace(/[.:]/g, "").trim();
    if (/^(gpo|grupo)$/.test(n)) return 0;
    if (/^(materia|asignatura)$/.test(n)) return 1;
    if (/^(aula|salon|lugar)$/.test(n)) return 2;
    if (/^(profesor|docente|maestro)$/.test(n)) return 10;
    return dayOf(n) ? dayOf(n) + 2 : -1;
  };
  // Reconstruye celdas por coordenadas: un día vacío nunca desaparece.
  function rowsFromItems(items) {
    return rowsFromBoxes(
      items
        .filter((i) => i.str?.trim())
        .map((i) => ({
          text: i.str,
          x0: i.transform[4],
          x1: i.transform[4] + (i.width || 0),
          y0: -i.transform[5],
          y1: -i.transform[5] + (Math.abs(i.height) || 8),
        })),
      { pdfText: true },
    );
  }
  function teacherRows(boxes) {
    const subject=boxes.find(b=>/^(materia|asignatura)$/i.test(b.text.trim()));
    if(!subject)return null;
    const height=Math.max(10,subject.y1-subject.y0);
    const header=boxes.filter(b=>Math.abs((b.y0+b.y1-subject.y0-subject.y1)/2)<height*2);
    const daysHeader=Array.from({length:7},(_,i)=>header.find(b=>dayOf(b.text)===i+1));
    const room=header.find(b=>/^(aula|sal[oó]n)$/i.test(b.text.trim()));
    const sit=header.find(b=>/^sit[.]?$/i.test(b.text.trim()));
    if(!room||!sit||!daysHeader.every(Boolean))return null;
    const centers=daysHeader.map(b=>(b.x0+b.x1)/2),step=(centers[6]-centers[0])/6;
    if(step<=0)return null;
    const roomCenter=(room.x0+room.x1)/2;
    const spans=[{left:subject.x0-8,right:sit.x0-8},...centers.map((v,i)=>({left:i?(centers[i-1]+v)/2:v-step/2,right:i<6?(v+centers[i+1])/2:v+step/2})),{left:roomCenter-step*.4,right:roomCenter+step*.4}];
    const rows=[];
    for(const b of boxes.filter(b=>b.y0>Math.max(...daysHeader.map(d=>d.y1),room.y1)).sort((a,b)=>a.y0-b.y0||a.x0-b.x0)){
      const y=(b.y0+b.y1)/2;
      let row=rows.find(r=>Math.abs(r.y-y)<Math.max(6,(b.y1-b.y0)*.55));
      if(!row){row={y,items:[]};rows.push(row);}row.items.push(b);
    }
    const output=['MATERIA | LUNES | MARTES | MIERCOLES | JUEVES | VIERNES | SABADO | DOMINGO | AULA'];let pending=null,last=0;
    const flush=()=>{if(pending&&pending.slice(1,8).some(x=>/\d/.test(x)))output.push(pending.join(' | '));pending=null;};
    for(const row of rows.sort((a,b)=>a.y-b.y)){
      const cells=Array(9).fill('');
      for(const b of row.items.sort((a,b)=>a.x0-b.x0)){const center=(b.x0+b.x1)/2,i=spans.findIndex(s=>center>=s.left&&center<s.right);if(i>=0)cells[i]+=(cells[i]?' ':'')+b.text;}
      if(cells[0]&&cells.slice(1,8).some(x=>/\d/.test(x))){flush();pending=cells;}
      else if(pending&&row.y-last<height*2.5){pending=pending.map((v,i)=>[v,cells[i]].filter(Boolean).join(' '));}
      else if(row.y-last>=height*2.5)flush();
      last=row.y;
    }
    flush();return output.length>1?output:null;
  }

  function rowsFromBoxes(boxes, options = {}) {
    const exactTeacher = teacherRows(boxes);
    if (exactTeacher) return exactTeacher;
    const rows = [];
    // Algunos lectores agrupan varios encabezados en un solo fragmento.
    const words = boxes.flatMap((b) => {
      if (!b.text?.trim()) return [];
      const parts = [...b.text.matchAll(/\S+/g)];
      if (parts.filter((p) => columnOf(p[0]) >= 0).length < 2) return [b];
      const scale = (b.x1 - b.x0) / b.text.length;
      return parts.map((p) => ({
        ...b,
        text: p[0],
        x0: b.x0 + p.index * scale,
        x1: b.x0 + (p.index + p[0].length) * scale,
      }));
    });
    for (const b of words.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
      const center = (b.y0 + b.y1) / 2;
      const rowTolerance = options.pdfText
        ? Math.max(4, (b.y1 - b.y0) * 0.65)
        : Math.max(12, (b.y1 - b.y0) * 0.9);
      let r = rows.find(
        (x) => Math.abs(x.y - center) < rowTolerance,
      );
      if (!r) {
        r = { y: center, items: [] };
        rows.push(r);
      }
      r.items.push(b);
    }
    let bounds = null,
      teacherSpans = null,
      teacherRoomIsLugar = false,
      teacherPendingAnchored = false,
      pending = null,
      lastY = null;
    const output = [];
    const flush = () => {
      if (pending) output.push(pending.join(" | "));
      pending = null;
      teacherPendingAnchored = false;
    };
    for (const r of rows.sort((a, b) => a.y - b.y)) {
      const xs = r.items.sort((a, b) => a.x0 - b.x0);
      const heads = Array(11).fill(null);
      for (const x of xs) {
        const n = columnOf(x.text);
        if (n >= 0) heads[n] = (x.x0 + x.x1) / 2;
      }
      if (
        heads.every((x) => x !== null) &&
        heads.every((x, i) => !i || x > heads[i - 1])
      ) {
        flush();
        teacherSpans = null;
        bounds = heads.slice(0, -1).map((x, i) => (x + heads[i + 1]) / 2);
        // Las columnas de días son regulares; los encabezados de materia y profesor pueden estar centrados en celdas anchas.
        const gaps = heads
          .slice(4, 10)
          .map((x, i) => x - heads[i + 3])
          .sort((a, b) => a - b);
        const step = gaps[Math.floor(gaps.length / 2)];
        bounds[0] = Math.min(bounds[0], heads[0] + step / 2);
        bounds[1] = heads[2] - (heads[3] - heads[2]) / 2;
        bounds[9] = heads[9] + step / 2;
        output.push(fitColumns.join(" | "));
        lastY = r.y;
        continue;
      }
      // Formato de carga docente: Materia + Lunes…Domingo + Aula, aunque
      // existan columnas administrativas adicionales (Clave, Sit, Hrs., etc.).
      // Solo conservamos lo que el docente necesita y descartamos lo demás.
      const subjectHead = xs.find((x) => /^(materia|asignatura)$/.test(norm(x.text).replace(/[.:]/g, "").trim()));
      const roomHead = xs.find((x) => /^(aula|salon|lugar)$/.test(norm(x.text).replace(/[.:]/g, "").trim()));
      const dayHeads = Array.from({ length: 7 }, (_, i) =>
        xs.find((x) => dayOf(x.text) === i + 1),
      );
      const detectedDays = dayHeads
        .map((head, i) => head ? { head, day: i + 1 } : null)
        .filter(Boolean);
      // En capturas o escaneos Tesseract a veces pierde Viernes/Sábado/Domingo
      // porque sus columnas están vacías. Con cuatro encabezados de día ya hay
      // suficiente geometría para reconocer de forma segura el horario docente.
      if (subjectHead && roomHead && detectedDays.length >= 4) {
        flush();
        bounds = null;
        teacherRoomIsLugar = /^lugar$/.test(norm(roomHead.text).replace(/[.:]/g, "").trim());
        const centers = xs
          .map((x) => (x.x0 + x.x1) / 2)
          .sort((a, b) => a - b)
          .filter((x, i, a) => !i || Math.abs(x - a[i - 1]) > 3);
        const targets = [subjectHead, ...detectedDays.map((x) => x.head), roomHead];
        teacherSpans = targets.map((x) => {
          const center = (x.x0 + x.x1) / 2;
          const prior = [...centers].reverse().find((v) => v < center - 3);
          const next = centers.find((v) => v > center + 3);
          return {
            left: prior == null ? -Infinity : (prior + center) / 2,
            right: next == null ? Infinity : (center + next) / 2,
          };
        });
        output.push(["MATERIA", ...detectedDays.map((x) => days[x.day - 1].toUpperCase()), "AULA"].join(" | "));
        lastY = r.y;
        continue;
      }
      if (teacherSpans) {
        const cells = Array(teacherSpans.length).fill("");
        for (const x of xs) {
          const center = (x.x0 + x.x1) / 2;
          const col = teacherSpans.findIndex((span) => center >= span.left && center < span.right);
          if (col >= 0) cells[col] += (cells[col] ? " " : "") + x.text.trim();
        }
        if (teacherRoomIsLugar && cells[cells.length - 1])
          cells[cells.length - 1] = cells[cells.length - 1].replace(/\s+P\s*$/i, "").trim();
        const dayCells = cells.slice(1, -1),
          hasTime = dayCells.some((x) => rangesInCell(x).length || /\d{1,2}:\d{2}/.test(x)),
          hasRoom = Boolean(cells[cells.length - 1]?.trim()),
          hasSchedule = hasTime || hasRoom,
          hasSubject = Boolean(cells[0]?.trim()),
          // En los reportes docentes de Servicios Escolares la asignatura puede
          // ocupar 2-5 renglones. El código entre paréntesis marca con bastante
          // seguridad el inicio de una materia nueva.
          startsCourse = /^\s*\((?=[^)]*\d)[^)]*\)/.test(cells[0] || ""),
          continuation = pending && r.y - lastY < Math.max(34, (xs[0]?.y1 - xs[0]?.y0 || 8) * 4);

        if (startsCourse && pending && teacherPendingAnchored) flush();

        if (!pending && (hasSubject || hasSchedule)) {
          pending = cells;
          teacherPendingAnchored = hasSchedule;
        } else if (pending && hasSchedule) {
          if (teacherPendingAnchored && !hasSubject && continuation) {
            // Continuación vertical de una misma celda de hora: «10:00 -» / «11:00».
            pending = pending.map((v, i) => [v, cells[i]].filter(Boolean).join(" "));
          } else if (teacherPendingAnchored) {
            flush();
            pending = cells;
          } else {
            pending = pending.map((v, i) => [v, cells[i]].filter(Boolean).join(" "));
          }
          teacherPendingAnchored = true;
        } else if (pending && continuation && hasSubject) {
          // Texto de asignatura antes o después del renglón donde aparecen las horas.
          pending[0] = [pending[0], cells[0]].filter(Boolean).join(" ");
        } else if (cells.some(Boolean) && (hasSubject || hasSchedule)) {
          flush();
          pending = cells;
          teacherPendingAnchored = hasSchedule;
        }
        lastY = r.y;
        continue;
      }
      if (bounds) {
        const cells = Array(11).fill("");
        for (const x of xs) {
          // Máxima intersección con la columna; evita mover textos largos por su centro.
          const spans = [-Infinity, ...bounds, Infinity];
          let best = 0,
            amount = -1;
          for (let n = 0; n < 11; n++) {
            const overlap =
              Math.min(x.x1, spans[n + 1]) - Math.max(x.x0, spans[n]);
            if (overlap > amount) {
              amount = overlap;
              best = n;
            }
          }
          cells[best] += (cells[best] ? " " : "") + x.text.trim();
        }
        const anyTime = cells.slice(3, 10).some((x) => /\d/.test(x));
        if (cells[0] || (cells[1] && cells[2] && anyTime)) flush();
        const continuation =
          pending && r.y - lastY < Math.max(24, (xs[0].y1 - xs[0].y0) * 2.5);
        if (!pending && (cells[0] || (cells[1] && anyTime))) pending = cells;
        else if (continuation)
          pending = pending.map((v, i) =>
            [v, cells[i]].filter(Boolean).join(" "),
          );
        else {
          flush();
          output.push("!REVISAR " + xs.map((x) => x.text).join(" "));
        }
        lastY = r.y;
        continue;
      }
      let line = "",
        prior;
      for (const b of xs) {
        if (prior)
          line +=
            b.x0 - prior.x1 > Math.max(18, (b.y1 - b.y0) * 1.2) ? " | " : " ";
        line += b.text.trim();
        prior = b;
      }
      output.push(line);
    }
    flush();
    return output;
  }
  // Normaliza el resultado de OCR. Tesseract puede devolver cajas de palabras
  // o únicamente texto plano según la plataforma/core cargado.
  function rowsFromOcr(result) {
    const exactTeacher = teacherRows(Array.isArray(result?.boxes) ? result.boxes : []);
    if (exactTeacher) return exactTeacher;
    const boxes = Array.isArray(result?.boxes) ? result.boxes : [],
      boxRows = boxes.length ? rowsFromBoxes(boxes) : [],
      textRows = String(result?.text || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    // Tesseract.js puede devolver blocks parciales y, al mismo tiempo, un
    // data.text más completo. Antes, con que existiera una sola caja se
    // descartaba todo el texto plano (incluida a veces la matrícula).
    // Combinamos ambos caminos y eliminamos duplicados aproximados.
    if (!boxRows.length) return textRows;
    if (!textRows.length) return boxRows;

    const key = (line) =>
      norm(line)
        .replace(/[|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const seen = new Set(boxRows.map(key));
    return [
      ...boxRows,
      ...textRows.filter((line) => {
        const k = key(line);
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      }),
    ];
  }
  function parse(lines) {
    const text = lines.join("\n"),
      careerMatch = text.match(
        /(?:carrera|programa(?:\s+educativo)?)\s*[:|]\s*([^\n|]+)/i,
      ),
      studentMatch = norm(text).match(
        // OCR puede separar la etiqueta y el valor con espacios, barras o signos.
        /(?:matricula|matr[i1l]cula|no\.?\s*(?:de\s*)?control)[^a-z0-9\n]{0,40}([a-z0-9-]{3,30})/i,
      ),
      // Respaldo para OCR que separa los dígitos de la matrícula con espacios
      // o signos. Exigimos al menos 7 dígitos para no confundir horarios.
      studentIdFallback = (() => {
        const normalized = norm(text),
          label = normalized.match(/(?:matricula|matr[i1l]cula|no\.?\s*(?:de\s*)?control)/i);
        if (label) {
          const tail = normalized.slice((label.index || 0) + label[0].length, (label.index || 0) + label[0].length + 90),
            line = tail.split(/\n/)[0] || "",
            candidate = line.match(/(?:[a-z0-9][\s|:;,.\-]*){7,30}/i)?.[0] || "",
            cleaned = candidate.replace(/[^a-z0-9-]/gi, "");
          if ((cleaned.match(/\d/g) || []).length >= 7) return cleaned.toUpperCase();
        }
        const numeric = normalized.match(/(?:\d[\s|:;,.\-]*){8,14}/)?.[0] || "",
          digits = numeric.replace(/\D/g, "");
        return digits.length >= 8 && digits.length <= 14 ? digits : "";
      })();
    const career =
      careerMatch?.[1]?.trim() ||
      lines
        .find((l) => /^\s*(ingenier[ií]a|licenciatura)\s+/i.test(l))
        ?.split("|")[0]
        ?.trim() ||
      "";
    const classes = [],
      warnings = [];
    let header = null;
    for (const line of lines) {
      // Si la fila viene como TSV, los tabuladores consecutivos representan
      // celdas vacías reales (por ejemplo, días sin clase). No deben colapsarse.
      const cells = (line.includes("\t")
          ? line.split("\t")
          : line.split(/\s*\|\s*|\s{2,}/))
          .map((x) => x.trim()),
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
        if (header.length === 11 && cells.length !== 11) {
          warnings.push(
            "Una fila no tiene las 11 celdas reconocibles. No se asignaron sus horas a otros días: " +
              line,
          );
          continue;
        }
        const value = (re) => {
          const index = header.findIndex((h) => re.test(h));
          return index >= 0 ? cells[index] || "" : "";
        };
        const subject = value(
            /^(materia|asignatura|nombre de (?:la )?materia)$/,
          ),
          teacher = value(/docente|maestro|profesor/),
          room = value(/salon|aula|lugar/),
          group = value(/^(grupo|gpo)\.?$/);
        const daily = header
          .map((h, i) => ({ day: dayOf(h), cell: cells[i] || "" }))
          .filter((x) => x.day);
        const teacherGrid = header.some((h) => /^(aula|salon|lugar)$/.test(h)) &&
            !header.some((h) => /docente|maestro|profesor/.test(h)),
          roomIsLugar = header.some((h) => h === "lugar"),
          teacherSubject = teacherGrid
            ? subject.replace(/^\s*\((?=[^)]*\d)[^)]*\)\s*/, "").trim()
            : subject,
          teacherRoom = roomIsLugar ? room.replace(/\s+P\s*$/i, "").trim() : room;
        if (daily.length) {
          for (const x of daily) {
            x.ranges = rangesInCell(x.cell);
          }
          // En horarios docentes cada fila suele repetir el mismo bloque en
          // varios días. Si OCR dañó una celda pero al menos dos días legibles
          // coinciden, recuperamos SOLO las celdas no vacías/no “-” de esa fila.
          const counts = new Map();
          for (const x of daily)
            for (const r of x.ranges || []) {
              const key = `${r.start}-${r.end}`;
              counts.set(key, (counts.get(key) || 0) + 1);
            }
          const consensus = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
          const consensusRange = consensus && consensus[1] >= 2
            ? (() => { const [start, end] = consensus[0].split("-"); return { start, end, raw: consensus[0] }; })()
            : null;
          for (const x of daily) {
            let ranges = x.ranges || [];
            const meaningful = x.cell && !/^[-–—.\s]*$/.test(x.cell);
            const completeTimes = [...String(x.cell || "").matchAll(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g)];
            const looksLikeDamagedTime = completeTimes.length > 0;
            if (consensusRange && meaningful && looksLikeDamagedTime) {
              // “1 0- 11:00” puede convertirse falsamente en 00:00–11:00.
              // Si solo quedó una hora completa y la mayoría de la fila coincide,
              // preferimos el bloque repetido en vez de inventar medianoche.
              if (!ranges.length || (ranges.length === 1 && completeTimes.length < 2 && ranges[0].start === "00:00"))
                ranges = [consensusRange];
            }
            if (meaningful && !ranges.length && (!teacherGrid || looksLikeDamagedTime))
              warnings.push(
                `${subject || "Materia pendiente"}, ${days[x.day - 1]}: revisa «${x.cell}». No se inventó una hora de salida.`,
              );
            for (const r of ranges)
              add(
                teacherSubject.replace(/[!|]+$/g, "").trim(),
                teacher,
                teacherRoom ||
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
            x.teacher === c.teacher &&
            x.classroom === c.classroom &&
            x.group === c.group &&
            x.day === c.day &&
            x.start === c.start &&
            x.end === c.end,
        ) === i,
    );
    const studentName =
      text
        .match(
          /(?:nombre(?:\s+del?)?(?:\s+alumno|\s+estudiante)?|alumno|estudiante)[^\nA-Za-zÁÉÍÓÚÜÑáéíóúüñ]{0,20}\s*([^\n|]+)/i,
        )?.[1]
        ?.trim() || "";
    return {
      career,
      studentName,
      studentId: studentMatch?.[1]?.toUpperCase() || studentIdFallback,
      classes: unique.slice(0, 120),
      warnings: [
        ...new Set([
          ...warnings,
          ...lines
            .filter((x) => x.startsWith("!REVISAR "))
            .map((x) => "Revisa el texto sin fila: " + x.slice(9)),
          ...(unique.length > 120
            ? ["Se detectaron más de 120 bloques. Revisa los datos restantes."]
            : []),
        ]),
      ],
      text: text.slice(0, 160000),
    };
  }
  const api = {
    days,
    fitColumns,
    norm,
    dayOf,
    time,
    range,
    rangesInCell,
    validate,
    overlaps,
    rowsFromItems,
    rowsFromBoxes,
    rowsFromOcr,
    parse,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FIT_SCHEDULE_CORE = api;
})(typeof window !== "undefined" ? window : globalThis);
