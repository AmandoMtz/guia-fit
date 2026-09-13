import 'dart:math';
import '../models/food_flow.dart';
import '../widgets/food_order_card.dart';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../services/app_controller.dart';
import '../widgets/common.dart';

String foodMoney(dynamic cents) =>
    '\$${((cents as num) / 100).toStringAsFixed(2)}';
String foodUnit(Map p) =>
    p['sale_unit'] == 'lot' ? 'lote de ${p['units_per_lot']} piezas' : 'unidad';
String foodStatus(dynamic status) =>
    const {
      'pending': 'En revisión',
      'approved': 'Verificado',
      'suspended': 'Suspendido',
      'requested': 'Por confirmar',
      'accepted': 'En preparación',
      'ready': 'Listo para recoger',
      'completed': 'Entregado',
      'rejected': 'Rechazado',
      'cancelled': 'Cancelado',
    }[status] ??
    '$status';
String requestUuid() {
  final r = Random.secure();
  final b = List<int>.generate(16, (_) => r.nextInt(256));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  final h = b.map((v) => v.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
}

class FoodScreen extends StatefulWidget {
  final AppController controller;
  final String mode;
  final VoidCallback? onChanged;
  final String initialTab;
  final String? focusOrderId;
  final Map<String, dynamic>? notificationData;
  final void Function(String tab, String? orderId)? onOpenFood;
  final ValueChanged<String>? onTabChanged;
  const FoodScreen({
    super.key,
    required this.controller,
    this.mode = 'food',
    this.onChanged,
    this.initialTab = 'products',
    this.focusOrderId,
    this.notificationData,
    this.onOpenFood,
    this.onTabChanged,
  });
  @override
  State<FoodScreen> createState() => _FoodScreenState();
}

class _FoodScreenState extends State<FoodScreen> {
  Map<String, dynamic> _catalog = {'vendors': [], 'products': []},
      _mine = {'vendor': null, 'products': []};
  List<dynamic> _orders = [], _notes = [], _vendors = [];
  Map<String, dynamic> _summary = {
    'buyer': <String, dynamic>{},
    'seller': <String, dynamic>{},
  };
  String _tab = 'products',
      _query = '',
      _vendor = '',
      _ordersFilter = 'active',
      _salesFilter = 'active';
  String? _focusOrderId, _error;
  String _loadedOrderRevision = '';
  final _search = TextEditingController();
  bool _loading = true, _busy = false, _dialogOpen = false;
  int _loadTicket = 0;
  AppController get c => widget.controller;
  Future<dynamic> _api(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final owner = c.user?.id;
    final result = await c.client!.request(
      '/api/food$path',
      method: method,
      body: body,
    );
    if (!mounted || c.user?.id != owner) {
      throw StateError('La sesión cambió. Vuelve a abrir Comidas.');
    }
    return result;
  }

  @override
  void initState() {
    super.initState();
    _tab = widget.initialTab;
    _focusOrderId = widget.focusOrderId;
    if (_focusOrderId != null) {
      _ordersFilter = 'all';
      _salesFilter = 'all';
    }
    _load();
  }

  @override
  void dispose() {
    _loadTicket++;
    _search.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant FoodScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.notificationData != null &&
        !identical(widget.notificationData, oldWidget.notificationData)) {
      final next = Map<String, dynamic>.from(
        widget.notificationData!['order_summary'] ?? {},
      );
      final changed = next.toString() != _loadedOrderRevision;
      _summary = next;
      if (widget.mode == 'notifications') {
        _notes = widget.notificationData!['items'] ?? [];
      }
      if (changed &&
          ['orders', 'sales'].contains(_tab) &&
          !_loading &&
          !_busy &&
          !_dialogOpen) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _load(silent: true);
        });
      }
    }
  }

  void _openTab(String tab, {String? orderId, String? filter}) {
    setState(() {
      _tab = tab;
      _focusOrderId = orderId;
      if (orderId != null) {
        _ordersFilter = 'all';
        _salesFilter = 'all';
      }
      if (filter != null) {
        if (tab == 'sales') {
          _salesFilter = filter;
        } else {
          _ordersFilter = filter;
        }
      }
    });
    widget.onTabChanged?.call(tab);
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    final ticket = ++_loadTicket, owner = c.user?.id, tab = _tab;
    if (c.demo) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    if (mounted && !silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      if (widget.mode == 'notifications') {
        final data = await _api('/notifications');
        if (!mounted || ticket != _loadTicket) return;
        _notes = data['items'];
        _summary = Map<String, dynamic>.from(data['order_summary'] ?? {});
      } else if (widget.mode == 'admin') {
        final rows = await _api('/admin/vendors');
        if (!mounted || ticket != _loadTicket) return;
        _vendors = rows;
      } else {
        final data = await Future.wait([
          _api('/catalog'),
          _api('/mine'),
          _api('/notifications'),
        ]);
        List<dynamic> rows = [];
        if (['orders', 'sales'].contains(tab)) {
          rows = await _api(
            '/orders?role=${tab == 'sales' ? 'seller' : 'buyer'}',
          );
          final focus = _focusOrderId;
          if (focus != null && !rows.any((o) => o['id'] == focus)) {
            final order = await _api('/orders/$focus');
            if (order['order_role'] == (tab == 'sales' ? 'seller' : 'buyer')) {
              rows = [order, ...rows];
            }
          }
        }
        if (!mounted || ticket != _loadTicket || c.user?.id != owner) return;
        _catalog = Map<String, dynamic>.from(data[0]);
        _mine = Map<String, dynamic>.from(data[1]);
        _summary = Map<String, dynamic>.from(data[2]['order_summary'] ?? {});
        _orders = rows;
        _loadedOrderRevision = _summary.toString();
        if (_tab == 'sales' && _mine['vendor'] == null) _tab = 'mine';
        if (_vendor.isNotEmpty &&
            !(_catalog['vendors'] as List).any((v) => v['id'] == _vendor)) {
          _vendor = '';
        }
      }
    } catch (e) {
      if (mounted && ticket == _loadTicket && c.user?.id == owner) {
        if (!silent) {
          _error = authError(e);
        } else {
          message(
            context,
            'No pudimos actualizar los pedidos. Intenta con Actualizar.',
          );
        }
      }
    } finally {
      if (mounted && ticket == _loadTicket && c.user?.id == owner) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _action(Future<void> Function() fn) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await fn();
      widget.onChanged?.call();
    } catch (e) {
      if (mounted) message(context, authError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _card(Widget child) => Container(
    width: double.infinity,
    margin: const EdgeInsets.only(bottom: 16),
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0xFFE0E7EA)),
    ),
    child: child,
  );
  Widget _tag(dynamic status) => Chip(
    label: Text(foodStatus(status), style: const TextStyle(fontSize: 14)),
    visualDensity: VisualDensity.compact,
    backgroundColor:
        ['approved', 'ready', 'accepted', 'completed'].contains(status)
        ? const Color(0xFFE8F3EC)
        : const Color(0xFFFFF1E2),
    side: BorderSide.none,
  );
  Widget _empty(String title, String body) => _card(
    Column(
      children: [
        const Icon(Icons.restaurant_outlined, size: 36, color: fitOrange),
        const SizedBox(height: 18),
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        Text(
          body,
          textAlign: TextAlign.center,
          style: const TextStyle(color: fitMuted, height: 1.7),
        ),
      ],
    ),
  );
  Widget _tabs() => LayoutBuilder(
    builder: (context, box) {
      final nav = <(String, IconData, String, String)>[
        (
          'products',
          Icons.restaurant_outlined,
          'Explorar',
          'Encuentra qué comer',
        ),
        (
          'orders',
          Icons.shopping_bag_outlined,
          'Mis compras',
          'Lo que tú pediste',
        ),
        if (_mine['vendor'] != null)
          (
            'sales',
            Icons.notifications_active_outlined,
            'Pedidos recibidos',
            'Lo que piden tus clientes',
          ),
        (
          'mine',
          Icons.storefront_outlined,
          _mine['vendor'] == null ? 'Quiero vender' : 'Mi puesto',
          'Productos y datos del puesto',
        ),
      ];
      final columns = box.maxWidth > 1000
          ? 4
          : box.maxWidth < 280
          ? 1
          : 2;
      final width = (box.maxWidth - (columns - 1) * 10) / columns;
      return Padding(
        padding: const EdgeInsets.only(bottom: 22),
        child: Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final item in nav)
              SizedBox(
                width: width,
                child: Semantics(
                  selected:
                      _tab == item.$1 ||
                      (_tab == 'vendors' && item.$1 == 'products'),
                  child: Material(
                    color:
                        _tab == item.$1 ||
                            (_tab == 'vendors' && item.$1 == 'products')
                        ? fitNavy
                        : Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: const BorderSide(color: Color(0xFFD8E3E8)),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: _busy ? null : () => _openTab(item.$1),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              item.$2,
                              size: 23,
                              color:
                                  _tab == item.$1 ||
                                      (_tab == 'vendors' &&
                                          item.$1 == 'products')
                                  ? Colors.white
                                  : fitNavy,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              '${item.$3}${item.$1 == 'sales' && (_summary['seller']?['requested'] ?? 0) > 0
                                  ? ' (${_summary['seller']['requested']})'
                                  : item.$1 == 'orders' && foodActiveCount(_summary['buyer'] ?? {}) > 0
                                  ? ' (${foodActiveCount(_summary['buyer'] ?? {})})'
                                  : ''}',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color:
                                    _tab == item.$1 ||
                                        (_tab == 'vendors' &&
                                            item.$1 == 'products')
                                    ? Colors.white
                                    : fitNavy,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.$4,
                              style: TextStyle(
                                fontSize: 14,
                                color:
                                    _tab == item.$1 ||
                                        (_tab == 'vendors' &&
                                            item.$1 == 'products')
                                    ? const Color(0xFFD8E5EC)
                                    : fitMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      );
    },
  );
  Widget _attention() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if ((_summary['seller']?['requested'] ?? 0) > 0)
        _card(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${_summary['seller']['requested']} pedidos esperan tu respuesta',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              const Text('Revisa y confirma los pedidos nuevos.'),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => _openTab('sales', filter: 'requested'),
                icon: const Icon(Icons.notifications_active_outlined),
                label: const Text('Atender pedidos'),
              ),
            ],
          ),
        ),
      if ((_summary['buyer']?['ready'] ?? 0) > 0)
        _card(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${_summary['buyer']['ready']} compras listas para recoger',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => _openTab('orders', filter: 'ready'),
                icon: const Icon(Icons.check_circle_outline),
                label: const Text('Ver mis compras'),
              ),
            ],
          ),
        ),
    ],
  );
  @override
  Widget build(BuildContext context) {
    if (c.demo) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: Image.asset(
              'assets/food-example.jpg',
              height: 230,
              fit: BoxFit.cover,
              semanticLabel: 'Fotografía ilustrativa de tacos',
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Text(
              'Imagen de ejemplo · Larry Miller · CC BY-SA 2.0. Crédito y enlace de licencia en Acerca de Comidas.',
              style: TextStyle(color: fitMuted, fontSize: 11),
            ),
          ),
          _empty(
            'El sabor de tu comunidad',
            'Inicia sesión para ver vendedores, solicitar productos o dar de alta tu puesto. La imagen no representa un producto a la venta.',
          ),
          TextButton(
            onPressed: _license,
            child: const Text('Acerca de Comidas'),
          ),
        ],
      );
    }
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(40),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null) {
      return Column(
        children: [
          InfoBanner(_error!, error: true),
          OutlinedButton(onPressed: _load, child: const Text('Reintentar')),
        ],
      );
    }
    if (widget.mode == 'notifications') return _notifications();
    if (widget.mode == 'admin') return _admin();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _tabs(),
        _attention(),
        switch (_tab) {
          'vendors' => _vendorList(),
          'orders' => _orderList(false),
          'sales' => _orderList(true),
          'mine' => _own(),
          _ => _products(),
        },
      ],
    );
  }

  void _license() => showLicensePage(
    context: context,
    applicationName: 'Guía FIT · Comidas',
    applicationLegalese:
        'Fotografía: Larry Miller. CC BY-SA 2.0.\nhttps://creativecommons.org/licenses/by-sa/2.0/\nFuente: https://commons.wikimedia.org/wiki/File:001_Tacos_de_carnitas,_carne_asada_y_al_pastor.jpg\nSolo ilustrativa.',
  );
  Widget _products() {
    final items = (_catalog['products'] as List)
        .where(
          (p) =>
              (_vendor.isEmpty || p['vendor_id'] == _vendor) &&
              '${p['name']} ${p['business_name']} ${p['description']}'
                  .toLowerCase()
                  .contains(_query.toLowerCase()),
        )
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 14,
          runSpacing: 8,
          alignment: WrapAlignment.spaceBetween,
          children: [
            Text(
              '¿Qué se te antoja?',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            TextButton.icon(
              onPressed: () => _openTab('vendors'),
              icon: const Icon(Icons.storefront_outlined),
              label: const Text('Ver puestos'),
            ),
          ],
        ),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 16),
          child: Text(
            '1. Elige y solicita   ·   2. Espera confirmación   ·   3. Recoge en el puesto',
            style: TextStyle(fontSize: 14, height: 1.6, color: fitMuted),
          ),
        ),
        TextField(
          controller: _search,
          onChanged: (v) => setState(() => _query = v),
          decoration: const InputDecoration(
            labelText: 'Buscar producto o puesto',
            prefixIcon: Icon(Icons.search),
          ),
        ),
        const SizedBox(height: 14),
        DropdownButtonFormField<String>(
          initialValue: _vendor,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Puesto'),
          items: [
            const DropdownMenuItem(value: '', child: Text('Todos los puestos')),
            for (final v in _catalog['vendors'])
              DropdownMenuItem(
                value: v['id'] as String,
                child: Text(
                  v['business_name'],
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
          onChanged: (v) => setState(() => _vendor = v ?? ''),
        ),
        const SizedBox(height: 20),
        if (items.isEmpty)
          _empty(
            'Sin productos por ahora',
            'Prueba otro puesto o vuelve más tarde.',
          ),
        LayoutBuilder(
          builder: (context, box) {
            final columns = box.maxWidth >= 950
                ? 3
                : box.maxWidth >= 580
                ? 2
                : 1;
            final width = (box.maxWidth - 18 * (columns - 1)) / columns;
            return Wrap(
              spacing: 18,
              runSpacing: 18,
              children: items.map((raw) {
                final p = Map<String, dynamic>.from(raw);
                return SizedBox(
                  width: width,
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFE0E7EA)),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (p['photo_url'] != null)
                          Image.network(
                            p['photo_url'],
                            height: 185,
                            fit: BoxFit.cover,
                            errorBuilder: (_, e, s) => _photoPlaceholder(),
                          )
                        else
                          _photoPlaceholder(),
                        Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                p['business_name'],
                                style: const TextStyle(
                                  color: fitOrange,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                p['name'],
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                p['description'],
                                style: const TextStyle(
                                  color: fitMuted,
                                  height: 1.6,
                                ),
                              ),
                              const SizedBox(height: 15),
                              Text(
                                'Recoge en: ${p['pickup_location']}',
                                style: const TextStyle(
                                  color: fitMuted,
                                  fontSize: 14,
                                ),
                              ),
                              const Divider(height: 30),
                              Wrap(
                                spacing: 14,
                                runSpacing: 10,
                                alignment: WrapAlignment.spaceBetween,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        foodMoney(p['price_cents']),
                                        style: const TextStyle(
                                          fontSize: 25,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      Text(
                                        'MXN / ${foodUnit(p)}',
                                        style: const TextStyle(
                                          fontSize: 14,
                                          color: fitMuted,
                                        ),
                                      ),
                                    ],
                                  ),
                                  FilledButton(
                                    onPressed:
                                        _mine['vendor']?['id'] == p['vendor_id']
                                        ? null
                                        : () => _order(p),
                                    child: Text(
                                      _mine['vendor']?['id'] == p['vendor_id']
                                          ? 'Tu producto'
                                          : 'Pedir',
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            );
          },
        ),
      ],
    );
  }

  Widget _photoPlaceholder() => Container(
    height: 185,
    color: const Color(0xFFF3EBE1),
    child: const Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.restaurant_outlined, size: 38, color: Color(0xFFA68E75)),
        SizedBox(height: 10),
        Text(
          'Fotografía pendiente',
          style: TextStyle(color: Color(0xFF8B7864), fontSize: 12),
        ),
      ],
    ),
  );
  Widget _vendorList() => Column(
    children: [
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          onPressed: () {
            _vendor = '';
            _openTab('products');
          },
          icon: const Icon(Icons.arrow_back),
          label: const Text('Todos los productos'),
        ),
      ),
      if ((_catalog['vendors'] as List).isEmpty)
        _empty(
          'La comunidad está creciendo',
          'Aún no hay vendedores aprobados. Solicita tu puesto en Quiero vender.',
        ),
      for (final v in _catalog['vendors'])
        _card(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _tag('approved'),
              Text(
                v['business_name'],
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 10),
              Text(v['description']),
              const SizedBox(height: 10),
              Text('Recoge en: ${v['pickup_location']}'),
              Text(
                '${v['hours_text']} · ${v['product_count']} productos',
                style: const TextStyle(color: fitMuted),
              ),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: () => setState(() {
                  _vendor = v['id'];
                  _tab = 'products';
                  _query = '';
                  _search.clear();
                  widget.onTabChanged?.call('products');
                }),
                icon: const Icon(Icons.arrow_forward),
                label: const Text('Ver productos'),
              ),
            ],
          ),
        ),
    ],
  );
  Future<void> _order(Map<String, dynamic> p) async {
    final requestId = requestUuid();
    _dialogOpen = true;
    try {
      final id = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (context) => FoodCheckoutDialog(
          product: p,
          onSubmit: (quantity, note) async {
            final order = await _api(
              '/orders',
              method: 'POST',
              body: {
                'product_id': p['id'],
                'quantity': quantity,
                'note': note,
                'request_id': requestId,
                'expected_price_cents': p['price_cents'],
              },
            );
            widget.onChanged?.call();
            return Map<String, dynamic>.from(order);
          },
        ),
      );
      if (mounted) {
        if (id != null) {
          _openTab('orders', orderId: id);
        } else {
          await _load(silent: true);
        }
      }
    } finally {
      _dialogOpen = false;
    }
  }

  Widget _orderList(bool seller) {
    final filter = seller ? _salesFilter : _ordersFilter;
    final filters = seller
        ? {
            'active': 'En curso',
            'requested': 'Nuevos',
            'accepted': 'En preparación',
            'ready': 'Por entregar',
            'history': 'Historial',
            'all': 'Todos',
          }
        : {
            'active': 'En curso',
            'ready': 'Para recoger',
            'history': 'Historial',
            'all': 'Todos',
          };
    final rows = foodSortedOrders(
      _orders.where((o) => foodOrderMatches(o['status'], filter)).toList(),
      seller,
    );
    if (_focusOrderId != null) {
      final at = rows.indexWhere((o) => o['id'] == _focusOrderId);
      if (at > 0) rows.insert(0, rows.removeAt(at));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                seller ? 'Pedidos de tus clientes' : 'Lo que has pedido',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            IconButton(
              onPressed: _busy ? null : () => _load(silent: true),
              tooltip: 'Actualizar pedidos',
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        Text(
          seller
              ? 'Confirma, prepara y entrega. Cada cambio avisa al cliente.'
              : 'Consulta la respuesta del puesto y cuándo puedes recoger.',
          style: const TextStyle(color: fitMuted),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 18),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final f in filters.entries)
                ChoiceChip(
                  label: Text(
                    '${f.value} (${_orders.where((o) => foodOrderMatches(o['status'], f.key)).length})',
                  ),
                  selected: filter == f.key,
                  onSelected: _busy
                      ? null
                      : (_) => setState(() {
                          if (seller) {
                            _salesFilter = f.key;
                          } else {
                            _ordersFilter = f.key;
                          }
                          _focusOrderId = null;
                        }),
                ),
            ],
          ),
        ),
        if (rows.isEmpty) ...[
          _empty(
            filter == 'history'
                ? 'Aún no hay pedidos finalizados'
                : 'Todo al día por aquí',
            seller
                ? 'Los pedidos de tus clientes aparecerán en Nuevos. También recibirás un aviso en la campana.'
                : 'Aquí aparecerá el seguimiento cuando solicites un producto.',
          ),
          OutlinedButton(
            onPressed: () => _openTab(seller ? 'mine' : 'products'),
            child: Text(seller ? 'Ver mi puesto' : 'Explorar productos'),
          ),
        ],
        for (final raw in rows)
          FoodOrderCard(
            order: Map<String, dynamic>.from(raw),
            seller: seller,
            busy: _busy,
            highlighted: raw['id'] == _focusOrderId,
            onAction: (status) => _action(() async {
              final question = status == 'completed'
                  ? '¿${raw['buyer_name']} ya recibió ${raw['product_name']}?'
                  : status == 'rejected'
                  ? '¿Confirmas que no puedes atender ${raw['product_name']}? Se avisará al cliente.'
                  : status == 'cancelled'
                  ? '¿Cancelar tu pedido de ${raw['product_name']}?'
                  : null;
              if (question != null && !await _confirm(question)) return;
              await _api(
                '/orders/${raw['id']}',
                method: 'PATCH',
                body: {'status': status},
              );
              await _load(silent: true);
              if (mounted) {
                message(
                  context,
                  status == 'completed'
                      ? 'Entrega confirmada.'
                      : 'Pedido actualizado. Se envió el aviso.',
                );
              }
            }),
          ),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 18),
          child: Text(
            'Últimos 300 pedidos, más el que abras desde un aviso. Se actualizan cada 30 segundos mientras la vista está activa.',
            style: TextStyle(color: fitMuted, fontSize: 14),
          ),
        ),
      ],
    );
  }

  Future<bool> _confirm(String text) async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Confirmar'),
          content: Text(text),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Volver'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Confirmar'),
            ),
          ],
        ),
      ) ??
      false;
  Widget _own() {
    final v = _mine['vendor'];
    if (v == null) {
      return _card(
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.storefront_outlined, size: 40, color: fitOrange),
            const SizedBox(height: 16),
            Text(
              'Empieza con tu puesto',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Text(
                '1. Registra el nombre, punto de entrega y horario.\n2. Prepara productos mientras revisan tu solicitud.\n3. Con el puesto aprobado, atiende tus pedidos.',
                style: TextStyle(height: 2, color: fitMuted),
              ),
            ),
            FilledButton(
              onPressed: () => _vendorForm(),
              child: const Text('Registrar mi puesto'),
            ),
          ],
        ),
      );
    }
    final editable = ['pending', 'approved'].contains(v['status']),
        online = v['status'] == 'approved' && v['is_active'] != false;
    final counts = _summary['seller'] ?? {};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _card(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _tag(v['status']),
              Text(
                v['business_name'],
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 12),
              Text('Recoge en: ${v['pickup_location']}'),
              Text(v['hours_text'] ?? ''),
              const SizedBox(height: 16),
              Wrap(
                spacing: 10,
                runSpacing: 8,
                children: [
                  FilledButton.icon(
                    onPressed: () => _openTab('sales'),
                    icon: const Icon(Icons.notifications_active_outlined),
                    label: const Text('Ver pedidos recibidos'),
                  ),
                  OutlinedButton(
                    onPressed: v['status'] == 'suspended'
                        ? null
                        : () => _vendorForm(Map<String, dynamic>.from(v)),
                    child: const Text('Editar puesto'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              InfoBanner(
                v['is_active'] == false
                    ? 'Puesto pausado. Puedes terminar pedidos pendientes. Activa Alumno vendedor en Mi cuenta para volver a recibir pedidos.'
                    : online
                    ? 'Tus productos disponibles aparecen en Explorar.'
                    : v['status'] == 'pending'
                    ? 'Solicitud en revisión. Puedes preparar productos; aparecerán cuando aprueben tu puesto.'
                    : v['review_source'] ??
                          'Consulta la revisión de tu solicitud con el administrador.',
              ),
            ],
          ),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 10,
          children: [
            for (final entry in {
              'requested': 'Nuevos',
              'accepted': 'En preparación',
              'ready': 'Por entregar',
            }.entries)
              OutlinedButton(
                onPressed: () => _openTab('sales', filter: entry.key),
                child: Text('${counts[entry.key] ?? 0} ${entry.value}'),
              ),
          ],
        ),
        const SizedBox(height: 24),
        Text('Mi menú', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: FilledButton.icon(
            onPressed: editable ? () => _productForm() : null,
            icon: const Icon(Icons.add),
            label: const Text('Agregar producto'),
          ),
        ),
        const SizedBox(height: 18),
        if ((_mine['products'] as List).isEmpty)
          _empty(
            'Agrega tu primer producto',
            'Sube una foto, indica el precio por unidad o lote y elige si está disponible.',
          ),
        for (final raw in _mine['products'])
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (raw['photo_url'] != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(
                      raw['photo_url'],
                      headers: c.client?.imageHeaders(raw['photo_url'] as String),
                      height: 150,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (_, e, stack) =>
                          const Text('Foto no disponible'),
                    ),
                  ),
                const SizedBox(height: 12),
                Text(
                  raw['name'],
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                Text(
                  '${foodMoney(raw['price_cents'])} MXN por ${foodUnit(raw)}',
                ),
                const SizedBox(height: 12),
                Text(
                  raw['available'] != true
                      ? 'Pausado'
                      : online
                      ? 'Visible para compradores'
                      : 'Preparado · puesto sin publicar',
                  style: const TextStyle(color: fitMuted),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 8,
                  children: [
                    OutlinedButton(
                      onPressed: editable
                          ? () => _productForm(Map<String, dynamic>.from(raw))
                          : null,
                      child: const Text('Editar'),
                    ),
                    OutlinedButton(
                      onPressed: !editable || _busy
                          ? null
                          : () => _action(() async {
                              await _api(
                                '/products/${raw['id']}',
                                method: 'PATCH',
                                body: {
                                  for (final key in [
                                    'name',
                                    'description',
                                    'photo_id',
                                    'price_cents',
                                    'sale_unit',
                                    'units_per_lot',
                                  ])
                                    key: raw[key],
                                  'available': raw['available'] != true,
                                },
                              );
                              await _load(silent: true);
                              if (mounted) {
                                message(
                                  context,
                                  raw['available'] == true
                                      ? 'Producto pausado. Los pedidos anteriores se conservan.'
                                      : 'Producto disponible si tu puesto está aprobado y activo.',
                                );
                              }
                            }),
                      child: Text(
                        raw['available'] == true
                            ? 'Pausar producto'
                            : 'Activar producto',
                      ),
                    ),
                    TextButton(
                      onPressed: _busy
                          ? null
                          : () => _action(() async {
                              if (!await _confirm(
                                '¿Eliminar ${raw['name']} del menú? Se conservan los pedidos anteriores.',
                              )) {
                                return;
                              }
                              await _api(
                                '/products/${raw['id']}',
                                method: 'DELETE',
                              );
                              await _load(silent: true);
                            }),
                      child: const Text(
                        'Eliminar',
                        style: TextStyle(color: Colors.red),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
      ],
    );
  }

  Future<void> _vendorForm([Map<String, dynamic>? vendor]) async {
    await showDialog<void>(
      context: context,
      builder: (context) => FoodFormDialog(
        title: vendor == null ? 'Quiero vender en la FIT' : 'Editar puesto',
        intro:
            'El administrador comprobará que vendas en la facultad. Cambiar el nombre o punto de entrega requiere una nueva revisión.',
        fields: const [
          FoodField('business_name', 'Nombre del puesto', max: 100),
          FoodField(
            'pickup_location',
            'Punto de entrega en la facultad',
            max: 180,
          ),
          FoodField(
            'hours_text',
            'Horario de atención',
            max: 160,
            required: false,
          ),
          FoodField(
            'description',
            'Sobre tu puesto',
            max: 600,
            required: false,
          ),
        ],
        initial: {
          for (final key in [
            'business_name',
            'pickup_location',
            'hours_text',
            'description',
          ])
            key: vendor?[key]?.toString() ?? '',
        },
        onSave: (values) async {
          await _api('/vendor', method: 'POST', body: values);
          await _load();
        },
      ),
    );
  }

  Future<void> _productForm([Map<String, dynamic>? product]) async {
    await showDialog<void>(
      context: context,
      builder: (context) => ProductDialog(
        controller: c,
        product: product,
        onSaved: () async {
          await _load();
        },
      ),
    );
  }

  Widget _notifications() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Text(
        'Abre un aviso para ir directamente a su pedido.',
        style: TextStyle(color: fitMuted, height: 1.6),
      ),
      Wrap(
        spacing: 10,
        children: [
          TextButton.icon(
            onPressed: _load,
            icon: const Icon(Icons.refresh),
            label: const Text('Actualizar'),
          ),
          TextButton(
            onPressed: _notes.any((n) => n['read_at'] == null) && !_busy
                ? () => _action(() async {
                    await _api(
                      '/notifications/read',
                      method: 'PATCH',
                      body: {'all': true},
                    );
                    await _load();
                  })
                : null,
            child: const Text('Marcar todos leídos'),
          ),
        ],
      ),
      if (_notes.isEmpty)
        _empty(
          'Todo al día',
          'Los cambios de tus pedidos y las revisiones de tu puesto aparecerán aquí.',
        ),
      for (final n in _notes)
        _card(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                n['read_at'] == null ? 'NUEVO' : 'LEÍDO',
                style: const TextStyle(
                  color: fitOrange,
                  fontSize: 10,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 10),
              Text(n['title'], style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(n['body']),
              if (n['order_status'] != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Estado actual: ${foodOrderNames[n['order_status']] ?? n['order_status']}',
                    style: const TextStyle(fontSize: 14, color: fitMuted),
                  ),
                ),
              if (foodNotificationTab(n) != null && widget.onOpenFood != null)
                FilledButton.icon(
                  onPressed: _busy
                      ? null
                      : () => _action(() async {
                          if (n['read_at'] == null) {
                            await _api(
                              '/notifications/read',
                              method: 'PATCH',
                              body: {
                                'ids': [n['id']],
                              },
                            );
                          }
                          if (mounted) {
                            widget.onOpenFood!(
                              foodNotificationTab(n)!,
                              n['order_id'] as String?,
                            );
                          }
                        }),
                  icon: const Icon(Icons.arrow_forward),
                  label: Text(
                    n['order_id'] != null ? 'Ver pedido' : 'Ver mi puesto',
                  ),
                ),
              const SizedBox(height: 12),
              Text(
                DateTime.parse(
                  n['created_at'],
                ).toLocal().toString().substring(0, 16),
                style: const TextStyle(color: fitMuted, fontSize: 11),
              ),
              if (n['read_at'] == null)
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => _action(() async {
                          await _api(
                            '/notifications/read',
                            method: 'PATCH',
                            body: {
                              'ids': [n['id']],
                            },
                          );
                          await _load();
                        }),
                  child: const Text('Marcar leído'),
                ),
            ],
          ),
        ),
    ],
  );
  Widget _admin() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const InfoBanner(
        'Comprueba identidad y vínculo con la facultad mediante una fuente autorizada. El correo confirmado no acredita permiso para vender.',
      ),
      if (_vendors.isEmpty)
        _empty('Sin solicitudes', 'Las altas de vendedores aparecerán aquí.'),
      for (final v in _vendors)
        _card(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _tag(v['status']),
              Text(
                v['business_name'],
                style: Theme.of(context).textTheme.titleLarge,
              ),
              Text('${v['full_name']} · ${v['email']}'),
              Text('${v['pickup_location']} · ${v['hours_text']}'),
              const SizedBox(height: 8),
              Text(v['description']),
              if (v['review_source'] != null)
                Text(
                  'Última revisión: ${v['review_source']}',
                  style: const TextStyle(color: fitMuted),
                ),
              TextButton(
                onPressed: () => showDialog<void>(
                  context: context,
                  builder: (context) => FoodFormDialog(
                    title: 'Revisar ${v['business_name']}',
                    intro:
                        'El motivo de rechazo o suspensión se mostrará al vendedor.',
                    fields: const [
                      FoodField(
                        'status',
                        'Resolución',
                        choices: {
                          'approved': 'Aprobar vendedor',
                          'rejected': 'Rechazar / pedir correcciones',
                          'suspended': 'Suspender puesto',
                        },
                      ),
                      FoodField(
                        'source',
                        'Fuente verificada o motivo',
                        max: 600,
                      ),
                    ],
                    initial: const {'status': 'approved', 'source': ''},
                    onSave: (v2) async {
                      await _api(
                        '/admin/vendors/${v['id']}',
                        method: 'PATCH',
                        body: v2,
                      );
                      await _load();
                      widget.onChanged?.call();
                    },
                  ),
                ),
                child: const Text('Revisar vendedor'),
              ),
            ],
          ),
        ),
    ],
  );
}

