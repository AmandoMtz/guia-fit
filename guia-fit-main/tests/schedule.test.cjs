const test = require("node:test"),
  assert = require("node:assert/strict");
const S = require("../web/dist/js/schedule-core.js");
test("PDF textual: matrícula, carrera y clases repetidas en días distintos requieren revisión", () => {
  const parsed = S.parse([
    "Facultad de Ingeniería Tampico",
    "Carrera: Ingeniería en Sistemas",
    "Matrícula: 1234567890",
    "Materia | Maestro | Salón | Día | Horario",
    "Cálculo | Ana López | A-101 | Lunes, Miércoles | 08:00–09:00",
    "Física | José Ruiz | Lab. 2 | Martes | 10:00-12:00",
  ]);
  assert.equal(parsed.career, "Ingeniería en Sistemas");
  assert.equal(parsed.studentId, "1234567890");
  assert.equal(parsed.classes.length, 3);
  assert.deepEqual(
    parsed.classes.map((c) => c.day),
    [1, 3, 2],
  );
  assert.equal(S.validate(parsed.classes[0]), "");
  assert.equal(parsed.reviewedAt, undefined);
});
test("tabla semanal con columnas de días; PDF escaneado o sin formato no inventa clases", () => {
  const p = S.parse([
    "Programa educativo: Ingeniería Civil",
    "Materia | Docente | Aula | Lun | Mar | Mié",
    "Estática | Juan Pérez | C-12 | 09:00 a 10:00 | — | 09:00-10:00",
  ]);
  assert.equal(p.classes.length, 2);
  assert.equal(p.classes[1].day, 3);
  assert.equal(p.classes[0].classroom, "C-12");
  assert.equal(S.parse([]).classes.length, 0);
  assert.equal(S.parse(["Nombre sin horario reconocible"]).classes.length, 0);
});
test("los cruces se detectan en un mismo día, no en clases contiguas ni en días distintos", () => {
  const base = {
    subject: "Materia",
    teacher: "Docente",
    classroom: "A-1",
    day: 1,
    start: "08:00",
    end: "09:00",
  };
  const a = { ...base, id: "a" },
    b = { ...base, id: "b", start: "08:30", end: "09:30" },
    c = { ...base, id: "c", day: 2 },
    d = { ...base, id: "d", start: "09:30", end: "10:00" };
  assert.deepEqual(S.overlaps([a, b, c, d]), ["a", "b"]);
  assert.ok(S.validate({ ...base, end: "07:59" }));
  assert.ok(S.validate({ ...base, start: "24:00" }));
  assert.ok(S.validate({ ...base, teacher: "" }));
});
test("reconstruye líneas del PDF y separa celdas respetando posiciones", () => {
  const item = (str, x, y, width) => ({
    str,
    transform: [1, 0, 0, 1, x, y],
    width,
  });
  const rows = S.rowsFromItems([
    item("Lunes", 220, 700, 40),
    item("Carrera: Civil", 20, 730, 95),
    item("Cálculo", 20, 700, 45),
  ]);
  assert.deepEqual(rows, ["Carrera: Civil", "Cálculo | Lunes"]);
});
