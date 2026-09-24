import 'package:flutter_test/flutter_test.dart';
import 'package:guia_fit/models/campus.dart';

void main() {
  test('admite nombres completos en español y rechaza datos vacíos', () {
    expect(validateName('José Amando Martínez Hernández'), isNull);
    expect(validateName(''), isNotNull);
    expect(validateName('A\u0000B'), isNotNull);
    expect(validateEmail('alumno@example.test'), isNull);
    expect(validateEmail('correo inválido'), isNotNull);
    expect(validatePassword('corta'), isNotNull);
  });
  test('el recorrido requiere todos los puntos y tramos verificados', () {
    final points = ['a', 'b', 'c']
        .map((id) => Place.fromJson({'id': id, 'name': id, 'verified': true}))
        .toList();
    final edges = [
      RouteEdge.fromJson({
        'id': 'ab',
        'from_id': 'a',
        'to_id': 'b',
        'instruction': 'Primer tramo',
        'verified': true,
        'accessible': true,
      }),
      RouteEdge.fromJson({
        'id': 'bc',
        'from_id': 'b',
        'to_id': 'c',
        'instruction': 'Segundo tramo',
        'verified': true,
        'accessible': false,
      }),
    ];
    expect(findRoute(points, edges, 'a', 'c')!.length, 2);
    expect(findRoute(points, edges, 'a', 'c', accessible: true), isNull);
    expect(findRoute(points, edges, 'c', 'a'), isNull);
    expect(findRoute(points, edges, 'a', 'a'), isEmpty);
    points[1] = Place.fromJson({'id': 'b', 'name': 'b', 'verified': false});
    expect(findRoute(points, edges, 'a', 'c'), isNull);
    expect(findRoute(points, edges, 'a', 'c', demo: true)!.length, 2);
  });
  test('la búsqueda normaliza tildes y mayúsculas', () {
    expect(normalize(' CAFETERÍA '), 'cafeteria');
  });
}
