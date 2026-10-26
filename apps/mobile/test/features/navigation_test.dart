import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/app/providers.dart';
import 'package:rento_mobile/core/location/location_service.dart';
import 'package:rento_mobile/core/storage/secure_store.dart';
import 'package:rento_mobile/features/explore/application/explore_providers.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

// M27 (docs/prompts/M27.md): the phone's back button and the remembered search place.

FakeApi _api([Map<String, Object> extra = const {}]) => FakeApi({
  'GET /v1/drawers': StubResponse(200, [drawerJson()]),
  'GET /v1/drawers/d-1/inventory': StubResponse(200, [inventoryJson()]),
  'GET /v1/drawers/d-1/items/m-1/availability': StubResponse(
    200,
    availabilityJson(),
  ),
  'GET /v1/bookings': const StubResponse(200, <Object>[]),
  'POST /v1/drawers/nearby': StubResponse(200, {
    'drawers': [nearbyDrawerJson()],
    'unavailable': <Object>[],
  }),
  ...extra,
});

/// Records whether the app asked Android to close it (what happens when nothing in the app handles back).
class _SystemExit {
  bool asked = false;
}

_SystemExit _watchSystemExit(WidgetTester tester) {
  final exit = _SystemExit();
  tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
    SystemChannels.platform,
    (call) async {
      if (call.method == 'SystemNavigator.pop') exit.asked = true;
      return null;
    },
  );
  addTearDown(
    () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      null,
    ),
  );
  return exit;
}

/// The phone's back button (Android's system back), not an on-screen arrow.
Future<void> _systemBack(WidgetTester tester) async {
  await tester.binding.handlePopRoute();
  await tester.pumpAndSettle();
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder.first);
  await tester.pumpAndSettle();
  await tester.tap(finder.first);
  await tester.pumpAndSettle();
}

Future<void> _chooseDemoPlace(
  WidgetTester tester, [
  String name = 'Bengaluru · Indiranagar',
]) async {
  final place = switch (name) {
    'Pune · Koregaon Park' => const GeoPoint(
      latitude: 18.5362,
      longitude: 73.8940,
    ),
    _ => const GeoPoint(latitude: 12.9784, longitude: 77.6408),
  };
  await chooseDemoPlace(tester, point: place, name: name);
}

