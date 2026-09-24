import 'dart:io';
import 'dart:typed_data';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:path_provider/path_provider.dart';
import '../models/schedule.dart';

Future<List<String>> recognizeScheduleImage(
  Uint8List bytes,
  String mime,
) async {
  if (!Platform.isAndroid && !Platform.isIOS) {
    throw UnsupportedError(
      'La lectura de imágenes está disponible en Android, iOS y la versión web.',
    );
  }
  final directory = await Directory(
    (await getTemporaryDirectory()).path,
  ).createTemp('fit_ocr_');
  final extension = mime == 'image/jpeg'
      ? 'jpg'
      : mime == 'image/webp'
      ? 'webp'
      : 'png';
  final file = File('${directory.path}/horario.$extension');
  final reader = TextRecognizer(script: TextRecognitionScript.latin);
  try {
    await file.writeAsBytes(bytes, flush: true);
    final result = await reader.processImage(
      InputImage.fromFilePath(file.path),
    );
    final words = <ScheduleWord>[];
    for (final block in result.blocks) {
      for (final line in block.lines) {
        for (final word in line.elements) {
          final box = word.boundingBox;
          words.add(
            ScheduleWord(word.text, box.left, box.top, box.right, box.bottom),
          );
        }
      }
    }
    return words.isEmpty
        ? result.text.split('\n')
        : scheduleRowsFromWords(words);
  } finally {
    await reader.close();
    if (await directory.exists()) await directory.delete(recursive: true);
  }
}
