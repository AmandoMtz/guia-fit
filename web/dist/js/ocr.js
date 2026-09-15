/* OCR en el dispositivo. Solo se descargan motor e idioma de nuestro propio sitio. */
(function (root) {
  async function read(source, onProgress = () => {}, options = {}) {
    if (!root.Tesseract)
      throw Error(
        "No se pudo cargar el lector de imágenes. Recarga la página.",
      );
    const base = new URL("vendor/tesseract/", document.baseURI).href;
    let worker;
    try {
      worker = await root.Tesseract.createWorker("spa", 1, {
        workerPath: base + "worker.min.js",
        corePath: base + "core/tesseract-core-lstm.wasm.js",
        langPath: base + "lang",
        workerBlobURL: false,
        gzip: true,
        logger: (m) =>
          onProgress(
            m.status === "recognizing text"
              ? `Leyendo imagen… ${Math.round(m.progress * 100)}%`
              : "Preparando lector local…",
          ),
      });
      await worker.setParameters({
        // Los horarios docentes de FIT son tablas muy anchas. En PSM 6,
        // Tesseract suele omitir por completo la fila de encabezados; PSM 11
        // conserva Materia/Lunes…Domingo/Aula y sus posiciones.
        tessedit_pageseg_mode: options.teacherMode ? "11" : "6",
        preserve_interword_spaces: "1",
      });
      const result = await worker.recognize(
        source,
        {},
        { text: true, blocks: true },
      );
      const boxes = [];
      for (const b of result.data.blocks || [])
        for (const p of b.paragraphs || [])
          for (const l of p.lines || [])
            for (const w of l.words || [])
              boxes.push({ text: w.text, ...w.bbox });
      return { text: result.data.text || "", boxes };
    } finally {
      await worker?.terminate();
    }
  }
  root.FIT_OCR = { read };
  // Puente utilizado por Flutter Web. Devuelve texto y posiciones, nunca hace un POST.
  root.fitOcrRead = async (dataUrl) => JSON.stringify(await read(dataUrl));
})(window);
