const test = require("node:test"),
  assert = require("node:assert/strict");
const fixtures = require("./fixtures/schedule-fit.json"),
  S = require("../web/dist/js/schedule-core.js");
function check(parsed, expected) {
  assert.equal(parsed.classes.length, expected.length, JSON.stringify(parsed));
  expected.forEach((record, i) =>
    Object.entries(record).forEach(([key, value]) =>
      assert.equal(parsed.classes[i][key], value, key),
    ),
  );
}
for (const f of fixtures.cases)
  test("FIT 11 columnas: " + f.name, () => {
    const p = S.parse(f.lines);
    check(p, f.expected);
    if (f.warn) assert.ok(p.warnings.length);
  });
test("PDF e imagen: posiciones preservan huecos y reúnen materia y profesor de varias líneas", () => {
  const ocr = S.parse(S.rowsFromBoxes(fixtures.boxes));
  check(ocr, fixtures.positionedExpected);
  const pdf = S.parse(
    S.rowsFromItems(
      fixtures.boxes.map((b) => ({
        str: b.text,
        transform: [1, 0, 0, 1, b.x0, -b.y0],
        height: b.y1 - b.y0,
        width: b.x1 - b.x0,
      })),
    ),
  );
  check(pdf, fixtures.positionedExpected);
  assert.deepEqual(S.overlaps(pdf.classes), []);
});
test("encabezados repetidos no mezclan docentes ni duplican las mismas clases", () => {
  const page = S.rowsFromBoxes(fixtures.boxes);
  check(S.parse([...page, ...page]), fixtures.positionedExpected);
});
test("horario docente: ignora Clave/Sit/Hrs. y conserva solo materia, aula y horas", () => {
  const box = (text, x, y, w = 54) => ({ text, x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + 10 });
  const heads = [
    ["G", 20], ["Clave", 75], ["Materia", 220], ["Sit", 385], ["F.F.", 425],
    ["Lunes", 500], ["Martes", 590], ["Miercoles", 680], ["Jueves", 770],
    ["Viernes", 860], ["Sabado", 950], ["Domingo", 1040],
    ["Hrs.", 1120], ["Hrs.", 1190], ["Hrs.", 1260], ["Aula", 1340],
  ].map(([text, x]) => box(text, x, 30));
  const row1 = [
    box("R", 20, 75), box("RC.05053.1115.", 75, 75, 82), box("CALCULO VECTORIAL", 220, 75, 140),
    box("T", 385, 75), box("UAT", 425, 75), box("7:00 - 8:00", 500, 75, 78),
    box("7:00 - 8:00", 590, 75, 78), box("7:00 - 8:00", 680, 75, 78), box("7:00 - 8:00", 770, 75, 78),
    box("04:00", 1120, 75), box("4", 1190, 75), box("4", 1260, 75), box("B-213", 1340, 75),
  ];
  const row2a = [
    box("F", 20, 115), box("RC.07072.1122.", 75, 115, 82), box("METODOS NUMERICOS", 220, 115, 145),
    box("T", 385, 115), box("UAT", 425, 115), box("10:00 -", 500, 115), box("10:00 -", 590, 115),
    box("10:00 -", 680, 115), box("10:00 -", 770, 115), box("04:00", 1120, 115), box("4", 1190, 115), box("4", 1260, 115), box("D-405", 1340, 115),
  ];
  const row2b = [box("11:00", 500, 132), box("11:00", 590, 132), box("11:00", 680, 132), box("11:00", 770, 132)];
  const lines = S.rowsFromBoxes([...heads, ...row1, ...row2a, ...row2b]);
  const parsed = S.parse(lines);
  assert.equal(parsed.classes.length, 8, JSON.stringify({ lines, parsed }));
  assert.deepEqual(
    parsed.classes.slice(0, 4).map((x) => [x.subject, x.classroom, x.day, x.start, x.end]),
    [1, 2, 3, 4].map((day) => ["CALCULO VECTORIAL", "B-213", day, "07:00", "08:00"]),
  );
  assert.deepEqual(
    parsed.classes.slice(4).map((x) => [x.subject, x.classroom, x.day, x.start, x.end]),
    [1, 2, 3, 4].map((day) => ["METODOS NUMERICOS", "D-405", day, "10:00", "11:00"]),
  );
});
test("horario docente: detecta captura aunque OCR pierda encabezados de días vacíos", () => {
  const box = (text, x, y, w = 54) => ({ text, x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + 10 });
  const heads = [
    ["G", 20], ["Clave", 75], ["Materia", 220], ["Sit", 385], ["F.F.", 425],
    ["Lunes", 500], ["Martes", 590], ["Miercol", 680], ["Juev", 770],
    ["Hrs.", 1120], ["Hrs.", 1190], ["Hrs.", 1260], ["Aula", 1340],
  ].map(([text, x]) => box(text, x, 30));
  const row = [
    box("R", 20, 75), box("RC.05053.1115.", 75, 75, 82), box("CALCULO VECTORIAL", 220, 75, 140),
    box("T", 385, 75), box("UAT", 425, 75), box("7:00 - 8:00", 500, 75, 78),
    box("7:00 - 8:00", 590, 75, 78), box("7:00 - 8:00", 680, 75, 78), box("7:00 - 8:00", 770, 75, 78),
    box("04:00", 1120, 75), box("4", 1190, 75), box("4", 1260, 75), box("B-213", 1340, 75),
  ];
  const parsed = S.parse(S.rowsFromBoxes([...heads, ...row]));
  assert.deepEqual(
    parsed.classes.map((x) => [x.subject, x.classroom, x.day, x.start, x.end]),
    [1, 2, 3, 4].map((day) => ["CALCULO VECTORIAL", "B-213", day, "07:00", "08:00"]),
  );
});
test("horario docente realista: PSM 11 separa Aula y puede borrar guiones", () => {
  const box = (text, x, y, w = 54, h = 10) => ({ text, x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + h });
  // Tesseract PSM 11 puede colocar Hrs./Aula ~9 px arriba del resto del encabezado.
  const heads = [
    ["Clave", 75, 59], ["Materia", 220, 59], ["Sit", 385, 59], ["F.F.", 425, 59],
    ["Lunes", 500, 59], ["Martes", 590, 59], ["Miercoles", 680, 59], ["Jueves", 770, 59],
    ["Viernes", 860, 59], ["Sabado", 950, 59], ["Domingo", 1040, 59],
    ["Hrs.", 1120, 50], ["Hrs.", 1190, 50], ["Hrs.", 1260, 50], ["Aula", 1340, 50],
  ].map(([text, x, y]) => box(text, x, y));
  const rowA = [
    box("RC.07072.1122", 75, 100, 84), box("METODOS NUMERICOS", 220, 100, 145), box("T", 385, 100), box("UAT", 425, 100),
    box("9:00 10:00", 500, 100, 78), box("9:00 10:00", 590, 100, 78), box("9:00 10:00", 680, 100, 78), box("9:00 10:00", 770, 100, 78),
    box("04:00", 1120, 100), box("4", 1190, 100), box("4", 1260, 100), box("D-406", 1340, 100),
  ];
  const rowB = [
    box("RC.07072.1122", 75, 145, 84), box("METODOS NUMERICOS", 220, 145, 145), box("T", 385, 145), box("UAT", 425, 145),
    box("10:00 11:00", 500, 145, 78), box("1 0- 11:00", 590, 145, 78), box("1 11:00 -", 680, 145, 78), box("10:00 11:00", 770, 145, 78),
    box("04:00", 1120, 145), box("4", 1190, 145), box("4", 1260, 145), box("D-405", 1340, 145),
  ];
  const parsed = S.parse(S.rowsFromBoxes([...heads, ...rowA, ...rowB]));
  assert.equal(parsed.classes.length, 8, JSON.stringify(parsed));
  assert.deepEqual(parsed.classes.slice(0, 4).map((x) => [x.day, x.start, x.end, x.classroom]), [1,2,3,4].map((d) => [d,"09:00","10:00","D-406"]));
  assert.deepEqual(parsed.classes.slice(4).map((x) => [x.day, x.start, x.end, x.classroom]), [1,2,3,4].map((d) => [d,"10:00","11:00","D-405"]));
});

