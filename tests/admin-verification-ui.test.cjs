const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (name) =>
  fs.readFileSync(path.join(__dirname, "../web/dist/js", name), "utf8");

test("los chats informan su duración sin mostrar el registro administrativo", () => {
  const academic = read("academic-chat.js");
  const food = read("food.js");

  assert.match(academic, /disponibles aquí durante 7 días/);
  assert.match(food, /El chat está disponible durante 12 horas/);
  assert.doesNotMatch(academic, /Administración conserva/i);
  assert.doesNotMatch(food, /Administración conserva/i);
});

test("administración ofrece acciones directas para verificar cuentas y comidas", () => {
  const app = read("app.js");
  const food = read("food.js");

  assert.match(app, /data-admin-verify/);
  assert.match(app, />Verificar cuenta</);
  assert.match(app, /\/api\/admin\/verify/);
  assert.match(app, /Verificar cuentas/);
  assert.match(food, /Verificar puesto/);
  assert.match(food, /\/admin\/vendors\//);
  assert.match(food, /Verificación de comidas/i);
});
