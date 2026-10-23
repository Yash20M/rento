import 'dart:typed_data';

import 'package:dio/dio.dart';

import 'models/models.dart';

/// Typed wrappers for the signed-in user's own account endpoints. Errors surface as [DioException]; P3-11 maps the
/// problem+json body to typed app errors in one place.
class MeApi {
  const MeApi(this._dio);

  final Dio _dio;

  Future<List<Identity>> identities() async {
    final response = await _dio.get<List<dynamic>>('/v1/me/identities');
    return _identities(response.data!);
  }

  /// Links Google. 401 `TOKEN_EXPIRED` = the session is too old for this: refresh it and retry. 409
  /// `IDENTITY_IN_USE` = that Google account belongs to someone else (or you already linked one).
  Future<List<Identity>> linkGoogle(GoogleLoginRequest request) =>
      _link('google', request.toJson());

  Future<List<Identity>> linkFacebook(FacebookLoginRequest request) =>
      _link('facebook', request.toJson());

  Future<List<Identity>> linkApple(AppleLoginRequest request) =>
      _link('apple', request.toJson());

  /// 409 `LAST_LOGIN_METHOD` when it is the only sign-in method left; 404 when it is not linked.
  Future<void> unlink(String provider) async {
    await _dio.delete<void>('/v1/me/identities/$provider');
  }

  Future<Profile> profile() async {
    final response = await _dio.get<Map<String, dynamic>>('/v1/me');
    return Profile.fromJson(response.data!);
  }

  /// Deletes the account. 401 = wrong password; 409 `HAS_FUTURE_BOOKINGS` = a booking is still live.
  Future<void> deleteAccount({String? password}) async {
    await _dio.delete<void>(
      '/v1/me',
      data: {if (password != null) 'password': password},
    );
  }

  /// Sets the profile photo (raw image body). 422 = not a JPEG/PNG/WebP image, empty or over 2 MB.
  Future<Profile> uploadAvatar(Uint8List bytes, String contentType) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/me/avatar',
      data: Stream.fromIterable([bytes]),
      options: Options(
        contentType: contentType,
        headers: {Headers.contentLengthHeader: bytes.length},
      ),
    );
    return Profile.fromJson(response.data!);
  }

  Future<Profile> removeAvatar() async {
    final response = await _dio.delete<Map<String, dynamic>>('/v1/me/avatar');
    return Profile.fromJson(response.data!);
  }

  Future<Profile> updateProfile(UpdateProfileRequest request) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/v1/me',
      data: request.toJson(),
    );
    return Profile.fromJson(response.data!);
  }

  Future<List<Identity>> _link(
    String provider,
    Map<String, dynamic> body,
  ) async {
    final response = await _dio.post<List<dynamic>>(
      '/v1/me/identities/$provider',
      data: body,
    );
    return _identities(response.data!);
  }

  List<Identity> _identities(List<dynamic> json) => [
    for (final item in json) Identity.fromJson(item as Map<String, dynamic>),
  ];
}
