import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/schedule.dart';

class ScheduleSubjectsTable extends StatelessWidget {
  final LocalSchedule schedule;
  const ScheduleSubjectsTable({super.key, required this.schedule});
  @override
  Widget build(BuildContext context) {
    final grouped = <String, List<ScheduleClass>>{};
    for (final c in schedule.classes) {
      grouped
          .putIfAbsent(
            jsonEncode([c.group, c.subject, c.classroom, c.teacher]),
            () => [],
          )
          .add(c);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: const WidgetStatePropertyAll(Color(0xFF173442)),
              headingTextStyle: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 11,
              ),
              dataTextStyle: const TextStyle(
                color: Color(0xFF173442),
                fontSize: 12,
              ),
              horizontalMargin: 16,
              columnSpacing: 22,
              dataRowMinHeight: 64,
              dataRowMaxHeight: 150,
              columns: fitScheduleColumns
                  .map((n) => DataColumn(label: Text(n)))
                  .toList(),
              rows: grouped.values.indexed.map((entry) {
                final xs = entry.$2, c = xs.first;
                return DataRow(
                  color: WidgetStatePropertyAll(
                    entry.$1.isEven ? Colors.white : const Color(0xFFF3F7F6),
                  ),
                  cells: [
                    DataCell(Text(c.group.isEmpty ? '—' : c.group)),
                    DataCell(
                      SizedBox(
                        width: 170,
                        child: Text(
                          c.subject,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                    DataCell(Text(c.classroom.isEmpty ? '—' : c.classroom)),
                    ...List.generate(7, (i) {
                      final times =
                          xs
                              .where((x) => x.day == i + 1)
                              .map((x) => '${x.start}–${x.end}')
                              .toSet()
                              .toList()
                            ..sort();
                      return DataCell(
                        Text(
                          times.isEmpty ? '—' : times.join('\n'),
                          style: TextStyle(
                            color: times.isEmpty
                                ? Colors.grey
                                : const Color(0xFF2C6359),
                            height: 1.8,
                          ),
                        ),
                      );
                    }),
                    DataCell(
                      SizedBox(
                        width: 150,
                        child: Text(
                          c.teacher.isEmpty ? 'Por completar' : c.teacher,
                        ),
                      ),
                    ),
                  ],
                );
              }).toList(),
            ),
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 12),
          child: Text(
            'Desliza para ver las 11 columnas. Cada fila conserva su materia, grupo, aula y profesor.',
            style: TextStyle(fontSize: 11, color: Colors.blueGrey),
          ),
        ),
      ],
    );
  }
}
