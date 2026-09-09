const {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
} = require("node:crypto");
const { promisify } = require("node:util");
const derive = promisify(scrypt);
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const randomToken = () => randomBytes(32).toString("base64url");
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 3,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$32768$8$3$${salt}$${key.toString("hex")}`;
}
async function verifyPassword(password, encoded) {
  const parts = (encoded || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const key = await derive(password, parts[4], 64, {
    N: Number(parts[1]),
    r: Number(parts[2]),
    p: Number(parts[3]),
    maxmem: 64 * 1024 * 1024,
  });
  const expected = Buffer.from(parts[5], "hex");
  return expected.length === key.length && timingSafeEqual(key, expected);
}
function passwordValid(value) {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 128 &&
    /[a-zA-Z]/.test(value) &&      // al menos una letra
    /[0-9]/.test(value) &&         // al menos un número
    /[^a-zA-Z0-9]/.test(value)     // al menos un carácter especial
  );
}
function emailValid(value) {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}
function nameValid(value) {
  return (
    typeof value === "string" &&
    value.trim().length >= 2 &&
    value.trim().length <= 100 &&
    !/[\x00-\x1f]/.test(value)
  );
}
module.exports = {
  hashToken,
  randomToken,
  hashPassword,
  verifyPassword,
  passwordValid,
  emailValid,
  nameValid,
};
