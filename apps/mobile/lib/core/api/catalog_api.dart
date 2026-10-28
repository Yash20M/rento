import 'package:dio/dio.dart';

import 'api_exception.dart';
import 'models/models.dart';

/// Browse what can be rented and where (public endpoints; no sign-in needed). Everything here is a SNAPSHOT: the
/// booking request decides (README §9.7).
class CatalogApi {
  const CatalogApi(this._dio);

  final Dio _dio;

  /// Drawers near the point, nearest first. 422 `OUTSIDE_SERVICE_AREA` when there is none. The coordinates are used
  /// for this one request and are never stored.
  Future<NearbyResponse> nearby(NearbyRequest request) => guardApi(() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/drawers/nearby',
      data: request.toJson(),
    );
    return NearbyResponse.fromJson(response.data!);
  });

  Future<List<PublicDrawer>> drawers() => guardApi(() async {
    final response = await _dio.get<List<dynamic>>('/v1/drawers');
    return [
      for (final item in response.data!)
        PublicDrawer.fromJson(item as Map<String, dynamic>),
    ];
  });

  /// The banners of the home screen that are live right now (public).
  Future<List<PublicPromotion>> promotions() => guardApi(() async {
    final response = await _dio.get<List<dynamic>>('/v1/promotions');
    return [
      for (final item in response.data!)
        PublicPromotion.fromJson(item as Map<String, dynamic>),
    ];
  });

  Future<List<InventoryEntry>> inventory(String drawerId) => guardApi(() async {
    final response = await _dio.get<List<dynamic>>(
      '/v1/drawers/$drawerId/inventory',
    );
    return [
      for (final item in response.data!)
        InventoryEntry.fromJson(item as Map<String, dynamic>),
    ];
  });

  /// The slot grid of one local day (`date` = `YYYY-MM-DD` in the drawer's zone), up to 90 days ahead.
  Future<Availability> availability({
    required String drawerId,
    required String itemModelId,
    required String date,
  }) => guardApi(() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/v1/drawers/$drawerId/items/$itemModelId/availability',
      queryParameters: {'date': date},
    );
    return Availability.fromJson(response.data!);
  });
}
