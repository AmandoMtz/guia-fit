import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../services/app_controller.dart';
import '../widgets/common.dart';

String foodMoney(dynamic cents) =>
    '\$${((cents as num) / 100).toStringAsFixed(2)}';
String foodUnit(Map p) =>
    p['sale_unit'] == 'lot' ? 'lote de ${p['units_per_lot']}' : 'unidad';
String foodStatus(dynamic status) =>
    const {
      'pending': 'En revisión',
      'approved': 'Verificado',
      'suspended': 'Suspendido',
      'requested': 'Solicitado',
      'accepted': 'Aceptado',
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
  const FoodScreen({
    super.key,
    required this.controller,
    this.mode = 'food',
    this.onChanged,
  });
  @override
  State<FoodScreen> createState() => _FoodScreenState();
}

class _FoodScreenState extends State<FoodScreen> {
  Map<String, dynamic> _catalog = {'vendors': [], 'products': []},
      _mine = {'vendor': null, 'products': []};
  List<dynamic> _orders = [], _notes = [], _vendors = [];
  String _tab = 'products', _query = '', _vendor = '';
  bool _loading = true, _busy = false, _sellerOrders = false;
  String? _error;
  AppController get c => widget.controller;
  Future<dynamic> _api(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) => c.client!.request('/api/food$path', method: method, body: body);
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (c.demo) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      if (widget.mode == 'notifications') {
        final data = await _api('/notifications');
        _notes = data['items'];
      } else if (widget.mode == 'admin') {
        _vendors = await _api('/admin/vendors');
      } else {
        final data = await Future.wait([
          _api('/catalog'),
          _api('/mine'),
          _api('/orders?role=${_sellerOrders ? 'seller' : 'buyer'}'),
        ]);
        _catalog = Map<String, dynamic>.from(data[0]);
        _mine = Map<String, dynamic>.from(data[1]);
        _orders = data[2];
      }
    } catch (e) {
      _error = authError(e);
    } finally {
      if (mounted) setState(() => _loading = false);
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
    label: Text(foodStatus(status), style: const TextStyle(fontSize: 11)),
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
  Widget _tabs() => Padding(
    padding: const EdgeInsets.symmetric(vertical: 22),
    child: Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final entry in {
          'products': 'Productos',
          'vendors': 'Vendedores',
          'orders': 'Mis pedidos',
          'mine': _mine['vendor'] == null ? 'Quiero vender' : 'Mi puesto',
        }.entries)
          ChoiceChip(
            label: Text(entry.value),
            selected: _tab == entry.key,
            onSelected: (_) {
              setState(() {
                _tab = entry.key;
                _sellerOrders = false;
              });
              if (_tab == 'orders') _load();
            },
          ),
      ],
    ),
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
        Container(
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            color: fitNavy,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'COMUNIDAD FIT',
                style: TextStyle(
                  color: Color(0xFFECBD9A),
                  letterSpacing: 2,
                  fontSize: 11,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Tu próxima pausa\nsabe bien.',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                  height: 1.1,
                  letterSpacing: -1,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '${(_catalog['vendors'] as List).length} puestos verificados · ${(_catalog['products'] as List).length} productos',
                style: const TextStyle(color: Color(0xFFCBDCDF)),
              ),
            ],
          ),
        ),
        _tabs(),
        switch (_tab) {
          'vendors' => _vendorList(),
          'orders' => _orderList(false),
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
              '${p['name']} ${p['business_name']}'.toLowerCase().contains(
                _query.toLowerCase(),
              ),
        )
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          onChanged: (v) => setState(() => _query = v),
          decoration: const InputDecoration(
            labelText: '¿Qué se te antoja?',
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
                                  fontSize: 11,
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
                                  fontSize: 12,
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
                                          fontSize: 11,
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
                                          : 'Solicitar',
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
    await showDialog<void>(
      context: context,
      builder: (context) => FoodFormDialog(
        title: 'Solicitar ${p['name']}',
        intro:
            '${foodMoney(p['price_cents'])} MXN por ${foodUnit(p)}. Recoge en ${p['pickup_location']}. El vendedor debe aceptar la solicitud. El pago se acuerda al recoger.',
        fields: const [
          FoodField('quantity', 'Cantidad de unidades o lotes', number: true),
          FoodField('note', 'Nota para el vendedor', max: 500, required: false),
        ],
        initial: const {'quantity': '1', 'note': ''},
        priceCents: p['price_cents'] as int,
        onSave: (v) async {
          final quantity = int.tryParse(v['quantity'] ?? '');
          if (quantity == null || quantity < 1 || quantity > 50) {
            throw Exception('Solicita entre 1 y 50 unidades o lotes.');
          }
          await _api(
            '/orders',
            method: 'POST',
            body: {
              'product_id': p['id'],
              'quantity': quantity,
              'note': v['note'],
              'request_id': requestId,
              'expected_price_cents': p['price_cents'],
            },
          );
          if (mounted) {
            setState(() {
              _tab = 'orders';
              _sellerOrders = false;
            });
            await _load();
            widget.onChanged?.call();
          }
        },
      ),
    );
  }

  Widget _orderList(bool seller) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Row(
        children: [
          Expanded(
            child: Text(
              seller ? 'Pedidos recibidos' : 'Tus pedidos',
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
          IconButton(
            onPressed: _load,
            tooltip: 'Actualizar pedidos',
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      const Padding(
        padding: EdgeInsets.only(bottom: 16),
        child: Text(
          'Últimos 300 pedidos. Los avisos se guardan en tu cuenta.',
          style: TextStyle(color: fitMuted, fontSize: 12),
        ),
      ),
      if (_orders.isEmpty)
        _empty(
          'Todavía no hay pedidos',
          seller
              ? 'Las solicitudes de tus clientes aparecerán aquí.'
              : 'Explora los productos de los puestos.',
        ),
      for (final o in _orders)
        _card(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _tag(o['status']),
              Text(
                seller ? o['buyer_name'] : o['business_name'],
                style: const TextStyle(color: fitOrange, fontSize: 12),
              ),
              const SizedBox(height: 8),
              Text(
                o['product_name'],
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 10),
              Text(
                '${o['quantity']} × ${foodUnit(o)} · ${foodMoney(o['total_cents'])} MXN',
              ),
              Text(o['pickup_location']),
              if ((o['note'] as String).isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Text('Nota: ${o['note']}'),
                ),
              Text(
                '#${(o['id'] as String).substring(0, 8)} · ${DateTime.parse(o['created_at']).toLocal().toString().substring(0, 16)}',
                style: const TextStyle(color: fitMuted, fontSize: 11),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final status
                      in seller
                          ? (const {
                                  'requested': ['accepted', 'rejected'],
                                  'accepted': ['ready', 'rejected'],
                                  'ready': ['completed'],
                                }[o['status']] ??
                                <String>[])
                          : o['status'] == 'requested'
                          ? ['cancelled']
                          : <String>[])
                    OutlinedButton(
                      onPressed: _busy
                          ? null
                          : () => _action(() async {
                              if (['rejected', 'cancelled'].contains(status) &&
                                  !await _confirm(
                                    '¿Confirmas esta acción para el pedido?',
                                  )) {
                                return;
                              }
                              await _api(
                                '/orders/${o['id']}',
                                method: 'PATCH',
                                body: {'status': status},
                              );
                              await _load();
                            }),
                      child: Text(
                        const {
                          'accepted': 'Aceptar',
                          'rejected': 'Rechazar',
                          'ready': 'Listo para recoger',
                          'completed': 'Marcar entregado',
                          'cancelled': 'Cancelar solicitud',
                        }[status]!,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
    ],
  );
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
              'Tu puesto, más cerca de la FIT.',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 16),
            const Text(
              '1. Completa los datos reales de tu puesto.\n2. Un administrador verifica tu vínculo con la facultad.\n3. Tus productos disponibles aparecen en Comidas.',
              style: TextStyle(height: 2, color: fitMuted),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => _vendorForm(),
              child: const Text('Solicitar mi puesto'),
            ),
          ],
        ),
      );
    }
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
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 10),
              Text('${v['pickup_location']} · ${v['hours_text']}'),
              if (v['is_active'] == false)
                const InfoBanner(
                  'Tu puesto está pausado. Puedes terminar pedidos pendientes. Activa Alumno vendedor en Mi cuenta para volver a mostrarlo.',
                ),
              if (v['status'] != 'approved')
                InfoBanner(
                  v['status'] == 'pending'
                      ? 'Puedes preparar tus productos mientras revisan tu solicitud. Aún no se muestran al público.'
                      : v['review_source'] ?? 'Contacta al administrador.',
                ),
              TextButton(
                onPressed: v['status'] == 'suspended'
                    ? null
                    : () => _vendorForm(Map<String, dynamic>.from(v)),
                child: const Text('Editar puesto'),
              ),
            ],
          ),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ChoiceChip(
              label: const Text('Mis productos'),
              selected: !_sellerOrders,
              onSelected: (_) => setState(() => _sellerOrders = false),
            ),
            ChoiceChip(
              label: const Text('Pedidos recibidos'),
              selected: _sellerOrders,
              onSelected: (_) {
                setState(() => _sellerOrders = true);
                _load();
              },
            ),
          ],
        ),
        const SizedBox(height: 18),
        if (_sellerOrders)
          _orderList(true)
        else ...[
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton.icon(
              onPressed: ['pending', 'approved'].contains(v['status'])
                  ? () => _productForm()
                  : null,
              icon: const Icon(Icons.add),
              label: const Text('Agregar producto'),
            ),
          ),
          const SizedBox(height: 18),
          if ((_mine['products'] as List).isEmpty)
            _empty(
              'Prepara tu menú',
              'Agrega una foto, precio y forma de venta.',
            ),
          for (final p in _mine['products'])
            _card(
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    p['name'],
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  Text('${foodMoney(p['price_cents'])} MXN / ${foodUnit(p)}'),
                  const SizedBox(height: 10),
                  Text(
                    p['available'] ? 'Disponible' : 'Pausado',
                    style: const TextStyle(color: fitMuted),
                  ),
                  Wrap(
                    spacing: 12,
                    children: [
                      TextButton(
                        onPressed: ['pending', 'approved'].contains(v['status'])
                            ? () => _productForm(Map<String, dynamic>.from(p))
                            : null,
                        child: const Text('Editar'),
                      ),
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => _action(() async {
                                if (!await _confirm(
                                  '¿Eliminar este producto del catálogo? Se conservan los pedidos anteriores.',
                                )) {
                                  return;
                                }
                                await _api(
                                  '/products/${p['id']}',
                                  method: 'DELETE',
                                );
                                await _load();
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
        'Los avisos se actualizan mientras tienes abierta la aplicación.',
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
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'Precio en MXN',
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
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Disponible para solicitar'),
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
