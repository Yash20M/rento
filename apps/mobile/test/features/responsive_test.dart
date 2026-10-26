import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/core/ui/brand.dart';
import 'package:rento_mobile/core/ui/responsive.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

/// P3-51 — nothing overlaps, overflows or gets cut off on any screen width: the main screens are walked through at
/// phone, tablet and desktop sizes, with larger system text, and any layout error (a RenderFlex overflow, a bad
/// constraint) fails the test. Picture-loading errors are expected (the test network refuses pictures) and ignored.
FakeApi _api() => FakeApi({
  'GET /v1/drawers': StubResponse(200, [drawerJson()]),
  'GET /v1/drawers/d-1/inventory': StubResponse(200, [inventoryJson()]),
  'GET /v1/drawers/d-1/items/m-1/availability': StubResponse(
    200,
    availabilityJson(),
  ),
  'POST /v1/drawers/nearby': StubResponse(200, {
    'drawers': [nearbyDrawerJson()],
    'unavailable': <Object>[],
  }),
  'GET /v1/bookings': StubResponse(200, [
    bookingJson(status: 'confirmed', holdExpiresAt: null, payment: paidJson()),
    bookingJson(id: 'b-2'),
  ]),
  'GET /v1/bookings/b-1': StubResponse(
    200,
    bookingJson(status: 'confirmed', holdExpiresAt: null, payment: paidJson()),
  ),
  'GET /v1/bookings/b-2': StubResponse(200, bookingJson(id: 'b-2')),
  'GET /v1/me/kyc': const StubResponse(200, {
    'required': true,
    'status': 'none',
    'maskedAadhaar': null,
    'verifiedAt': null,
    'verifiedName': null,
    'reason': null,
  }),
  'GET /v1/me': const StubResponse(200, {
    'id': 'u-1',
    'email': 'asha.with.a.rather.long.address@example-company.com',
    'displayName': 'Asha Venkataraghavan-Subramaniam',
    'phone': null,
    'emailVerified': false,
    'avatarUrl': null,
    'needsProfileCompletion': <String>[],
  }),
});

/// Collects every framework error raised during the test (instead of stopping at the first), so one run lists all of
/// them with the screen and the source line.
class _Errors {
  _Errors() {
    _previous = FlutterError.onError;
    FlutterError.onError = (details) {
      final text = details.toString();
      if (text.contains('NetworkImage') || text.contains('image resource')) {
        return; // the test network refuses pictures
      }
      final where = RegExp(r'lib/[\w/.]+:\d+').firstMatch(text)?.group(0);
      final first = details.exceptionAsString().split('\n').first;
      list.add('$screen: $first @ ${where ?? 'unknown'}');
    };
  }

  late final void Function(FlutterErrorDetails)? _previous;

  /// The framework insists its own handler is back before the test body ends.
  void restore() => FlutterError.onError = _previous;

  final list = <String>[];
  String screen = 'start';
}

/// Scrolls the page (not a horizontal strip) until [finder] exists and is on screen.
Future<void> _scrollTo(WidgetTester tester, Finder finder) async {
  final vertical = find.byWidgetPredicate(
    (w) => w is Scrollable && w.axis == Axis.vertical,
  );
  if (finder.evaluate().isEmpty) {
    await tester.scrollUntilVisible(finder, 300, scrollable: vertical.first);
  }
  await tester.ensureVisible(finder.first);
  await tester.pumpAndSettle();
}

Future<void> _tapText(WidgetTester tester, String text) async {
  await _scrollTo(tester, find.text(text));
  await tester.tap(find.text(text).first);
  await tester.pumpAndSettle();
}

void main() {
  const sizes = <String, Size>{
    'small phone 320x640': Size(320, 640),
    'phone 360x740': Size(360, 740),
    'large phone 430x932': Size(430, 932),
    'tablet 820x1180': Size(820, 1180),
    'desktop 1280x800': Size(1280, 800),
  };

  for (final entry in sizes.entries) {
    for (final scale in const [1.0, 1.6]) {
      final name = '${entry.key}, text x$scale';

      testWidgets('R-01 sign-in and sign-up fit: $name', (tester) async {
        tester.platformDispatcher.textScaleFactorTestValue = scale;
        addTearDown(tester.platformDispatcher.clearAllTestValues);
        final errors = _Errors()..screen = 'sign-in';
        try {
          await pumpApp(tester, _api(), size: entry.value);
          errors.screen = 'sign-up';
          await _tapText(tester, 'New to Rento? Create an account');
        } finally {
          errors.restore();
        }
        expect(errors.list, isEmpty, reason: errors.list.join('\n'));
      });

      testWidgets('R-02 explore, drawer, product and tabs fit: $name', (
        tester,
      ) async {
        tester.platformDispatcher.textScaleFactorTestValue = scale;
        addTearDown(tester.platformDispatcher.clearAllTestValues);
        final errors = _Errors()..screen = 'explore';
        try {
          await pumpApp(tester, _api(), signedIn: true, size: entry.value);
          errors.screen = 'place sheet';
          await chooseDemoPlace(tester);
          errors.screen = 'drawer';
          await _tapText(tester, 'Indiranagar');
          errors.screen = 'product';
          await _tapText(tester, 'PlayStation 5');
          errors.screen = 'product, time chosen';
          await _tapText(tester, '10:00 AM');
          await tester.pumpAndSettle();
          errors.screen = 'back to explore';
          await tester.pageBack();
          await tester.pumpAndSettle();
          await tester.pageBack();
          await tester.pumpAndSettle();
          errors.screen = 'my bookings';
          await _tapText(tester, 'My bookings');
          errors.screen = 'account';
          await _tapText(tester, 'Account');
        } finally {
          errors.restore();
        }
        expect(errors.list, isEmpty, reason: errors.list.join('\n'));
      });
    }
  }

  testWidgets('R-03 the logo is the orange tile with the wordmark', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: Center(child: RentoLogo()))),
    );
    expect(find.byKey(const Key('rento-logo')), findsOneWidget);
    final tile = tester.widget<Container>(find.byKey(const Key('rento-logo')));
    expect(
      (tile.decoration as BoxDecoration).color,
      const Color(0xFFEF8E30),
      reason: 'the exact orange of logo.png',
    );
  });

  test('R-04 columns grow with the width and never drop below one', () {
    expect(columnsFor(320), 1);
    expect(columnsFor(700), 2);
    expect(columnsFor(1100), 3);
    expect(columnsFor(5000), 3, reason: 'capped');
    expect(columnsFor(100), 1);
  });
}
