import 'dart:convert';
import 'package:idb_shim/idb_browser.dart';
import '../models/schedule.dart';

class ScheduleStore {
  Future<Database> _open() => idbFactoryNative.open(
    'fit-flutter-schedules-v2',
    version: 1,
    onUpgradeNeeded: (e) {
      e.database.createObjectStore('schedules');
    },
  );
  Future<LocalSchedule?> read(String userId) async {
    final db = await _open();
    try {
      final tx = db.transaction('schedules', idbModeReadOnly);
      final value = await tx.objectStore('schedules').getObject(userId);
      await tx.completed;
      if (value == null) return null;
      final saved = LocalSchedule.fromJson(jsonDecode(value as String));
      if (saved.userId != userId) {
        throw StateError('El horario pertenece a otra cuenta.');
      }
      return saved;
    } finally {
      db.close();
    }
  }

  Future<void> save(LocalSchedule schedule) async {
    final db = await _open();
    try {
      final tx = db.transaction('schedules', idbModeReadWrite);
      await tx
          .objectStore('schedules')
          .put(jsonEncode(schedule.toJson()), schedule.userId);
      await tx.completed;
    } finally {
      db.close();
    }
  }

  Future<void> delete(String userId) async {
    final db = await _open();
    try {
      final tx = db.transaction('schedules', idbModeReadWrite);
      await tx.objectStore('schedules').delete(userId);
      await tx.completed;
    } finally {
      db.close();
    }
  }
}
