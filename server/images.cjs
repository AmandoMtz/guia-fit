const sharp = require("sharp");
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
let uploads = 0, transforms = 0;

// Bound memory before Multer buffers the request, and separately while decoding.
function imageUploadSlot(req, res, next) {
  if (uploads >= 4) return next(fail(503, "image_busy", "Estamos procesando varias fotos. Inténtalo en unos segundos."));
  uploads++;
  let released = false;
  const release = () => { if (!released) { released = true; uploads--; } };
  res.once("finish", release);
  res.once("close", release);
  next();
}

async function normalizeImage(file, { size = 1280, fit = "inside", maxBytes = 1536 * 1024 } = {}) {
  const formats = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
  if (!file || !Object.hasOwn(formats, file.mimetype) || !Buffer.isBuffer(file.buffer))
    throw fail(400, "invalid_image", "Selecciona una imagen JPG, PNG o WebP.");
  if (file.buffer.length > 5242880) throw fail(413, "image_too_large", "La imagen supera 5 MB.");
  if (transforms >= 2) throw fail(503, "image_busy", "Estamos procesando varias fotos. Inténtalo en unos segundos.");
  transforms++;
  try {
    const processor = sharp(file.buffer, { failOn: "warning", limitInputPixels: 25000000 });
    const meta = await processor.metadata();
    if (meta.format !== formats[file.mimetype] || (meta.pages || 1) !== 1 || !meta.width || !meta.height)
      throw new Error("Invalid image");
    // Re-encode pixels: originals, EXIF/GPS, appended scripts and metadata are discarded.
    const bytes = await processor.rotate().resize(size, size, { fit, withoutEnlargement: true })
      .toColourspace("srgb").webp({ quality: 80 }).toBuffer();
    if (!bytes.length || bytes.length > maxBytes) throw new Error("Image output exceeds limit");
    return bytes;
  } catch {
    throw fail(400, "invalid_image", "No se pudo leer esa foto. Usa una imagen estática válida de hasta 25 megapíxeles.");
  } finally {
    transforms--;
  }
}
module.exports = { normalizeImage, imageUploadSlot };
