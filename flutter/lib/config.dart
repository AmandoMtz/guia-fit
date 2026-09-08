class AppConfig {
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static bool get configured =>
      apiBaseUrl.startsWith('https://') ||
      apiBaseUrl.startsWith('http://localhost:') ||
      apiBaseUrl.startsWith('http://127.0.0.1:');
}
