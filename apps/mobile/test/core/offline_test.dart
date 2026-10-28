import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/core/api/api_client.dart';
import 'package:rento_mobile/core/cache/read_cache.dart';
import 'package:rento_mobile/core/net/connectivity.dart';
import 'package:rento_mobile/core/storage/secure_store.dart';
import 'package:rento_mobile/features/booking/application/booking_providers.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

/// P3-23 — offline and resilience (README §11.4): repeat only safe GETs, know when Rento cannot be reached, keep the
/// last drawer list and bookings readable, switch booking off while offline, never create a second booking.
const _down = StubResponse.networkDown();

Dio _dio(
  List<RequestOptions> seen,
  StubResponse Function(RequestOptions) answer, {
  List<bool>? reachability,
  ReadCache? cache,
  List<Duration> retries = const [Duration.zero, Duration.zero],
}) => buildDio(
  devEnv,
  adapter: StubHttpAdapter((options) {
    seen.add(options);
    return answer(options);
  }),
  enableLogging: false,
  retryDelays: retries,
  cache: cache,
  onReachability: reachability?.add,
);

void main() {
  group('repeating requests', () {
    test(
      'O-01 a GET that finds no network is repeated, then succeeds',
      () async {
        final seen = <RequestOptions>[];
        final dio = _dio(
          seen,
          (o) =>
              seen.length < 3 ? _down : const StubResponse(200, {'ok': true}),
        );
        final response = await dio.get<dynamic>('/v1/drawers');
        expect(response.data, {'ok': true});
        expect(seen, hasLength(3)); // first try + two repeats
      },
    );

    test('O-02 a GET gives up after the last pause and says so', () async {
      final seen = <RequestOptions>[];
      final dio = _dio(seen, (_) => _down);
      await expectLater(
        dio.get<dynamic>('/v1/drawers'),
        throwsA(isA<DioException>()),
      );
      expect(seen, hasLength(3));
    });

    test(
      'O-03 a busy server (503) is repeated; a refusal (404) is not',
      () async {
        final seen = <RequestOptions>[];
        final dio = _dio(
          seen,
          (o) =>
              o.path == '/v1/busy'
                  ? (seen.where((s) => s.path == '/v1/busy').length < 2
                      ? const StubResponse(503, {'code': 'RETRY_LATER'})
                      : const StubResponse(200, {}))
                  : const StubResponse(404, {'code': 'NOT_FOUND'}),
        );
        await dio.get<dynamic>('/v1/busy');
        expect(seen.where((s) => s.path == '/v1/busy'), hasLength(2));
        await expectLater(
          dio.get<dynamic>('/v1/missing'),
          throwsA(isA<DioException>()),
        );
        expect(seen.where((s) => s.path == '/v1/missing'), hasLength(1));
      },
    );

    test(
      'O-04 a POST is NEVER repeated by the client layer (it could act twice)',
      () async {
        final seen = <RequestOptions>[];
        final dio = _dio(seen, (_) => _down);
        await expectLater(
          dio.post<dynamic>('/v1/bookings', data: {}),
          throwsA(isA<DioException>()),
        );
        expect(seen, hasLength(1));
      },
    );
  });

  group('knowing whether Rento can be reached', () {
    test(
      'O-05 no answer ⇒ offline; any answer (even an error) ⇒ online',
      () async {
        final seen = <RequestOptions>[];
        final reach = <bool>[];
        var answer = _down;
        final dio = _dio(
          seen,
          (_) => answer,
          reachability: reach,
          retries: const [],
        );
        await expectLater(
          dio.get<dynamic>('/healthz'),
          throwsA(isA<DioException>()),
        );
        expect(reach.last, isFalse);
        answer = const StubResponse(500, {'code': 'INTERNAL_ERROR'});
        await expectLater(
          dio.get<dynamic>('/healthz'),
          throwsA(isA<DioException>()),
        );
        expect(
          reach.last,
          isTrue,
          reason: 'the server answered, so it is reachable',
        );
        answer = const StubResponse(200, {'status': 'ok'});
        await dio.get<dynamic>('/healthz');
        expect(reach.last, isTrue);
      },
    );
  });

  group('the saved copy', () {
    test(
      'O-06 the last good drawers and bookings answer stands in while offline — and only those',
      () async {
        final seen = <RequestOptions>[];
        final reach = <bool>[];
        final cache = ReadCache(InMemorySecureStore());
        var online = true;
        final dio = _dio(
          seen,
          (o) =>
              online
                  ? StubResponse(200, [
                    {'path': o.path},
                  ])
                  : _down,
          cache: cache,
          reachability: reach,
          retries: const [],
        );
        await dio.get<dynamic>('/v1/drawers');
        await dio.get<dynamic>('/v1/bookings');
        await dio.get<dynamic>('/v1/me'); // not saved
        online = false;
        final drawers = await dio.get<dynamic>('/v1/drawers');
        final bookings = await dio.get<dynamic>('/v1/bookings');
        expect(drawers.data, [
          {'path': '/v1/drawers'},
        ]);
        expect(bookings.data, [
          {'path': '/v1/bookings'},
        ]);
        expect(drawers.extra['fromCache'], isTrue);
        expect(
          reach.last,
          isFalse,
          reason: 'a saved answer must not make the app look online',
        );
        await expectLater(
          dio.get<dynamic>('/v1/me'),
          throwsA(isA<DioException>()),
        );
        await expectLater(
          dio.post<dynamic>('/v1/bookings', data: {}),
          throwsA(isA<DioException>()),
          reason: 'writes are never served from a saved copy',
        );
      },
    );

    test('O-07 the saved copy is wiped when the session ends', () async {
      final store = InMemorySecureStore();
      final cache = ReadCache(store);
      await cache.save('cache.bookings', [1]);
      await cache.save('cache.drawers', [2]);
      await cache.clear();
      expect(await store.read('cache.bookings'), isNull);
      expect(await store.read('cache.drawers'), isNull);
    });
  });

  group('on screen', () {
    FakeApi api({required bool Function() down, Map<String, Object>? extra}) {
      StubResponse unlessDown(StubResponse ok) => down() ? _down : ok;
      return FakeApi({
        'GET /v1/drawers': (_) => unlessDown(StubResponse(200, [drawerJson()])),
        'GET /v1/bookings':
            (_) => unlessDown(
              StubResponse(200, [
                bookingJson(
                  status: 'confirmed',
                  holdExpiresAt: null,
                  payment: paidJson(),
                ),
              ]),
            ),
        'GET /healthz':
            (_) => unlessDown(const StubResponse(200, {'status': 'ok'})),
        'GET /v1/me/kyc': const StubResponse(200, {
          'required': true,
          'status': 'none',
          'maskedAadhaar': null,
          'verifiedAt': null,
          'verifiedName': null,
          'reason': null,
        }),
        ...?extra,
      });
    }

    testWidgets(
      'O-08 offline: a banner, the saved bookings stay readable, "Check again" brings it back',
      (tester) async {
        var down = false;
        final pumped = await pumpApp(
          tester,
          api(down: () => down),
          signedIn: true,
        );
        await tester.tap(find.text('My bookings').first);
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('booking-b-1')), findsOneWidget);
        expect(find.byKey(const Key('offline-banner')), findsNothing);

        down = true;
        pumped.container.invalidate(myBookingsProvider);
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('offline-banner')), findsOneWidget);
        expect(
          find.byKey(const Key('booking-b-1')),
          findsOneWidget,
          reason: 'saved copy',
        );

        await tester.tap(find.byKey(const Key('offline-check')));
        await tester.pumpAndSettle();
        expect(
          find.byKey(const Key('offline-banner')),
          findsOneWidget,
          reason: 'still down',
        );

        down = false;
        await tester.tap(find.byKey(const Key('offline-check')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('offline-banner')), findsNothing);
      },
    );

    testWidgets(
      'O-09 offline: cancelling a booking is switched off, and back on when online',
      (tester) async {
        var down = false;
        final pumped = await pumpApp(
          tester,
          api(
            down: () => down,
            extra: {
              'GET /v1/bookings/b-1': StubResponse(
                200,
                bookingJson(
                  status: 'confirmed',
                  holdExpiresAt: null,
                  payment: paidJson(),
                ),
              ),
            },
          ),
          signedIn: true,
        );
        await tester.tap(find.text('My bookings').first);
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('booking-b-1')));
        await tester.pumpAndSettle();
        OutlinedButton button() => tester.widget<OutlinedButton>(
          find.byKey(const Key('cancel-booking')),
        );
        await tester.ensureVisible(find.byKey(const Key('cancel-booking')));
        expect(button().onPressed, isNotNull);

        // A failed request elsewhere taught the app it is offline.
        down = true;
        pumped.container.read(onlineProvider.notifier).report(false);
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.byKey(const Key('cancel-booking')));
        expect(button().onPressed, isNull);

        down = false;
        await tester.tap(find.byKey(const Key('offline-check')));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.byKey(const Key('cancel-booking')));
        expect(button().onPressed, isNotNull);
      },
    );

    testWidgets('O-10 signing out wipes the saved bookings from the device', (
      tester,
    ) async {
      final pumped = await pumpApp(
        tester,
        api(down: () => false),
        signedIn: true,
      );
      await tester.tap(find.text('My bookings').first);
      await tester.pumpAndSettle();
      expect(await pumped.store.read('cache.bookings'), isNotNull);

      await tester.tap(find.text('Account').first);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('sign-out')));
      await tester.tap(find.byKey(const Key('sign-out')));
      await tester.pumpAndSettle();
      expect(await pumped.store.read('cache.bookings'), isNull);
    });

    testWidgets(
      'O-11 opening the app with NO connection keeps a saved session: saved bookings are readable, and it finishes signing in once Rento answers',
      (tester) async {
        // First run, online: sign in (refresh token + who) and look at the bookings (saved copy).
        final store = InMemorySecureStore();
        final first = await pumpApp(
          tester,
          api(down: () => false),
          signedIn: true,
          store: store,
        );
        await tester.tap(find.text('My bookings').first);
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('booking-b-1')), findsOneWidget);
        first.container.dispose();

        // Second run: the phone has no connection at all.
        var down = true;
        final second = api(
          down: () => down,
          extra: {
            'POST /v1/auth/refresh':
                (RequestOptions _) =>
                    down ? _down : StubResponse(200, authJson()),
          },
        );
        await tester.pumpWidget(const SizedBox());
        await pumpApp(tester, second, store: store);
        expect(
          find.text('Welcome back'),
          findsNothing,
          reason: 'not thrown to sign-in',
        );
        expect(find.byKey(const Key('offline-banner')), findsOneWidget);
        await tester.tap(find.text('My bookings').first);
        await tester.pumpAndSettle();
        expect(
          find.byKey(const Key('booking-b-1')),
          findsOneWidget,
          reason: 'saved copy',
        );

        // Back online: "Check again" finishes the sign-in with the refresh token.
        down = false;
        await tester.tap(find.byKey(const Key('offline-check')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('offline-banner')), findsNothing);
        // One sign-in attempt at start-up, then one each time Rento answers again after being unreachable (the home
        // screen makes several public requests, so that can happen a few times), and the one "Check again" makes.
        // What must never happen is a loop: the count stays small and the person ends up signed in.
        expect(
          second.to('POST', '/v1/auth/refresh').length,
          inInclusiveRange(2, 5),
        );
      },
    );

    testWidgets(
      'O-12 a refused session (not just no connection) still ends in sign-in, and forgets everything saved',
      (tester) async {
        final store = InMemorySecureStore();
        await store.write('refresh_token', 'old');
        await store.write(
          'user',
          '{"id":"u-1","email":"a@b.c","displayName":null,"emailVerified":true}',
        );
        await store.write('cache.bookings', '[]');
        final refused = FakeApi({
          'POST /v1/auth/refresh': StubResponse(
            401,
            problemJson(401, 'UNAUTHENTICATED'),
          ),
        });
        await pumpApp(tester, refused, store: store);
        expect(find.text('Welcome back'), findsOneWidget);
        expect(await store.read('refresh_token'), isNull);
        expect(await store.read('user'), isNull);
        expect(await store.read('cache.bookings'), isNull);
      },
    );
  });
}
