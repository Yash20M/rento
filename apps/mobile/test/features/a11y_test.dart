import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

const _serverFault = StubResponse(500, {
  'type': 'about:blank',
  'title': 'Internal Server Error',
  'status': 500,
  'code': 'INTERNAL_ERROR',
});

/// P3-27 — accessibility of the main screens, using Flutter's own guidelines: every tap target is at least 48 dp, every
/// tap target has a label a screen reader can speak, and text has enough contrast — in the light AND the dark theme.
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
  ]),
  'GET /v1/bookings/b-1': StubResponse(
    200,
    bookingJson(status: 'confirmed', holdExpiresAt: null, payment: paidJson()),
  ),
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
    'email': 'asha@example.com',
    'displayName': 'Asha',
    'phone': null,
    'emailVerified': true,
    'avatarUrl': null,
    'needsProfileCompletion': <String>[],
  }),
});

Future<void> _tapText(WidgetTester tester, String text) async {
  // Big pictures push things below the fold: scroll to the target like a person would.
  await tester.ensureVisible(find.text(text).first);
  await tester.pumpAndSettle();
  await tester.tap(find.text(text).first);
  await tester.pumpAndSettle();
}

Future<void> _chooseDemoPlace(WidgetTester tester) async {
  await chooseDemoPlace(tester);
}

Future<void> _guidelines(WidgetTester tester, String step) async {
  try {
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    await expectLater(tester, meetsGuideline(textContrastGuideline));
  } on TestFailure catch (error) {
    fail('$step: ${error.message}');
  }
}

void main() {
  _darkMain();
  _moreScreens();
  testWidgets('A-01 the sign-in and sign-up screens', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpApp(tester, _api());
    await _guidelines(tester, 'step 1');
    await _tapText(tester, 'New to Rento? Create an account');
    await _guidelines(tester, 'step 2');
    handle.dispose();
  });

  testWidgets(
    'A-02 explore (all drawers, then nearby), a drawer and its slot picker',
    (tester) async {
      final handle = tester.ensureSemantics();
      await pumpApp(tester, _api(), signedIn: true);
      await _guidelines(tester, 'step 3');
      await _guidelines(tester, 'step 4');
      await chooseDemoPlace(tester);
      await _guidelines(tester, 'step 5');
      await _tapText(tester, 'Indiranagar');
      await _guidelines(tester, 'step 6');
      await _tapText(tester, 'PlayStation 5');
      await _guidelines(tester, 'step 7');
      await tester.ensureVisible(find.text('10:00 AM'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('10:00 AM'));
      await tester.pumpAndSettle();
      await _guidelines(tester, 'step 8');
      handle.dispose();
    },
  );

  testWidgets(
    'A-03 my bookings, a booking, the account and the profile editor',
    (tester) async {
      final handle = tester.ensureSemantics();
      await pumpApp(tester, _api(), signedIn: true);
      await _tapText(tester, 'My bookings');
      await _guidelines(tester, 'step 9');
      await tester.tap(find.byKey(const Key('booking-b-1')));
      await tester.pumpAndSettle();
      await _guidelines(tester, 'step 10');
      await tester.pageBack();
      await tester.pumpAndSettle();
      await _tapText(tester, 'Account');
      await _guidelines(tester, 'step 11');
      await tester.tap(find.byKey(const Key('edit-profile')));
      await tester.pumpAndSettle();
      await _guidelines(tester, 'step 12');
      handle.dispose();
    },
  );
}

void _darkMode(WidgetTester tester) {
  tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
  addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
}

void _darkMain() {
  testWidgets('A-04 the same screens in the dark theme', (tester) async {
    _darkMode(tester);
    final handle = tester.ensureSemantics();
    await pumpApp(tester, _api());
    await _guidelines(tester, 'dark sign-in');
    handle.dispose();
  });

  testWidgets('A-05 explore, a drawer and the bookings in the dark theme', (
    tester,
  ) async {
    _darkMode(tester);
    final handle = tester.ensureSemantics();
    await pumpApp(tester, _api(), signedIn: true);
    await _guidelines(tester, 'dark explore');
    await _chooseDemoPlace(tester);
    await _guidelines(tester, 'dark explore with drawers');
    await _tapText(tester, 'Indiranagar');
    await _guidelines(tester, 'dark drawer');
    await tester.pageBack();
    await tester.pumpAndSettle();
    await _tapText(tester, 'My bookings');
    await _guidelines(tester, 'dark bookings');
    await tester.tap(find.byKey(const Key('booking-b-1')));
    await tester.pumpAndSettle();
    await _guidelines(tester, 'dark booking');
    await tester.pageBack();
    await tester.pumpAndSettle();
    await _tapText(tester, 'Account');
    await _guidelines(tester, 'dark account');
    handle.dispose();
  });
}

