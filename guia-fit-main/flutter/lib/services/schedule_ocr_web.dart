import 'dart:convert';
import 'dart:js_interop';
import 'dart:typed_data';
import '../models/schedule.dart';

@JS('fitOcrRead')
external JSPromise<JSString> _readImage(JSString dataUrl);
Future<List<String>> recognizeScheduleImage(
  Uint8List bytes,
  String mime,
) async {
  final data =
      jsonDecode(
            (await _readImage(
              'data:$mime;base64,${base64Encode(bytes)}'.toJS,
            ).toDart).toDart,
          )
          as Map<String, dynamic>;
  final words = (data['boxes'] as List).map((raw) {
    final b = Map<String, dynamic>.from(raw);
    return ScheduleWord(
      b['text'],
      (b['x0'] as num).toDouble(),
      (b['y0'] as num).toDouble(),
      (b['x1'] as num).toDouble(),
      (b['y1'] as num).toDouble(),
    );
  }).toList();
  return words.isEmpty
      ? (data['text'] as String).split('\n')
      : scheduleRowsFromWords(words);
}
