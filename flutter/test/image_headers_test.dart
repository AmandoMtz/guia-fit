import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../lib/services/api_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('Las fotos privadas usan sesión sin filtrarla a otras URL', () async {
    FlutterSecureStorage.setMockInitialValues({'fit_session': 'fixture-token'});
    final client = FitApiClient('https://castoresfit.com');
    await client.initialize();
    const photo = '/api/photos/12345678-1234-1234-1234-123456789abc';
    expect(client.imageHeaders('https://castoresfit.com$photo'),
        {'Authorization': 'Bearer fixture-token'});
    for (final url in [
      'https://evil.example$photo',
      'https://castoresfit.com.evil.example$photo',
      'http://castoresfit.com$photo',
      'https://castoresfit.com:8443$photo',
      'https://castoresfit.com/assets/logo.png',
      'https://castoresfit.com@evil.example$photo',
      'data:image/png;base64,AAAA',
    ]) {
      expect(client.imageHeaders(url), isEmpty, reason: url);
    }
    FlutterSecureStorage.setMockInitialValues({});
    final anonymous = FitApiClient('https://castoresfit.com');
    await anonymous.initialize();
    expect(anonymous.imageHeaders('https://castoresfit.com$photo'), isEmpty);
  });
}
