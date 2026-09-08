const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const core = require("../web/dist/js/core.js");
const sandbox = { window: {} };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../web/dist/js/catalog.js"), "utf8"),
  sandbox,
);
const catalog = sandbox.window.FIT_CATALOG;

test("admite nombres con acentos y detecta contraseñas diferentes", () => {
  const values = {
    full_name: "José Amando Martínez Hernández",
    email: "alumno@example.test",
    password: "mi frase extensa",
    confirm: "otra frase extensa",
  };
  assert.equal(core.validate(values, "register").full_name, undefined);
  assert.equal(core.validate(values, "register").email, undefined);
  assert.ok(core.validate(values, "register").confirm);
  assert.ok(
    core.validate({ ...values, full_name: "A\u0000B" }, "register").full_name,
  );
});
test("validación de acceso, recuperación y contraseña nueva", () => {
  assert.ok(core.validate({ email: "invalido", password: "" }, "login").email);
  assert.ok(
    core.validate({ email: "invalido", password: "" }, "login").password,
  );
  assert.deepEqual(
    core.validate({ email: "alumno@example.test" }, "recover"),
    {},
  );
  assert.deepEqual(
    core.validate(
      {
        password: "frase suficientemente larga",
        confirm: "frase suficientemente larga",
      },
      "reset",
    ),
    {},
  );
});
test("ninguna ruta real se inventa a partir del croquis", () => {
  assert.equal(catalog.edges.length, 0);
  assert.equal(
    core.findRoute(catalog.places, catalog.edges, "entrada-faja", "sala-a"),
    null,
  );
  assert.equal(
    catalog.places.every((p) => p.verified === false),
    true,
  );
});
test("busca salones sin distinguir acentos", () => {
  assert.equal(
    core.filterPlaces(catalog.places, "cafeteria", "", "").length,
    1,
  );
  assert.equal(core.filterPlaces(catalog.places, "", "Aula", "").length, 1);
});
test("la demostración avanza por los tres tramos y no se acepta como real", () => {
  assert.equal(
    core.findRoute(
      catalog.demoPlaces,
      catalog.demoEdges,
      "demo-inicio",
      "demo-102",
      false,
      true,
    ).length,
    3,
  );
  assert.equal(
    core.findRoute(
      catalog.demoPlaces,
      catalog.demoEdges,
      "demo-inicio",
      "demo-102",
    ),
    null,
  );
});
test("respeta sentido, accesibilidad y verificación de todos los puntos", () => {
  const nodes = ["a", "b", "c"].map((id) => ({ id, verified: true }));
  const edges = [
    { from_id: "a", to_id: "b", verified: true, accessible: true },
    { from_id: "b", to_id: "c", verified: true, accessible: false },
    { from_id: "b", to_id: "a", verified: true, accessible: true },
  ];
  assert.equal(core.findRoute(nodes, edges, "a", "c").length, 2);
  assert.equal(core.findRoute(nodes, edges, "a", "c", true), null);
  assert.equal(core.findRoute(nodes, edges, "c", "a"), null);
  nodes[1].verified = false;
  assert.equal(core.findRoute(nodes, edges, "a", "c"), null);
});
test("rechaza imágenes con protocolos ejecutables y archivos locales", () => {
  assert.equal(core.photoUrl("javascript:alert(1)"), "");
  assert.equal(core.photoUrl("file:///secret"), "");
  assert.equal(
    core.photoUrl("https://example.test/a.png"),
    "https://example.test/a.png",
  );
});
