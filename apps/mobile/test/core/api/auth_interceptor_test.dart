import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/app/config/env.dart';
import 'package:rento_mobile/core/api/api_client.dart';
import 'package:rento_mobile/core/api/models/models.dart';
import 'package:rento_mobile/core/auth/session_store.dart';
import 'package:rento_mobile/core/storage/secure_store.dart';

import '../../support/fixtures.dart';
import '../../support/stub_http_adapter.dart';

const _env = AppEnv(flavor: Flavor.dev, apiBaseUrl: 'http://api.test');

Future<(Dio, SessionStore, InMemorySecureStore)> _client(
  StubHttpAdapter adapter, {
  String access = 'access-old',
  String? refresh = 'refresh-old',
}) async {
  final store = InMemorySecureStore();
  final session = SessionStore(store);
  if (refresh != null) await store.write(SessionStore.refreshKey, refresh);
  await session.save(
    AuthResponse.fromJson(
      authJson(n: 0)
        ..['accessToken'] = access
        ..['refreshToken'] = refresh ?? 'unused',
    ),
  );
  if (refresh == null) await store.delete(SessionStore.refreshKey);
  final dio = buildDio(
    _env,
    session: session,
    adapter: adapter,
    enableLogging: false,
  );
  addTearDown(session.dispose);
  return (dio, session, store);
}

StubResponse _expired() => StubResponse(
  401,
  problemJson(401, 'TOKEN_EXPIRED', detail: 'Access token expired'),
);

