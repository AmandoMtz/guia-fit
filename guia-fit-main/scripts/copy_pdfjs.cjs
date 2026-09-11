// Reproducir los archivos locales de PDF.js tras actualizar su versión fijada.
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  source = path.join(root, "node_modules/pdfjs-dist"),
  target = path.join(root, "web/dist/vendor/pdfjs");
fs.mkdirSync(target, { recursive: true });
for (const name of ["pdf.mjs", "pdf.worker.mjs"])
  fs.copyFileSync(
    path.join(source, "legacy/build", name),
    path.join(target, name),
  );
for (const name of ["cmaps", "standard_fonts"])
  fs.cpSync(path.join(source, name), path.join(target, name), {
    recursive: true,
  });
fs.copyFileSync(path.join(source, "LICENSE"), path.join(target, "LICENSE"));
console.log("PDF.js copiado con worker, fuentes y licencia.");
