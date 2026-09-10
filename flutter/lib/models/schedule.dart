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
  String userId, career, studentId, studentName;
  List<ScheduleClass> classes;
  List<String> warnings;
  DateTime? reviewedAt;
  LocalSchedule({
    required this.userId,
    this.career = '',
    this.studentId = '',
    this.studentName = '',
    List<ScheduleClass>? classes,
    List<String>? warnings,
    this.reviewedAt,
  }) : classes = classes ?? [],
       warnings = warnings ?? [];
  // Ignora los archivos de versiones anteriores sin decodificarlos.
  factory LocalSchedule.fromJson(Map<String, dynamic> j) => LocalSchedule(
    userId: j['userId'],
    career: j['career'] ?? '',
    studentId: j['studentId'] ?? '',
    studentName: j['studentName'] ?? '',
    classes: (j['classes'] as List? ?? [])
        .map((x) => ScheduleClass.fromJson(Map<String, dynamic>.from(x)))
        .toList(),
    reviewedAt: j['reviewedAt'] == null
        ? null
        : DateTime.tryParse(j['reviewedAt']),
  );
  Map<String, dynamic> toJson() => {
    'version': 2,
    'userId': userId,
    'career': career,
    'studentId': studentId,
    'studentName': studentName,
    'classes': classes.map((x) => x.toJson()).toList(),
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
          x.teacher == teacher &&
          x.classroom == room &&
          x.group == group &&
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
            .split(RegExp(r'\s*\|\s*|\t'))
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
    if (line.startsWith('!REVISAR ')) {
      result.warnings.add('Revisa el texto sin fila: ${line.substring(9)}');
      continue;
    }
    if (header != null && cells.length > 1) {
      if (header.length == 11 && cells.length != 11) {
        result.warnings.add(
          'Una fila no conserva las 11 celdas. Revisa: $line',
        );
        continue;
      }
      String value(String pattern) {
        final i = header!.indexWhere((h) => RegExp(pattern).hasMatch(h));
        return i >= 0 && i < cells.length ? cells[i] : '';
      }

      final subject = value(
            r'^(materia|asignatura|nombre de (?:la )?materia)$',
          ),
          teacher = value('docente|maestro|profesor'),
          room = value('salon|aula'),
          group = value(r'^(grupo|gpo)\.?$');
      final daily = header.indexed.where((x) => scheduleDay(x.$2) > 0).toList();
      if (daily.isNotEmpty) {
        for (final entry in daily) {
          final cell = entry.$1 < cells.length ? cells[entry.$1] : '';
          final ranges =
              RegExp(
                    r'\b\d{1,2}(?::\d{2})?\s*(?:-|–|—|a)\s*\d{1,2}(?::\d{2})?\b',
                    caseSensitive: false,
                  )
                  .allMatches(cell)
                  .map((m) => scheduleRange(m[0]!))
                  .whereType<({String start, String end})>()
                  .toList();
          if (cell.isNotEmpty &&
              !RegExp(r'^[-–—.\s]*$').hasMatch(cell) &&
              ranges.isEmpty) {
            result.warnings.add(
              '$subject, ${entry.$2}: revisa «$cell». No se inventó una hora de salida.',
            );
          }
          for (final range in ranges) {
            add(subject, teacher, room, scheduleDay(entry.$2), range, group);
          }
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

const fitScheduleColumns = [
  'GPO',
  'MATERIA',
  'AULA',
  'LUNES',
  'MARTES',
  'MIÉRCOLES',
  'JUEVES',
  'VIERNES',
  'SÁBADO',
  'DOMINGO',
  'PROFESOR',
];
int _columnOf(String s) {
  final n = normalize(s).replaceAll(RegExp('[.:]'), '').trim();
  if (RegExp(r'^(gpo|grupo)$').hasMatch(n)) return 0;
  if (RegExp(r'^(materia|asignatura)$').hasMatch(n)) return 1;
  if (RegExp(r'^(aula|salon)$').hasMatch(n)) return 2;
  if (RegExp(r'^(profesor|docente|maestro)$').hasMatch(n)) return 10;
  return scheduleDay(n) > 0 ? scheduleDay(n) + 2 : -1;
}

List<String> scheduleRowsFromWords(List<ScheduleWord> words) {
  final rows = <List<ScheduleWord>>[], output = <String>[];
  final expanded = <ScheduleWord>[];
  for (final w in words.where((x) => x.text.trim().isNotEmpty)) {
    final parts = RegExp(r'\S+').allMatches(w.text).toList();
    if (parts.where((p) => _columnOf(p[0]!) >= 0).length < 2) {
      expanded.add(w);
      continue;
    }
    final scale = (w.x1 - w.x0) / w.text.length;
    for (final p in parts) {
      expanded.add(
        ScheduleWord(
          p[0]!,
          w.x0 + p.start * scale,
          w.y0,
          w.x0 + p.end * scale,
          w.y1,
        ),
      );
    }
  }
  expanded.sort(
    (a, b) =>
        a.y0.compareTo(b.y0) == 0 ? a.x0.compareTo(b.x0) : a.y0.compareTo(b.y0),
  );
  for (final w in expanded) {
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
  rows.sort(
    (a, b) => ((a.first.y0 + a.first.y1) / 2).compareTo(
      (b.first.y0 + b.first.y1) / 2,
    ),
  );
  List<double>? bounds;
  List<String>? pending;
  double? lastY;
  void flush() {
    if (pending != null) output.add(pending!.join(' | '));
    pending = null;
  }

  for (final row in rows) {
    row.sort((a, b) => a.x0.compareTo(b.x0));
    final y = (row.first.y0 + row.first.y1) / 2;
    final heads = List<double?>.filled(11, null);
    for (final w in row) {
      final n = _columnOf(w.text);
      if (n >= 0) heads[n] = (w.x0 + w.x1) / 2;
    }
    if (heads.every((x) => x != null) &&
        heads.indexed.every((x) => x.$1 == 0 || x.$2! > heads[x.$1 - 1]!)) {
      flush();
      bounds = List.generate(10, (i) => (heads[i]! + heads[i + 1]!) / 2);
      final gaps = List.generate(6, (i) => heads[i + 4]! - heads[i + 3]!)
        ..sort();
      final step = gaps[gaps.length ~/ 2];
      bounds[0] = bounds[0] < heads[0]! + step / 2
          ? bounds[0]
          : heads[0]! + step / 2;
      bounds[1] = heads[2]! - (heads[3]! - heads[2]!) / 2;
      bounds[9] = heads[9]! + step / 2;
      output.add(fitScheduleColumns.join(' | '));
      lastY = y;
      continue;
    }
    if (bounds != null) {
      final cells = List.filled(11, '');
      final spans = [double.negativeInfinity, ...bounds, double.infinity];
      for (final w in row) {
        var best = 0;
        var amount = double.negativeInfinity;
        for (var n = 0; n < 11; n++) {
          final right = w.x1 < spans[n + 1] ? w.x1 : spans[n + 1];
          final left = w.x0 > spans[n] ? w.x0 : spans[n];
          if (right - left > amount) {
            amount = right - left;
            best = n;
          }
        }
        cells[best] += '${cells[best].isEmpty ? '' : ' '}${w.text.trim()}';
      }
      final anyTime = cells
          .sublist(3, 10)
          .any((s) => RegExp(r'\d').hasMatch(s));
      if (cells[0].isNotEmpty ||
          (cells[1].isNotEmpty && cells[2].isNotEmpty && anyTime)) {
        flush();
      }
      final continuation =
          pending != null &&
          y - lastY! <
              ((row.first.y1 - row.first.y0) * 2.5).clamp(24, double.infinity);
      if (pending == null &&
          (cells[0].isNotEmpty || (cells[1].isNotEmpty && anyTime))) {
        pending = cells;
      } else if (continuation) {
        pending = List.generate(
          11,
          (i) => [pending![i], cells[i]].where((x) => x.isNotEmpty).join(' '),
        );
      } else {
        flush();
        output.add('!REVISAR ${row.map((x) => x.text).join(' ')}');
      }
      lastY = y;
      continue;
    }
    final line = StringBuffer();
    ScheduleWord? prior;
    for (final w in row) {
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
    output.add(line.toString());
  }
  flush();
  return output;
}
