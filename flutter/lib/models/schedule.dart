import 'dart:convert';
import 'dart:typed_data';
import 'campus.dart' show normalize;

const scheduleDays = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];
const _dayAliases = [
  ['lunes', 'lun', 'lu'],
  ['martes', 'mar', 'ma'],
  ['miercoles', 'mie', 'mi'],
  ['jueves', 'jue', 'ju'],
  ['viernes', 'vie', 'vi'],
  ['sabado', 'sab', 'sa'],
  ['domingo', 'dom', 'do'],
];
int scheduleDay(String s) =>
    _dayAliases.indexWhere(
      (xs) => xs.contains(normalize(s).replaceAll(RegExp('[.:]'), '').trim()),
    ) +
    1;
int scheduleMinutes(String s) {
  final m = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(s);
  if (m == null) return -1;
  final h = int.parse(m[1]!), minute = int.parse(m[2]!);
  return h < 24 && minute < 60 ? h * 60 + minute : -1;
}

({String start, String end})? scheduleRange(String s) {
  final m = RegExp(
    r'\b(\d{1,2})(?::(\d{2}))?\s*(?:-|–|—|a)\s*(\d{1,2})(?::(\d{2}))?\b',
    caseSensitive: false,
  ).firstMatch(s);
  if (m == null) return null;
  final start = '${m[1]!.padLeft(2, '0')}:${m[2] ?? '00'}',
      end = '${m[3]!.padLeft(2, '0')}:${m[4] ?? '00'}';
  return scheduleMinutes(start) >= 0 &&
          scheduleMinutes(end) > scheduleMinutes(start)
      ? (start: start, end: end)
      : null;
}

class ScheduleClass {
  String id, subject, teacher, classroom, start, end, placeId, group;
  int day;
  ScheduleClass({
    required this.id,
    this.subject = '',
    this.group = '',
    this.teacher = '',
    this.classroom = '',
    this.day = 1,
    this.start = '08:00',
    this.end = '09:00',
    this.placeId = '',
  });
  factory ScheduleClass.fromJson(Map<String, dynamic> j) => ScheduleClass(
    id: j['id'],
    subject: j['subject'],
    group: j['group'] ?? '',
    teacher: j['teacher'],
    classroom: j['classroom'],
    day: j['day'],
    start: j['start'],
    end: j['end'],
    placeId: j['place_id'] ?? '',
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'subject': subject,
    'group': group,
    'teacher': teacher,
    'classroom': classroom,
    'day': day,
    'start': start,
    'end': end,
    'place_id': placeId,
  };
  String? get error {
    if (group.length > 40) return 'El grupo debe tener hasta 40 caracteres.';
    if (subject.trim().isEmpty || subject.length > 160) {
      return 'Escribe el nombre de la materia.';
    }
    if (teacher.trim().isEmpty || teacher.length > 160) {
      return 'Escribe el nombre del maestro.';
    }
    if (classroom.trim().isEmpty || classroom.length > 100) {
      return 'Escribe el salón.';
    }
    if (day < 1 || day > 7) return 'Selecciona el día.';
    if (scheduleMinutes(start) < 0 ||
        scheduleMinutes(end) <= scheduleMinutes(start)) {
      return 'La salida debe ser posterior a la entrada.';
    }
    return null;
  }
}

Set<String> scheduleConflicts(List<ScheduleClass> classes) {
  final result = <String>{};
  for (var i = 0; i < classes.length; i++) {
    for (var j = i + 1; j < classes.length; j++) {
      final a = classes[i], b = classes[j];
      if (a.day == b.day &&
          scheduleMinutes(a.start) < scheduleMinutes(b.end) &&
          scheduleMinutes(b.start) < scheduleMinutes(a.end)) {
        result.addAll([a.id, b.id]);
      }
    }
  }
  return result;
}

