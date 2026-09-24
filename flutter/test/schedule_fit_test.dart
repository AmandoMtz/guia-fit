import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:guia_fit/models/schedule.dart';
import 'package:guia_fit/widgets/schedule_subjects_table.dart';

void main() {
  final fixtures =
      jsonDecode(File('../tests/fixtures/schedule-fit.json').readAsStringSync())
          as Map<String, dynamic>;
  void check(LocalSchedule parsed, List<dynamic> expected) {
    expect(parsed.classes.length, expected.length);
    for (var i = 0; i < expected.length; i++) {
      for (final entry in (expected[i] as Map<String, dynamic>).entries) {
        expect(
          parsed.classes[i].toJson()[entry.key],
          entry.value,
          reason: entry.key,
        );
      }
    }
  }

  for (final f in fixtures['cases']) {
    test('FIT 11 columnas: ${f['name']}', () {
      final s = parseScheduleLines(List<String>.from(f['lines']), 'account-a');
      check(s, f['expected']);
      if (f['warn'] == true) expect(s.warnings, isNotEmpty);
    });
  }
  LocalSchedule positioned() => parseScheduleLines(
    scheduleRowsFromWords(
      (fixtures['boxes'] as List)
          .map(
            (b) => ScheduleWord(
              b['text'],
              (b['x0'] as num).toDouble(),
              (b['y0'] as num).toDouble(),
              (b['x1'] as num).toDouble(),
              (b['y1'] as num).toDouble(),
            ),
          )
          .toList(),
    ),
    'account-a',
  );
  test(
    'las coordenadas preservan vacíos, profesor y materia de varias líneas',
    () {
      final p = positioned();
      check(p, fixtures['positionedExpected']);
      expect(scheduleConflicts(p.classes), isEmpty);
    },
  );
  for (final width in [360.0, 1280.0]) {
    testWidgets(
      'tabla de 11 columnas funciona a $width px con Ibarra en días distintos',
      (tester) async {
        tester.view.physicalSize = Size(width, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: ScheduleSubjectsTable(schedule: positioned()),
              ),
            ),
          ),
        );
        expect(find.text('GPO'), findsOneWidget);
        expect(find.text('PROFESOR'), findsOneWidget);
        final data = tester.widget<DataTable>(find.byType(DataTable));
        expect(data.columns.length, 11);
        expect(data.rows.length, 3);
        expect((data.rows[0].cells[4].child as Text).data, '11:00–12:00');
        expect((data.rows[0].cells[5].child as Text).data, '—');
        expect((data.rows[1].cells[4].child as Text).data, '—');
        expect((data.rows[1].cells[5].child as Text).data, '11:00–12:00');
        expect(tester.takeException(), isNull);
      },
    );
  }
}
