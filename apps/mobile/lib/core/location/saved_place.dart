import 'dart:convert';

import 'location_service.dart';

/// The last place the customer searched, as kept on the phone between runs (ADR-016, README §10.6): the coordinates
/// rounded to 2 decimals (~1.1 km) so the copy never pinpoints a home, plus the name of a named place. The exact point
/// stays in memory only. Deleted whenever the session ends.
abstract final class SavedPlace {
  static const String storageKey = 'last_place';

  /// 2 decimals ≈ 1.1 km of latitude.
  static double coarse(double degrees) => (degrees * 100).roundToDouble() / 100;

  static String encode(GeoPoint point, {String? name}) => jsonEncode({
    'latitude': coarse(point.latitude),
    'longitude': coarse(point.longitude),
    if (name != null) 'name': name,
  });

  /// `null` for anything that is not a well-formed place (old format, edited by hand, cut short).
  static ({GeoPoint point, String? name})? decode(String? raw) {
    if (raw == null) return null;
    final Object? json;
    try {
      json = jsonDecode(raw);
    } on FormatException {
      return null;
    }
    if (json is! Map) return null;
    final latitude = json['latitude'];
    final longitude = json['longitude'];
    final name = json['name'];
    if (latitude is! num || longitude is! num) return null;
    if (latitude.abs() > 90 || longitude.abs() > 180) return null;
    if (name != null && name is! String) return null;
    return (
      point: GeoPoint(
        latitude: latitude.toDouble(),
        longitude: longitude.toDouble(),
      ),
      name: name as String?,
    );
  }
}
