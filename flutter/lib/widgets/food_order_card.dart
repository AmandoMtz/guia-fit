import 'package:flutter/material.dart';
import '../models/food_flow.dart';
import 'common.dart';

class FoodOrderCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final bool seller, busy, highlighted;
  final void Function(String status) onAction;
  const FoodOrderCard({
    super.key,
    required this.order,
    required this.seller,
    required this.onAction,
    this.busy = false,
    this.highlighted = false,
  });

  @override
  Widget build(BuildContext context) {
    final status = order['status'] as String;
    final current = foodOrderSteps.indexOf(status);
    final actions = foodOrderActions(status, seller);
    final color = status == 'ready' || status == 'completed'
        ? const Color(0xFF24633D)
        : status == 'requested'
        ? const Color(0xFF81400B)
        : fitNavy;
    return Container(
      margin: const EdgeInsets.only(bottom: 18),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: highlighted ? fitOrange : const Color(0xFFD8E3E8),
          width: highlighted ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 10,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                '${seller ? 'Cliente' : 'Puesto'}: ${seller ? order['buyer_name'] : order['business_name']}',
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: .09),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  foodOrderNames[status] ?? status,
                  style: TextStyle(
                    color: color,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            order['product_name'],
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(foodOrderQuantity(order)),
          const SizedBox(height: 8),
          Text(
            '\$${((order['total_cents'] as num) / 100).toStringAsFixed(2)} MXN',
            style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w700),
          ),
          if (current >= 0) ...[
            const SizedBox(height: 24),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < 4; i++)
                  Expanded(
                    child: Semantics(
                      label:
                          '${const ['Enviado', 'Confirmado', 'Listo', 'Entregado'][i]}${i == current ? ', etapa actual' : ''}',
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: i == current
                                ? fitOrange
                                : i < current
                                ? fitNavy
                                : const Color(0xFFE7EEF2),
                            child: i < current
                                ? const Icon(
                                    Icons.check,
                                    color: Colors.white,
                                    size: 17,
                                  )
                                : Text(
                                    '${i + 1}',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: i == current
                                          ? Colors.white
                                          : fitNavy,
                                    ),
                                  ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            const [
                              'Enviado',
                              'Confirmado',
                              'Listo',
                              'Entregado',
                            ][i],
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: i == current
                                  ? FontWeight.w700
                                  : FontWeight.w400,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
          Container(
            margin: const EdgeInsets.symmetric(vertical: 20),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF0F5F7),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              foodOrderHint(status, seller),
              style: const TextStyle(fontSize: 16, height: 1.5),
            ),
          ),
          Text('Punto de entrega: ${order['pickup_location']}'),
          if ((order['note'] as String? ?? '').isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text('Nota del cliente: ${order['note']}'),
            ),
          const Divider(height: 30),
          Text(
            'Pedido #${(order['id'] as String).substring(0, 8)} · ${DateTime.parse(order['created_at']).toLocal().toString().substring(0, 16)}',
            style: const TextStyle(color: fitMuted, fontSize: 13),
          ),
          if (actions.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Wrap(
                spacing: 8,
                runSpacing: 10,
                children: [
                  for (final action in actions.entries)
                    if (['rejected', 'cancelled'].contains(action.key))
                      OutlinedButton(
                        onPressed: busy ? null : () => onAction(action.key),
                        child: Text(action.value),
                      )
                    else
                      FilledButton(
                        onPressed: busy ? null : () => onAction(action.key),
                        child: Text(action.value),
                      ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