class LocalSchedule {
  String userId, career, studentId, studentName, pdfName, sourceMime;
  List<ScheduleClass> classes;
  Uint8List? pdf;
  DateTime? reviewedAt;
  LocalSchedule({
    required this.userId,
    this.career = '',
    this.studentId = '',
    this.studentName = '',
    this.sourceMime = 'application/pdf',
    this.pdfName = '',
    List<ScheduleClass>? classes,
    this.pdf,
    this.reviewedAt,
  }) : classes = classes ?? [];
  factory LocalSchedule.fromJson(Map<String, dynamic> j) => LocalSchedule(
    userId: j['userId'],
    career: j['career'],
    studentId: j['studentId'],
    studentName: j['studentName'] ?? '',
    sourceMime: j['sourceMime'] ?? 'application/pdf',
    pdfName: j['pdfName'] ?? '',
    classes: (j['classes'] as List)
        .map((x) => ScheduleClass.fromJson(Map<String, dynamic>.from(x)))
        .toList(),
    pdf: j['pdfBase64'] == null ? null : base64Decode(j['pdfBase64']),
    reviewedAt: j['reviewedAt'] == null
        ? null
        : DateTime.parse(j['reviewedAt']),
  );
  Map<String, dynamic> toJson() => {
    'version': 1,
    'userId': userId,
    'career': career,
    'studentId': studentId,
    'studentName': studentName,
    'sourceMime': sourceMime,
    'pdfName': pdfName,
    'classes': classes.map((x) => x.toJson()).toList(),
    'pdfBase64': pdf == null ? null : base64Encode(pdf!),
    'reviewedAt': reviewedAt?.toIso8601String(),
  };
  LocalSchedule copy() => LocalSchedule.fromJson(toJson());
}

