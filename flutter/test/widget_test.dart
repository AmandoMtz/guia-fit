import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guia_fit/main.dart';
import 'package:guia_fit/services/app_controller.dart';

void main() {
  for (final size in [const Size(360, 800), const Size(1280, 900)]) {
    testWidgets('acceso y directorio sin desbordamientos en ${size.width}px', (
      tester,
    ) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final controller = AppController(null);
      await tester.runAsync(() => controller.initialize());
      await tester.pumpWidget(FitApp(controller: controller));
      await tester.pumpAndSettle();
      expect(find.text('Bienvenido a Guía FIT'), findsOneWidget);
      expect(tester.takeException(), isNull);
      final demo = find.text('Explorar demostración');
      await tester.ensureVisible(demo);
      await tester.tap(demo);
      await tester.pumpAndSettle();
      expect(find.text('Directorio de espacios'), findsOneWidget);
      expect(controller.user, isNull);
      expect(controller.demo, isTrue);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('el formulario rechaza correo y contraseña vacíos', (
    tester,
  ) async {
    final controller = AppController(null);
    await tester.runAsync(() => controller.initialize());
    await tester.pumpWidget(FitApp(controller: controller));
    final submit = find.widgetWithText(FilledButton, 'Iniciar sesión');
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();
    expect(find.text('Escribe un correo válido.'), findsOneWidget);
    expect(find.text('Escribe tu contraseña.'), findsOneWidget);
    expect(controller.user, isNull);
  });
}
