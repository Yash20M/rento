import 'package:freezed_annotation/freezed_annotation.dart';

part 'health.freezed.dart';
part 'health.g.dart';

/// `GET /healthz` — `status` is always `ok`.
@freezed
abstract class HealthResponse with _$HealthResponse {
  const factory HealthResponse({
    @JsonKey(required: true) required String status,
  }) = _HealthResponse;

  factory HealthResponse.fromJson(Map<String, dynamic> json) =>
      _$HealthResponseFromJson(json);
}

@freezed
abstract class ReadinessChecks with _$ReadinessChecks {
  const factory ReadinessChecks({
    @JsonKey(required: true) required String database,
  }) = _ReadinessChecks;

  factory ReadinessChecks.fromJson(Map<String, dynamic> json) =>
      _$ReadinessChecksFromJson(json);
}

/// `GET /readyz` — `status` is always `ready`; a 503 problem+json is returned when not ready.
@freezed
abstract class ReadinessResponse with _$ReadinessResponse {
  const factory ReadinessResponse({
    @JsonKey(required: true) required String status,
    @JsonKey(required: true) required ReadinessChecks checks,
  }) = _ReadinessResponse;

  factory ReadinessResponse.fromJson(Map<String, dynamic> json) =>
      _$ReadinessResponseFromJson(json);
}
