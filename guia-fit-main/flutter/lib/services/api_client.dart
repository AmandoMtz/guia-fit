import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'http_client_native.dart' if (dart.library.html) 'http_client_web.dart';

class ApiError implements Exception {
  final String code, message;
  final int status;
  const ApiError(this.code, this.message, this.status);
  @override
  String toString() => message;
}

class FitUser {
  final String id, email;
  final String? emailConfirmedAt;
  final bool sellerIntent;
  FitUser.fromJson(Map<String, dynamic> json)
    : id = json['id'] as String,
      email = json['email'] as String,
      emailConfirmedAt = json['email_confirmed_at'] as String?,
      sellerIntent = json['food_seller_intent'] == true;
}

class FitApiClient {
  final String base;
  FitApiClient(String url) : base = url.replaceFirst(RegExp(r'/$'), '');
  final _http = createHttpClient();
  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  String? _sessionToken, recoveryToken;
  Future<void> initialize() async {
    if (!kIsWeb) _sessionToken = await _storage.read(key: 'fit_session');
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$base$path');
    final headers = {
      'Content-Type': 'application/json',
      'X-FIT-Client': kIsWeb ? 'web' : 'mobile',
      if (!kIsWeb && _sessionToken != null)
        'Authorization': 'Bearer $_sessionToken',
    };
    try {
      final response = await (switch (method) {
        'POST' => _http.post(
          uri,
          headers: headers,
          body: jsonEncode(body ?? {}),
        ),
        'DELETE' => _http.delete(uri, headers: headers),
        'PATCH' => _http.patch(
          uri,
          headers: headers,
          body: jsonEncode(body ?? {}),
        ),
        _ => _http.get(uri, headers: headers),
      }).timeout(const Duration(seconds: 25));
      final result = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode >= 400) {
        final error = result['error'] as Map<String, dynamic>? ?? {};
        if (response.statusCode == 401 && !kIsWeb) {
          _sessionToken = null;
          await _storage.delete(key: 'fit_session');
        }
        throw ApiError(
          error['code'] as String? ?? 'service_error',
          error['message'] as String? ?? 'No se pudo completar la solicitud.',
          response.statusCode,
        );
      }
      return result['data'];
    } on ApiError {
      rethrow;
    } catch (_) {
      throw const ApiError(
        'network_error',
        'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
        0,
      );
    }
  }

  Future<FitUser> signIn(String email, String password) async {
    final data =
        await request(
              '/api/auth/login',
              method: 'POST',
              body: {'email': email.trim(), 'password': password},
            )
            as Map<String, dynamic>;
    if (!kIsWeb) {
      _sessionToken = data['sessionToken'] as String;
      await _storage.write(key: 'fit_session', value: _sessionToken);
    }
    return FitUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<FitUser?> restore() async {
    if (!kIsWeb && _sessionToken == null) return null;
    try {
      final data = await request('/api/auth/me') as Map<String, dynamic>;
      return FitUser.fromJson(data['user'] as Map<String, dynamic>);
    } on ApiError catch (e) {
      if (e.status == 401) return null;
      rethrow;
    }
  }

  Future<void> signOut() async {
    try {
      await request('/api/auth/logout', method: 'POST');
    } on ApiError catch (e) {
      if (e.status != 401) rethrow;
    }
    _sessionToken = null;
    if (!kIsWeb) await _storage.delete(key: 'fit_session');
  }

  Future<Map<String, dynamic>> uploadFoodPhoto(Uint8List bytes, String name) =>
      _uploadPhoto(bytes, name, '/api/food/photos');

  Future<Map<String, dynamic>> uploadProfilePhoto(
    Uint8List bytes,
    String name,
  ) => _uploadPhoto(bytes, name, '/api/profile/photo');

  Future<Uint8List?> readProfilePhoto() async {
    try {
      final response = await _http
          .get(
            Uri.parse('$base/api/profile/photo'),
            headers: {
              'X-FIT-Client': kIsWeb ? 'web' : 'mobile',
              if (!kIsWeb && _sessionToken != null)
                'Authorization': 'Bearer $_sessionToken',
            },
          )
          .timeout(const Duration(seconds: 25));
      if (response.statusCode == 404) return null;
      if (response.statusCode >= 400) {
        throw ApiError(
          'photo_error',
          'No se pudo cargar tu foto.',
          response.statusCode,
        );
      }
      return response.bodyBytes;
    } on ApiError {
      rethrow;
    } catch (_) {
      throw const ApiError(
        'network_error',
        'No se pudo cargar tu foto. Revisa tu conexión.',
        0,
      );
    }
  }

  Future<Map<String, dynamic>> _uploadPhoto(
    Uint8List bytes,
    String name,
    String path,
  ) async {
    final ext = name.split('.').last.toLowerCase();
    final mime = {
      'jpg': 'jpeg',
      'jpeg': 'jpeg',
      'png': 'png',
      'webp': 'webp',
    }[ext];
    if (mime == null || bytes.length > 5242880) {
      throw const ApiError(
        'validation_error',
        'Usa una imagen JPG, PNG o WebP de hasta 5 MB.',
        400,
      );
    }
    try {
      final req = http.MultipartRequest('POST', Uri.parse('$base$path'));
      req.headers.addAll({
        'X-FIT-Client': kIsWeb ? 'web' : 'mobile',
        if (!kIsWeb && _sessionToken != null)
          'Authorization': 'Bearer $_sessionToken',
      });
      req.files.add(
        http.MultipartFile.fromBytes(
          'file',
          bytes,
          filename: name,
          contentType: MediaType('image', mime),
        ),
      );
      final response = await http.Response.fromStream(
        await _http.send(req),
      ).timeout(const Duration(seconds: 40));
      final result = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode >= 400) {
        throw ApiError(
          'upload_error',
          result['error']?['message'] ?? 'No se pudo subir la foto.',
          response.statusCode,
        );
      }
      return Map<String, dynamic>.from(result['data']);
    } on ApiError {
      rethrow;
    } catch (_) {
      throw const ApiError(
        'network_error',
        'No se pudo subir la foto. Revisa tu conexión.',
        0,
      );
    }
  }

  void dispose() => _http.close();
}