/// The screens added after the first pass, in BOTH themes: a held booking at checkout, a confirmed and an active
/// booking, the opening-hours list, the photo sheet, and the empty and failed states.
void _moreScreens() {
  for (final dark in [false, true]) {
    final mode = dark ? 'dark' : 'light';
    void theme(WidgetTester tester) {
      if (dark) _darkMode(tester);
    }

    testWidgets(
      'A-06 checkout of a held booking and a confirmed booking ($mode)',
      (tester) async {
        theme(tester);
        final handle = tester.ensureSemantics();
        final api =
            _api()
              ..on('GET /v1/bookings', StubResponse(200, [bookingJson()]))
              ..on('GET /v1/bookings/b-1', StubResponse(200, bookingJson()));
        await pumpApp(tester, api, signedIn: true);
        await _tapText(tester, 'My bookings');
        await tester.tap(find.byKey(const Key('booking-b-1')));
        await tester.pumpAndSettle();
        expect(
          find.byKey(const Key('pay')),
          findsOneWidget,
          reason: 'on the checkout screen',
        );
        await _guidelines(tester, '$mode checkout (held)');
        handle.dispose();
      },
    );

    testWidgets(
      'A-07 the booking detail while confirmed and while in use ($mode)',
      (tester) async {
        theme(tester);
        final handle = tester.ensureSemantics();
        for (final status in ['confirmed', 'active']) {
          final booking = bookingJson(
            status: status,
            holdExpiresAt: null,
            payment: paidJson(),
            cancellable: status == 'confirmed',
          );
          final api =
              _api()
                ..on('GET /v1/bookings', StubResponse(200, [booking]))
                ..on('GET /v1/bookings/b-1', StubResponse(200, booking));
          await pumpApp(tester, api, signedIn: true);
          await _tapText(tester, 'My bookings');
          await tester.tap(find.byKey(const Key('booking-b-1')));
          await tester.pumpAndSettle();
          expect(
            find.byKey(
              Key(status == 'confirmed' ? 'cancel-booking' : 'extend-booking'),
            ),
            findsOneWidget,
            reason: 'on the $status booking screen',
          );
          await _guidelines(tester, '$mode booking $status');
          await tester.pumpWidget(const SizedBox());
        }
        handle.dispose();
      },
    );

    testWidgets(
      'A-08 a drawer with its opening hours open, and the photo sheet ($mode)',
      (tester) async {
        theme(tester);
        final handle = tester.ensureSemantics();
        await pumpApp(tester, _api(), signedIn: true);
        await _chooseDemoPlace(tester);
        await _tapText(tester, 'Indiranagar');
        await tester.ensureVisible(find.byKey(const Key('hours-tile')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('hours-tile')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('hours-day-1')), findsOneWidget);
        await _guidelines(tester, '$mode drawer with hours');
        await tester.pageBack();
        await tester.pumpAndSettle();
        await _tapText(tester, 'Account');
        await tester.tap(find.byKey(const Key('change-photo')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('photo-choose')), findsOneWidget);
        await _guidelines(tester, '$mode photo sheet');
        handle.dispose();
      },
    );

    testWidgets('A-09 an empty list and a failed screen ($mode)', (
      tester,
    ) async {
      theme(tester);
      final handle = tester.ensureSemantics();
      final empty =
          _api()..on('GET /v1/bookings', const StubResponse(200, <Object>[]));
      await pumpApp(tester, empty, signedIn: true);
      await _tapText(tester, 'My bookings');
      await _guidelines(tester, '$mode empty bookings');
      await tester.pumpWidget(const SizedBox());

      final failing = _api()..on('GET /v1/bookings', _serverFault);
      await pumpApp(tester, failing, signedIn: true);
      await _tapText(tester, 'My bookings');
      expect(find.byKey(const Key('error-illustration')), findsOneWidget);
      await _guidelines(tester, '$mode failed bookings');
      handle.dispose();
    });
  }
}
