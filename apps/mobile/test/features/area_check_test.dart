import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/core/location/location_service.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

/// P3-54 — products are shown at once, without waiting for the phone's position; whether Rento serves the customer's
/// area is checked only when they try to order, and a "no" is explained.
FakeApi _api([Map<String, Object> extra = const {}]) => FakeApi({
  'GET /v1/drawers': StubResponse(200, [
    drawerJson(),
    drawerJson(id: 'd-2', name: 'Koramangala'),
  ]),
  'GET /v1/drawers/d-1/inventory': StubResponse(200, [inventoryJson()]),
  'GET /v1/drawers/d-2/inventory': StubResponse(200, [inventoryJson()]),
  'GET /v1/drawers/d-1/items/m-1/availability': StubResponse(
    200,
    availabilityJson(),
  ),
  'POST /v1/drawers/nearby': StubResponse(200, {
    'drawers': [nearbyDrawerJson()],
    'unavailable': <Object>[],
  }),
  'POST /v1/bookings': StubResponse(201, bookingJson()),
  'GET /v1/bookings/b-1': StubResponse(200, bookingJson()),
  'GET /v1/bookings': const StubResponse(200, <Object>[]),
  ...extra,
});

/// A phone whose position arrives only when the test says so.
class _SlowLocation implements LocationService {
  final done = Completer<GeoPoint>();

  @override
  Future<GeoPoint> current() => done.future;
}

