import 'dart:io';
import 'dart:typed_data';
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
          sourceMime: 'image/png',
          pdfName: 'horario.png',
          pdf: Uint8List.fromList([137, 80, 78, 71]),
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
        expect(saved.sourceMime, 'image/png');
        expect(saved.pdf, a.pdf);
        expect((await reopened.read('account-b'))!.studentId, '67890');
        expect(await reopened.read('other-account'), isNull);
        a.classes.first.subject = 'Física';
        a.pdf = null;
        await reopened.save(a);
        expect(
          (await reopened.read('account-a'))!.classes.first.subject,
          'Física',
        );
        expect((await reopened.read('account-a'))!.pdf, isNull);
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
