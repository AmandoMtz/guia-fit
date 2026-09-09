import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guia_fit/models/schedule.dart';
import 'package:guia_fit/widgets/schedule_table.dart';

void main() {
  for (final width in [360.0, 1280.0]) {
    testWidgets(
      'tabla sin archivo original permite editar la clase en $width px',
      (tester) async {
        tester.view.physicalSize = Size(width, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        String? edited;
        final schedule = LocalSchedule(
          userId: 'a',
          studentId: '123',
          career: 'Ingeniería Civil',
          classes: [
            ScheduleClass(
              id: 'class-a',
              subject: 'Cálculo diferencial',
              teacher: 'Ana López',
              group: '2A',
              classroom: 'A-101',
              day: 1,
              start: '08:00',
              end: '09:00',
            ),
          ],
        );
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: ScheduleTable(
                  schedule: schedule,
                  monday: DateTime(2026, 9, 7),
                  onPlace: (_) {},
                  onEdit: (id) => edited = id,
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(schedule.pdf, isNull);
        expect(find.text('Cálculo diferencial'), findsOneWidget);
        expect(find.text('Ana López'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.tap(find.text('Editar'));
        await tester.pump();
        expect(edited, 'class-a');
        expect(tester.takeException(), isNull);
      },
    );
  }
}
