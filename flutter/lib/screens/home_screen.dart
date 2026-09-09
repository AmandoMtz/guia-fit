import 'dart:async';
import 'package:flutter/material.dart';
import 'food_screen.dart';
import 'schedule_screen.dart';
import '../models/campus.dart';
import '../services/app_controller.dart';
import '../widgets/common.dart';

class HomeScreen extends StatefulWidget {
  final AppController controller;
  const HomeScreen({super.key, required this.controller});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  final _scaffold = GlobalKey<ScaffoldState>();
  Timer? _notificationTimer;
  int _unread = 0;
  bool _polling = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pollNotifications();
    if (c.user != null) {
      _notificationTimer = Timer.periodic(
        const Duration(seconds: 30),
        (_) => _pollNotifications(),
      );
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _notificationTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _pollNotifications();
  }

  Future<void> _pollNotifications() async {
    if (c.demo ||
        c.user == null ||
        _polling ||
        (WidgetsBinding.instance.lifecycleState != null &&
            WidgetsBinding.instance.lifecycleState !=
                AppLifecycleState.resumed)) {
      return;
    }
    _polling = true;
    final id = c.user!.id;
    try {
      final data = await c.client!.request("/api/food/notifications");
      if (mounted && c.user?.id == id) {
        setState(() => _unread = data["unread_count"] as int);
      }
    } catch (_) {
    } finally {
      _polling = false;
    }
  }

  int _tab = 0, _step = 0;
  String _query = '', _category = '', _building = '';
  String? _origin, _destination, _routeMessage;
  bool _accessible = false, _routeDemo = false, _arrived = false;
  List<RouteEdge>? _route;
  AppController get c => widget.controller;
  static const _labels = [
    'Directorio',
    'Mapa',
    'Cómo llegar',
    'Comidas',
    'Mi horario',
    'Mi cuenta',
    'Mis avisos',
    'Vendedores',
  ];
  static const _icons = [
    Icons.grid_view_outlined,
    Icons.map_outlined,
    Icons.route_outlined,
    Icons.restaurant_outlined,
    Icons.calendar_month_outlined,
    Icons.person_outline,
    Icons.notifications_outlined,
    Icons.storefront_outlined,
  ];
  Future<void> _logout() async {
    try {
      await c.signOut();
    } catch (_) {
      if (mounted) {
        message(context, 'No pudimos cerrar la sesión. Revisa tu conexión.');
      }
    }
  }