class FoodField {
  final String keyName, label;
  final int max;
  final bool required, number;
  final Map<String, String>? choices;
  const FoodField(
    this.keyName,
    this.label, {
    this.max = 160,
    this.required = true,
    this.number = false,
    this.choices,
  });
}

class FoodFormDialog extends StatefulWidget {
  final String title, intro;
  final List<FoodField> fields;
  final Map<String, String> initial;
  final Future<void> Function(Map<String, String>) onSave;
  final int? priceCents;
  const FoodFormDialog({
    super.key,
    required this.title,
    required this.intro,
    required this.fields,
    required this.initial,
    required this.onSave,
    this.priceCents,
  });
  @override
  State<FoodFormDialog> createState() => _FoodFormDialogState();
}

class _FoodFormDialogState extends State<FoodFormDialog> {
  final _form = GlobalKey<FormState>();
  late final Map<String, TextEditingController> _values;
  bool _busy = false;
  String? _error;
  @override
  void initState() {
    super.initState();
    _values = {
      for (final f in widget.fields)
        f.keyName: TextEditingController(text: widget.initial[f.keyName] ?? ''),
    };
  }

  @override
  void dispose() {
    for (final c in _values.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onSave({
        for (final e in _values.entries) e.key: e.value.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.title),
    content: SizedBox(
      width: 520,
      child: SingleChildScrollView(
        child: Form(
          key: _form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                widget.intro,
                style: const TextStyle(color: fitMuted, height: 1.7),
              ),
              const SizedBox(height: 20),
              for (final f in widget.fields)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: f.choices == null
                      ? TextFormField(
                          controller: _values[f.keyName],
                          enabled: !_busy,
                          maxLength: f.max,
                          keyboardType: f.number
                              ? TextInputType.number
                              : TextInputType.text,
                          maxLines: f.max > 180 ? 3 : 1,
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            labelText: f.label,
                            counterText: '',
                          ),
                          validator: (v) =>
                              f.required && (v?.trim().isEmpty ?? true)
                              ? 'Completa este dato.'
                              : null,
                        )
                      : DropdownButtonFormField<String>(
                          initialValue: _values[f.keyName]!.text,
                          isExpanded: true,
                          decoration: InputDecoration(labelText: f.label),
                          items: f.choices!.entries
                              .map(
                                (e) => DropdownMenuItem(
                                  value: e.key,
                                  child: Text(e.value),
                                ),
                              )
                              .toList(),
                          onChanged: _busy
                              ? null
                              : (v) => _values[f.keyName]!.text = v ?? '',
                        ),
                ),
              if (widget.priceCents != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Text(
                    'Total: ${foodMoney(widget.priceCents! * (int.tryParse(_values['quantity']!.text) ?? 0))} MXN',
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              if (_error != null) InfoBanner(_error!, error: true),
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: _busy ? null : () => Navigator.pop(context),
        child: const Text('Cancelar'),
      ),
      FilledButton(
        onPressed: _busy ? null : _save,
        child: Text(
          _busy
              ? 'Guardando…'
              : widget.priceCents != null
              ? 'Enviar solicitud'
              : 'Guardar',
        ),
      ),
    ],
  );
}

class FoodCheckoutDialog extends StatefulWidget {
  final Map<String, dynamic> product;
  final Future<Map<String, dynamic>> Function(int quantity, String note)
  onSubmit;
  const FoodCheckoutDialog({
    super.key,
    required this.product,
    required this.onSubmit,
  });
  @override
  State<FoodCheckoutDialog> createState() => _FoodCheckoutDialogState();
}

class _FoodCheckoutDialogState extends State<FoodCheckoutDialog> {
  final _form = GlobalKey<FormState>(),
      _quantity = TextEditingController(text: '1'),
      _note = TextEditingController();
  bool _busy = false;
  String? _error;
  Map<String, dynamic>? _order;
  @override
  void dispose() {
    _quantity.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final order = await widget.onSubmit(
        int.parse(_quantity.text),
        _note.text.trim(),
      );
      if (mounted) setState(() => _order = order);
    } catch (e) {
      if (mounted) setState(() => _error = authError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product, quantity = int.tryParse(_quantity.text);
    final valid = quantity != null && quantity >= 1 && quantity <= 50;
    return PopScope(
      canPop: !_busy,
      child: AlertDialog(
        title: Text(
          _order != null ? 'Solicitud enviada' : 'Pedir ${p['name']}',
        ),
        content: SizedBox(
          width: 520,
          child: SingleChildScrollView(
            child: _order != null
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.check_circle_outline,
                        color: fitOrange,
                        size: 44,
                      ),
                      const SizedBox(height: 18),
                      const Text(
                        'Ahora espera la confirmación',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        '${p['business_name']} recibió tu pedido de ${p['name']}.',
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'En Mis compras verás cuándo lo acepta y cuándo puedes recogerlo.',
                      ),
                    ],
                  )
                : Form(
                    key: _form,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          p['business_name'],
                          style: const TextStyle(
                            fontSize: 16,
                            color: fitOrange,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text('Recoge en: ${p['pickup_location']}'),
                        const SizedBox(height: 20),
                        Text(
                          p['sale_unit'] == 'lot'
                              ? '¿Cuántos lotes quieres?'
                              : '¿Cuántas unidades quieres?',
                        ),
                        const SizedBox(height: 10),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            IconButton.filledTonal(
                              tooltip: 'Quitar uno',
                              onPressed: _busy || !valid || quantity <= 1
                                  ? null
                                  : () => setState(
                                      () => _quantity.text = '${quantity - 1}',
                                    ),
                              icon: const Icon(Icons.remove),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextFormField(
                                controller: _quantity,
                                enabled: !_busy,
                                keyboardType: TextInputType.number,
                                textAlign: TextAlign.center,
                                decoration: const InputDecoration(
                                  labelText: 'Cantidad',
                                ),
                                onChanged: (_) => setState(() {}),
                                validator: (v) {
                                  final n = int.tryParse(v ?? '');
                                  return n == null || n < 1 || n > 50
                                      ? 'Entre 1 y 50.'
                                      : null;
                                },
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton.filledTonal(
                              tooltip: 'Agregar uno',
                              onPressed: _busy || !valid || quantity >= 50
                                  ? null
                                  : () => setState(
                                      () => _quantity.text = '${quantity + 1}',
                                    ),
                              icon: const Icon(Icons.add),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          '${foodMoney(p['price_cents'])} MXN por ${foodUnit(p)}.',
                          style: const TextStyle(fontSize: 14, color: fitMuted),
                        ),
                        const SizedBox(height: 20),
                        TextFormField(
                          controller: _note,
                          enabled: !_busy,
                          maxLength: 500,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            labelText: 'Nota para el vendedor (opcional)',
                            hintText: 'Por ejemplo: sin cebolla',
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: fitNavy,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Total del pedido',
                                style: TextStyle(color: Colors.white),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                valid
                                    ? '${foodMoney((p['price_cents'] as int) * quantity)} MXN'
                                    : 'Revisa la cantidad',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 23,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              if (valid && p['sale_unit'] == 'lot')
                                Text(
                                  '${quantity * (p['units_per_lot'] as int)} piezas en total',
                                  style: const TextStyle(color: Colors.white),
                                ),
                            ],
                          ),
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 16),
                          child: Text(
                            'Espera a que el vendedor confirme. Acuerda el pago al recoger; esta solicitud no realiza ningún cobro.',
                            style: TextStyle(
                              fontSize: 14,
                              color: fitMuted,
                              height: 1.6,
                            ),
                          ),
                        ),
                        if (_error != null) InfoBanner(_error!, error: true),
                      ],
                    ),
                  ),
          ),
        ),
        actions: _order != null
            ? [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Seguir explorando'),
                ),
                FilledButton(
                  onPressed: () =>
                      Navigator.pop(context, _order!['id'] as String),
                  child: const Text('Ver seguimiento'),
                ),
              ]
            : [
                TextButton(
                  onPressed: _busy ? null : () => Navigator.pop(context),
                  child: const Text('Volver'),
                ),
                FilledButton(
                  onPressed: _busy ? null : _submit,
                  child: Text(_busy ? 'Enviando…' : 'Solicitar pedido'),
                ),
              ],
      ),
    );
  }
}

