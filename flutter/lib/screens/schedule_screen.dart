import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui' as ui;
import '../services/schedule_ocr.dart';
import '../widgets/schedule_table.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:pdfrx/pdfrx.dart';
import '../models/schedule.dart';
import '../services/app_controller.dart';
import '../services/schedule_store.dart';
import '../widgets/common.dart';

class ScheduleScreen extends StatefulWidget {
  final AppController controller;
  final void Function(String) onPlace;
  const ScheduleScreen({
    super.key,
    required this.controller,
    required this.onPlace,
  });
  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  final _store = ScheduleStore();
  LocalSchedule? _saved;
  bool _loading = true, _busy = false;
  String? _error;
  int _week = 0;
  AppController get c => widget.controller;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      if (c.user != null) _saved = await _store.read(c.user!.id);
    } catch (_) {
      _error =
          'No se pudo abrir el horario local. Revisa el almacenamiento del dispositivo.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit(
    LocalSchedule draft, {
    String? text,
    bool imported = false,
    String? editId,
  }) async {
    final saved = await showDialog<LocalSchedule>(
      context: context,
      barrierDismissible: false,
      builder: (context) => ScheduleReviewDialog(
        draft: draft,
        controller: c,
        text: text,
        imported: imported,
        editId: editId,
      ),
    );
    if (saved != null && mounted) setState(() => _saved = saved);
  }

  Future<void> _import() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    PdfDocument? document;
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
        withData: true,
      );
      if (result == null || !mounted) return;
      final file = result.files.single, bytes = file.bytes;
      if (bytes == null || file.size > 8388608) {
        throw Exception('Selecciona una imagen o PDF de hasta 8 MB.');
      }
      final isPdf =
          bytes.length >= 5 &&
          ascii.decode(bytes.sublist(0, 5), allowInvalid: true) == '%PDF-';
      final ext = file.name.split('.').last.toLowerCase();
      final mime = isPdf
          ? 'application/pdf'
          : {
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'png': 'image/png',
              'webp': 'image/webp',
            }[ext];
      if (mime == null) {
        throw Exception('Selecciona una imagen JPG, PNG, WebP o un PDF.');
      }
      final lines = <String>[];
      if (isPdf) {
        document = await PdfDocument.openData(
          bytes,
          sourceName: file.name,
          passwordProvider: () async => null,
        );
        if (document.pages.length > 20) {
          throw Exception('Selecciona un PDF de hasta 20 páginas.');
        }
        for (final page in document.pages) {
          final text = await page.loadText();
          if (text.fullText.trim().length < 30) {
            final scale = math.min(
              2.5,
              2800 / math.max(page.width, page.height),
            );
            final rendered = await page.render(
              fullWidth: page.width * scale,
              fullHeight: page.height * scale,
            );
            if (rendered == null) continue;
            try {
              final image = await rendered.createImage();
              try {
                final png = await image.toByteData(
                  format: ui.ImageByteFormat.png,
                );
                if (png != null) {
                  lines.addAll(
                    await recognizeScheduleImage(
                      png.buffer.asUint8List(),
                      'image/png',
                    ),
                  );
                }
              } finally {
                image.dispose();
              }
            } finally {
              rendered.dispose();
            }
          } else {
            final rows = <List<PdfPageTextFragment>>[];
            for (final fragment in text.fragments.where(
              (f) => f.text.trim().isNotEmpty,
            )) {
              final row = rows
                  .where(
                    (r) => (r.first.bounds.top - fragment.bounds.top).abs() < 4,
                  )
                  .firstOrNull;
              if (row == null) {
                rows.add([fragment]);
              } else {
                row.add(fragment);
              }
            }
            rows.sort(
              (a, b) => b.first.bounds.top.compareTo(a.first.bounds.top),
            );
            for (final row in rows) {
              row.sort((a, b) => a.bounds.left.compareTo(b.bounds.left));
              final line = StringBuffer();
              PdfPageTextFragment? prior;
              for (final f in row) {
                if (prior != null) {
                  line.write(
                    f.bounds.left - prior.bounds.right > 12 ? ' | ' : ' ',
                  );
                }
                line.write(f.text.replaceAll(RegExp(r'[\r\n]+'), ' ').trim());
                prior = f;
              }
              lines.add(line.toString());
            }
          }
        }
      } else {
        lines.addAll(await recognizeScheduleImage(bytes, mime));
      }
      if (!mounted || c.user == null) return;
      final draft = parseScheduleLines(lines, c.user!.id);
      if (draft.studentId.isEmpty) {
        draft.studentId = c.profile?['student_id'] ?? '';
      }
      if (draft.studentName.isEmpty) {
        draft.studentName = c.profile?['full_name'] ?? '';
      }
      draft.pdf = bytes;
      draft.pdfName = file.name;
      draft.sourceMime = mime;
      await _edit(draft, text: lines.join('\n'), imported: true);
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is Exception
              ? e.toString().replaceFirst('Exception: ', '')
              : 'No se pudo leer el archivo. Puedes capturar las clases manualmente.',
        );
      }
    } finally {
      await document?.dispose();
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _box(Widget child, {Color color = Colors.white}) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(26),
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFFE0E7E7)),
    ),
    child: child,
  );
  Widget _welcome() => _box(
    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(
          Icons.calendar_month_outlined,
          size: 64,
          color: Color(0xFF2C6359),
        ),
        const SizedBox(height: 24),
        const Text(
          'TU SEMANA EN ORDEN',
          style: TextStyle(color: fitOrange, fontSize: 11, letterSpacing: 1.8),
        ),
        const SizedBox(height: 14),
        const Text(
          'Cada clase,\nen su lugar.',
          style: TextStyle(
            fontSize: 38,
            fontWeight: FontWeight.w700,
            height: 1.15,
            letterSpacing: -1.5,
          ),
        ),
        const SizedBox(height: 18),
        const Text(
          'Sube una imagen o el PDF de tu horario. Revisa carrera, matrícula y clases, y organiza tu semana.',
          style: TextStyle(color: fitMuted, height: 1.8),
        ),
        const SizedBox(height: 24),
        if (c.demo)
          const InfoBanner(
            'Inicia sesión para guardar tu horario en este dispositivo.',
          )
        else
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              FilledButton.icon(
                onPressed: _busy ? null : _import,
                icon: const Icon(Icons.upload_file_outlined),
                label: Text(_busy ? 'Leyendo horario…' : 'Subir imagen o PDF'),
              ),
              OutlinedButton(
                onPressed: _busy
                    ? null
                    : () => _edit(
                        LocalSchedule(
                          userId: c.user!.id,
                          studentId: c.profile?['student_id'] ?? '',
                        ),
                      ),
                child: const Text('Capturar manualmente'),
              ),
            ],
          ),
        const Divider(height: 40),
        const Text(
          '01  Sube tu horario\n02  Revisa los datos\n03  Consulta tu semana',
          style: TextStyle(height: 2, color: fitMuted),
        ),
        const SizedBox(height: 18),
        const Text(
          'Solo en este dispositivo. El archivo no se envía al servidor. Hasta 8 MB y 20 páginas.',
          style: TextStyle(color: fitMuted, fontSize: 12, height: 1.7),
        ),
      ],
    ),
    color: const Color(0xFFF1F6F2),
  );
  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(40),
          child: CircularProgressIndicator(),
        ),
      );
    }
    final saved = _saved;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_error != null) InfoBanner(_error!, error: true),
        if (saved == null) _welcome() else ..._calendar(saved),
      ],
    );
  }

  List<Widget> _calendar(LocalSchedule saved) {
    final today = DateTime.now();
    final monday = DateTime(
      today.year,
      today.month,
      today.day - (today.weekday - 1) + _week * 7,
    );
    final conflicts = scheduleConflicts(saved.classes);
    final total = saved.classes.fold<int>(
      0,
      (n, c) => n + scheduleMinutes(c.end) - scheduleMinutes(c.start),
    );
    final count = saved.classes
        .map((x) => x.subject.toLowerCase())
        .toSet()
        .length;
    return [
      _box(
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${saved.studentId} · MI HORARIO',
              style: const TextStyle(
                color: Color(0xFFB4D2CA),
                fontSize: 11,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              saved.career,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 27,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '${saved.studentName.isEmpty ? (c.profile?['full_name'] ?? '') : saved.studentName} · ${c.user?.email ?? ''}',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                height: 1.7,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              '$count materias · ${(total / 60).toStringAsFixed(1)} horas por semana',
              style: const TextStyle(color: Color(0xFFD0E0E3)),
            ),
            const SizedBox(height: 14),
            Text(
              'Revisado por ti el ${_date(saved.reviewedAt ?? today)}. No es una validación institucional.',
              style: const TextStyle(
                color: Color(0xFFB9CDD2),
                fontSize: 11,
                height: 1.7,
              ),
            ),
          ],
        ),
        color: fitNavy,
      ),
      const SizedBox(height: 22),
      Wrap(
        spacing: 10,
        runSpacing: 10,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          IconButton(
            onPressed: () => setState(() => _week--),
            tooltip: 'Semana anterior',
            icon: const Icon(Icons.chevron_left),
          ),
          Text(
            '${_date(monday)} – ${_date(monday.add(const Duration(days: 6)))}',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          IconButton(
            onPressed: () => setState(() => _week++),
            tooltip: 'Semana siguiente',
            icon: const Icon(Icons.chevron_right),
          ),
          TextButton(
            onPressed: () => setState(() => _week = 0),
            child: const Text('Hoy'),
          ),
          OutlinedButton(
            onPressed: saved.pdf == null
                ? null
                : () => showSchedulePdf(context, saved),
            child: const Text('Ver original'),
          ),
          FilledButton(
            onPressed: _busy ? null : () => _edit(saved.copy()),
            child: const Text('Editar horario'),
          ),
        ],
      ),
      if (conflicts.isNotEmpty)
        const InfoBanner(
          'Hay clases que se superponen. Revisa las horas en Editar horario.',
        ),
      const SizedBox(height: 18),
      ScheduleTable(
        schedule: saved,
        monday: monday,
        onPlace: widget.onPlace,
        onEdit: (id) => _edit(saved.copy(), editId: id),
      ),
      const SizedBox(height: 20),
      const Text(
        'Semana recurrente: no incorpora vacaciones ni cambios oficiales. Guardado solo en este dispositivo. Borrar los datos de la app o del navegador elimina el horario.',
        style: TextStyle(color: fitMuted, fontSize: 12, height: 1.7),
      ),
      const SizedBox(height: 10),
      Wrap(
        spacing: 12,
        children: [
          TextButton(
            onPressed: _busy ? null : _import,
            child: Text(_busy ? 'Leyendo horario…' : 'Importar otro horario'),
          ),
          TextButton(
            onPressed: _busy
                ? null
                : () async {
                    final yes = await showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Eliminar horario'),
                        content: const Text(
                          'Se eliminarán de este dispositivo para tu cuenta.',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context, false),
                            child: const Text('Cancelar'),
                          ),
                          FilledButton(
                            onPressed: () => Navigator.pop(context, true),
                            child: const Text('Eliminar'),
                          ),
                        ],
                      ),
                    );
                    if (yes != true) return;
                    try {
                      await _store.delete(saved.userId);
                      if (mounted) setState(() => _saved = null);
                    } catch (_) {
                      if (mounted) {
                        message(
                          context,
                          'No se pudo eliminar el horario. Inténtalo otra vez.',
                        );
                      }
                    }
                  },
            child: const Text(
              'Eliminar horario',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    ];
  }

  String _date(DateTime d) => '${d.day}/${d.month}/${d.year}';
}

