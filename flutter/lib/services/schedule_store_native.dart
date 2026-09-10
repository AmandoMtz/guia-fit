import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import '../models/schedule.dart';

class ScheduleStore {
  final Directory? directory;
  ScheduleStore({this.directory});
  Future<File> _file(String userId) async {
    if (!RegExp(r'^[a-zA-Z0-9-]+$').hasMatch(userId)) {
      throw ArgumentError('Cuenta inválida.');
    }
    final dir = Directory(
      '${(directory ?? await getApplicationDocumentsDirectory()).path}/fit_schedules',
    );
    await dir.create(recursive: true);
    return File('${dir.path}/$userId.json');
  }

  Future<LocalSchedule?> read(String userId) async {
    final file = await _file(userId);
    if (!await file.exists()) return null;
    final data = jsonDecode(await file.readAsString()) as Map<String, dynamic>;
    final saved = LocalSchedule.fromJson(data);
    if (saved.userId != userId) {
      throw StateError('El horario pertenece a otra cuenta.');
    }
    if (data['version'] != 2 ||
        data.containsKey('pdfBase64') ||
        data.containsKey('pdfName')) {
      await save(saved);
    }
    return saved;
  }

  Future<void> save(LocalSchedule schedule) async {
    final file = await _file(schedule.userId);
    final temp = File('${file.path}.tmp');
    await temp.writeAsString(jsonEncode(schedule.toJson()), flush: true);
    await temp.rename(file.path);
  }

  Future<void> delete(String userId) async {
    final file = await _file(userId);
    if (await file.exists()) await file.delete();
    final temp = File('${file.path}.tmp');
    if (await temp.exists()) await temp.delete();
  }
}
