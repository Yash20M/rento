import 'package:freezed_annotation/freezed_annotation.dart';

part 'kyc.freezed.dart';
part 'kyc.g.dart';

/// The customer's identity-verification state (`KycStatusDto`). Only the last four Aadhaar digits are ever shown.
@freezed
abstract class KycStatus with _$KycStatus {
  const factory KycStatus({
    /// Whether this deployment requires verification before booking.
    @JsonKey(required: true) required bool required,

    /// `none`, `pending`, `verified` or `rejected`.
    @JsonKey(required: true) required String status,

    /// `XXXX XXXX 1234`.
    @JsonKey(required: true) required String? maskedAadhaar,
    @JsonKey(required: true) required DateTime? verifiedAt,
    @JsonKey(required: true) required String? verifiedName,

    /// Why staff declined it.
    @JsonKey(required: true) required String? reason,
  }) = _KycStatus;

  factory KycStatus.fromJson(Map<String, dynamic> json) =>
      _$KycStatusFromJson(json);
}

/// `POST /v1/me/kyc/aadhaar` body. The number is sent once to the verification service and is not stored.
@freezed
abstract class StartAadhaarRequest with _$StartAadhaarRequest {
  const factory StartAadhaarRequest({
    @JsonKey(required: true) required String aadhaarNumber,
  }) = _StartAadhaarRequest;

  factory StartAadhaarRequest.fromJson(Map<String, dynamic> json) =>
      _$StartAadhaarRequestFromJson(json);
}

/// A code was sent to the phone linked to the Aadhaar (`AadhaarRequestDto`).
@freezed
abstract class AadhaarRequest with _$AadhaarRequest {
  const factory AadhaarRequest({
    @JsonKey(required: true) required String requestId,
    @JsonKey(required: true) required DateTime expiresAt,
    @JsonKey(required: true) required String maskedAadhaar,
  }) = _AadhaarRequest;

  factory AadhaarRequest.fromJson(Map<String, dynamic> json) =>
      _$AadhaarRequestFromJson(json);
}

/// `POST /v1/me/kyc/aadhaar/verify` body (`VerifyAadhaarDto`).
@freezed
abstract class VerifyAadhaarRequest with _$VerifyAadhaarRequest {
  const factory VerifyAadhaarRequest({
    @JsonKey(required: true) required String requestId,
    @JsonKey(required: true) required String otp,
  }) = _VerifyAadhaarRequest;

  factory VerifyAadhaarRequest.fromJson(Map<String, dynamic> json) =>
      _$VerifyAadhaarRequestFromJson(json);
}
