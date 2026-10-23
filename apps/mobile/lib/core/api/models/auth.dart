import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth.freezed.dart';
part 'auth.g.dart';

/// `POST /v1/auth/register` body.
@freezed
abstract class RegisterRequest with _$RegisterRequest {
  const factory RegisterRequest({
    @JsonKey(required: true) required String email,
    @JsonKey(required: true) required String password,
    @JsonKey(required: true) required String name,

    /// E.164, e.g. `+919876543210`. Omitted from the JSON when null.
    @JsonKey(includeIfNull: false) String? phone,
  }) = _RegisterRequest;

  factory RegisterRequest.fromJson(Map<String, dynamic> json) =>
      _$RegisterRequestFromJson(json);
}

/// `POST /v1/auth/login` body.
@freezed
abstract class LoginRequest with _$LoginRequest {
  const factory LoginRequest({
    @JsonKey(required: true) required String email,
    @JsonKey(required: true) required String password,
  }) = _LoginRequest;

  factory LoginRequest.fromJson(Map<String, dynamic> json) =>
      _$LoginRequestFromJson(json);
}

/// `POST /v1/auth/refresh` and `/logout` body.
@freezed
abstract class RefreshTokenRequest with _$RefreshTokenRequest {
  const factory RefreshTokenRequest({
    @JsonKey(required: true) required String refreshToken,
  }) = _RefreshTokenRequest;

  factory RefreshTokenRequest.fromJson(Map<String, dynamic> json) =>
      _$RefreshTokenRequestFromJson(json);
}

@freezed
abstract class UserSummary with _$UserSummary {
  const factory UserSummary({
    @JsonKey(required: true) required String id,

    /// Null when the account has no email (e.g. a social login that withheld it).
    @JsonKey(required: true) required String? email,
    @JsonKey(required: true) required String? displayName,
    @JsonKey(required: true) required bool emailVerified,

    /// Profile photo: a path on the API (`/v1/media/<id>`), or null.
    @JsonKey(required: true) required String? avatarUrl,
  }) = _UserSummary;

  factory UserSummary.fromJson(Map<String, dynamic> json) =>
      _$UserSummaryFromJson(json);
}

/// Response of register / login / refresh.
@freezed
abstract class AuthResponse with _$AuthResponse {
  const factory AuthResponse({
    @JsonKey(required: true) required String accessToken,
    @JsonKey(required: true) required String refreshToken,

    /// Always `Bearer`.
    @JsonKey(required: true) required String tokenType,

    /// Access-token lifetime in seconds.
    @JsonKey(required: true) required int expiresIn,
    @JsonKey(required: true) required UserSummary user,
  }) = _AuthResponse;

  factory AuthResponse.fromJson(Map<String, dynamic> json) =>
      _$AuthResponseFromJson(json);
}
