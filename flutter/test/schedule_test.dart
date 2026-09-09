import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:guia_fit/models/schedule.dart';

void main() {
  test(
    'importa carrera, matrícula y clases por día sin afirmar verificación institucional',
    () {
      final s = parseScheduleLines([
        'Carrera: Ingeniería Civil',
        'Alumno: Ana López',
        'Matrícula: 1234567890',
        'Materia | Maestro | Salón | Grupo | Día | Horario',
        'Cálculo | Ana López | A-101 | 2A | Lunes, Miércoles | 08:00–09:00',
      ], 'user-a');
      expect(s.career, 'Ingeniería Civil');
      expect(s.studentName, 'Ana López');
      expect(s.classes.first.group, '2A');
      expect(s.studentId, '1234567890');
      expect(s.classes.length, 2);
      expect(s.classes.map((x) => x.day), [1, 3]);
      expect(s.classes.first.error, isNull);
      expect(s.reviewedAt, isNull);
    },
  );
  test(
    'admite columnas semanales y deja vacío un PDF sin texto reconocido',
    () {
      final s = parseScheduleLines([
        'Programa educativo: Ingeniería Civil',
        'Materia | Docente | Aula | Lun | Mar | Mié',
        'Estática | Juan Pérez | C-12 | 09:00 a 10:00 | — | 09:00-10:00',
      ], 'user-a');
      expect(s.classes.length, 2);
      expect(s.classes.last.day, 3);
      expect(parseScheduleLines([], 'user-a').classes, isEmpty);
    },
  );
  test('detecta cruces sin confundir clases contiguas o días distintos', () {
    final classes = [
      ScheduleClass(
        id: 'a',
        subject: 'Materia',
        teacher: 'Ana',
        classroom: 'A',
        day: 1,
        start: '08:00',
        end: '09:00',
      ),
      ScheduleClass(id: 'b', day: 1, start: '08:30', end: '09:30'),
      ScheduleClass(id: 'c', day: 2, start: '08:00', end: '09:00'),
      ScheduleClass(id: 'd', day: 1, start: '09:30', end: '10:00'),
    ];
    expect(scheduleConflicts(classes), {'a', 'b'});
    expect(scheduleMinutes('24:00'), -1);
    expect(
      ScheduleClass(
        id: 'x',
        subject: 'Materia',
        teacher: 'Ana',
        classroom: 'A',
        start: '10:00',
        end: '09:00',
      ).error,
      isNotNull,
    );
  });
  test(
    'la copia editable preserva PDF y cuenta sin modificar el horario guardado',
    () {
      final original = LocalSchedule(
        userId: 'user-a',
        career: 'Ingeniería Civil',
        studentId: '123',
        pdfName: 'horario.pdf',
        pdf: Uint8List.fromList([37, 80, 68, 70, 45]),
        classes: [ScheduleClass(id: '1', subject: 'Cálculo')],
      );
      final copy = original.copy();
      copy.classes.first.subject = 'Física';
      copy.pdf![0] = 0;
      expect(original.classes.first.subject, 'Cálculo');
      expect(original.pdf!.first, 37);
      final saved = LocalSchedule.fromJson(
        jsonDecode(jsonEncode(original.toJson())),
      );
      expect(saved.userId, 'user-a');
      expect(saved.pdf, original.pdf);
      expect(saved.studentId, '123');
    },
  );
}