Future<void> showSchedulePdf(BuildContext context, LocalSchedule draft) async {
  if (draft.pdf == null) return;
  await showDialog<void>(
    context: context,
    builder: (context) => Dialog(
      child: SizedBox(
        width: 900,
        height: MediaQuery.sizeOf(context).height * .84,
        child: Column(
          children: [
            ListTile(
              title: Text(
                draft.pdfName.isEmpty ? 'Mi horario original' : draft.pdfName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: IconButton(
                onPressed: () => Navigator.pop(context),
                tooltip: 'Cerrar original',
                icon: const Icon(Icons.close),
              ),
            ),
            Expanded(
              child: draft.sourceMime.startsWith('image/')
                  ? InteractiveViewer(
                      child: Image.memory(
                        draft.pdf!,
                        fit: BoxFit.contain,
                        errorBuilder: (_, e, s) => const Center(
                          child: Text('No se pudo mostrar la imagen.'),
                        ),
                      ),
                    )
                  : PdfViewer.data(
                      draft.pdf!,
                      sourceName:
                          '${draft.userId}-${draft.pdfName}-${draft.pdf.hashCode}',
                      passwordProvider: () async => null,
                    ),
            ),
          ],
        ),
      ),
    ),
  );
}

class ScheduleReviewDialog extends StatefulWidget {
  final LocalSchedule draft;
  final AppController controller;
  final String? text;
  final bool imported;
  final String? editId;
  const ScheduleReviewDialog({
    super.key,
    required this.draft,
    required this.controller,
    this.text,
    this.imported = false,
    this.editId,
  });
  @override
  State<ScheduleReviewDialog> createState() => _ScheduleReviewDialogState();
}

class _ScheduleReviewDialogState extends State<ScheduleReviewDialog> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _career, _student, _studentName;
  bool _confirmed = false, _busy = false, _keepOriginal = true;
  String? _error;
  LocalSchedule get draft => widget.draft;
  @override
  void initState() {
    super.initState();
    _career = TextEditingController(text: draft.career);
    _studentName = TextEditingController(
      text: draft.studentName.isEmpty
          ? (widget.controller.profile?['full_name'] ?? '')
          : draft.studentName,
    );
    if (widget.editId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final current = draft.classes
            .where((x) => x.id == widget.editId)
            .firstOrNull;
        if (current != null && mounted) _class(current);
      });
    }
    _student = TextEditingController(text: draft.studentId);
  }

  @override
  void dispose() {
    _career.dispose();
    _studentName.dispose();
    _student.dispose();
    super.dispose();
  }

  Future<void> _class([ScheduleClass? current]) async {
    if (current == null && draft.classes.length >= 120) {
      message(context, 'Puedes guardar hasta 120 bloques de clase.');
      return;
    }
    final result = await showDialog<ScheduleClass>(
      context: context,
      builder: (context) =>
          ClassEditorDialog(current: current, controller: widget.controller),
    );
    if (result == null || !mounted) return;
    setState(() {
      if (current == null) {
        draft.classes.add(result);
      } else {
        draft.classes[draft.classes.indexOf(current)] = result;
      }
      _confirmed = false;
    });
  }

  Future<void> _save() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() => _error = null);
    if (!_confirmed) {
      setState(
        () => _error = 'Confirma que revisaste los datos contra tu horario.',
      );
      return;
    }
    if (draft.classes.isEmpty) {
      setState(() => _error = 'Agrega al menos una clase.');
      return;
    }
    final invalid = draft.classes.where((x) => x.error != null).firstOrNull;
    if (invalid != null) {
      setState(() => _error = 'Revisa ${invalid.subject}: ${invalid.error}');
      return;
    }
    if (widget.controller.user?.id != draft.userId) {
      setState(
        () => _error = 'La sesión cambió. Abre el horario desde tu cuenta.',
      );
      return;
    }
    setState(() => _busy = true);
    try {
      draft.career = _career.text.trim();
      draft.studentName = _studentName.text.trim();
      if (!_keepOriginal) {
        draft.pdf = null;
        draft.pdfName = '';
      }
      draft.studentId = _student.text.trim();
      draft.reviewedAt = DateTime.now();
      await ScheduleStore().save(draft);
      if (mounted) Navigator.pop(context, draft);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'No se pudo guardar. Revisa el espacio y los permisos de almacenamiento.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Tu horario, a tu manera.'),
    content: SizedBox(
      width: 730,
      child: SingleChildScrollView(
        child: Form(
          key: _form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                widget.imported
                    ? '${draft.classes.length} clases detectadas. Comprueba cada dato contra el archivo original.'
                    : 'Edita tu carrera, matrícula y clases.',
                style: const TextStyle(color: fitMuted, height: 1.7),
              ),
              if (widget.imported && draft.classes.isEmpty)
                const InfoBanner(
                  'No se reconocieron clases automáticamente. Revisa el texto detectado o agrega las clases manualmente. Puedes conservar el original como referencia.',
                ),
              const SizedBox(height: 18),
              TextFormField(
                controller: _studentName,
                maxLength: 160,
                decoration: const InputDecoration(
                  labelText: 'Nombre del estudiante',
                ),
                onChanged: (_) => setState(() => _confirmed = false),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _career,
                maxLength: 160,
                decoration: const InputDecoration(labelText: 'Carrera'),
                onChanged: (_) => setState(() => _confirmed = false),
                validator: (v) =>
                    (v?.trim().length ?? 0) < 3 ? 'Escribe la carrera.' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _student,
                maxLength: 30,
                decoration: const InputDecoration(labelText: 'Matrícula'),
                onChanged: (_) => setState(() => _confirmed = false),
                validator: (v) =>
                    RegExp(r'^[a-zA-Z0-9-]{3,30}$').hasMatch(v?.trim() ?? '')
                    ? null
                    : 'Revisa la matrícula.',
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 10,
                children: [
                  OutlinedButton.icon(
                    onPressed: _busy ? null : () => _class(),
                    icon: const Icon(Icons.add),
                    label: const Text('Agregar clase'),
                  ),
                  if (draft.pdf != null)
                    TextButton(
                      onPressed: () => showSchedulePdf(context, draft),
                      child: const Text('Ver original'),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              if (draft.classes.isEmpty)
                const InfoBanner(
                  'Agrega una entrada por cada día y bloque de clase.',
                ),
              for (final c in draft.classes)
                Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          c.subject.isEmpty
                              ? 'Materia por completar'
                              : c.subject,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '${scheduleDays[c.day - 1]} · ${c.start}–${c.end}',
                        ),
                        Text(
                          '${c.teacher.isEmpty ? 'Maestro pendiente' : c.teacher} · Grupo ${c.group.isEmpty ? '—' : c.group} · ${c.classroom.isEmpty ? 'Salón pendiente' : c.classroom}',
                          style: const TextStyle(color: fitMuted, fontSize: 12),
                        ),
                        if (c.error != null)
                          Text(
                            c.error!,
                            style: const TextStyle(
                              color: Colors.red,
                              fontSize: 12,
                            ),
                          ),
                        Wrap(
                          spacing: 10,
                          children: [
                            TextButton(
                              onPressed: _busy ? null : () => _class(c),
                              child: const Text('Editar'),
                            ),
                            TextButton(
                              onPressed: _busy
                                  ? null
                                  : () => setState(() {
                                      draft.classes.remove(c);
                                      _confirmed = false;
                                    }),
                              child: const Text(
                                'Quitar',
                                style: TextStyle(color: Colors.red),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              if (widget.text?.isNotEmpty ?? false)
                ExpansionTile(
                  title: const Text(
                    'Texto detectado del archivo',
                    style: TextStyle(fontSize: 13),
                  ),
                  children: [
                    SizedBox(
                      height: 180,
                      child: SingleChildScrollView(
                        child: SelectableText(
                          widget.text!,
                          style: const TextStyle(fontSize: 11),
                        ),
                      ),
                    ),
                  ],
                ),
              if (draft.pdf != null)
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  value: _keepOriginal,
                  onChanged: _busy
                      ? null
                      : (v) => setState(() => _keepOriginal = v ?? true),
                  title: const Text(
                    'Conservar el archivo original como referencia en este dispositivo',
                    style: TextStyle(fontSize: 13),
                  ),
                ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                value: _confirmed,
                onChanged: _busy
                    ? null
                    : (v) => setState(() => _confirmed = v ?? false),
                title: const Text(
                  'Revisé matrícula, carrera y clases contra mi horario.',
                  style: TextStyle(fontSize: 13),
                ),
              ),
              const Text(
                'Solo en este dispositivo, para tu cuenta. Esta revisión no acredita una inscripción oficial.',
                style: TextStyle(color: fitMuted, fontSize: 11, height: 1.7),
              ),
              if (_error != null) InfoBanner(_error!, error: true),
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: _busy ? null : () => Navigator.pop(context),
        child: const Text('Cancelar'),
      ),
      FilledButton(
        onPressed: _busy ? null : _save,
        child: Text(_busy ? 'Guardando…' : 'Guardar calendario'),
      ),
    ],
  );
}

class ClassEditorDialog extends StatefulWidget {
  final ScheduleClass? current;
  final AppController controller;
  const ClassEditorDialog({super.key, this.current, required this.controller});
  @override
  State<ClassEditorDialog> createState() => _ClassEditorDialogState();
}

class _ClassEditorDialogState extends State<ClassEditorDialog> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _subject,
      _teacher,
      _room,
      _start,
      _end,
      _group;
  int _day = 1;
  String _place = '';
  String? _error;
  @override
  void initState() {
    super.initState();
    final c = widget.current;
    _subject = TextEditingController(text: c?.subject ?? '');
    _teacher = TextEditingController(text: c?.teacher ?? '');
    _room = TextEditingController(text: c?.classroom ?? '');
    _group = TextEditingController(text: c?.group ?? '');
    _start = TextEditingController(text: c?.start ?? '08:00');
    _end = TextEditingController(text: c?.end ?? '09:00');
    _day = c?.day ?? 1;
    _place = widget.controller.places.any((p) => p.id == c?.placeId)
        ? c!.placeId
        : '';
  }

  @override
  void dispose() {
    for (final c in [_subject, _teacher, _room, _start, _end, _group]) {
      c.dispose();
    }
    super.dispose();
  }

  void _save() {
    if (!_form.currentState!.validate()) return;
    final c = ScheduleClass(
      id:
          widget.current?.id ??
          DateTime.now().microsecondsSinceEpoch.toString(),
      subject: _subject.text.trim(),
      teacher: _teacher.text.trim(),
      classroom: _room.text.trim(),
      group: _group.text.trim(),
      day: _day,
      start: _start.text.trim(),
      end: _end.text.trim(),
      placeId: _place,
    );
    if (c.error != null) {
      setState(() => _error = c.error);
      return;
    }
    Navigator.pop(context, c);
  }

  Future<void> _time(TextEditingController control) async {
    final minutes = scheduleMinutes(control.text);
    final chosen = await showTimePicker(
      context: context,
      initialTime: minutes < 0
          ? const TimeOfDay(hour: 8, minute: 0)
          : TimeOfDay(hour: minutes ~/ 60, minute: minutes % 60),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
    if (chosen != null) {
      control.text =
          '${chosen.hour.toString().padLeft(2, '0')}:${chosen.minute.toString().padLeft(2, '0')}';
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.current == null ? 'Agregar clase' : 'Editar clase'),
    content: SizedBox(
      width: 520,
      child: SingleChildScrollView(
        child: Form(
          key: _form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final field in [
                (_subject, 'Materia', 160),
                (_teacher, 'Maestro', 160),
                (_room, 'Salón', 100),
                (_group, 'Grupo', 40),
              ])
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: TextFormField(
                    controller: field.$1,
                    maxLength: field.$3,
                    decoration: InputDecoration(
                      labelText: field.$2,
                      counterText: '',
                    ),
                    validator: (v) =>
                        field.$2 != 'Grupo' && (v?.trim().isEmpty ?? true)
                        ? 'Completa este dato.'
                        : null,
                  ),
                ),
              DropdownButtonFormField<int>(
                initialValue: _day,
                decoration: const InputDecoration(labelText: 'Día'),
                items: List.generate(
                  7,
                  (i) => DropdownMenuItem(
                    value: i + 1,
                    child: Text(scheduleDays[i]),
                  ),
                ),
                onChanged: (v) => setState(() => _day = v ?? 1),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _start,
                      readOnly: true,
                      onTap: () => _time(_start),
                      decoration: const InputDecoration(
                        labelText: 'Entrada (24 h)',
                        suffixIcon: Icon(Icons.schedule),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _end,
                      readOnly: true,
                      onTap: () => _time(_end),
                      decoration: const InputDecoration(
                        labelText: 'Salida (24 h)',
                        suffixIcon: Icon(Icons.schedule),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _place,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Vincular con el directorio (opcional)',
                ),
                items: [
                  const DropdownMenuItem(
                    value: '',
                    child: Text('Sin vincular'),
                  ),
                  for (final p in widget.controller.places)
                    DropdownMenuItem(
                      value: p.id,
                      child: Text(p.name, overflow: TextOverflow.ellipsis),
                    ),
                ],
                onChanged: (v) => setState(() => _place = v ?? ''),
              ),
              const SizedBox(height: 12),
              const Text(
                'Elige el espacio solo si corresponde al salón del PDF. Sus recorridos deben estar verificados.',
                style: TextStyle(color: fitMuted, fontSize: 12, height: 1.7),
              ),
              if (_error != null) InfoBanner(_error!, error: true),
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancelar'),
      ),
      FilledButton(onPressed: _save, child: const Text('Guardar clase')),
    ],
  );
}
