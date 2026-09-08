import 'package:flutter/material.dart';
import 'services/api_client.dart';
import 'config.dart';
import 'services/app_controller.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'widgets/common.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final client = AppConfig.configured
      ? FitApiClient(AppConfig.apiBaseUrl)
      : null;
  final controller = AppController(client);
  await controller.initialize();
  runApp(FitApp(controller: controller));
}

class FitApp extends StatelessWidget {
  final AppController controller;
  const FitApp({super.key, required this.controller});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Guía FIT',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: const Color(0xFFF3F6F8),
      colorScheme: ColorScheme.fromSeed(
        seedColor: fitOrange,
        primary: fitOrange,
        secondary: fitNavy,
        surface: Colors.white,
      ),
      textTheme: const TextTheme(
        bodyLarge: TextStyle(fontSize: 16, height: 1.5),
        bodyMedium: TextStyle(fontSize: 14, height: 1.5),
        headlineMedium: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          letterSpacing: -.8,
          color: fitNavy,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFF6F8FA),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 15,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: Color(0xFFBDC8CF)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: Color(0xFFBDC8CF)),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
        ),
      ),
    ),
    home: AnimatedBuilder(
      animation: controller,
      builder: (context, _) => controller.recovery
          ? AuthScreen(
              key: const ValueKey('recovery'),
              controller: controller,
              initialMode: AuthMode.reset,
            )
          : controller.signedIn || controller.demo
          ? HomeScreen(controller: controller)
          : AuthScreen(controller: controller),
    ),
  );
}
