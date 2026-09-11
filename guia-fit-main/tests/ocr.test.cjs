const test = require("node:test"),
  assert = require("node:assert/strict"),
  path = require("node:path"),
  os = require("node:os"),
  fs = require("node:fs");
const { createWorker } = require("tesseract.js");
const S = require("../web/dist/js/schedule-core.js");

// IMPORTANTE:
// La imagen de prueba ya viene rasterizada en tests/fixtures. Antes se generaba
// en tiempo de ejecución con @napi-rs/canvas + "sans-serif"; en Windows esa
// fuente podía resolverse de forma distinta y producir glifos deformados. Eso
// hacía fallar Tesseract aunque el OCR y el parser estuvieran correctos.
test("OCR local lee una imagen real y genera datos editables con alumno y grupo", async () => {
  const fixture = path.resolve(__dirname, "fixtures/ocr-schedule.png");
  assert.ok(fs.existsSync(fixture), "Falta la imagen fija de prueba OCR");

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
      fs.readFileSync(fixture),
      {},
      { text: true, blocks: true },
    );

    const boxes = [];
    for (const b of result.data.blocks || [])
      for (const p of b.paragraphs || [])
        for (const l of p.lines || [])
          for (const w of l.words || [])
            boxes.push({ text: w.text, ...w.bbox });

    const parsed = S.parse(
      S.rowsFromOcr({ boxes, text: result.data.text || "" }),
    );

    assert.equal(parsed.studentId, "1234567890");
    assert.equal(parsed.studentName, "Ana Lopez");
    assert.equal(parsed.classes.length, 1);
    assert.equal(parsed.classes[0].subject, "Calculo");
    assert.equal(parsed.classes[0].teacher, "Juan Perez");
    assert.equal(parsed.classes[0].classroom, "A-101");
    assert.equal(parsed.classes[0].group, "2A");
    assert.equal(parsed.classes[0].day, 1);
    assert.equal(parsed.classes[0].start, "08:00");
    assert.equal(parsed.classes[0].end, "09:00");
    assert.equal(parsed.reviewedAt, undefined);
  } finally {
    await worker?.terminate();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
