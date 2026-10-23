import 'package:dio/dio.dart';

import 'models/models.dart';

class HealthApi {
  const HealthApi(this._dio);

  final Dio _dio;

  Future<HealthResponse> healthz() async {
    final response = await _dio.get<Map<String, dynamic>>('/healthz');
    return HealthResponse.fromJson(response.data!);
  }

  /// Throws a [DioException] with status 503 (`RETRY_LATER`) when the API is not ready.
  Future<ReadinessResponse> readyz() async {
    final response = await _dio.get<Map<String, dynamic>>('/readyz');
    return ReadinessResponse.fromJson(response.data!);
  }
}
