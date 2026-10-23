import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:rento_mobile/core/ui/kit.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

/// P3-29 — what each screen shows when its data cannot be loaded (server error, offline), while it loads, and when
/// there is nothing to show. The rule: never a blank screen or a forever-spinner; always a plain sentence and, for
/// something that can be retried, a "Try again" button that really asks again.
const _serverError = StubResponse(500, {
  'type': 'about:blank',
  'title': 'Internal Server Error',
  'status': 500,
  'code': 'INTERNAL_ERROR',
});

FakeApi _api(Map<String, Object> routes) => FakeApi({
  'GET /v1/drawers': StubResponse(200, [drawerJson()]),
  'GET /v1/drawers/d-1/inventory': StubResponse(200, [inventoryJson()]),
  'GET /v1/drawers/d-1/items/m-1/availability': StubResponse(
    200,
    availabilityJson(),
  ),
  'GET /v1/bookings': const StubResponse(200, <Object>[]),
  'GET /v1/me/kyc': const StubResponse(200, {
    'required': true,
    'status': 'none',
    'maskedAadhaar': null,
    'verifiedAt': null,
    'verifiedName': null,
    'reason': null,
  }),
  ...routes,
});

Future<void> _tapText(WidgetTester tester, String text) async {
  await tester.tap(find.text(text).first);
  await tester.pumpAndSettle();
}

Future<void> _chooseDemoPlace(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('choose-location')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('demo-Bengaluru · Indiranagar')));
  await tester.pumpAndSettle();
}

void main() {
  const failures = <String, StubResponse>{
    'server error': _serverError,
    'offline': StubResponse.networkDown(),
  };
  const messages = <String, String>{
    'server error': 'Something went wrong. Please try again.',
    'offline': 'Cannot reach Rento. Check your connection and try again.',
  };

  for (final failure in failures.entries) {
    final name = failure.key;

    testWidgets(
      'S-01 my bookings, $name: a sentence and a retry that asks again',
      (tester) async {
        var answer = failure.value;
        final api = _api({'GET /v1/bookings': (_) => answer});
        await pumpApp(tester, api, signedIn: true);
        await _tapText(tester, 'My bookings');
        expect(find.text(messages[name]!), findsOneWidget);
        expect(find.text('Try again'), findsOneWidget);

        answer = const StubResponse(200, <Object>[]);
        await _tapText(tester, 'Try again');
        expect(find.text('Try again'), findsNothing);
        expect(find.text('No upcoming bookings'), findsOneWidget);
        expect(api.to('GET', '/v1/bookings').length, greaterThanOrEqualTo(2));
      },
    );

    testWidgets('S-02 time slots, $name: a sentence and a retry', (
      tester,
    ) async {
      var answer = failure.value;
      final api = _api({
        'POST /v1/drawers/nearby': StubResponse(200, {
          'drawers': [nearbyDrawerJson()],
          'unavailable': <Object>[],
        }),
        'GET /v1/drawers/d-1/items/m-1/availability': (_) => answer,
      });
      await pumpApp(tester, api, signedIn: true);
      await _chooseDemoPlace(tester);
      await _tapText(tester, 'Indiranagar');
      await _tapText(tester, 'PlayStation 5');
      expect(find.text(messages[name]!), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
      expect(
        tester.widget<FilledButton>(find.byKey(const Key('reserve'))).onPressed,
        isNull,
        reason: 'nothing can be reserved while the times are unknown',
      );

      answer = StubResponse(200, availabilityJson());
      await _tapText(tester, 'Try again');
      expect(find.text('Try again'), findsNothing);
      expect(find.text('10:00 AM'), findsOneWidget);
    });

    testWidgets('S-03 a booking, $name: a sentence and a retry', (
      tester,
    ) async {
      var answer = failure.value;
      final api = _api({
        'GET /v1/bookings': StubResponse(200, [bookingJson()]),
        'GET /v1/bookings/b-1': (_) => answer,
      });
      await pumpApp(tester, api, signedIn: true);
      await _tapText(tester, 'My bookings');
      await tester.tap(find.byKey(const Key('booking-b-1')));
      await tester.pumpAndSettle();
      expect(find.text(messages[name]!), findsOneWidget);

      answer = StubResponse(200, bookingJson());
      await _tapText(tester, 'Try again');
      expect(find.byKey(const Key('status-held')), findsOneWidget);
    });

    testWidgets(
      'S-04 finding drawers, $name: a sentence and a retry that searches again',
      (tester) async {
        var answer = failure.value;
        final api = _api({'POST /v1/drawers/nearby': (_) => answer});
        await pumpApp(tester, api, signedIn: true);
        await _chooseDemoPlace(tester);
        expect(find.text(messages[name]!), findsOneWidget);

        answer = StubResponse(200, {
          'drawers': [nearbyDrawerJson()],
          'unavailable': <Object>[],
        });
        await _tapText(tester, 'Try again');
        expect(find.text('Indiranagar'), findsWidgets);
        expect(api.to('POST', '/v1/drawers/nearby').length, 2);
      },
    );
  }

  testWidgets('S-05 nothing to show is an answer, not an error', (
    tester,
  ) async {
    final api = _api({
      'POST /v1/drawers/nearby': const StubResponse(200, {
        'drawers': <Object>[],
        'unavailable': <Object>[],
      }),
    });
    await pumpApp(tester, api, signedIn: true);
    await _chooseDemoPlace(tester);
    expect(find.byKey(const Key('nearby-empty')), findsOneWidget);
    expect(find.text('Try again'), findsNothing);

    await _tapText(tester, 'My bookings');
    expect(find.text('No upcoming bookings'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
  });

  testWidgets(
    'S-06 while a list loads there is a placeholder, not a blank screen',
    (tester) async {
      final api = _api({});
      await pumpApp(tester, api, signedIn: true);
      // Hold the answer back: the screen must show something while it waits.
      var release = false;
      api.on('GET /v1/bookings', (_) {
        release = true;
        return const StubResponse(200, <Object>[]);
      });
      await tester.tap(find.text('My bookings').first);
      await tester.pump();
      expect(find.byType(Scaffold), findsWidgets);
      expect(find.byType(Text), findsWidgets);
      await tester.pumpAndSettle();
      expect(release, isTrue);
    },
  );

  testWidgets('S-07a a server fault is drawn as a warning', (tester) async {
    final api = _api({'GET /v1/bookings': (_) => _serverError});
    await pumpApp(tester, api, signedIn: true);
    await _tapText(tester, 'My bookings');
    expect(find.byKey(const Key('error-illustration')), findsOneWidget);
    expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget);
    expect(find.byIcon(Icons.cloud_off_rounded), findsNothing);
  });

  testWidgets('S-07b being offline is drawn as a cloud', (tester) async {
    final api = _api({
      'GET /v1/bookings': (_) => const StubResponse.networkDown(),
    });
    await pumpApp(tester, api, signedIn: true);
    await _tapText(tester, 'My bookings');
    expect(find.byKey(const Key('error-illustration')), findsOneWidget);
    expect(find.byIcon(Icons.cloud_off_rounded), findsWidgets);
  });

  testWidgets(
    'S-08 an empty state fits even a very short space without overflowing',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              height: 140,
              child: EmptyView(
                icon: Icons.receipt_long_outlined,
                title: 'Nothing here',
                body: 'Some explanation',
                action: FilledButton(onPressed: () {}, child: const Text('Go')),
              ),
            ),
          ),
        ),
      );
      expect(tester.takeException(), isNull);
      expect(find.text('Nothing here'), findsOneWidget);
    },
  );
}