  void _toPlace(Place place) {
    setState(() {
      _destination = place.id;
      _route = null;
      _routeMessage = null;
      _routeDemo = false;
      _tab = 2;
    });
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 900;
    final titles = [
      'Directorio de espacios',
      'Mapa del campus',
      'Cómo llegar',
      'Comidas',
      'Mi horario',
      'Mi cuenta',
      'Mis avisos',
      'Revisar vendedores',
    ];
    final subtitles = [
      'Busca tu salón y consulta cómo identificarlo.',
      'Ubica los espacios en el croquis de referencia.',
      'Elige tu punto de partida y tu destino.',
      'Una pausa entre clases, con el sabor de tu comunidad.',
      'Tu semana, tus materias y tu próximo salón.',
      'Consulta tus datos y tu verificación.',
      'Novedades de tus pedidos y de tu puesto.',
      'Valida los puestos de la comunidad FIT.',
    ];
    final body = ListView(
      padding: EdgeInsets.all(wide ? 32 : 20),
      children: [
        const Text(
          'GUÍA DEL CAMPUS',
          style: TextStyle(
            fontSize: 12,
            color: fitMuted,
            letterSpacing: 1.8,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Text(titles[_tab], style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 8),
        Text(subtitles[_tab], style: const TextStyle(color: fitMuted)),
        const SizedBox(height: 16),
        if (c.demo)
          const InfoBanner(
            'Demostración: no has iniciado sesión. Los lugares proceden del croquis; sus recorridos todavía deben verificarse.',
          ),
        if (c.dataError != null) ...[
          InfoBanner(c.dataError!, error: true),
          TextButton(onPressed: c.loadData, child: const Text('Reintentar')),
        ],
        switch (_tab) {
          0 => _directory(),
          1 => _map(),
          2 => _directions(),
          3 => FoodScreen(
            key: const ValueKey("food"),
            controller: c,
            onChanged: _pollNotifications,
          ),
          4 => ScheduleScreen(
            key: ValueKey(c.user?.id),
            controller: c,
            onPlace: (id) {
              final place = c.places.where((p) => p.id == id).firstOrNull;
              if (place != null) {
                _toPlace(place);
              } else {
                message(context, "Este espacio ya no está en el directorio.");
              }
            },
          ),
          6 => FoodScreen(
            key: const ValueKey("notifications"),
            controller: c,
            mode: "notifications",
            onChanged: _pollNotifications,
          ),
          7 => FoodScreen(
            key: const ValueKey("food-admin"),
            controller: c,
            mode: "admin",
            onChanged: _pollNotifications,
          ),
          _ => ProfileScreen(controller: c),
        },
      ],
    );
    return Scaffold(
      key: _scaffold,
      drawer: wide
          ? null
          : Drawer(
              child: SafeArea(
                child: ListView(
                  children: [
                    const Padding(
                      padding: EdgeInsets.all(20),
                      child: BrandHeader(compact: true),
                    ),
                    ...List.generate(
                      c.admin ? 8 : 7,
                      (i) => ListTile(
                        leading: Icon(_icons[i]),
                        title: Text(_labels[i]),
                        selected: _tab == i,
                        onTap: () {
                          Navigator.pop(context);
                          setState(() => _tab = i);
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
      appBar: AppBar(
        toolbarHeight: 82,
        title: wide
            ? const BrandHeader()
            : const Text(
                'Guía FIT',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
        actions: [
          if (c.user != null)
            IconButton(
              tooltip: "Mis avisos",
              onPressed: () => setState(() => _tab = 6),
              icon: Badge(
                isLabelVisible: _unread > 0,
                label: Text(_unread > 99 ? "99+" : "$_unread"),
                child: const Icon(Icons.notifications_outlined),
              ),
            ),
          TextButton.icon(
            onPressed: _logout,
            icon: const Icon(Icons.logout, size: 18),
            label: Text(c.demo ? 'Salir de demo' : 'Cerrar sesión'),
          ),
          const SizedBox(width: 10),
        ],
      ),
      body: SafeArea(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (wide)
              NavigationRail(
                selectedIndex: _tab,
                labelType: NavigationRailLabelType.all,
                onDestinationSelected: (i) => setState(() => _tab = i),
                destinations: List.generate(
                  c.admin ? 8 : 7,
                  (i) => NavigationRailDestination(
                    icon: Icon(_icons[i]),
                    label: Text(_labels[i]),
                  ),
                ),
              ),
            Expanded(child: body),
          ],
        ),
      ),
      bottomNavigationBar: wide
          ? null
          : NavigationBar(
              selectedIndex: _tab == 0
                  ? 0
                  : _tab == 3
                  ? 1
                  : _tab == 4
                  ? 2
                  : 3,
              onDestinationSelected: (i) {
                if (i == 3) {
                  _scaffold.currentState?.openDrawer();
                } else {
                  setState(() => _tab = [0, 3, 4][i]);
                }
              },
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.grid_view_outlined),
                  label: 'Directorio',
                ),
                NavigationDestination(
                  icon: Icon(Icons.restaurant_outlined),
                  label: 'Comidas',
                ),
                NavigationDestination(
                  icon: Icon(Icons.calendar_month_outlined),
                  label: 'Mi horario',
                ),
                NavigationDestination(icon: Icon(Icons.menu), label: 'Más'),
              ],
            ),
    );
  }

  Widget _filter(
    String label,
    String value,
    List<String> items,
    void Function(String) onChange,
  ) => DropdownButtonFormField<String>(
    initialValue: items.contains(value) ? value : '',
    isExpanded: true,
    decoration: InputDecoration(labelText: label),
    items: [
      DropdownMenuItem(value: '', child: Text(label)),
      ...items.map(
        (v) => DropdownMenuItem(
          value: v,
          child: Text(v, overflow: TextOverflow.ellipsis),
        ),
      ),
    ],
    onChanged: (v) => onChange(v ?? ''),
  );
  Widget _directory() {
    final query = normalize(_query);
    final places = c.places
        .where(
          (p) =>
              (_category.isEmpty || p.category == _category) &&
              (_building.isEmpty || p.building == _building) &&
              normalize(
                '${p.name} ${p.code} ${p.building} ${p.floor}',
              ).contains(query),
        )
        .toList();
    final categories = c.places.map((p) => p.category).toSet().toList()..sort();
    final buildings =
        c.places
            .map((p) => p.building)
            .where((b) => b.isNotEmpty)
            .toSet()
            .toList()
          ..sort();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          onChanged: (v) => setState(() => _query = v),
          decoration: const InputDecoration(
            labelText: 'Buscar salón, sala o edificio',
            prefixIcon: Icon(Icons.search),
          ),
        ),
        const SizedBox(height: 14),
        LayoutBuilder(
          builder: (context, size) {
            final filters = [
              _filter(
                'Todos los tipos',
                _category,
                categories,
                (v) => setState(() => _category = v),
              ),
              _filter(
                'Todos los edificios',
                _building,
                buildings,
                (v) => setState(() => _building = v),
              ),
            ];
            return size.maxWidth < 430
                ? Column(
                    children: [
                      filters[0],
                      const SizedBox(height: 12),
                      filters[1],
                    ],
                  )
                : Row(
                    children: [
                      Expanded(child: filters[0]),
                      const SizedBox(width: 12),
                      Expanded(child: filters[1]),
                    ],
                  );
          },
        ),
        const SizedBox(height: 18),
        Text(
          '${places.length} espacios',
          style: const TextStyle(fontSize: 13, color: fitMuted),
        ),
        const SizedBox(height: 14),
        if (places.isEmpty)
          const Surface(
            child: Text('No encontramos espacios con esos filtros.'),
          ),
        LayoutBuilder(
          builder: (context, size) {
            final columns = size.maxWidth >= 1000
                ? 3
                : size.maxWidth >= 600
                ? 2
                : 1;
            final width = (size.maxWidth - (columns - 1) * 16) / columns;
            return Wrap(
              spacing: 16,
              runSpacing: 16,
              children: places
                  .map((p) => SizedBox(width: width, child: _placeCard(p)))
                  .toList(),
            );
          },
        ),
      ],
    );
  }

  Widget _placeCard(Place p) => Container(
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFFE3E8EB)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PlacePhoto(p),
        Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 12,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    p.category.toUpperCase(),
                    style: const TextStyle(
                      color: fitOrange,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  VerificationBadge(p.verified),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                p.name,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: fitNavy,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                p.building.isEmpty ? 'Edificio por confirmar' : p.building,
                style: const TextStyle(color: fitMuted, fontSize: 14),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: [
                  TextButton(
                    onPressed: () => _detail(p),
                    child: const Text('Ver información'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => _toPlace(p),
                    icon: const Icon(Icons.route, size: 18),
                    label: const Text('Cómo llegar'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    ),
  );
  Future<void> _detail(Place p) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          24,
          6,
          24,
          24 + MediaQuery.viewInsetsOf(ctx).bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    p.name,
                    style: const TextStyle(
                      fontSize: 23,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Cerrar',
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: PlacePhoto(p, height: 170),
            ),
            const SizedBox(height: 18),
            Align(
              alignment: Alignment.centerLeft,
              child: VerificationBadge(p.verified),
            ),
            const SizedBox(height: 16),
            Text(
              p.description.isEmpty ? 'Descripción pendiente.' : p.description,
            ),
            const SizedBox(height: 12),
            Text(
              'Edificio: ${p.building.isEmpty ? 'Por confirmar' : p.building}\nPiso: ${p.floor.isEmpty ? 'Por confirmar' : p.floor}\nIdentificación: ${p.code.isEmpty ? 'Por confirmar' : p.code}',
            ),
            const SizedBox(height: 14),
            Text(
              'Fuente: ${p.source.isEmpty ? 'Pendiente' : p.source}\nVerificación en sitio: ${p.sourceDate ?? 'pendiente'}',
              style: const TextStyle(fontSize: 13, color: fitMuted),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: () {
                Navigator.pop(ctx);
                _toPlace(p);
              },
              icon: const Icon(Icons.route),
              label: const Text('Cómo llegar'),
            ),
          ],
        ),
      ),
    ),
  );
  Widget _map() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const InfoBanner(
        'Croquis de referencia: no está a escala ni detecta tu posición actual.',
      ),
      ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Container(
          color: Colors.white,
          height: 560,
          child: InteractiveViewer(
            minScale: 1,
            maxScale: 4,
            child: Center(
              child: Image.asset(
                'assets/croquis.png',
                fit: BoxFit.contain,
                semanticLabel:
                    'Croquis original de la Facultad de Ingeniería Tampico',
              ),
            ),
          ),
        ),
      ),
      const SizedBox(height: 14),
      const Text(
        'Amplía el croquis con dos dedos y consulta un espacio:',
        style: TextStyle(fontSize: 13, color: fitMuted),
      ),
      const SizedBox(height: 14),
      Surface(
        child: Column(
          children: c.places
              .map(
                (p) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.place_outlined, color: fitOrange),
                  title: Text(p.name),
                  subtitle: Text(p.building),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _detail(p),
                ),
              )
              .toList(),
        ),
      ),
    ],
  );
  Widget _placeSelect(
    String label,
    String? value,
    void Function(String?) onChange,
  ) => Padding(
    padding: const EdgeInsets.only(bottom: 18),
    child: DropdownButtonFormField<String>(
      initialValue: c.places.any((p) => p.id == value) ? value : null,
      isExpanded: true,
      decoration: InputDecoration(labelText: label),
      items: c.places
          .map(
            (p) => DropdownMenuItem(
              value: p.id,
              child: Text(p.name, overflow: TextOverflow.ellipsis),
            ),
          )
          .toList(),
      onChanged: onChange,
    ),
  );
  Widget _directions() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Surface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _placeSelect(
              '¿Desde dónde sales?',
              _origin,
              (v) => setState(() => _origin = v),
            ),
            _placeSelect(
              '¿A dónde quieres ir?',
              _destination,
              (v) => setState(() => _destination = v),
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              value: _accessible,
              onChanged: (v) => setState(() => _accessible = v ?? false),
              title: const Text(
                'Usar solo tramos verificados como accesibles',
                style: TextStyle(fontSize: 14),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () {
                if (_origin == null || _destination == null) {
                  message(context, 'Selecciona el origen y el destino.');
                  return;
                }
                setState(() {
                  _route = findRoute(
                    c.places,
                    c.edges,
                    _origin!,
                    _destination!,
                    accessible: _accessible,
                  );
                  _routeDemo = false;
                  _step = 0;
                  _arrived = false;
                  _routeMessage = _route == null
                      ? 'Recorrido pendiente de verificación. No hay una conexión comprobada con estas condiciones.'
                      : _route!.isEmpty
                      ? 'El origen y el destino son el mismo.'
                      : null;
                });
              },
              icon: const Icon(Icons.route),
              label: const Text('Buscar recorrido'),
            ),
            if (_routeMessage != null) InfoBanner(_routeMessage!),
          ],
        ),
      ),
      if (_route?.isNotEmpty ?? false) _steps(),
      Surface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Una indicación a la vez',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            const Text(
              'Confirma cada paso al llegar al punto indicado. La guía no detecta tu posición dentro del edificio.',
              style: TextStyle(color: fitMuted),
            ),
            const SizedBox(height: 18),
            OutlinedButton(
              onPressed: () => setState(() {
                _route = findRoute(
                  c.demoPlaces,
                  c.demoEdges,
                  'demo-inicio',
                  'demo-102',
                  demo: true,
                );
                _step = 0;
                _arrived = false;
                _routeDemo = true;
                _routeMessage = null;
              }),
              child: const Text('Ver ejemplo de recorrido'),
            ),
            const SizedBox(height: 10),
            const Text(
              'El ejemplo utiliza salones ficticios y no es una ruta real.',
              style: TextStyle(fontSize: 12, color: fitMuted),
            ),
          ],
        ),
      ),
    ],
  );
  Widget _steps() {
    final steps = _route!;
    return Surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_routeDemo)
            const InfoBanner(
              'Ejemplo ficticio · No sigas estas indicaciones en el campus.',
            ),
          Text(
            _arrived
                ? 'RECORRIDO FINALIZADO'
                : 'PASO ${_step + 1} DE ${steps.length}',
            style: const TextStyle(
              color: fitOrange,
              fontSize: 13,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 18),
          LinearProgressIndicator(
            value: (_step + 1) / steps.length,
            minHeight: 5,
          ),
          const SizedBox(height: 22),
          Semantics(
            liveRegion: true,
            child: Text(
              _arrived
                  ? (_routeDemo
                        ? 'Terminaste el recorrido de ejemplo.'
                        : 'Has confirmado tu llegada.')
                  : steps[_step].instruction,
              style: const TextStyle(
                fontSize: 23,
                fontWeight: FontWeight.w600,
                height: 1.5,
              ),
            ),
          ),
          const SizedBox(height: 22),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              OutlinedButton(
                onPressed: _step == 0 || _arrived
                    ? null
                    : () => setState(() => _step--),
                child: const Text('Anterior'),
              ),
              FilledButton(
                onPressed: _arrived
                    ? null
                    : () => setState(() {
                        if (_step == steps.length - 1) {
                          _arrived = true;
                        } else {
                          _step++;
                        }
                      }),
                child: Text(_step == steps.length - 1 ? 'Llegué' : 'Siguiente'),
              ),
              TextButton(
                onPressed: () => setState(() {
                  _step = 0;
                  _arrived = false;
                }),
                child: const Text('Reiniciar'),
              ),
            ],
          ),
          const SizedBox(height: 20),
          ...List.generate(
            steps.length,
            (i) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(
                radius: 15,
                backgroundColor: const Color(0xFFF3F6F8),
                child: Text('${i + 1}', style: const TextStyle(fontSize: 12)),
              ),
              title: Text(
                steps[i].instruction,
                style: TextStyle(
                  fontSize: 14,
                  color: i == _step ? fitOrange : fitMuted,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ProfileScreen extends StatefulWidget {
  final AppController controller;
  const ProfileScreen({super.key, required this.controller});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _form = GlobalKey<FormState>();
  late TextEditingController _name, _student;
  bool _saving = false;
  @override
  void initState() {
    super.initState();
    _name = TextEditingController(
      text: widget.controller.profile?['full_name'] as String? ?? '',
    );
    _student = TextEditingController(
      text: widget.controller.profile?['student_id'] as String? ?? '',
    );
  }

  @override
  void dispose() {
    _name.dispose();
    _student.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    if (c.demo) {
      return const Surface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Estás explorando una demostración',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 12),
            Text(
              'No se ha creado una cuenta ni se han guardado datos personales. Sal de la demostración para registrarte.',
            ),
          ],
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Surface(
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Mis datos',
                  style: TextStyle(fontSize: 21, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _name,
                  validator: validateName,
                  maxLength: 100,
                  decoration: const InputDecoration(
                    labelText: 'Nombre completo',
                  ),
                ),
                const SizedBox(height: 18),
                Text('Correo electrónico\n${c.user?.email ?? ''}'),
                const SizedBox(height: 18),
                TextFormField(
                  controller: _student,
                  maxLength: 64,
                  decoration: const InputDecoration(
                    labelText: 'Matrícula (opcional)',
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: _saving
                      ? null
                      : () async {
                          if (!_form.currentState!.validate()) return;
                          setState(() => _saving = true);
                          try {
                            await c.updateProfile(_name.text, _student.text);
                            if (context.mounted) {
                              message(context, 'Datos actualizados.');
                            }
                          } catch (_) {
                            if (context.mounted) {
                              message(
                                context,
                                'No pudimos guardar los cambios.',
                              );
                            }
                          } finally {
                            if (mounted) setState(() => _saving = false);
                          }
                        },
                  child: Text(_saving ? 'Guardando…' : 'Guardar cambios'),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Modificar el nombre o la matrícula devuelve la validación institucional al estado pendiente.',
                  style: TextStyle(fontSize: 13, color: fitMuted),
                ),
              ],
            ),
          ),
        ),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Estado de tu cuenta',
                style: TextStyle(fontSize: 21, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              const Text(
                'Identificador para revisión institucional:',
                style: TextStyle(fontSize: 12, color: fitMuted),
              ),
              SelectableText(
                c.user?.id ?? '',
                style: const TextStyle(fontSize: 12),
              ),
              const SizedBox(height: 20),
              VerificationBadge(c.user?.emailConfirmedAt != null),
              const SizedBox(height: 8),
              const Text('Correo electrónico'),
              const Divider(height: 30),
              VerificationBadge(c.verification?['status'] == 'verified'),
              const SizedBox(height: 8),
              const Text('Vinculación con la facultad'),
              const SizedBox(height: 14),
              const Text(
                'La pertenencia institucional requiere contrastar tus datos con una fuente autorizada. Verificar el correo no confirma tu identidad académica.',
                style: TextStyle(fontSize: 13, color: fitMuted),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
