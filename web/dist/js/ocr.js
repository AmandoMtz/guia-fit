/* OCR en el dispositivo. Solo se descargan motor e idioma de nuestro propio sitio. */
(function (root) {
  function boxesFromBlocks(blocks) {
    const boxes = [];
    for (const b of blocks || [])
      for (const p of b.paragraphs || [])
        for (const l of p.lines || [])
          for (const w of l.words || [])
            if (w.text?.trim() && w.bbox)
              boxes.push({ text: w.text, ...w.bbox });
    return boxes;
  }
  function boxesFromTsv(tsv) {
    const boxes = [];
    const lines = String(tsv || "").split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      const p = lines[i].split("\t");
      if (p.length < 12 || Number(p[0]) !== 5) continue;
      const text = p.slice(11).join("\t").trim();
      const left = Number(p[6]), top = Number(p[7]), width = Number(p[8]), height = Number(p[9]);
      if (!text || ![left, top, width, height].every(Number.isFinite)) continue;
      boxes.push({ text, x0: left, y0: top, x1: left + width, y1: top + height });
    }
    return boxes;
  }
  function score(result) {
    const text = String(result.text || "").toLowerCase(),
      dayHits = ["lunes", "martes", "mier", "jueves", "viernes", "sabado", "sábado", "domingo"]
        .filter((x) => text.includes(x)).length,
      times = (text.match(/\b\d{1,2}:\d{2}\b/g) || []).length,
      tableWords = /materia|asignatura/.test(text) ? 4 : 0,
      roomWords = /aula|sal[oó]n|lugar/.test(text) ? 3 : 0;
    return (result.boxes?.length || 0) + dayHits * 12 + Math.min(times, 30) * 2 + tableWords + roomWords;
  }
  async function read(source, onProgress = () => {}, options = {}) {
    if (!root.Tesseract)
      throw Error("No se pudo cargar el lector de imágenes. Recarga la página.");
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
      const recognize = async (psm) => {
        await worker.setParameters({
          tessedit_pageseg_mode: String(psm),
          preserve_interword_spaces: "1",
        });
        const result = await worker.recognize(
          source,
          {},
          { text: true, blocks: true, tsv: true },
        );
        const blockBoxes = boxesFromBlocks(result.data.blocks),
          tsvBoxes = boxesFromTsv(result.data.tsv),
          boxes = tsvBoxes.length >= blockBoxes.length ? tsvBoxes : blockBoxes;
        return { text: result.data.text || "", boxes };
      };

      const primary = await recognize(options.teacherMode ? 11 : 6);
      if (!options.teacherMode || score(primary) >= 90) return primary;

      // Algunos navegadores/cores segmentan mal una tabla muy horizontal con PSM 11.
      // Reutilizamos el mismo worker y probamos PSM 6 solo cuando la primera lectura
      // carece de estructura suficiente. schedule.js elige la opción con más clases.
      onProgress("Intentando una segunda lectura de la tabla…");
      const alternative = await recognize(6);
      return score(alternative) > score(primary)
        ? { ...alternative, alternatives: [primary] }
        : { ...primary, alternatives: [alternative] };
    } finally {
      await worker?.terminate();
    }
  }
  root.FIT_OCR = { read };
  // Puente utilizado por Flutter Web. Devuelve texto y posiciones, nunca hace un POST.
  root.fitOcrRead = async (dataUrl) => JSON.stringify(await read(dataUrl));
})(window);
