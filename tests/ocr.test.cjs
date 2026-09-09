const test = require("node:test"),
  assert = require("node:assert/strict"),
  path = require("node:path"),
  os = require("node:os"),
  fs = require("node:fs");
const { createCanvas } = require("@napi-rs/canvas");
const { createWorker } = require("tesseract.js");
const S = require("../web/dist/js/schedule-core.js");
test("OCR local lee una imagen y genera datos editables con alumno y grupo", async () => {
  const canvas = createCanvas(2400, 550),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  ctx.font = "32px sans-serif";
  ctx.fillText("Carrera: Ingenieria Civil", 45, 65);
  ctx.fillText("Matricula: 1234567890", 45, 120);
  ctx.fillText("Alumno: Ana Lopez", 45, 175);
  const columns = [45, 490, 950, 1190, 1410, 1720],
    headers = ["Materia", "Maestro", "Salon", "Grupo", "Dia", "Horario"],
    values = ["Calculo", "Juan Perez", "A-101", "2A", "Lunes", "08:00-09:00"];
  headers.forEach((s, i) => ctx.fillText(s, columns[i], 260));
  values.forEach((s, i) => ctx.fillText(s, columns[i], 335));
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "fit-ocr-test-"));
  let worker;
  try {
    worker = await createWorker("spa", 1, {
      langPath: path.resolve(__dirname, "../web/dist/vendor/tesseract/lang"),
      cachePath: folder,
      gzip: true,
    });
    await worker.setParameters({
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1",
    });
    const result = await worker.recognize(
      canvas.toBuffer("image/png"),
      {},
      { text: true, blocks: true },
    );
    const boxes = [];
    for (const b of result.data.blocks || [])
      for (const p of b.paragraphs || [])
        for (const l of p.lines || [])
          for (const w of l.words || [])
            boxes.push({ text: w.text, ...w.bbox });
    const parsed = S.parse(S.rowsFromBoxes(boxes));
    assert.equal(parsed.studentId, "1234567890");
    assert.equal(parsed.studentName, "Ana Lopez");
    assert.equal(parsed.classes.length, 1);
    assert.equal(parsed.classes[0].group, "2A");
    assert.equal(parsed.classes[0].day, 1);
    assert.equal(parsed.classes[0].start, "08:00");
    assert.equal(parsed.reviewedAt, undefined);
  } finally {
    await worker?.terminate();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
