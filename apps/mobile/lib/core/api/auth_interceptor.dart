import 'dart:async';

import 'package:dio/dio.dart';

import '../auth/session_store.dart';
import 'models/models.dart';

/// Adds the bearer token and, when the server says it expired, refreshes it ONCE (single flight — ADR-012: two
/// simultaneous refreshes of one token would revoke the whole session family) and repeats the request. A refused
/// refresh ends the session.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required this.session,
    required this.dio,
    required Dio refreshDio,
  }) : _refreshDio = refreshDio;

  final SessionStore session;

  /// The client this interceptor is installed on, used to repeat a request after a refresh.
  final Dio dio;
  final Dio _refreshDio;

  Future<bool>? _refreshing;

  static const _noAuthPaths = ['/v1/auth/'];

  bool _isAuthPath(String path) => _noAuthPaths.any(path.startsWith);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = session.accessToken;
    if (token != null && !_isAuthPath(options.path)) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final response = err.response;
    final options = err.requestOptions;
    final expired =
        response?.statusCode == 401 &&
        !_isAuthPath(options.path) &&
        _codeOf(response?.data) == 'TOKEN_EXPIRED';
    if (!expired || options.extra['retried'] == true) {
      return handler.next(err);
    }

    final used = options.headers['Authorization'];
    // Someone else may have refreshed while this request was in flight: just repeat it with the new token.
    final alreadyRefreshed =
        session.accessToken != null && used != 'Bearer ${session.accessToken}';
    if (!alreadyRefreshed && !await _refresh()) return handler.next(err);

    try {
      options.extra['retried'] = true;
      options.headers['Authorization'] = 'Bearer ${session.accessToken}';
      handler.resolve(await dio.fetch<dynamic>(options));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  Future<bool> _refresh() =>
      _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);

  Future<bool> _doRefresh() async {
    final refreshToken = await session.readRefreshToken();
    if (refreshToken == null) return false;
    try {
      final response = await _refreshDio.post<Map<String, dynamic>>(
        '/v1/auth/refresh',
        data: RefreshTokenRequest(refreshToken: refreshToken).toJson(),
      );
      await session.save(AuthResponse.fromJson(response.data!));
      return true;
    } on DioException catch (error) {
      // The server refused the token: the session is over. A network failure keeps it (the request just fails).
      if (error.response != null) await session.clear(forced: true);
      return false;
    }
  }

  String? _codeOf(Object? body) =>
      body is Map<String, dynamic> ? body['code'] as String? : null;
}