Future<void> _toReserve(WidgetTester tester) async {
  await tester.ensureVisible(find.byKey(const Key('drawer-d-1')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('drawer-d-1')));
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.text('PlayStation 5').first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('PlayStation 5').first);
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.text('10:00 AM'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('10:00 AM'));
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.byKey(const Key('duration-60')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('duration-60')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('reserve')));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'P-01 products appear at once; the position arriving later only reorders',
    (tester) async {
      final location = _SlowLocation();
      final api = _api();
      await pumpApp(
        tester,
        api,
        signedIn: true,
        location: location,
        autoLocate: true,
      );

      // the position has NOT arrived, yet everything is on screen
      expect(find.byKey(const Key('products-near-you')), findsOneWidget);
      expect(find.byKey(const Key('drawer-d-1')), findsOneWidget);
      expect(find.byKey(const Key('drawer-d-2')), findsOneWidget);
      expect(find.byKey(const Key('locating')), findsNothing);
      expect(api.to('POST', '/v1/drawers/nearby'), isEmpty);

      location.done.complete(
        const GeoPoint(latitude: 12.9784, longitude: 77.6408),
      );
      await tester.pumpAndSettle();
      expect(api.to('POST', '/v1/drawers/nearby'), hasLength(1));
      expect(find.byKey(const Key('drawer-d-1')), findsOneWidget);
    },
  );

  testWidgets('P-02 ordering from a drawer in the area goes ahead', (
    tester,
  ) async {
    final api = _api();
    await pumpApp(tester, api, signedIn: true);
    await _toReserve(tester);
    expect(api.to('POST', '/v1/bookings'), hasLength(1));
  });

  testWidgets(
    'P-03 ordering from a drawer that does not serve the area is refused with a sentence',
    (tester) async {
      // the customer's area is served by another drawer only
      final api = _api({
        'POST /v1/drawers/nearby': StubResponse(200, {
          'drawers': [nearbyDrawerJson(id: 'd-2', name: 'Koramangala')],
          'unavailable': <Object>[],
        }),
      });
      await pumpApp(tester, api, signedIn: true);
      await _toReserve(tester);
      expect(
        find.text(
          'Sorry, this drawer is not available in your area. Try a drawer nearer to you.',
        ),
        findsOneWidget,
      );
      expect(api.to('POST', '/v1/bookings'), isEmpty);
    },
  );

  testWidgets(
    'P-04 nowhere near any drawer: the same explanation, no booking',
    (tester) async {
      final api = _api({
        'POST /v1/drawers/nearby': StubResponse(
          422,
          problemJson(422, 'OUTSIDE_SERVICE_AREA'),
        ),
      });
      await pumpApp(tester, api, signedIn: true);
      await _toReserve(tester);
      expect(find.textContaining('not available in your area'), findsOneWidget);
      expect(api.to('POST', '/v1/bookings'), isEmpty);
    },
  );

  testWidgets(
    'P-05 location refused: ordering says why it is needed, and nothing is booked',
    (tester) async {
      final api = _api();
      await pumpApp(
        tester,
        api,
        signedIn: true,
        location: FakeLocation(failure: LocationFailure.denied),
      );
      await _toReserve(tester);
      expect(find.textContaining('Allow location access'), findsOneWidget);
      expect(api.to('POST', '/v1/bookings'), isEmpty);
    },
  );

  testWidgets(
    'P-06 location found only at order time is used, and then the order goes ahead',
    (tester) async {
      final location = FakeLocation();
      final api = _api();
      await pumpApp(tester, api, signedIn: true, location: location);
      expect(
        location.calls,
        0,
        reason: 'browsing never asked for the position',
      );
      await _toReserve(tester);
      expect(location.calls, 1);
      expect(api.to('POST', '/v1/bookings'), hasLength(1));
    },
  );

  testWidgets(
    'P-07 a failing area check does not block the order (the server still enforces its rules)',
    (tester) async {
      final api = _api({
        'POST /v1/drawers/nearby': StubResponse(
          503,
          problemJson(503, 'RETRY_LATER'),
        ),
      });
      await pumpApp(tester, api, signedIn: true);
      await _toReserve(tester);
      expect(api.to('POST', '/v1/bookings'), hasLength(1));
    },
  );

  testWidgets('P-08 the refusal clears when another time is chosen', (
    tester,
  ) async {
    final api = _api({
      'POST /v1/drawers/nearby': StubResponse(
        422,
        problemJson(422, 'OUTSIDE_SERVICE_AREA'),
      ),
    });
    await pumpApp(tester, api, signedIn: true);
    await _toReserve(tester);
    expect(find.textContaining('not available in your area'), findsOneWidget);
    await tester.ensureVisible(find.text('10:30 AM'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('10:30 AM'));
    await tester.pumpAndSettle();
    expect(find.textContaining('not available in your area'), findsNothing);
  });

  testWidgets(
    'V-01 "Available" is shown on a product only when it is in the customer area',
    (tester) async {
      final api = _api();
      await pumpApp(tester, api, signedIn: true);
      // position unknown: every product is listed, none claims to be available for this person
      expect(find.byKey(const Key('products-near-you')), findsOneWidget);
      expect(find.byKey(const Key('available-label')), findsNothing);

      await chooseDemoPlace(tester); // d-1 serves the area and has units free
      expect(find.byKey(const Key('available-label')), findsWidgets);
      expect(find.text('Available'), findsWidgets);
      expect(find.textContaining('available now'), findsNothing);
    },
  );

  testWidgets('V-02 outside the area no product says "Available"', (
    tester,
  ) async {
    final api = _api({
      'POST /v1/drawers/nearby': StubResponse(
        422,
        problemJson(422, 'OUTSIDE_SERVICE_AREA'),
      ),
    });
    await pumpApp(tester, api, signedIn: true);
    await chooseDemoPlace(tester);
    expect(find.byKey(const Key('products-near-you')), findsOneWidget);
    expect(find.byKey(const Key('available-label')), findsNothing);
  });

  testWidgets(
    'V-03 a drawer page shows "Available" on its products in the area, nothing outside it',
    (tester) async {
      final api = _api();
      await pumpApp(tester, api, signedIn: true);
      await chooseDemoPlace(tester);
      await tester.ensureVisible(find.byKey(const Key('drawer-d-1')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('drawer-d-1')));
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.byKey(const Key('item-m-1')),
          matching: find.byKey(const Key('available-label')),
        ),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'V-04 a closed drawer in the area still lists its products, but without "Available"',
    (tester) async {
      final api = _api({
        'POST /v1/drawers/nearby': StubResponse(200, {
          'drawers': <Object>[],
          'unavailable': [nearbyDrawerJson(openNow: false, reason: 'closed')],
        }),
      });
      await pumpApp(tester, api, signedIn: true);
      await chooseDemoPlace(tester);
      expect(find.byKey(const Key('products-near-you')), findsOneWidget);
      expect(find.byKey(const Key('available-label')), findsNothing);
    },
  );
}
