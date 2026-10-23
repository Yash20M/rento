import 'package:dio/dio.dart';

import 'models/models.dart';

/// Typed wrappers for the auth endpoints. Errors surface as [DioException]; P3-11 maps the problem+json body
/// (see [ProblemDetails]) to typed app errors in one place.
class AuthApi {
  const AuthApi(this._dio);

  final Dio _dio;

  Future<AuthResponse> register(RegisterRequest request) =>
      _post('/v1/auth/register', request.toJson());

  Future<AuthResponse> login(LoginRequest request) =>
      _post('/v1/auth/login', request.toJson());

  Future<AuthResponse> refresh(RefreshTokenRequest request) =>
      _post('/v1/auth/refresh', request.toJson());

  /// Idempotent: the server answers 204 even for unknown tokens.
  Future<void> logout(RefreshTokenRequest request) async {
    await _dio.post<void>('/v1/auth/logout', data: request.toJson());
  }

  /// Always completes normally (202) for a well-formed email, whether or not an account exists.
  Future<void> forgotPassword(ForgotPasswordRequest request) async {
    await _dio.post<void>('/v1/auth/password/forgot', data: request.toJson());
  }

  /// 204 on success; every session of the account is signed out. A bad link or weak password is a 422.
  Future<void> resetPassword(ResetPasswordRequest request) async {
    await _dio.post<void>('/v1/auth/password/reset', data: request.toJson());
  }

  Future<void> verifyEmail(VerifyEmailRequest request) async {
    await _dio.post<void>('/v1/auth/email/verify', data: request.toJson());
  }

  /// Requires a signed-in user; the server throttles to one mail per minute and no-ops when already verified.
  Future<void> resendVerification() async {
    await _dio.post<void>('/v1/auth/email/verification/resend');
  }

  /// Social sign-in. 401 `SOCIAL_TOKEN_INVALID` = token rejected; 409 `ACCOUNT_LINK_REQUIRED` = the email belongs to an
  /// existing account (sign in the usual way, then link from the profile); 404 = the provider is not enabled.
  Future<SocialAuthResponse> signInWithGoogle(GoogleLoginRequest request) =>
      _social('/v1/auth/social/google', request.toJson());

  Future<SocialAuthResponse> signInWithFacebook(FacebookLoginRequest request) =>
      _social('/v1/auth/social/facebook', request.toJson());

  Future<SocialAuthResponse> signInWithApple(AppleLoginRequest request) =>
      _social('/v1/auth/social/apple', request.toJson());

  Future<SocialAuthResponse> _social(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await _dio.post<Map<String, dynamic>>(path, data: body);
    return SocialAuthResponse.fromJson(response.data!);
  }

  Future<AuthResponse> _post(String path, Map<String, dynamic> body) async {
    final response = await _dio.post<Map<String, dynamic>>(path, data: body);
    return AuthResponse.fromJson(response.data!);
  }
}
