const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  nm = path.join(root, "node_modules");
const targets = ["web/dist/vendor/tesseract", "flutter/web/vendor/tesseract"];
for (const dest of targets) {
  const target = path.join(root, dest);
  fs.mkdirSync(path.join(target, "core"), { recursive: true });
  fs.mkdirSync(path.join(target, "lang"), { recursive: true });
  for (const file of ["tesseract.min.js", "worker.min.js", "tesseract.min.js.LICENSE.txt", "worker.min.js.LICENSE.txt"])
    fs.copyFileSync(
      path.join(nm, "tesseract.js/dist", file),
      path.join(target, file),
    );
  for (const file of [
    "tesseract-core-lstm.wasm.js",
    "tesseract-core-lstm.wasm",
  ])
    fs.copyFileSync(
      path.join(nm, "tesseract.js-core", file),
      path.join(target, "core", file),
    );
  fs.copyFileSync(
    path.join(nm, "@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz"),
    path.join(target, "lang/spa.traineddata.gz"),
  );
  fs.copyFileSync(
    path.join(nm, "tesseract.js/LICENSE.md"),
    path.join(target, "LICENSE-TESSERACT.txt"),
  );
  fs.copyFileSync(
    path.join(nm, "tesseract.js-core/LICENSE"),
    path.join(target, "LICENSE-CORE.txt"),
  );
  fs.writeFileSync(
    path.join(target, "LANGUAGE-CREDIT.txt"),
    "Spanish data: @tesseract.js-data/spa 1.0.0, 4.0.0_best_int/spa.traineddata.gz. Package declares MIT. Authors: Balearica, jeromewu.\nSource: https://github.com/naptha/tessdata\nTraining data upstream: https://github.com/tesseract-ocr/tessdata_best (Apache 2.0).\nUnmodified binary.\n",
  );
}
fs.copyFileSync(
  path.join(root, "web/dist/js/ocr.js"),
  path.join(root, "flutter/web/ocr.js"),
);
console.log("OCR local copiado para la web y Flutter Web.");
