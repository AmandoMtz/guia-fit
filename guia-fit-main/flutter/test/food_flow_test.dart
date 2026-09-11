import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guia_fit/models/food_flow.dart';
import 'package:guia_fit/screens/food_screen.dart';
import 'package:guia_fit/services/api_client.dart';
import 'package:guia_fit/services/app_controller.dart';
import 'package:guia_fit/widgets/food_order_card.dart';

Map<String, dynamic> orderFixture([String status = 'requested']) => {
  'id': '11111111-1111-4111-8111-111111111111',
  'status': status,
  'buyer_name': 'Alumno de prueba',
  'business_name': 'Puesto de prueba',
  'product_name': 'Tacos de prueba',
  'quantity': 2,
  'sale_unit': 'lot',
  'units_per_lot': 3,
  'total_cents': 5000,
  'pickup_location': 'Mesa de prueba',
  'note': 'Sin cebolla',
  'created_at': '2026-09-10T12:00:00Z',
};

class FoodFixtureApi extends FitApiClient {
  final requests = <String>[];
  bool seller = true;
  FoodFixtureApi() : super('https://example.invalid');
  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    requests.add(path);
    if (path.endsWith('/catalog')) return {'vendors': [], 'products': []};
    if (path.endsWith('/mine')) {
      return {
        'vendor': seller
            ? {
                'id': 'vendor',
                'status': 'approved',
                'business_name': 'Puesto de prueba',
                'pickup_location': 'Mesa',
                'is_active': true,
              }
            : null,
        'products': [],
      };
    }
    if (path.endsWith('/notifications')) {
      return {
        'items': [
          {
            'id': 'notice',
            'kind': 'food_order',
            'order_id': orderFixture()['id'],
            'order_role': 'seller',
            'order_status': 'requested',
            'read_at': null,
            'title': 'Nueva solicitud de pedido',
            'body': 'Tacos',
            'created_at': '2026-09-10T12:00:00Z',
          },
        ],
        'unread_count': 1,
        'order_summary': {
          'buyer': {},
          'seller': {'requested': 1},
          'revision': 'one',
        },
      };
    }
    if (path.contains('/orders?role=seller')) return [orderFixture()];
    if (path.contains('/orders?role=buyer')) return [];
    if (path.endsWith('/notifications/read')) return {};
    throw StateError('Unexpected request $path');
  }
}

void main() {
  test(
    'los accesos de los avisos usan el rol autorizado y conservan compras y ventas separadas',
    () {
      expect(
        foodNotificationTab({'order_id': 'x', 'order_role': 'seller'}),
        'sales',
      );
      expect(
        foodNotificationTab({'order_id': 'x', 'order_role': 'buyer'}),
        'orders',
      );
      expect(
        foodNotificationTab({'order_id': 'x', 'title': 'Nueva solicitud'}),
        null,
      );
      expect(foodOrderActions('accepted', false), isEmpty);
      expect(foodOrderActions('ready', true), {
        'completed': 'Confirmar entrega',
      });
      expect(
        foodOrderQuantity(orderFixture()),
        '2 lotes de 3 piezas · 6 piezas en total',
      );
      expect(foodActiveCount({'requested': 2, 'ready': 1, 'completed': 50}), 3);
      expect(foodOrderMatches('cancelled', 'active'), false);
    },
  );
  testWidgets(
    'el seguimiento permite al vendedor entregar y al comprador consultar a 360 px',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(360, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      String? action;
      Widget page(bool seller) => MaterialApp(
        home: Scaffold(
          body: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(1.5)),
            child: SingleChildScrollView(
              child: FoodOrderCard(
                order: orderFixture('ready'),
                seller: seller,
                onAction: (v) => action = v,
              ),
            ),
          ),
        ),
      );
      await tester.pumpWidget(page(true));
      await tester.ensureVisible(find.text('Confirmar entrega'));
      await tester.tap(find.text('Confirmar entrega'));
      expect(action, 'completed');
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(page(false));
      expect(find.text('Confirmar entrega'), findsNothing);
      expect(find.textContaining('Tu pedido está listo'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'solicitar dos lotes muestra el total y evita reenviar mientras espera',
    (tester) async {
      final pending = Completer<Map<String, dynamic>>();
      int calls = 0;
      String? tracked;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => FilledButton(
                onPressed: () async {
                  tracked = await showDialog<String>(
                    context: context,
                    builder: (_) => FoodCheckoutDialog(
                      product: {
                        'name': 'Tacos',
                        'business_name': 'Puesto',
                        'pickup_location': 'Mesa',
                        'price_cents': 2500,
                        'sale_unit': 'lot',
                        'units_per_lot': 3,
                      },
                      onSubmit: (quantity, note) {
                        calls++;
                        expect(quantity, 2);
                        return pending.future;
                      },
                    ),
                  );
                },
                child: const Text('Abrir pedido'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Abrir pedido'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Agregar uno'));
      await tester.pump();
      expect(find.text('\$50.00 MXN'), findsOneWidget);
      expect(find.text('6 piezas en total'), findsOneWidget);
      await tester.tap(find.text('Solicitar pedido'));
      await tester.pump();
      await tester.tap(find.text('Enviando…'));
      await tester.pump();
      expect(calls, 1);
      pending.complete(orderFixture());
      await tester.pumpAndSettle();
      expect(find.text('Ahora espera la confirmación'), findsOneWidget);
      await tester.tap(find.text('Ver seguimiento'));
      await tester.pumpAndSettle();
      expect(tracked, orderFixture()['id']);
    },
  );
  testWidgets(
    'Pedidos recibidos abre ventas directamente y Mis compras consulta solo compras',
    (tester) async {
      final api = FoodFixtureApi();
      final c = AppController(api);
      c.user = FitUser.fromJson({
        'id': 'seller',
        'email': 'seller@example.test',
      });
      addTearDown(c.dispose);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(child: FoodScreen(controller: c)),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Pedidos recibidos (1)'));
      await tester.pumpAndSettle();
      expect(api.requests, contains('/api/food/orders?role=seller'));
      expect(find.text('Pedidos de tus clientes'), findsOneWidget);
      await tester.ensureVisible(find.text('Mis compras'));
      await tester.tap(find.text('Mis compras'));
      await tester.pumpAndSettle();
      expect(api.requests, contains('/api/food/orders?role=buyer'));
      expect(find.text('Tacos de prueba'), findsNothing);
    },
  );
  testWidgets(
    'el aviso abre el pedido de venta correcto y queda marcado como leído',
    (tester) async {
      final api = FoodFixtureApi();
      final c = AppController(api);
      c.user = FitUser.fromJson({
        'id': 'seller',
        'email': 'seller@example.test',
      });
      addTearDown(c.dispose);
      String? tab, id;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: FoodScreen(
                controller: c,
                mode: 'notifications',
                onOpenFood: (t, o) {
                  tab = t;
                  id = o;
                },
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ver pedido'));
      await tester.pumpAndSettle();
      expect(tab, 'sales');
      expect(id, orderFixture()['id']);
      expect(api.requests, contains('/api/food/notifications/read'));
    },
  );
}
