/* QR Model 2 fijo: versión 3, nivel L, modo byte. Suficiente para FIT-EVENT:<token>. */
const SIZE = 29;
const DATA_CODEWORDS = 55;
const ECC_CODEWORDS = 15;
function gfTables() {
  const exp = Array(512).fill(0), log = Array(256).fill(0);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  return { exp, log };
}
const GF = gfTables();
function mul(a, b) {
  if (!a || !b) return 0;
  return GF.exp[GF.log[a] + GF.log[b]];
}
function generator(degree) {
  let p = [1];
  for (let i = 0; i < degree; i++) {
    const next = Array(p.length + 1).fill(0);
    for (let j = 0; j < p.length; j++) {
      next[j] ^= p[j];
      next[j + 1] ^= mul(p[j], GF.exp[i]);
    }
    p = next;
  }
  return p;
}
function ecc(data) {
  const g = generator(ECC_CODEWORDS), work = [...data, ...Array(ECC_CODEWORDS).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const factor = work[i];
    if (!factor) continue;
    for (let j = 0; j < g.length; j++) work[i + j] ^= mul(g[j], factor);
  }
  return work.slice(data.length);
}
function bitLength(n) {
  let x = n, count = 0;
  while (x) { count++; x >>>= 1; }
  return count;
}
function formatBits(mask = 0) {
  const data = (1 << 3) | mask; // L = 01
  let d = data << 10;
  const g = 0x537;
  while (bitLength(d) >= bitLength(g)) d ^= g << (bitLength(d) - bitLength(g));
  return ((data << 10) | d) ^ 0x5412;
}
function codewords(text) {
  const bytes = [...Buffer.from(text, "utf8")];
  if (bytes.length > 53) throw new Error("QR payload too long");
  const bits = [];
  const push = (value, n) => { for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const b of bytes) push(b, 8);
  for (let i = 0; i < Math.min(4, DATA_CODEWORDS * 8 - bits.length); i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j++) value = (value << 1) | bits[i + j];
    out.push(value);
  }
  let pad = 0;
  while (out.length < DATA_CODEWORDS) out.push(pad++ % 2 ? 0x11 : 0xec);
  return [...out, ...ecc(out)];
}
function matrix(text) {
  const m = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const reserved = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const set = (r, c, value = false) => {
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return;
    m[r][c] = !!value;
    reserved[r][c] = true;
  };
  const finder = (row, col) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const dark = inside && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(row + r, col + c, dark);
    }
  };
  finder(0, 0); finder(0, SIZE - 7); finder(SIZE - 7, 0);
  for (let i = 8; i < SIZE - 8; i++) {
    if (!reserved[6][i]) set(6, i, i % 2 === 0);
    if (!reserved[i][6]) set(i, 6, i % 2 === 0);
  }
  // Alignment de versión 3: centro (22,22).
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    const a = Math.max(Math.abs(dr), Math.abs(dc));
    set(22 + dr, 22 + dc, a === 2 || a === 0);
  }
  // Reservar zonas de información de formato.
  const reserveFormat = [
    ...Array.from({ length: 9 }, (_, i) => [8, i]),
    ...Array.from({ length: 8 }, (_, i) => [i, 8]),
    ...Array.from({ length: 8 }, (_, i) => [8, SIZE - 1 - i]),
    ...Array.from({ length: 7 }, (_, i) => [SIZE - 1 - i, 8]),
  ];
  for (const [r, c] of reserveFormat) if (!reserved[r][c]) set(r, c, false);
  set(SIZE - 8, 8, true); // módulo oscuro fijo

  const words = codewords(text), dataBits = [];
  for (const word of words) for (let i = 7; i >= 0; i--) dataBits.push((word >>> i) & 1);
  let bit = 0, upward = true;
  for (let col = SIZE - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < SIZE; i++) {
      const row = upward ? SIZE - 1 - i : i;
      for (let k = 0; k < 2; k++) {
        const c = col - k;
        if (reserved[row][c]) continue;
        const raw = bit < dataBits.length ? dataBits[bit++] : 0;
        const masked = raw ^ ((row + c) % 2 === 0 ? 1 : 0); // máscara 0
        m[row][c] = !!masked;
      }
    }
    upward = !upward;
  }
  const bits = formatBits(0);
  for (let i = 0; i < 15; i++) {
    const mod = ((bits >>> i) & 1) === 1;
    // Copia vertical (implementación de referencia QR Model 2).
    if (i < 6) m[i][8] = mod;
    else if (i < 8) m[i + 1][8] = mod;
    else m[SIZE - 15 + i][8] = mod;
    // Copia horizontal.
    if (i < 8) m[8][SIZE - i - 1] = mod;
    else if (i < 9) m[8][15 - i] = mod;
    else m[8][15 - i - 1] = mod;
  }
  m[SIZE - 8][8] = true;
  return m;
}
function svg(text, scale = 8, margin = 4) {
  const m = matrix(text), n = SIZE + margin * 2, rects = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (m[r][c])
    rects.push(`<rect x="${c + margin}" y="${r + margin}" width="1" height="1"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * scale}" height="${n * scale}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><g fill="black">${rects.join("")}</g></svg>`;
}
module.exports = { matrix, svg };
