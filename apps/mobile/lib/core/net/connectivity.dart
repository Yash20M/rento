import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Whether the API can be reached, learned from the requests the app makes anyway (README §11.4): a failure with no
/// answer at all means offline, any answer from the server means online. No extra plugin, and it is the question that
/// matters — "can I reach Rento?" — rather than "is there a network?".
class OnlineNotifier extends Notifier<bool> {
  @override
  bool build() => true;

  void report(bool online) {
    if (state != online) state = online;
  }
}

final onlineProvider = NotifierProvider<OnlineNotifier, bool>(
  OnlineNotifier.new,
);

bool isUnreachable(DioException error) =>
    error.response == null &&
    switch (error.type) {
      DioExceptionType.connectionError ||
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout => true,
      _ => false,
    };

/// Tells [report] what each request taught us. Answers served from the saved copy teach nothing.
class ReachabilityInterceptor extends Interceptor {
  ReachabilityInterceptor(this.report);

  final void Function(bool online) report;

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    if (response.extra['fromCache'] != true) report(true);
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response != null) {
      report(true); // the server answered, even if with an error
    } else if (isUnreachable(err)) {
      report(false);
    }
    handler.next(err);
  }
}
