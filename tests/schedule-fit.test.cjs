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
