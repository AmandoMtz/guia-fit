import 'dart:async';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:guia_fit/services/api_client.dart';
import 'package:guia_fit/services/app_controller.dart';

class DeferredProfileApi extends FitApiClient {
  DeferredProfileApi() : super('https://example.invalid');
  final profileResult = Completer<dynamic>();
  final photoResult = Completer<Map<String, dynamic>>();
  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    if (path == '/api/data/profiles') return profileResult.future;
    return [];
  }

  @override
  Future<Map<String, dynamic>> uploadProfilePhoto(
    Uint8List bytes,
    String name,
  ) => photoResult.future;
}

FitUser user(String id) =>
    FitUser.fromJson({'id': id, 'email': '$id@example.test'});
void main() {
  test(
    'cambiar de cuenta durante una carga no muestra el perfil anterior',
    () async {
      final api = DeferredProfileApi();
      final controller = AppController(api)..user = user('a');
      final pending = controller.loadData();
      controller.user = user('b');
      controller.profile = {'full_name': 'Alumno B'};
      api.profileResult.complete([
        {'full_name': 'Alumno A'},
      ]);
      await pending;
      expect(controller.profile?['full_name'], 'Alumno B');
      controller.dispose();
    },
  );
  test(
    'una foto pendiente de otra sesión no reemplaza el avatar de la cuenta nueva',
    () async {
      final api = DeferredProfileApi();
      final c = AppController(api)..user = user('a');
      final pending = c.updateProfilePhoto(Uint8List.fromList([0]), 'a.png');
      c.user = user('b');
      c.profile = {'photo_updated_at': 'foto-b'};
      c.profilePhoto = Uint8List.fromList([42]);
      api.photoResult.complete({'photo_updated_at': 'foto-a'});
      await pending;
      expect(c.profile?['photo_updated_at'], 'foto-b');
      expect(c.profilePhoto, [42]);
      c.dispose();
    },
  );
}
