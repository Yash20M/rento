import 'package:dio/dio.dart';

import 'models/models.dart';

/// A failed API call, reduced to what screens need: the stable [code] (README §14.2 — branch on this, never on the
/// text), the HTTP [status] and per-field messages. [isNetwork] is true when no response arrived at all.
class ApiException implements Exception {
  const ApiException({
    required this.code,
    this.status,
    this.detail = '',
    this.fields = const {},
    this.isNetwork = false,
  });

  final ErrorCode code;
  final int? status;

  /// Server text for logs and developers; never shown to customers as is.
  final String detail;

  /// `field → message` from a `VALIDATION_FAILED` response (first message per field).
  final Map<String, String> fields;
  final bool isNetwork;

  /// Turns whatever dio threw into an [ApiException]; anything else is passed on unchanged by the caller.
  factory ApiException.fromDio(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiException(
        code: ErrorCode.unknown,
        isNetwork: true,
        detail: error.message ?? 'No response',
      );
    }
    final data = response.data;
    if (data is Map<String, dynamic>) {
      try {
        final problem = ProblemDetails.fromJson(data);
        final fields = <String, String>{};
        for (final entry in problem.errors ?? const <FieldError>[]) {
          fields.putIfAbsent(entry.field, () => entry.message);
        }
        return ApiException(
          code: problem.code,
          status: response.statusCode,
          detail: problem.detail,
          fields: fields,
        );
      } catch (_) {
        // Not a problem document: fall through to the status-only error.
      }
    }
    return ApiException(
      code: ErrorCode.unknown,
      status: response.statusCode,
      detail: 'HTTP ${response.statusCode}',
    );
  }

  @override
  String toString() => 'ApiException(${code.name}, status: $status)';
}

/// Runs [call] and converts a [DioException] into an [ApiException].
Future<T> guardApi<T>(Future<T> Function() call) async {
  try {
    return await call();
  } on DioException catch (error) {
    final inner = error.error;
    if (inner is ApiException) throw inner;
    throw ApiException.fromDio(error);
  }
}
