import 'dart:io';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:guia_fit/models/schedule.dart';
import 'package:guia_fit/services/schedule_store_native.dart';

void main() {
  test(
    'almacenamiento del dispositivo: cuentas separadas, edición y borrado propios',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'fit_schedule_test_',
      );
      try {
        final store = ScheduleStore(directory: directory);
        final a = LocalSchedule(
          userId: 'account-a',
          studentId: '12345',
          studentName: 'Ana López',
          career: 'Ingeniería Civil',
          classes: [ScheduleClass(id: '1', subject: 'Cálculo', group: '2A')],
        );
        final b = LocalSchedule(
          userId: 'account-b',
          studentId: '67890',
          career: 'Ingeniería en Sistemas',
        );
        await store.save(a);
        await store.save(b);
        final reopened = ScheduleStore(directory: directory);
        final saved = await reopened.read('account-a');
        expect(saved!.classes.first.group, '2A');
        expect(saved.toJson().containsKey('pdfBase64'), false);
        expect((await reopened.read('account-b'))!.studentId, '67890');
        expect(await reopened.read('other-account'), isNull);
        a.classes.first.subject = 'Física';
        await reopened.save(a);
        expect(
          (await reopened.read('account-a'))!.classes.first.subject,
          'Física',
        );
        final file = File('${directory.path}/fit_schedules/account-a.json');
        await file.writeAsString(
          jsonEncode({...a.toJson(), 'version': 1, 'pdfBase64': 'original'}),
        );
        await reopened.read('account-a');
        expect(
          jsonDecode(await file.readAsString()).containsKey('pdfBase64'),
          false,
        );
        await reopened.delete('account-a');
        expect(await reopened.read('account-a'), isNull);
        expect((await reopened.read('account-b'))!.studentId, '67890');
        await expectLater(reopened.read('../account-b'), throwsArgumentError);
      } finally {
        await directory.delete(recursive: true);
      }
    },
  );
}