void main() {
  test(
    'I-01 the bearer token is sent on API calls but never on the auth endpoints',
    () async {
      final adapter = StubHttpAdapter(
        (o) => StubResponse(200, <String, Object>{}),
      );
      final (dio, _, _) = await _client(adapter);

      await dio.get<dynamic>('/v1/bookings');
      await dio.post<dynamic>('/v1/auth/login', data: {});

      expect(adapter.requests[0].headers['Authorization'], 'Bearer access-old');
      expect(adapter.requests[1].headers.containsKey('Authorization'), isFalse);
    },
  );

  test(
    'I-02 an expired token is refreshed ONCE and the request repeated with the new token',
    () async {
      var served = 0;
      final adapter = StubHttpAdapter((o) {
        if (o.path == '/v1/auth/refresh') {
          expect(o.data, {'refreshToken': 'refresh-old'});
          return StubResponse(200, authJson(n: 2));
        }
        served++;
        return o.headers['Authorization'] == 'Bearer access-2'
            ? StubResponse(200, {'ok': true})
            : _expired();
      });
      final (dio, session, store) = await _client(adapter);

      final response = await dio.get<Map<String, dynamic>>('/v1/bookings');

      expect(response.data, {'ok': true});
      expect(served, 2); // the failed call and the repeat
      expect(
        adapter.requests.where((r) => r.path == '/v1/auth/refresh'),
        hasLength(1),
      );
      expect(session.accessToken, 'access-2');
      expect(await store.read(SessionStore.refreshKey), 'refresh-2'); // rotated
    },
  );

  test(
    'I-03 several calls failing at once cause ONE refresh (a second would revoke the session family)',
    () async {
      final gate = Completer<void>();
      final adapter = StubHttpAdapter((o) {
        if (o.path == '/v1/auth/refresh') {
          return StubResponse(200, authJson(n: 2));
        }
        return o.headers['Authorization'] == 'Bearer access-2'
            ? StubResponse(200, {'ok': true})
            : _expired();
      });
      final (dio, _, _) = await _client(adapter);
      gate.complete();

      final results = await Future.wait([
        dio.get<dynamic>('/v1/bookings'),
        dio.get<dynamic>('/v1/bookings/b-1'),
        dio.get<dynamic>('/v1/drawers'),
      ]);

      expect(results.map((r) => r.statusCode), [200, 200, 200]);
      expect(
        adapter.requests.where((r) => r.path == '/v1/auth/refresh'),
        hasLength(1),
      );
    },
  );

  test(
    'I-04 a refused refresh ends the session: tokens are forgotten and listeners are told',
    () async {
      final adapter = StubHttpAdapter((o) {
        if (o.path == '/v1/auth/refresh') {
          return StubResponse(
            401,
            problemJson(401, 'UNAUTHENTICATED', detail: 'revoked'),
          );
        }
        return _expired();
      });
      final (dio, session, store) = await _client(adapter);
      var forced = 0;
      session.forcedSignOuts.listen((_) => forced++);

      await expectLater(
        dio.get<dynamic>('/v1/bookings'),
        throwsA(isA<DioException>()),
      );
      await Future<void>.delayed(Duration.zero);

      expect(session.accessToken, isNull);
      expect(await store.read(SessionStore.refreshKey), isNull);
      expect(forced, 1);
    },
  );

  test(
    'I-05 a network failure while refreshing keeps the session (the call just fails)',
    () async {
      final adapter = StubHttpAdapter((o) {
        if (o.path == '/v1/auth/refresh') throw const SocketLikeFailure();
        return _expired();
      });
      final (dio, session, store) = await _client(adapter);

      await expectLater(
        dio.get<dynamic>('/v1/bookings'),
        throwsA(isA<DioException>()),
      );

      expect(session.accessToken, 'access-old');
      expect(await store.read(SessionStore.refreshKey), 'refresh-old');
    },
  );

  test(
    'I-06 only 401 TOKEN_EXPIRED triggers a refresh; other errors pass through untouched',
    () async {
      final adapter = StubHttpAdapter((o) {
        return switch (o.path) {
          '/v1/bookings' => StubResponse(403, problemJson(403, 'FORBIDDEN')),
          '/v1/drawers' => StubResponse(
            401,
            problemJson(401, 'UNAUTHENTICATED'),
          ),
          _ => StubResponse(500, problemJson(500, 'INTERNAL_ERROR')),
        };
      });
      final (dio, _, _) = await _client(adapter);

      for (final path in ['/v1/bookings', '/v1/drawers', '/v1/me']) {
        await expectLater(dio.get<dynamic>(path), throwsA(isA<DioException>()));
      }
      expect(
        adapter.requests.where((r) => r.path == '/v1/auth/refresh'),
        isEmpty,
      );
    },
  );

  test(
    'I-07 a repeated request that fails again is not refreshed a second time (no loop)',
    () async {
      final adapter = StubHttpAdapter((o) {
        if (o.path == '/v1/auth/refresh') {
          return StubResponse(200, authJson(n: 2));
        }
        return _expired(); // even the new token is "expired"
      });
      final (dio, _, _) = await _client(adapter);

      await expectLater(
        dio.get<dynamic>('/v1/bookings'),
        throwsA(isA<DioException>()),
      );

      expect(
        adapter.requests.where((r) => r.path == '/v1/auth/refresh'),
        hasLength(1),
      );
      expect(
        adapter.requests.where((r) => r.path == '/v1/bookings'),
        hasLength(2),
      );
    },
  );

  test('I-08 without a refresh token an expired token simply fails', () async {
    final adapter = StubHttpAdapter((o) => _expired());
    final (dio, _, _) = await _client(adapter, refresh: null);

    await expectLater(
      dio.get<dynamic>('/v1/bookings'),
      throwsA(isA<DioException>()),
    );
    expect(
      adapter.requests.where((r) => r.path == '/v1/auth/refresh'),
      isEmpty,
    );
  });

  test('I-09 a request body survives being repeated after a refresh', () async {
    final adapter = StubHttpAdapter((o) {
      if (o.path == '/v1/auth/refresh') {
        return StubResponse(200, authJson(n: 2));
      }
      return o.headers['Authorization'] == 'Bearer access-2'
          ? StubResponse(201, bookingJson())
          : _expired();
    });
    final (dio, _, _) = await _client(adapter);

    final response = await dio.post<dynamic>(
      '/v1/bookings',
      data: {'durationMinutes': 60},
      options: Options(headers: {'Idempotency-Key': 'key-1'}),
    );

    expect(response.statusCode, 201);
    final repeated =
        adapter.requests.where((r) => r.path == '/v1/bookings').last;
    expect(repeated.data, {'durationMinutes': 60});
    expect(
      repeated.headers['Idempotency-Key'],
      'key-1',
    ); // the SAME key on the repeat
  });
}

class SocketLikeFailure implements Exception {
  const SocketLikeFailure();
}
