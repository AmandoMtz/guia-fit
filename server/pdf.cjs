function latin(value) {
  return String(value ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\xFF]/g, "?");
}
function pdfEscape(value) {
  return latin(value).replace(/([\\()])/g, "\\$1");
}
function wrap(text, width = 92) {
  const words = latin(text).split(/\s+/).filter(Boolean), out = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (next.length > width && line) { out.push(line); line = word; }
    else line = next;
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}
function createPdf({ title, subtitle = "", lines = [], validationCode = "" }) {
  const all = [];
  if (subtitle) all.push(...wrap(subtitle, 88), "");
  for (const line of lines) all.push(...wrap(line, 96));
  if (validationCode) all.push("", `Código de validación: ${validationCode}`, "Valida este código dentro de Guía FIT.");
  const chunks = [];
  for (let i = 0; i < all.length || i === 0; i += 43) chunks.push(all.slice(i, i + 43));
  const objects = [null];
  const add = (body) => { objects.push(body); return objects.length - 1; };
  const catalog = add("");
  const pagesRoot = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds = [];
  chunks.forEach((pageLines, pageIndex) => {
    let stream = "BT\n/F2 16 Tf\n50 790 Td\n(" + pdfEscape(title) + ") Tj\n";
    stream += "/F1 9 Tf\n0 -20 Td\n(Guía FIT · Facultad de Ingeniería Tampico) Tj\n";
    stream += "0 -24 Td\n/F1 10 Tf\n";
    pageLines.forEach((line, i) => {
      if (i) stream += "0 -15 Td\n";
      stream += "(" + pdfEscape(line) + ") Tj\n";
    });
    stream += `\n0 -28 Td\n/F1 8 Tf\n(Página ${pageIndex + 1} de ${chunks.length}) Tj\nET`;
    const streamBuffer = Buffer.from(stream, "latin1");
    const content = add(Buffer.concat([
      Buffer.from(`<< /Length ${streamBuffer.length} >>\nstream\n`, "ascii"),
      streamBuffer,
      Buffer.from("\nendstream", "ascii"),
    ]));
    const page = add(`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`);
    pageIds.push(page);
  });
  objects[catalog] = `<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`;
  objects[pagesRoot] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const parts = [Buffer.from("%PDF-1.4\n%âãÏÓ\n", "latin1")], offsets = [0];
  let offset = parts[0].length;
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = offset;
    const body = Buffer.isBuffer(objects[i]) ? objects[i] : Buffer.from(objects[i], "latin1");
    const obj = Buffer.concat([Buffer.from(`${i} 0 obj\n`, "ascii"), body, Buffer.from("\nendobj\n", "ascii")]);
    parts.push(obj); offset += obj.length;
  }
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  xref += `trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(parts);
}
module.exports = { createPdf };
