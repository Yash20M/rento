import 'package:dio/dio.dart';

import 'connectivity.dart';

/// Repeats a failed GET a couple of times with growing pauses (README §11.4: "auto-retry only idempotent GETs").
/// Nothing else is ever repeated here: a POST/PATCH/DELETE could act twice. (A booking retry is the screen's job and
/// always reuses its Idempotency-Key.) Only "no answer" and 502/503/504 are retried; a 4xx is the server's decision.
class RetryInterceptor extends Interceptor {
  RetryInterceptor({required this.dio, required this.delays});

  final Dio dio;
  final List<Duration> delays;

  static bool _retryable(DioException error) {
    final status = error.response?.statusCode;
    return isUnreachable(error) ||
        status == 502 ||
        status == 503 ||
        status == 504;
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final options = err.requestOptions;
    final done = (options.extra['retries'] as int?) ?? 0;
    if (options.method != 'GET' || done >= delays.length || !_retryable(err)) {
      return handler.next(err);
    }
    await Future<void>.delayed(delays[done]);
    options.extra['retries'] = done + 1;
    try {
      handler.resolve(await dio.fetch<dynamic>(options));
    } on DioException catch (error) {
      handler.next(error);
    }
  }
}
