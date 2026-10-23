import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth.dart';

part 'social.freezed.dart';
part 'social.g.dart';

/// `POST /v1/auth/social/google` body.
@freezed
abstract class GoogleLoginRequest with _$GoogleLoginRequest {
  const factory GoogleLoginRequest({
    @JsonKey(required: true) required String idToken,
  }) = _GoogleLoginRequest;

  factory GoogleLoginRequest.fromJson(Map<String, dynamic> json) =>
      _$GoogleLoginRequestFromJson(json);
}

/// `POST /v1/auth/social/facebook` body: [accessToken] (Classic Login) **or** [authenticationToken] + [nonce]
/// (iOS Limited Login). The server rejects any other combination with a 422.
@freezed
abstract class FacebookLoginRequest with _$FacebookLoginRequest {
  const factory FacebookLoginRequest({
    @JsonKey(includeIfNull: false) String? accessToken,
    @JsonKey(includeIfNull: false) String? authenticationToken,
    @JsonKey(includeIfNull: false) String? nonce,
  }) = _FacebookLoginRequest;

  factory FacebookLoginRequest.fromJson(Map<String, dynamic> json) =>
      _$FacebookLoginRequestFromJson(json);
}

/// `POST /v1/auth/social/apple` body.
@freezed
abstract class AppleLoginRequest with _$AppleLoginRequest {
  const factory AppleLoginRequest({
    @JsonKey(required: true) required String identityToken,
    @JsonKey(required: true) required String nonce,

    /// Apple only delivers the name on the first sign-in; forward it then.
    @JsonKey(includeIfNull: false) String? fullName,
  }) = _AppleLoginRequest;

  factory AppleLoginRequest.fromJson(Map<String, dynamic> json) =>
      _$AppleLoginRequestFromJson(json);
}

/// Response of every social sign-in: a normal session plus what the profile still lacks.
@freezed
abstract class SocialAuthResponse with _$SocialAuthResponse {
  const factory SocialAuthResponse({
    @JsonKey(required: true) required String accessToken,
    @JsonKey(required: true) required String refreshToken,
    @JsonKey(required: true) required String tokenType,
    @JsonKey(required: true) required int expiresIn,
    @JsonKey(required: true) required UserSummary user,

    /// Profile fields to collect next: `email` and/or `phone`. Empty when the profile is complete.
    @JsonKey(required: true) required List<String> needsProfileCompletion,
  }) = _SocialAuthResponse;

  factory SocialAuthResponse.fromJson(Map<String, dynamic> json) =>
      _$SocialAuthResponseFromJson(json);
}
