import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:app_links/app_links.dart';
import '../models/campus.dart';
import 'api_client.dart';

class AppController extends ChangeNotifier {
  final FitApiClient? client;
  AppController(this.client);
  FitUser? user;
  bool demo = false, recovery = false, loading = false, admin = false;
  String? dataError, authNotice;
  Map<String, dynamic>? profile, verification;
  List<Place> places = [], referencePlaces = [], demoPlaces = [];
  List<RouteEdge> edges = [], demoEdges = [];
  StreamSubscription<Uri>? _links;
  bool get configured => client != null;
  bool get signedIn => user != null;
  Future<void> initialize() async {
    final data =
        jsonDecode(await rootBundle.loadString('assets/catalog.json'))
            as Map<String, dynamic>;
    referencePlaces = (data['places'] as List)
        .map((x) => Place.fromJson(Map<String, dynamic>.from(x)))
        .toList();
    demoPlaces = (data['demoPlaces'] as List)
        .map((x) => Place.fromJson(Map<String, dynamic>.from(x)))
        .toList();
    demoEdges = (data['demoEdges'] as List)
        .map((x) => RouteEdge.fromJson(Map<String, dynamic>.from(x)))
        .toList();
    places = referencePlaces;
    if (client == null) return;
    try {
      await client!.initialize();
      final uri = kIsWeb ? Uri.base : await AppLinks().getInitialLink();
      if (uri != null) await handleLink(uri);
      if (!kIsWeb) {
        _links = AppLinks().uriLinkStream.listen(
          handleLink,
          onError: (Object error) {
            dataError = 'No pudimos abrir el enlace. Solicita uno nuevo.';
            notifyListeners();
          },
        );
      }
      if (!recovery) {
        user = await client!.restore();
        if (user != null) await loadData();
      }
    } catch (e) {
      dataError = authError(e);
    }
  }

  Future<void> handleLink(Uri uri) async {
    final token = Uri.splitQueryString(uri.fragment)['token'];
    if (token == null) return;
    try {
      if (uri.queryParameters['flow'] == 'recovery') {
        client!.recoveryToken = token;
        recovery = true;
        demo = false;
        notifyListeners();
      } else if (uri.queryParameters['flow'] == 'confirm') {
        await client!.request(
          '/api/auth/confirm',
          method: 'POST',
          body: {'token': token},
        );
        authNotice = 'Correo confirmado. Ya puedes iniciar sesión.';
        notifyListeners();
      }
    } catch (e) {
      dataError = authError(e);
      notifyListeners();
    }
  }

  void exploreDemo() {
    demo = true;
    user = null;
    recovery = false;
    dataError = null;
    places = referencePlaces;
    edges = [];
    notifyListeners();
  }

  Future<void> loadData() async {
    if (client == null || user == null) return;
    dataError = null;
    try {
      final data = await Future.wait<dynamic>([
        client!.request('/api/data/profiles'),
        client!.request('/api/data/institutional_verifications'),
        client!.request('/api/data/places'),
        client!.request('/api/data/route_edges'),
        client!.request('/api/data/app_roles'),
      ]);
      admin = (data[4] as List).any((x) => x['role'] == 'admin');
      profile = Map<String, dynamic>.from((data[0] as List).first);
      verification = (data[1] as List).isEmpty
          ? null
          : Map<String, dynamic>.from((data[1] as List).first);
      places = (data[2] as List)
          .map((x) => Place.fromJson(Map<String, dynamic>.from(x)))
          .toList();
      edges = (data[3] as List)
          .map((x) => RouteEdge.fromJson(Map<String, dynamic>.from(x)))
          .toList();
    } catch (e) {
      places = [];
      edges = [];
      profile = null;
      verification = null;
      dataError = authError(e);
      if (e is ApiError && e.status == 401) user = null;
    }
    notifyListeners();
  }

  Future<void> signIn(String email, String password) async {
    loading = true;
    try {
      user = await client!.signIn(email, password);
      demo = false;
      await loadData();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> register(
    String name,
    String email,
    String password, {
    bool seller = false,
  }) async {
    await client!.request(
      '/api/auth/register',
      method: 'POST',
      body: {
        'email': email.trim(),
        'password': password,
        'full_name': name.trim(),
        'account_type': seller ? 'seller' : 'buyer',
      },
    );
  }

  Future<void> recover(String email) async {
    await client!.request(
      '/api/auth/recover',
      method: 'POST',
      body: {'email': email.trim()},
    );
  }

  Future<void> resend(String email) async {
    await client!.request(
      '/api/auth/resend',
      method: 'POST',
      body: {'email': email.trim()},
    );
  }

  Future<void> changePassword(String password) async {
    await client!.request(
      '/api/auth/reset',
      method: 'POST',
      body: {'password': password, 'token': client!.recoveryToken},
    );
    client!.recoveryToken = null;
    await signOut();
  }

  Future<void> updateProfile(String name, String studentId) async {
    await client!.request(
      '/api/data/profiles',
      method: 'PATCH',
      body: {
        'full_name': name.trim(),
        'student_id': studentId.trim().isEmpty ? null : studentId.trim(),
      },
    );
    await loadData();
  }

  Future<void> signOut() async {
    if (!demo && client != null) await client!.signOut();
    user = null;
    demo = false;
    recovery = false;
    profile = null;
    verification = null;
    admin = false;
    dataError = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _links?.cancel();
    client?.dispose();
    super.dispose();
  }
}

String authError(Object error) => error is ApiError
    ? error.message
    : 'No se pudo completar la solicitud. Revisa tu conexión.';
