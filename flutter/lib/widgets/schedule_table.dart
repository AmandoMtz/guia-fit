import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../models/schedule.dart';
import 'common.dart';

class ScheduleTable extends StatefulWidget {
  final LocalSchedule schedule;
  final DateTime monday;
  final void Function(String) onPlace, onEdit;
  const ScheduleTable({
    super.key,
    required this.schedule,
    required this.monday,
    required this.onPlace,
    required this.onEdit,
  });
  @override
  State<ScheduleTable> createState() => _ScheduleTableState();
}

class _ScheduleTableState extends State<ScheduleTable> {
  final _scroll = ScrollController();
  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final classes = widget.schedule.classes,
        conflicts = scheduleConflicts(classes);
    final days = [
      1,
      2,
      3,
      4,
      5,
      ...[6, 7].where((d) => classes.any((x) => x.day == d)),
    ];
    final slots = classes.map((x) => '${x.start}|${x.end}').toSet().toList()
      ..sort((a, b) {
        final n =
            scheduleMinutes(a.split('|')[0]) - scheduleMinutes(b.split('|')[0]);
        return n == 0
            ? scheduleMinutes(a.split('|')[1]) -
                  scheduleMinutes(b.split('|')[1])
            : n;
      });
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LayoutBuilder(
          builder: (context, box) => Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFDDE6E7)),
            ),
            clipBehavior: Clip.antiAlias,
            child: Scrollbar(
              controller: _scroll,
              thumbVisibility: true,
              child: SingleChildScrollView(
                controller: _scroll,
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.only(bottom: 12),
                child: SizedBox(
                  width: math.max(box.maxWidth, 80 + days.length * 152),
                  child: Table(
                    columnWidths: const {0: FixedColumnWidth(80)},
                    defaultVerticalAlignment: TableCellVerticalAlignment.top,
                    border: const TableBorder(
                      horizontalInside: BorderSide(color: Color(0xFFE4ECEE)),
                      verticalInside: BorderSide(color: Color(0xFFEDF1F2)),
                    ),
                    children: [
                      TableRow(
                        decoration: const BoxDecoration(
                          color: Color(0xFFF0F5F3),
                        ),
                        children: [
                          const Padding(
                            padding: EdgeInsets.symmetric(
                              vertical: 32,
                              horizontal: 6,
                            ),
                            child: Text(
                              'HORARIO',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 10,
                                letterSpacing: 1,
                                color: fitMuted,
                              ),
                            ),
                          ),
                          for (final day in days) _heading(day),
                        ],
                      ),
                      for (final slot in slots)
                        TableRow(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                vertical: 24,
                                horizontal: 8,
                              ),
                              child: Column(
                                children: [
                                  Text(
                                    slot.split('|')[0],
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const Text(
                                    'a',
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: fitMuted,
                                    ),
                                  ),
                                  Text(
                                    slot.split('|')[1],
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            for (final day in days)
                              Padding(
                                padding: const EdgeInsets.all(8),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    if (!classes.any(
                                      (x) =>
                                          x.day == day &&
                                          '${x.start}|${x.end}' == slot,
                                    ))
                                      const SizedBox(
                                        height: 100,
                                        child: Center(
                                          child: Text(
                                            '—',
                                            style: TextStyle(
                                              color: Color(0xFFCAD9DF),
                                            ),
                                          ),
                                        ),
                                      ),
                                    for (final item in classes.where(
                                      (x) =>
                                          x.day == day &&
                                          '${x.start}|${x.end}' == slot,
                                    ))
                                      _cell(
                                        item,
                                        classes.indexOf(item),
                                        conflicts.contains(item.id),
                                      ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'Desliza la tabla para consultar todos los días.',
          style: TextStyle(fontSize: 11, color: fitMuted),
        ),
      ],
    );
  }

  Widget _heading(int day) {
    final date = widget.monday.add(Duration(days: day - 1)),
        now = DateTime.now();
    final today =
        date.year == now.year && date.month == now.month && date.day == now.day;
    return Container(
      color: today ? fitNavy : null,
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 8),
      child: Column(
        children: [
          Text(
            scheduleDays[day - 1].toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              letterSpacing: 1,
              color: today ? Colors.white : fitMuted,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            '${date.day}',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w600,
              color: today ? Colors.white : fitNavy,
            ),
          ),
        ],
      ),
    );
  }

  Widget _cell(ScheduleClass c, int index, bool conflict) {
    const colors = [
      Color(0xFFFFF3E3),
      Color(0xFFEBF4EE),
      Color(0xFFEDF1FA),
      Color(0xFFFAECE6),
    ];
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors[index % 4],
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            c.subject,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 9),
          Text(
            c.teacher,
            style: const TextStyle(fontSize: 11, color: fitMuted, height: 1.6),
          ),
          const SizedBox(height: 12),
          Text(
            'Grupo: ${c.group.isEmpty ? '—' : c.group}\nSalón: ${c.classroom}',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              height: 1.8,
            ),
          ),
          if (conflict)
            const Text(
              'Cruce de horario',
              style: TextStyle(fontSize: 10, color: Colors.red),
            ),
          TextButton(
            onPressed: () => widget.onEdit(c.id),
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: const Size(40, 30),
            ),
            child: const Text('Editar', style: TextStyle(fontSize: 11)),
          ),
          if (c.placeId.isNotEmpty)
            TextButton(
              onPressed: () => widget.onPlace(c.placeId),
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: const Size(40, 30),
              ),
              child: const Text('Cómo llegar', style: TextStyle(fontSize: 11)),
            ),
        ],
      ),
    );
  }
}
