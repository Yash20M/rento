import 'package:freezed_annotation/freezed_annotation.dart';

part 'me.freezed.dart';
part 'me.g.dart';

/// One sign-in method of the signed-in user (`GET /v1/me/identities`). `provider` is `password`, `google`,
/// `facebook` or `apple`.
@freezed
abstract class Identity with _$Identity {
  const factory Identity({
    @JsonKey(required: true) required String provider,
    @JsonKey(required: true) required String? email,
    @JsonKey(required: true) required bool emailVerified,
    @JsonKey(required: true) required DateTime linkedAt,
  }) = _Identity;

  factory Identity.fromJson(Map<String, dynamic> json) =>
      _$IdentityFromJson(json);
}

/// `PATCH /v1/me` body. Send only what changes; the server rejects empty bodies and unknown fields.
@freezed
abstract class UpdateProfileRequest with _$UpdateProfileRequest {
  const factory UpdateProfileRequest({
    @JsonKey(includeIfNull: false) String? name,

    /// E.164, e.g. `+919876543210`.
    @JsonKey(includeIfNull: false) String? phone,

    /// Only while the account has no email; it is attached once the link mailed to it is used.
    @JsonKey(includeIfNull: false) String? email,
  }) = _UpdateProfileRequest;

  factory UpdateProfileRequest.fromJson(Map<String, dynamic> json) =>
      _$UpdateProfileRequestFromJson(json);
}

/// The signed-in user's profile.
@freezed
abstract class Profile with _$Profile {
  const factory Profile({
    @JsonKey(required: true) required String id,
    @JsonKey(required: true) required String? email,
    @JsonKey(required: true) required String? displayName,
    @JsonKey(required: true) required String? phone,
    @JsonKey(required: true) required bool emailVerified,

    /// Profile photo: a path on the API (`/v1/media/<id>`), or null.
    @JsonKey(required: true) required String? avatarUrl,

    /// Fields still to collect: `email` and/or `phone`.
    @JsonKey(required: true) required List<String> needsProfileCompletion,
  }) = _Profile;

  factory Profile.fromJson(Map<String, dynamic> json) =>
      _$ProfileFromJson(json);
}
