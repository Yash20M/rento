import 'package:freezed_annotation/freezed_annotation.dart';

import 'error_code.dart';

part 'problem_details.freezed.dart';
part 'problem_details.g.dart';

/// One field-level validation error (`errors[]` of a `VALIDATION_FAILED` response).
@freezed
abstract class FieldError with _$FieldError {
  const factory FieldError({
    @JsonKey(required: true) required String field,
    @JsonKey(required: true) required String message,
  }) = _FieldError;

  factory FieldError.fromJson(Map<String, dynamic> json) =>
      _$FieldErrorFromJson(json);
}

/// RFC 9457 `application/problem+json` body (README §14.1). Branch on [code], never on [detail].
@freezed
abstract class ProblemDetails with _$ProblemDetails {
  const factory ProblemDetails({
    @JsonKey(required: true) required String type,
    @JsonKey(required: true) required String title,
    @JsonKey(required: true) required int status,
    @JsonKey(required: true, unknownEnumValue: ErrorCode.unknown)
    required ErrorCode code,
    @JsonKey(required: true) required String detail,
    @JsonKey(includeIfNull: false) List<FieldError>? errors,
    @JsonKey(required: true) required String traceId,
  }) = _ProblemDetails;

  factory ProblemDetails.fromJson(Map<String, dynamic> json) =>
      _$ProblemDetailsFromJson(json);
}
