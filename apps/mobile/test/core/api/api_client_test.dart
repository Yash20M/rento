import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/app/config/env.dart';
import 'package:rento_mobile/core/api/api_client.dart';

/// Captures requests and answers with a canned response — no sockets involved.
class _StubAdapter implements HttpClientAdapter {
  _StubAdapter({this.status = 200, this.body = '{"status":"ok"}'});

  final int status;
  final String body;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      body,
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

const _env = AppEnv(flavor: Flavor.dev, apiBaseUrl: 'http://10.0.2.2:3000');

void main() {
  test('H-01 buildDio configures base URL, timeouts and Accept header', () {
    final dio = buildDio(_env, enableLogging: false);

    expect(dio.options.baseUrl, 'http://10.0.2.2:3000');
    expect(dio.options.connectTimeout, const Duration(seconds: 10));
    expect(dio.options.receiveTimeout, const Duration(seconds: 20));
    expect(dio.options.sendTimeout, const Duration(seconds: 20));
    expect(dio.options.headers['Accept'], 'application/json');
  });

  test('H-02 requests go to the configured origin', () async {
    final stub = _StubAdapter();
    final dio = buildDio(_env, enableLogging: false)..httpClientAdapter = stub;

    final response = await dio.get<dynamic>('/healthz');

    expect(stub.requests.single.uri.toString(), 'http://10.0.2.2:3000/healthz');
    expect(stub.requests.single.headers['Accept'], 'application/json');
    expect(jsonEncode(response.data), '{"status":"ok"}');
  });

  test(
    'H-03 non-2xx responses surface as DioException (for P3-11 error mapping)',
    () async {
      final stub = _StubAdapter(
        status: 503,
        body: '{"code":"RETRY_LATER","status":503}',
      );
      final dio = buildDio(_env, enableLogging: false)
        ..httpClientAdapter = stub;

      await expectLater(
        dio.get<dynamic>('/readyz'),
        throwsA(
          isA<DioException>()
              .having((e) => e.type, 'type', DioExceptionType.badResponse)
              .having((e) => e.response?.statusCode, 'status', 503),
        ),
      );
    },
  );

  test('H-04 debug logging never includes headers or bodies (tokens)', () {
    final logged =
        buildDio(
          _env,
          enableLogging: true,
        ).interceptors.whereType<LogInterceptor>().single;
    expect(logged.request, isTrue);
    expect(logged.requestHeader, isFalse);
    expect(logged.requestBody, isFalse);
    expect(logged.responseHeader, isFalse);
    expect(logged.responseBody, isFalse);

    expect(
      buildDio(
        _env,
        enableLogging: false,
      ).interceptors.whereType<LogInterceptor>(),
      isEmpty,
    );
  });
}