void main() {
  group('P3-49 the phone\'s back button', () {
    testWidgets(
      'N-01 back on "My bookings" goes to Explore; the app stays open',
      (tester) async {
        final exit = _watchSystemExit(tester);
        await pumpApp(tester, _api(), signedIn: true);
        await _tap(tester, find.text('My bookings'));
        expect(find.text('Rent what you need, by the hour.'), findsNothing);

        await _systemBack(tester);

        expect(find.text('Rent what you need, by the hour.'), findsOneWidget);
        expect(exit.asked, isFalse);
      },
    );

    testWidgets('N-02 back on Explore leaves the app (Android convention)', (
      tester,
    ) async {
      final exit = _watchSystemExit(tester);
      await pumpApp(tester, _api(), signedIn: true);

      await _systemBack(tester);

      expect(exit.asked, isTrue);
    });

    testWidgets('N-03 a drawer opened from Explore: back returns to Explore', (
      tester,
    ) async {
      final exit = _watchSystemExit(tester);
      await pumpApp(tester, _api(), signedIn: true);
      await _chooseDemoPlace(tester);
      await _tap(tester, find.text('Indiranagar'));
      expect(find.text('1 Test Street, Bengaluru'), findsOneWidget);

      await _systemBack(tester);

      expect(find.text('Rent what you need, by the hour.'), findsOneWidget);
      expect(exit.asked, isFalse);
    });

    Future<void> reserve(WidgetTester tester, FakeApi api) async {
      await pumpApp(tester, api, signedIn: true);
      await _chooseDemoPlace(tester);
      await _tap(tester, find.text('Indiranagar'));
      await _tap(tester, find.text('PlayStation 5'));
      await _tap(tester, find.text('10:00 AM'));
      await _tap(tester, find.byKey(const Key('duration-60')));
      await _tap(tester, find.byKey(const Key('reserve')));
      expect(find.text('Complete your booking'), findsOneWidget);
    }

    testWidgets(
      'N-04 the payment screen (it replaced the history) — back goes to Explore instead of closing the app',
      (tester) async {
        final exit = _watchSystemExit(tester);
        await reserve(
          tester,
          _api({
            'POST /v1/bookings': StubResponse(201, bookingJson()),
            'GET /v1/bookings/b-1': StubResponse(200, bookingJson()),
          }),
        );

        await _systemBack(tester);

        expect(find.text('Rent what you need, by the hour.'), findsOneWidget);
        expect(exit.asked, isFalse);
      },
    );

    testWidgets('N-05 the booking opened after paying — back goes to Explore', (
      tester,
    ) async {
      final exit = _watchSystemExit(tester);
      final confirmed = bookingJson(
        status: 'confirmed',
        holdExpiresAt: null,
        payment: paidJson(),
      );
      await reserve(
        tester,
        _api({
          'POST /v1/bookings': StubResponse(201, bookingJson()),
          'GET /v1/bookings/b-1': StubResponse(200, confirmed),
        }),
      );
      await _tap(tester, find.byKey(const Key('view-booking')));
      expect(find.text('Complete your booking'), findsNothing);

      await _systemBack(tester);

      expect(find.text('Rent what you need, by the hour.'), findsOneWidget);
      expect(exit.asked, isFalse);
    });
  });

  group('P3-50 the remembered search place (rounded, ADR-016)', () {
    Future<Map<String, dynamic>?> saved(InMemorySecureStore store) async {
      final raw = await store.read('last_place');
      return raw == null ? null : jsonDecode(raw) as Map<String, dynamic>;
    }

    testWidgets(
      'L-01 "use my location" keeps the exact point in memory but saves only 2 decimals (~1 km)',
      (tester) async {
        final api = _api();
        final p = await pumpApp(
          tester,
          api,
          signedIn: true,
          location: FakeLocation(
            point: const GeoPoint(latitude: 18.53412, longitude: 73.89417),
          ),
          autoLocate: true,
        );

        expect(await saved(p.store), {'latitude': 18.53, 'longitude': 73.89});
        // This run still searches at the exact point.
        final body = api.to('POST', '/v1/drawers/nearby').last.data as Map;
        expect(body['latitude'], 18.53412);
        expect(body['longitude'], 73.89417);
      },
    );

    testWidgets(
      'L-02 at the next start the saved place is searched straight away, without asking "Where are you?"',
      (tester) async {
        final store = InMemorySecureStore();
        await store.write(
          'last_place',
          jsonEncode({'latitude': 18.53, 'longitude': 73.89}),
        );
        final api = _api();
        await pumpApp(tester, api, signedIn: true, store: store);

        expect(find.byKey(const Key('choose-location')), findsNothing);
        expect(find.text('Indiranagar'), findsOneWidget);
        final body = api.to('POST', '/v1/drawers/nearby').single.data as Map;
        expect(body['latitude'], 18.53);
        expect(body['longitude'], 73.89);
      },
    );

    testWidgets('L-03 a named demo place comes back with its name', (
      tester,
    ) async {
      final first = await pumpApp(tester, _api(), signedIn: true);
      await _chooseDemoPlace(tester, 'Pune · Koregaon Park');
      expect(await saved(first.store), {
        'latitude': 18.54,
        'longitude': 73.89,
        'name': 'Pune · Koregaon Park',
      });

      await tester.pumpWidget(const SizedBox()); // the app is closed
      final second = _api();
      await pumpApp(tester, second, signedIn: true, store: first.store);

      // the place is searched again at once (the screen has no place label any more)
      expect(find.byKey(const Key('choose-location')), findsNothing);
      final body = second.to('POST', '/v1/drawers/nearby').single.data as Map;
      expect(body['latitude'], 18.54);
      expect(body['longitude'], 73.89);
    });

    testWidgets(
      'L-04 signing out forgets the place, on the phone and in memory',
      (tester) async {
        final api = _api({
          'POST /v1/auth/logout': const StubResponse(204, null),
        });
        final p = await pumpApp(tester, api, signedIn: true);
        await _chooseDemoPlace(tester);
        expect(await saved(p.store), isNotNull);

        // Inside the test's fake clock the logout request only finishes while frames are pumped: start, pump, then wait.
        final signOut =
            p.container.read(authControllerProvider.notifier).signOut();
        await tester.pumpAndSettle();
        await signOut;

        expect(await saved(p.store), isNull);
        expect(p.container.read(locationChoiceProvider), isNull);
      },
    );

    for (final (name, raw) in [
      ('not JSON', 'Pune'),
      ('missing longitude', '{"latitude": 18.53}'),
      ('latitude out of range', '{"latitude": 123.0, "longitude": 73.89}'),
      ('longitude out of range', '{"latitude": 18.53, "longitude": 190}'),
    ]) {
      testWidgets('L-05 a broken saved place ($name) is ignored', (
        tester,
      ) async {
        final store = InMemorySecureStore();
        await store.write('last_place', raw);
        final api = _api();
        await pumpApp(tester, api, signedIn: true, store: store);

        expect(find.byKey(const Key('products-near-you')), findsOneWidget);
        expect(
          find.textContaining('location'),
          findsNothing,
          reason: 'no location text',
        );
        expect(api.to('POST', '/v1/drawers/nearby'), isEmpty);
      });
    }
  });
}
