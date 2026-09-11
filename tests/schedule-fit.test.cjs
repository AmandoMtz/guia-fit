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
