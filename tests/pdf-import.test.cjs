const test = require("node:test"),
  assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const S = require("../web/dist/js/schedule-core.js");
// PDF sintético sin datos de alumnos. Se genera en memoria para probar el lector real.
function fixturePdf(positioned = false) {
  const lines = [
    "Carrera: Ingenieria Civil",
    "Matricula: 1234567890",
    "Materia | Maestro | Salon | Dia | Horario",
    "Calculo | Ana Lopez | A-101 | Lunes | 08:00-09:00",
  ];
  const stream = positioned
    ? require("./fixtures/schedule-fit.json")
        .boxes.map(
          (b) =>
            `BT /F1 8 Tf 1 0 0 1 ${b.x0} ${760 - b.y0} Tm (${b.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")}) Tj ET`,
        )
        .join("\n")
    : "BT /F1 11 Tf 45 760 Td " +
      lines
        .map((s, i) => (i ? "0 -25 Td " : "") + "(" + s + ") Tj")
        .join("\n") +
      " ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1250 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let data = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(data.length);
    data += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const start = data.length;
  data +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((x) => String(x).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new Uint8Array(Buffer.from(data));
}
test("el lector PDF incluido extrae clases de un documento real sin subirlo a una API", async () => {
  const lib = await import(
    pathToFileURL(path.resolve(__dirname, "../web/dist/vendor/pdfjs/pdf.mjs"))
      .href
  );
  lib.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.resolve(__dirname, "../web/dist/vendor/pdfjs/pdf.worker.mjs"),
  ).href;
  const doc = await lib.getDocument({
    data: fixturePdf(),
    isEvalSupported: false,
    useWasm: false,
    standardFontDataUrl:
      path.resolve(__dirname, "../web/dist/vendor/pdfjs/standard_fonts") + "/",
  }).promise;
  try {
    const content = await (await doc.getPage(1)).getTextContent();
    const parsed = S.parse(S.rowsFromItems(content.items));
    assert.equal(parsed.career, "Ingenieria Civil");
    assert.equal(parsed.studentId, "1234567890");
    assert.equal(parsed.classes.length, 1);
    assert.equal(parsed.classes[0].classroom, "A-101");
    assert.equal(parsed.classes[0].teacher, "Ana Lopez");
  } finally {
    await doc.destroy();
  }
});

test("PDF real de 11 columnas: días vacíos y profesor repetido mantienen su materia correcta", async () => {
  const lib = await import(
    pathToFileURL(path.resolve(__dirname, "../web/dist/vendor/pdfjs/pdf.mjs"))
      .href
  );
  lib.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.resolve(__dirname, "../web/dist/vendor/pdfjs/pdf.worker.mjs"),
  ).href;
  const doc = await lib.getDocument({
    data: fixturePdf(true),
    isEvalSupported: false,
    useWasm: false,
    standardFontDataUrl:
      path.resolve(__dirname, "../web/dist/vendor/pdfjs/standard_fonts") + "/",
  }).promise;
  try {
    const p = S.parse(
      S.rowsFromItems((await (await doc.getPage(1)).getTextContent()).items),
    );
    assert.deepEqual(
      p.classes.map((x) => [x.subject, x.teacher, x.group, x.day, x.start]),
      [
        ["Humanismo", "Ibarra", "2A", 2, "11:00"],
        ["Investigacion", "Ibarra", "2A", 3, "11:00"],
        ["Metodologia de la investigacion", "Ibarra Lopez", "3A", 6, "09:00"],
      ],
    );
  } finally {
    await doc.destroy();
  }
});