test("horario docente Servicios Escolares: Lugar + asignatura multilínea + seis días", () => {
  const box = (text, x, y, w = 46, h = 9) => ({ text, x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + h });
  const heads = [
    ["Grupo", 30], ["Asignatura", 125], ["Nivel", 220], ["Período", 290], ["Lugar", 347],
    ["Lunes", 416], ["Martes", 482], ["Miércoles", 551], ["Jueves", 618], ["Viernes", 681], ["Sábado", 744],
  ].map(([text, x]) => box(text, x, 138));
  const first = [
    box("(RC.06062.2835.5-5)", 92, 153, 80), box("GESTION", 151, 153),
    box("ORGANIZACIONAL DE LAS", 112, 163, 115),
    box("TECNOLOGIAS DE LA", 111, 172, 95), box("K", 32, 172), box("LICENCIATURA", 222, 172, 80), box("2", 290, 172),
    box("A-112 P", 347, 172, 55), box("10:00-11:00", 416, 172, 62), box("10:00-11:00", 482, 172, 62),
    box("10:00-11:00", 551, 172, 62), box("10:00-11:00", 618, 172, 62), box("-", 681, 172), box("-", 744, 172),
    box("INFORMACION Y", 110, 182, 85), box("COMUNICACION", 110, 191, 75),
  ];
  const second = [
    box("(MCC20)", 90, 204, 45), box("MINERÍA DE DATOS", 130, 204, 95),
    box("A", 32, 214), box("MAESTRIA", 222, 214, 55), box("3", 290, 214), box("POSGRADO-7 P", 347, 214, 78),
    box("-", 416, 214), box("11:00-12:00", 482, 214, 62), box("11:00-12:00", 551, 214, 62), box("11:00-12:00", 618, 214, 62), box("-", 681, 214), box("-", 744, 214),
    box("(OPTATIVA)", 120, 223, 60),
  ];
  const items = [...heads, ...first, ...second].map((b) => ({
    str: b.text,
    transform: [1, 0, 0, 1, b.x0, -b.y0],
    height: b.y1 - b.y0,
    width: b.x1 - b.x0,
  }));
  const parsed = S.parse(S.rowsFromItems(items));
  assert.equal(parsed.classes.length, 7, JSON.stringify(parsed));
  assert.deepEqual(
    parsed.classes.slice(0, 4).map((x) => [x.subject, x.classroom, x.day, x.start, x.end]),
    [1,2,3,4].map((d) => ["GESTION ORGANIZACIONAL DE LAS TECNOLOGIAS DE LA INFORMACION Y COMUNICACION", "A-112", d, "10:00", "11:00"]),
  );
  assert.deepEqual(
    parsed.classes.slice(4).map((x) => [x.subject, x.classroom, x.day, x.start, x.end]),
    [2,3,4].map((d) => ["MINERÍA DE DATOS (OPTATIVA)", "POSGRADO-7", d, "11:00", "12:00"]),
  );
});
