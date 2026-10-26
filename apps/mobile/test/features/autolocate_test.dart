import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/core/location/location_service.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import 'package:rento_mobile/core/storage/secure_store.dart';
import '../support/stub_http_adapter.dart';

/// P3-53 — no "Find a drawer" question: the app finds the nearest drawers by itself, and when it cannot (location off,
/// or nothing serves the place) it still shows every drawer and product instead of an empty screen.
FakeApi _api([Map<String, Object> extra = const {}]) => FakeApi({
  'GET /v1/drawers': StubResponse(200, [
    drawerJson(),
    drawerJson(id: 'd-2', name: 'Koramangala'),
  ]),
  'GET /v1/drawers/d-1/inventory': StubResponse(200, [inventoryJson()]),
  'GET /v1/drawers/d-2/inventory': StubResponse(200, [inventoryJson()]),
  'POST /v1/drawers/nearby': StubResponse(200, {
    'drawers': [nearbyDrawerJson()],
    'unavailable': <Object>[],
  }),
  'GET /v1/bookings': const StubResponse(200, <Object>[]),
  ...extra,
});

void main() {
  testWidgets(
    'A-01 with the phone position the nearest drawers appear by themselves',
    (tester) async {
      final location = FakeLocation(
        point: const GeoPoint(latitude: 12.9784, longitude: 77.6408),
      );
      final api = _api();
      await pumpApp(
        tester,
        api,
        signedIn: true,
        location: location,
        autoLocate: true,
      );

      expect(
        find.text('Find a drawer'),
        findsNothing,
        reason: 'the title is gone',
      );
      expect(find.byKey(const Key('choose-location')), findsNothing);
      expect(location.calls, 1, reason: 'asked for the position once');
      final search = api.to('POST', '/v1/drawers/nearby');
      expect(search, hasLength(1));
      expect((search.single.data as Map)['latitude'], 12.9784);
      expect(find.byKey(const Key('products-near-you')), findsOneWidget);
      expect(find.byKey(const Key('drawer-d-1')), findsOneWidget);
    },
  );

  testWidgets(
    'A-02 location refused: every drawer and product is shown, with no place picker',
    (tester) async {
      final api = _api();
      await pumpApp(
        tester,
        api,
        signedIn: true,
        location: FakeLocation(failure: LocationFailure.denied),
        autoLocate: true,
      );

      expect(api.to('POST', '/v1/drawers/nearby'), isEmpty);
      expect(find.byKey(const Key('products-near-you')), findsOneWidget);
      expect(
        find.textContaining('location'),
        findsNothing,
        reason: 'no location text',
      );
      expect(find.byKey(const Key('products-near-you')), findsOneWidget);
      expect(find.byKey(const Key('drawer-d-1')), findsOneWidget);
      expect(find.byKey(const Key('drawer-d-2')), findsOneWidget);
      expect(
        find.byKey(const Key('choose-location')),
        findsNothing,
        reason: 'no place picker',
      );
    },
  );

  testWidgets(
    'A-03 no drawer serves the place: everything Rento has is shown, not an empty screen',
    (tester) async {
      final api = _api({
        'POST /v1/drawers/nearby': StubResponse(
          422,
          problemJson(422, 'OUTSIDE_SERVICE_AREA'),
        ),
      });
      {
        await pumpApp(
          tester,
          api,
          signedIn: true,
          location: FakeLocation(
            point: const GeoPoint(latitude: 1.3, longitude: 103.8),
          ),
          autoLocate: true,
        );

        expect(find.byKey(const Key('outside-service-area')), findsOneWidget);
        expect(
          find.textContaining('location'),
          findsNothing,
          reason: 'no location text',
        );
        expect(find.byKey(const Key('drawer-d-1')), findsOneWidget);
        expect(find.text('Try again'), findsNothing);
      }
    },
  );

  testWidgets('A-04 an empty nearby answer also falls back to every drawer', (
    tester,
  ) async {
    final api = _api({
      'POST /v1/drawers/nearby': StubResponse(200, {
        'drawers': <Object>[],
        'unavailable': <Object>[],
      }),
    });
    await pumpApp(
      tester,
      api,
      signedIn: true,
      location: FakeLocation(),
      autoLocate: true,
    );
    expect(find.byKey(const Key('nearby-empty')), findsOneWidget);
    expect(find.byKey(const Key('drawer-d-2')), findsOneWidget);
  });

  testWidgets(
    'A-05 a remembered place is used and the phone is not asked again',
    (tester) async {
      final location = FakeLocation();
      final api = _api();
      await pumpApp(
        tester,
        api,
        signedIn: true,
        location: location,
        autoLocate: true,
        store: await _storeWithPlace(),
      );
      expect(location.calls, 0);
      expect(api.to('POST', '/v1/drawers/nearby'), hasLength(1));
    },
  );
}

Future<InMemorySecureStore> _storeWithPlace() async {
  final store = InMemorySecureStore();
  await store.write('last_place', '{"latitude":12.98,"longitude":77.64}');
  return store;
}
