import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../app/config/env.dart';
import '../auth/session_store.dart';
import '../cache/read_cache.dart';
import '../net/connectivity.dart';
import '../net/retry_interceptor.dart';
import 'auth_interceptor.dart';

/// Pauses before the 1st and 2nd repeat of a failed GET.
const defaultRetryDelays = [
  Duration(milliseconds: 400),
  Duration(milliseconds: 1200),
];

/// The HTTP client: base URL, timeouts, headers and — when a [session] is given — the bearer token with single-flight
/// refresh ([AuthInterceptor]). Errors surface as [DioException]; the typed API classes convert them to `ApiException`
/// in one place (`guardApi`). [adapter] lets tests replace the network.
Dio buildDio(
  AppEnv env, {
  SessionStore? session,
  HttpClientAdapter? adapter,
  bool enableLogging = kDebugMode,
  ReadCache? cache,
  void Function(bool online)? onReachability,
  List<Duration> retryDelays = const [],
}) {
  BaseOptions options() => BaseOptions(
    baseUrl: env.apiBaseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 20),
    sendTimeout: const Duration(seconds: 20),
    headers: {'Accept': 'application/json'},
  );

  final dio = Dio(options());
  if (adapter != null) dio.httpClientAdapter = adapter;

  if (session != null) {
    // Refreshing must not go through the interceptor that triggers it.
    final refreshDio = Dio(options());
    if (adapter != null) refreshDio.httpClientAdapter = adapter;
    dio.interceptors.add(
      AuthInterceptor(session: session, dio: dio, refreshDio: refreshDio),
    );
  }

  // Order matters: the first interceptor sees a failure first. Reachability notes it, Retry repeats GETs, and only
  // when that is exhausted does the saved copy (Cache) stand in.
  if (onReachability != null) {
    dio.interceptors.add(ReachabilityInterceptor(onReachability));
  }
  if (retryDelays.isNotEmpty) {
    dio.interceptors.add(RetryInterceptor(dio: dio, delays: retryDelays));
  }
  if (cache != null) dio.interceptors.add(CacheInterceptor(cache));

  if (enableLogging) {
    // Method + URL + status only. Headers and bodies are never logged: they carry tokens and credentials.
    dio.interceptors.add(
      LogInterceptor(
        requestHeader: false,
        requestBody: false,
        responseHeader: false,
        responseBody: false,
        logPrint: (object) => debugPrint(object.toString()),
      ),
    );
  }
  return dio;
}