class ProductDialog extends StatefulWidget {
  final AppController controller;
  final Map<String, dynamic>? product;
  final Future<void> Function() onSaved;
  const ProductDialog({
    super.key,
    required this.controller,
    this.product,
    required this.onSaved,
  });
  @override
  State<ProductDialog> createState() => _ProductDialogState();
}

class _ProductDialogState extends State<ProductDialog> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _name, _description, _price, _units;
  String _unit = 'unit';
  bool _available = true, _busy = false;
  String? _photoId, _photoName, _error;
  Uint8List? _photo;
  bool _removePhoto = false;
  @override
  void initState() {
    super.initState();
    final p = widget.product ?? {};
    _name = TextEditingController(text: p['name'] ?? '');
    _description = TextEditingController(text: p['description'] ?? '');
    _price = TextEditingController(
      text: p['price_cents'] == null
          ? ''
          : ((p['price_cents'] as num) / 100).toStringAsFixed(2),
    );
    _units = TextEditingController(text: '${p['units_per_lot'] ?? 2}');
    _unit = p['sale_unit'] ?? 'unit';
    _available = p['available'] ?? true;
    _photoId = p['photo_id'];
  }

  @override
  void dispose() {
    for (final c in [_name, _description, _price, _units]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pick() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
        withData: true,
      );
      if (result == null || !mounted) return;
      final f = result.files.single;
      if (f.size > 5242880 || f.bytes == null) {
        throw Exception('Usa una foto de hasta 5 MB.');
      }
      setState(() {
        _photo = f.bytes;
        _photoName = f.name;
        _removePhoto = false;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _save() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_photo != null) {
        final upload = await widget.controller.client!.uploadFoodPhoto(
          _photo!,
          _photoName!,
        );
        _photoId = upload['id'];
        _photo = null;
      }
      if (_removePhoto) _photoId = null;
      await widget.controller.client!.request(
        '/api/food/products${widget.product == null ? '' : '/${widget.product!['id']}'}',
        method: widget.product == null ? 'POST' : 'PATCH',
        body: {
          'name': _name.text.trim(),
          'description': _description.text.trim(),
          'photo_id': _photoId,
          'price_cents': (double.parse(_price.text.replaceAll(',', '.')) * 100)
              .round(),
          'sale_unit': _unit,
          'units_per_lot': _unit == 'lot' ? int.parse(_units.text) : 1,
          'available': _available,
        },
      );
      await widget.onSaved();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) setState(() => _error = authError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.product == null ? 'Nuevo producto' : 'Editar producto'),
    content: SizedBox(
      width: 530,
      child: SingleChildScrollView(
        child: Form(
          key: _form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _name,
                maxLength: 120,
                decoration: const InputDecoration(
                  labelText: 'Nombre del producto',
                ),
                validator: (v) =>
                    (v?.trim().length ?? 0) < 2 ? 'Escribe el nombre.' : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _description,
                maxLength: 600,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Descripción'),
              ),
              const SizedBox(height: 12),
              if (_photo != null)
                Image.memory(_photo!, height: 170, fit: BoxFit.contain)
              else if (widget.product?['photo_url'] != null && !_removePhoto)
                Image.network(
                  widget.product!['photo_url'],
                  headers: widget.controller.client?.imageHeaders(widget.product!['photo_url'] as String),
                  height: 150,
                  fit: BoxFit.contain,
                  errorBuilder: (_, e, s) =>
                      const Text('Fotografía no disponible'),
                ),
              OutlinedButton.icon(
                onPressed: _busy ? null : _pick,
                icon: const Icon(Icons.add_photo_alternate_outlined),
                label: const Text('Seleccionar fotografía (hasta 5 MB)'),
              ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Quitar fotografía actual'),
                value: _removePhoto,
                onChanged: _busy
                    ? null
                    : (v) => setState(() {
                        _removePhoto = v ?? false;
                        if (_removePhoto) _photo = null;
                      }),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _price,
                onChanged: (_) => setState(() {}),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(
                  labelText: _unit == 'lot'
                      ? 'Precio del lote completo en MXN'
                      : 'Precio de una unidad en MXN',
                  prefixText: '\$ ',
                ),
                validator: (v) {
                  final n = double.tryParse((v ?? '').replaceAll(',', '.'));
                  return n == null || !n.isFinite || n < .01 || n > 10000
                      ? 'Precio entre 0.01 y 10,000.'
                      : null;
                },
              ),
              const SizedBox(height: 18),
              DropdownButtonFormField<String>(
                initialValue: _unit,
                decoration: const InputDecoration(labelText: 'Forma de venta'),
                items: const [
                  DropdownMenuItem(value: 'unit', child: Text('Por unidad')),
                  DropdownMenuItem(value: 'lot', child: Text('Por lote')),
                ],
                onChanged: _busy
                    ? null
                    : (v) => setState(() => _unit = v ?? 'unit'),
              ),
              if (_unit == 'lot')
                Padding(
                  padding: const EdgeInsets.only(top: 18),
                  child: TextFormField(
                    controller: _units,
                    onChanged: (_) => setState(() {}),
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Piezas por lote',
                    ),
                    validator: (v) {
                      final n = int.tryParse(v ?? '');
                      return n == null || n < 2 || n > 1000
                          ? 'Entre 2 y 1,000 piezas.'
                          : null;
                    },
                  ),
                ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  _unit == 'lot'
                      ? 'El precio corresponde al lote completo de ${_units.text} piezas.'
                      : 'El precio corresponde a una sola unidad.',
                  style: const TextStyle(fontSize: 14, color: fitMuted),
                ),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Permitir que los compradores lo pidan'),
                subtitle: const Text(
                  'Será visible cuando tu puesto esté aprobado y activo.',
                ),
                value: _available,
                onChanged: _busy ? null : (v) => setState(() => _available = v),
              ),
              if (_error != null) InfoBanner(_error!, error: true),
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: _busy ? null : () => Navigator.pop(context),
        child: const Text('Cancelar'),
      ),
      FilledButton(
        onPressed: _busy ? null : _save,
        child: Text(_busy ? 'Guardando…' : 'Guardar producto'),
      ),
    ],
  );
}
