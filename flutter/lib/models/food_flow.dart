const foodOrderSteps = ['requested', 'accepted', 'ready', 'completed'];
const foodOrderNames = {
  'requested': 'Por confirmar',
  'accepted': 'En preparación',
  'ready': 'Listo para recoger',
  'completed': 'Entregado',
  'rejected': 'Rechazado',
  'cancelled': 'Cancelado',
};

String foodOrderHint(String status, bool seller) =>
    (seller
        ? const {
            'requested':
                'Confirma si puedes atenderlo. El cliente está esperando tu respuesta.',
            'accepted':
                'Prepara el pedido y avisa al cliente cuando pueda recogerlo.',
            'ready':
                'El cliente ya puede recogerlo. Confirma la entrega cuando lo reciba.',
            'completed':
                'Entrega finalizada. Este pedido queda en tu historial.',
            'rejected':
                'El cliente recibió un aviso de que no puedes atender este pedido.',
            'cancelled':
                'El cliente canceló antes de la confirmación. No prepares este pedido.',
          }
        : const {
            'requested':
                'El vendedor recibió tu solicitud. Espera su confirmación antes de ir.',
            'accepted':
                'El vendedor aceptó tu pedido. Te avisará aquí cuando esté listo.',
            'ready':
                'Tu pedido está listo. Acércate al punto de entrega y menciona tu nombre.',
            'completed': 'El vendedor marcó tu pedido como entregado.',
            'rejected':
                'El vendedor no pudo atender este pedido. Puedes elegir otro producto.',
            'cancelled':
                'Cancelaste esta solicitud. Puedes volver a explorar el menú.',
          })[status] ??
    'Consulta el estado de tu pedido.';

Map<String, String> foodOrderActions(String status, bool seller) {
  if (!seller) {
    return status == 'requested' ? {'cancelled': 'Cancelar pedido'} : {};
  }
  return (const {
        'requested': {
          'accepted': 'Aceptar pedido',
          'rejected': 'No puedo atenderlo',
        },
        'accepted': {
          'ready': 'Avisar: listo para recoger',
          'rejected': 'Cancelar preparación',
        },
        'ready': {'completed': 'Confirmar entrega'},
      })[status] ??
      {};
}

bool foodOrderMatches(String status, String filter) => switch (filter) {
  'all' => true,
  'active' => ['requested', 'accepted', 'ready'].contains(status),
  'history' => ['completed', 'rejected', 'cancelled'].contains(status),
  _ => status == filter,
};

int foodActiveCount(Map counts) => [
  'requested',
  'accepted',
  'ready',
].fold(0, (total, key) => total + ((counts[key] as num?)?.toInt() ?? 0));

String foodOrderQuantity(Map order) {
  final q = order['quantity'] as int;
  return order['sale_unit'] == 'lot'
      ? '$q ${q == 1 ? 'lote' : 'lotes'} de ${order['units_per_lot']} piezas · ${q * (order['units_per_lot'] as int)} piezas en total'
      : '$q ${q == 1 ? 'unidad' : 'unidades'}';
}

List<dynamic> foodSortedOrders(List<dynamic> orders, bool seller) {
  final priority = seller
      ? {'requested': 0, 'accepted': 1, 'ready': 2}
      : {'ready': 0, 'requested': 1, 'accepted': 2};
  return [...orders]..sort((a, b) {
    final difference =
        (priority[a['status']] ?? 3) - (priority[b['status']] ?? 3);
    return difference != 0
        ? difference
        : DateTime.parse(
            b['created_at'],
          ).compareTo(DateTime.parse(a['created_at']));
  });
}

String? foodNotificationTab(Map note) {
  if (note['order_id'] != null &&
      ['buyer', 'seller'].contains(note['order_role'])) {
    return note['order_role'] == 'seller' ? 'sales' : 'orders';
  }
  return note['kind'] == 'vendor_review' ? 'mine' : null;
}
