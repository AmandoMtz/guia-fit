/* Estados de pedidos compartidos por las vistas. No conceden permisos. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FIT_FOOD_FLOW = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  "use strict";
  const steps = ["requested", "accepted", "ready", "completed"];
  const names = {
    requested: "Por confirmar",
    accepted: "En preparación",
    ready: "Listo para recoger",
    completed: "Entregado",
    rejected: "Rechazado",
    cancelled: "Cancelado",
  };
  const hints = {
    buyer: {
      requested:
        "El vendedor recibió tu solicitud. Espera su confirmación antes de ir.",
      accepted:
        "El vendedor aceptó tu pedido. Te avisará aquí cuando esté listo.",
      ready:
        "Tu pedido está listo. Acércate al punto de entrega y menciona tu nombre.",
      completed: "El vendedor marcó tu pedido como entregado.",
      rejected:
        "El vendedor no pudo atender este pedido. Puedes elegir otro producto.",
      cancelled: "Cancelaste esta solicitud. Puedes volver a explorar el menú.",
    },
    seller: {
      requested:
        "Confirma si puedes atenderlo. El cliente está esperando tu respuesta.",
      accepted: "Prepara el pedido y avisa al cliente cuando pueda recogerlo.",
      ready:
        "El cliente ya puede recogerlo. Marca la entrega cuando lo reciba.",
      completed: "Entrega finalizada. Este pedido queda en tu historial.",
      rejected:
        "El cliente recibió un aviso de que no puedes atender este pedido.",
      cancelled:
        "El cliente canceló antes de la confirmación. No prepares este pedido.",
    },
  };
  function actions(status, seller) {
    if (!seller)
      return status === "requested" ? [["cancelled", "Cancelar pedido"]] : [];
    return (
      {
        requested: [
          ["accepted", "Aceptar pedido"],
          ["rejected", "No puedo atenderlo"],
        ],
        accepted: [
          ["ready", "Avisar: listo para recoger"],
          ["rejected", "Cancelar preparación"],
        ],
        ready: [["completed", "Confirmar entrega"]],
      }[status] || []
    );
  }
  function matches(status, filter) {
    if (filter === "all") return true;
    if (filter === "history")
      return ["completed", "rejected", "cancelled"].includes(status);
    if (filter === "active")
      return ["requested", "accepted", "ready"].includes(status);
    return status === filter;
  }
  function sortOrders(orders, seller) {
    const priority = seller
      ? { requested: 0, accepted: 1, ready: 2 }
      : { ready: 0, requested: 1, accepted: 2 };
    return [...orders].sort(
      (a, b) =>
        (priority[a.status] ?? 3) - (priority[b.status] ?? 3) ||
        new Date(b.created_at) - new Date(a.created_at),
    );
  }
  function activeCount(counts = {}) {
    return ["requested", "accepted", "ready"].reduce(
      (sum, key) => sum + Number(counts[key] || 0),
      0,
    );
  }
  function destination(note) {
    if (note.order_id && ["buyer", "seller"].includes(note.order_role))
      return {
        tab: note.order_role === "seller" ? "sales" : "orders",
        orderId: note.order_id,
      };
    return note.kind === "vendor_review"
      ? { tab: "mine", orderId: null }
      : null;
  }
  function quantity(p) {
    const q = Number(p.quantity);
    return p.sale_unit === "lot"
      ? `${q} ${q === 1 ? "lote" : "lotes"} de ${p.units_per_lot} piezas · ${q * Number(p.units_per_lot)} piezas en total`
      : `${q} ${q === 1 ? "unidad" : "unidades"}`;
  }
  return {
    steps,
    names,
    hints,
    actions,
    matches,
    sortOrders,
    activeCount,
    destination,
    quantity,
  };
});