LocalSchedule parseScheduleLines(List<String> lines, String userId) {
  final text = lines.join('\n');
  final careerMatch = RegExp(
    r'(?:carrera|programa(?:\s+educativo)?)\s*[:|]\s*([^\n|]+)',
    caseSensitive: false,
  ).firstMatch(text);
  final studentMatch = RegExp(
    r'(?:matricula|no\.?\s*(?:de\s*)?control)\s*[:|]?\s*([a-z0-9-]{3,30})',
    caseSensitive: false,
  ).firstMatch(normalize(text));
  final career =
      careerMatch?[1]?.trim() ??
      lines
          .where(
            (l) => RegExp(
              r'^\s*(ingenier[ií]a|licenciatura)\s+',
              caseSensitive: false,
            ).hasMatch(l),
          )
          .firstOrNull
          ?.split('|')
          .first
          .trim() ??
      '';
  final result = LocalSchedule(
    userId: userId,
    career: career,
    studentId: studentMatch?[1]?.toUpperCase() ?? '',
    studentName:
        RegExp(
          r'(?:nombre(?:\s+del?)?(?:\s+alumno|\s+estudiante)?|alumno|estudiante)\s*[:|]\s*([^\n|]+)',
          caseSensitive: false,
        ).firstMatch(text)?[1]?.trim() ??
        '',
  );
  List<String>? header;
  void add(
    String subject,
    String teacher,
    String room,
    int day,
    ({String start, String end})? range, [
    String group = '',
  ]) {
    if (range == null ||
        day == 0 ||
        subject.isEmpty ||
        result.classes.length >= 120) {
      return;
    }
    if (result.classes.any(
      (x) =>
          x.subject == subject &&
          x.day == day &&
          x.start == range.start &&
          x.end == range.end,
    )) {
      return;
    }
    result.classes.add(
      ScheduleClass(
        id: 'import-${result.classes.length + 1}',
        subject: subject,
        group: group,
        teacher: teacher,
        classroom: room,
        day: day,
        start: range.start,
        end: range.end,
      ),
    );
  }

  for (final line in lines) {
    final cells = line
            .split(RegExp(r'\s*\|\s*|\t+'))
            .map((x) => x.trim())
            .toList(),
        ns = cells.map(normalize).toList();
    if (ns.any(
          (x) => RegExp(
            r'^(materia|asignatura|nombre de (?:la )?materia)$',
          ).hasMatch(x),
        ) &&
        ns.any(
          (x) =>
              RegExp('docente|maestro|profesor|horario|hora|dia').hasMatch(x) ||
              scheduleDay(x) > 0,
        )) {
      header = ns;
      continue;
    }
    if (header != null && cells.length > 1) {
      String value(String pattern) {
        final i = header!.indexWhere((h) => RegExp(pattern).hasMatch(h));
        return i >= 0 && i < cells.length ? cells[i] : '';
      }

      final subject = value(
            r'^(materia|asignatura|nombre de (?:la )?materia)$',
          ),
          teacher = value('docente|maestro|profesor'),
          room = value('salon|aula'),
          group = value('^grupo');
      final daily = header.indexed.where((x) => scheduleDay(x.$2) > 0).toList();
      if (daily.isNotEmpty) {
        for (final entry in daily) {
          final cell = entry.$1 < cells.length ? cells[entry.$1] : '';
          final room2 = room.isNotEmpty
              ? room
              : RegExp(
                      r'(?:sal[oó]n|aula)\s*:?\s*([^|,;]+)',
                      caseSensitive: false,
                    ).firstMatch(cell)?[1] ??
                    '';
          add(
            subject,
            teacher,
            room2,
            scheduleDay(entry.$2),
            scheduleRange(cell),
            group,
          );
        }
        continue;
      }
      final dayCell = value('^dia'),
          range = scheduleRange(value('horario|hora')) ?? scheduleRange(line);
      final hits = dayCell
          .split(RegExp('[,;/]+'))
          .map(scheduleDay)
          .where((d) => d > 0)
          .toList();
      for (final d in hits) {
        add(subject, teacher, room, d, range, group);
      }
      if (hits.isNotEmpty) continue;
    }
    final dayIndex = cells.indexWhere((x) => scheduleDay(x) > 0),
        rangeIndex = cells.indexWhere((x) => scheduleRange(x) != null);
    if (cells.length >= 5 && dayIndex >= 0 && rangeIndex >= 0) {
      final remaining = cells.indexed
          .where((x) => x.$1 != dayIndex && x.$1 != rangeIndex)
          .map((x) => x.$2)
          .toList();
      add(
        remaining[0],
        remaining[1],
        remaining[2],
        scheduleDay(cells[dayIndex]),
        scheduleRange(cells[rangeIndex]),
        remaining.length > 3 ? remaining[3] : '',
      );
    }
  }
  return result;
}

class ScheduleWord {
  final String text;
  final double x0, y0, x1, y1;
  ScheduleWord(this.text, this.x0, this.y0, this.x1, this.y1);
}

List<String> scheduleRowsFromWords(List<ScheduleWord> words) {
  final rows = <List<ScheduleWord>>[];
  for (final w in words.where((x) => x.text.trim().isNotEmpty)) {
    final center = (w.y0 + w.y1) / 2;
    final row = rows
        .where(
          (r) =>
              (((r.first.y0 + r.first.y1) / 2) - center).abs() <
              ((w.y1 - w.y0) * .48).clamp(5, double.infinity),
        )
        .firstOrNull;
    if (row == null) {
      rows.add([w]);
    } else {
      row.add(w);
    }
  }
  rows.sort((a, b) => a.first.y0.compareTo(b.first.y0));
  return rows.map((r) {
    r.sort((a, b) => a.x0.compareTo(b.x0));
    final line = StringBuffer();
    ScheduleWord? prior;
    for (final w in r) {
      if (prior != null) {
        line.write(
          w.x0 - prior.x1 > ((w.y1 - w.y0) * 1.2).clamp(18, double.infinity)
              ? ' | '
              : ' ',
        );
      }
      line.write(w.text.trim());
      prior = w;
    }
    return line.toString();
  }).toList();
}
