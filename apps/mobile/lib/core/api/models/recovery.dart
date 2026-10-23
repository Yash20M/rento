import 'package:freezed_annotation/freezed_annotation.dart';

part 'recovery.freezed.dart';
part 'recovery.g.dart';

/// `POST /v1/auth/password/forgot` body. The server answers 202 whether or not the address has an account.
@freezed
abstract class ForgotPasswordRequest with _$ForgotPasswordRequest {
  const factory ForgotPasswordRequest({
    @JsonKey(required: true) required String email,
  }) = _ForgotPasswordRequest;

  factory ForgotPasswordRequest.fromJson(Map<String, dynamic> json) =>
      _$ForgotPasswordRequestFromJson(json);
}

/// `POST /v1/auth/password/reset` body. [token] comes from the emailed link.
@freezed
abstract class ResetPasswordRequest with _$ResetPasswordRequest {
  const factory ResetPasswordRequest({
    @JsonKey(required: true) required String token,
    @JsonKey(required: true) required String newPassword,
  }) = _ResetPasswordRequest;

  factory ResetPasswordRequest.fromJson(Map<String, dynamic> json) =>
      _$ResetPasswordRequestFromJson(json);
}

/// `POST /v1/auth/email/verify` body. [token] comes from the emailed link.
@freezed
abstract class VerifyEmailRequest with _$VerifyEmailRequest {
  const factory VerifyEmailRequest({
    @JsonKey(required: true) required String token,
  }) = _VerifyEmailRequest;

  factory VerifyEmailRequest.fromJson(Map<String, dynamic> json) =>
      _$VerifyEmailRequestFromJson(json);
}
