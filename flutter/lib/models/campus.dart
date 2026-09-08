import 'dart:collection';

class Place {
  final String id, name, code, category, building, floor, description, source;
  final String? photoUrl, sourceDate;
  final double? x, y;
  final bool verified;
  Place.fromJson(Map<String, dynamic> json)
    : id = json['id'] as String,
      name = json['name'] as String,
      code = json['code'] as String? ?? '',
      category = json['category'] as String? ?? 'Otro',
      building = json['building'] as String? ?? '',
      floor = json['floor'] as String? ?? '',
      description = json['description'] as String? ?? '',
      source = json['source'] as String? ?? '',
      photoUrl = json['photo_url'] as String?,
      sourceDate = json['source_date'] as String?,
      x = (json['x'] as num?)?.toDouble(),
      y = (json['y'] as num?)?.toDouble(),
      verified = json['verified'] == true;
  String? get safePhoto {
    final uri = Uri.tryParse(photoUrl ?? '');
    return uri != null &&
            (uri.scheme == 'https' ||
                (uri.scheme == 'http' &&
                    ['localhost', '127.0.0.1'].contains(uri.host)))
        ? photoUrl
        : null;
  }
}

class RouteEdge {
  final String id, fromId, toId, instruction;
  final bool verified, accessible;
  RouteEdge.fromJson(Map<String, dynamic> json)
    : id = json['id'] as String,
      fromId = json['from_id'] as String,
      toId = json['to_id'] as String,
      instruction = json['instruction'] as String,
      verified = json['verified'] == true,
      accessible = json['accessible'] == true;
}

/// Busca un recorrido dirigido solo entre puntos y tramos comprobados.
/// Devuelve null si no existe y [] si el origen y el destino coinciden.
List<RouteEdge>? findRoute(
  List<Place> places,
  List<RouteEdge> edges,
  String origin,
  String destination, {
  bool accessible = false,
  bool demo = false,
}) {
  final nodes = {for (final place in places) place.id: place};
  if (!nodes.containsKey(origin) || !nodes.containsKey(destination)) {
    return null;
  }
  if (origin == destination) return [];
  if (!demo && (!nodes[origin]!.verified || !nodes[destination]!.verified)) {
    return null;
  }
  final queue = Queue<String>()..add(origin);
  final seen = {origin};
  final previous = <String, RouteEdge>{};
  while (queue.isNotEmpty) {
    final current = queue.removeFirst();
    for (final edge in edges) {
      if (edge.fromId != current || !nodes.containsKey(edge.toId)) continue;
      if (!demo && (!edge.verified || !nodes[edge.toId]!.verified)) continue;
      if (accessible && !edge.accessible) continue;
      if (!seen.add(edge.toId)) continue;
      previous[edge.toId] = edge;
      if (edge.toId == destination) {
        final result = <RouteEdge>[];
        var at = destination;
        while (at != origin) {
          final step = previous[at]!;
          result.insert(0, step);
          at = step.fromId;
        }
        return result;
      }
      queue.add(edge.toId);
    }
  }
  return null;
}

String normalize(String value) {
  const source = 'áéíóúüñ';
  const target = 'aeiouun';
  var result = value.toLowerCase().trim();
  for (var i = 0; i < source.length; i++) {
    result = result.replaceAll(source[i], target[i]);
  }
  return result;
}

String? validateName(String? value) {
  final name = (value ?? '').trim();
  return name.length < 2 ||
          name.length > 100 ||
          RegExp(r'[\x00-\x1f]').hasMatch(name)
      ? 'Escribe tu nombre completo (2 a 100 caracteres).'
      : null;
}

String? validateEmail(String? value) =>
    RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch((value ?? '').trim())
    ? null
    : 'Escribe un correo válido.';
String? validatePassword(String? value) =>
    (value ?? '').length < 12 || (value ?? '').length > 128
    ? 'Usa entre 12 y 128 caracteres.'
    : null;
