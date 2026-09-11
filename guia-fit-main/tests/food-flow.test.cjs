const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../web/dist/js/food-flow.js");

test("dos lotes expresan seis piezas y conservan la unidad de venta", () => {
  assert.equal(
    F.quantity({ quantity: 2, sale_unit: "lot", units_per_lot: 3 }),
    "2 lotes de 3 piezas · 6 piezas en total",
  );
  assert.equal(
    F.quantity({ quantity: 1, sale_unit: "unit", units_per_lot: 1 }),
    "1 unidad",
  );
});
test("un comprador ve primero lo listo y un vendedor lo que espera confirmación", () => {
  const orders = ["completed", "accepted", "ready", "requested"].map(
    (status) => ({ status, created_at: "2026-09-10T12:00:00Z" }),
  );
  assert.equal(F.sortOrders(orders, true)[0].status, "requested");
  assert.equal(F.sortOrders(orders, false)[0].status, "ready");
  assert.equal(orders[0].status, "completed");
  assert.equal(
    F.activeCount({
      requested: 2,
      accepted: 3,
      ready: 1,
      completed: 80,
      rejected: 2,
    }),
    6,
  );
  assert.equal(F.matches("cancelled", "active"), false);
  assert.equal(F.matches("rejected", "history"), true);
});
test("los avisos distinguen ventas de compras y no deducen permisos del título", () => {
  assert.deepEqual(F.destination({ order_id: "one", order_role: "seller" }), {
    tab: "sales",
    orderId: "one",
  });
  assert.deepEqual(F.destination({ order_id: "one", order_role: "buyer" }), {
    tab: "orders",
    orderId: "one",
  });
  assert.equal(
    F.destination({ order_id: "one", title: "Nueva solicitud de pedido" }),
    null,
  );
  assert.deepEqual(F.destination({ kind: "vendor_review" }), {
    tab: "mine",
    orderId: null,
  });
});
test("las acciones del seguimiento respetan cada etapa y el papel del usuario", () => {
  assert.deepEqual(F.actions("ready", true), [
    ["completed", "Confirmar entrega"],
  ]);
  assert.deepEqual(F.actions("ready", false), []);
  assert.deepEqual(F.actions("accepted", false), []);
  assert.deepEqual(F.actions("requested", false), [
    ["cancelled", "Cancelar pedido"],
  ]);
  assert.deepEqual(F.actions("completed", true), []);
  assert.match(F.hints.buyer.requested, /Espera su confirmación/);
});
