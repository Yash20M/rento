import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// A canned answer for [StubHttpAdapter].
class StubResponse {
  const StubResponse(this.status, [this.body]);

  /// No answer at all (offline, server down): the request fails before any response arrives.
  const StubResponse.networkDown() : status = 0, body = null;

  final int status;

  /// JSON-encodable body, or null for an empty response (e.g. 204).
  final Object? body;
}

/// Captures requests and answers from [handler] — no sockets involved.
class StubHttpAdapter implements HttpClientAdapter {
  StubHttpAdapter(this.handler);

  /// Always answers [status]/[body].
  StubHttpAdapter.constant(int status, [Object? body])
    : handler = ((_) => StubResponse(status, body));

  final StubResponse Function(RequestOptions options) handler;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final answer = handler(options);
    if (answer.status == 0) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'stubbed: network down',
      );
    }
    final text = answer.body == null ? '' : jsonEncode(answer.body);
    return ResponseBody.fromString(
      text,
      answer.status,
      headers: {
        if (answer.body != null)
          Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
