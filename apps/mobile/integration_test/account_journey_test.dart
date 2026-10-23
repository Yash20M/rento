import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:rento_mobile/app/app.dart';
import 'package:rento_mobile/app/config/env.dart';
import 'package:rento_mobile/app/providers.dart';
import 'package:rento_mobile/core/media/photo_picker.dart';

/// The real app on a real device or emulator, talking to a real API and database (started by
/// `pnpm test:live-android`, which passes the API address and the demo customer as --dart-define values).
const _api = String.fromEnvironment('API_BASE_URL');
const _email = String.fromEnvironment('LIVE_EMAIL');
const _password = String.fromEnvironment('LIVE_PASSWORD');

Future<void> _launch(
  WidgetTester tester, {
  String api = _api,
  PhotoPicker? picker,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      retry: (_, _) => null,
      overrides: [
        envProvider.overrideWithValue(
          AppEnv(flavor: Flavor.dev, apiBaseUrl: api),
        ),
        if (picker != null) photoPickerProvider.overrideWithValue(picker),
      ],
      child: const RentoApp(),
    ),
  );
  await tester.pumpAndSettle(const Duration(seconds: 2));
  if (api != _api) {
    return; // an offline launch keeps whatever session the device holds
  }
  // The device keeps its saved session between tests: every test starts signed out.
  await tester.pump(const Duration(seconds: 3));
  await tester.pumpAndSettle(const Duration(milliseconds: 500));
  if (find.text('Welcome back').evaluate().isEmpty) {
    await tester.tap(find.text('Account').first);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('sign-out')));
    await tester.tap(find.byKey(const Key('sign-out')));
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle(const Duration(milliseconds: 500));
  }
}

Future<void> _settle(WidgetTester tester, {int seconds = 4}) async {
  // Real network: give the answer time to arrive, then let the screen rebuild.
  await tester.pump(Duration(seconds: seconds));
  await tester.pumpAndSettle(const Duration(milliseconds: 500));
}

/// A real 1×1 PNG: the stand-in for "the picture the person chose from the gallery".
final _pixel = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
);

class _GalleryStandIn implements PhotoPicker {
  @override
  Future<PickedPhoto?> pick(PhotoSource source) async =>
      PickedPhoto(bytes: Uint8List.fromList(_pixel), contentType: 'image/png');
}

/// What is on screen, for a failure message that says more than "found 0 widgets".
String _screenText(WidgetTester tester) => tester
    .widgetList<Text>(find.byType(Text))
    .map((t) => t.data ?? '')
    .where((t) => t.isNotEmpty)
    .join(' | ');

/// Fills the sign-in form and presses the button (scrolled into view: the keyboard may be covering it).
Future<void> _signIn(WidgetTester tester, String password) async {
  await tester.enterText(find.widgetWithText(TextField, 'Email'), _email);
  await tester.enterText(find.widgetWithText(TextField, 'Password'), password);
  await tester.pump();
  final button = find.widgetWithText(FilledButton, 'Sign in');
  await tester.ensureVisible(button);
  await tester.tap(button);
}

/// Widgets whose key is a string starting with [prefix] (days, slots and durations carry their value in the key).
List<Finder> _keyed(String prefix) {
  final found = find.byWidgetPredicate((w) {
    final key = w.key;
    return key is ValueKey<String> && key.value.startsWith(prefix);
  });
  return [for (var i = 0; i < found.evaluate().length; i++) found.at(i)];
}

/// A screenshot after the pictures had real time to arrive (they load over the real network, outside the test clock).
Future<void> _shot(
  WidgetTester tester,
  IntegrationTestWidgetsFlutterBinding binding,
  String name,
) async {
  await tester.runAsync(
    () => Future<void>.delayed(const Duration(milliseconds: 1500)),
  );
  await tester.pump(const Duration(milliseconds: 400));
  await binding.takeScreenshot(name);
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  // Android needs the surface converted once before screenshots can be taken.
  setUpAll(() async => binding.convertFlutterSurfaceToImage());

  testWidgets('J-A1 sign in, edit the profile, see the new name, sign out', (
    tester,
  ) async {
    expect(_api, isNotEmpty, reason: 'run through pnpm test:live-android');
    await _launch(tester);

    // Signed out: the sign-in form.
    expect(find.text('Welcome back'), findsOneWidget);
    await _shot(tester, binding, '01-sign-in');

    await _signIn(tester, _password);
    await _settle(tester);

    // Signed in: the main navigation is there.
    expect(find.text('Welcome back'), findsNothing);
    await _shot(tester, binding, '02-explore');

    await tester.tap(find.text('Account').first);
    await _settle(tester, seconds: 1);
    expect(find.byKey(const Key('account-name')), findsOneWidget);
    await _shot(tester, binding, '03-account');

    // Edit the name.
    await tester.tap(find.byKey(const Key('edit-profile')));
    await _settle(tester, seconds: 2);
    expect(find.byKey(const Key('edit-profile-dialog')), findsOneWidget);
    final newName =
        'Live Tester ${DateTime.now().millisecondsSinceEpoch % 10000}';
    await tester.enterText(find.byKey(const Key('profile-name')), newName);
    await tester.tap(find.byKey(const Key('profile-save')));
    await _settle(tester, seconds: 3);
    expect(find.text('Details saved'), findsOneWidget);
    expect(find.text(newName), findsWidgets);
    await _shot(tester, binding, '04-profile-saved');

    // A wrong number is explained, not swallowed.
    await tester.tap(find.byKey(const Key('edit-profile')));
    await _settle(tester, seconds: 2);
    await tester.enterText(find.byKey(const Key('profile-phone')), '12345');
    await tester.tap(find.byKey(const Key('profile-save')));
    await _settle(tester, seconds: 3);
    expect(find.byKey(const Key('profile-error')), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await _settle(tester, seconds: 1);

    // Sign out lands on the sign-in form again.
    await tester.ensureVisible(find.byKey(const Key('sign-out')));
    await tester.tap(find.byKey(const Key('sign-out')));
    await _settle(tester, seconds: 2);
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets(
    'J-A3 find a drawer, reserve a slot, pay in the demo gateway, see it confirmed, cancel it',
    (tester) async {
      await _launch(tester);
      await _signIn(tester, _password);
      await _settle(tester);

      // Where are you: a demo place near the seeded drawers.
      await tester.tap(find.byKey(const Key('choose-location')));
      await _settle(tester, seconds: 1);
      await tester.tap(find.byKey(const Key('demo-Bengaluru · Indiranagar')));
      await _settle(tester);
      expect(find.text('Indiranagar Hub'), findsWidgets);
      await _shot(tester, binding, '10-drawers');

      await tester.tap(find.text('Indiranagar Hub').first);
      await _settle(tester);
      // Pictures arrive over the real network, outside the test clock: give them real time before the screenshot.
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(seconds: 3)),
      );
      await tester.pump();
      await _shot(tester, binding, '11-drawer');

      await tester.tap(find.text('GoPro Hero 12').first);
      await _settle(tester);
      expect(find.byKey(const Key('reserve')), findsOneWidget);

      // Tomorrow is always inside opening hours (the seeded drawers are open every day).
      await tester.tap(_keyed('day-')[1]);
      await _settle(tester, seconds: 3);
      final slots = _keyed('slot-');
      expect(
        slots,
        isNotEmpty,
        reason: 'no free slot tomorrow: ${_screenText(tester)}',
      );
      await tester.tap(slots.first);
      await _settle(tester, seconds: 1);
      final durations = _keyed('duration-');
      expect(durations, isNotEmpty);
      await tester.ensureVisible(durations.first);
      // The sticky reserve bar sits over the bottom of the list: lift the chip clear of it.
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -250));
      await tester.pumpAndSettle();
      await tester.tap(durations.first);
      await _settle(tester, seconds: 1);
      await tester.ensureVisible(find.byKey(const Key('summary-total')));
      await _shot(tester, binding, '12-slot-picked');

      await tester.ensureVisible(find.byKey(const Key('reserve')));
      await tester.tap(find.byKey(const Key('reserve')));
      await _settle(tester);
      // Held: the countdown and the pay button.
      expect(find.byKey(const Key('hold-countdown')), findsOneWidget);
      await _shot(tester, binding, '13-checkout');

      await tester.tap(find.byKey(const Key('pay')));
      await _settle(tester, seconds: 2);
      await tester.tap(find.byKey(const Key('demo-pay-card-ok')));
      await _settle(tester, seconds: 5);
      expect(find.byKey(const Key('confirmed-title')), findsOneWidget);
      await _shot(tester, binding, '14-confirmed');

      await tester.tap(find.byKey(const Key('view-booking')));
      await _settle(tester);
      expect(
        find.byKey(const Key('status-confirmed')),
        findsOneWidget,
        reason: 'on screen: ${_screenText(tester)}',
      );
      await _shot(tester, binding, '15-booking');

      // Cancel it: the refund is shown and the status changes.
      await tester.ensureVisible(find.byKey(const Key('cancel-booking')));
      await tester.tap(find.byKey(const Key('cancel-booking')));
      await _settle(tester, seconds: 1);
      await tester.tap(find.byKey(const Key('confirm-cancel')));
      await _settle(tester, seconds: 5);
      expect(find.byKey(const Key('status-cancelled')), findsOneWidget);
      expect(find.byKey(const Key('booking-refund')), findsOneWidget);
      await _shot(tester, binding, '16-cancelled');
    },
  );

  testWidgets(
    'J-A4 the phone has NO connection: the app opens signed in with the saved bookings and says it is offline',
    (tester) async {
      // Online first: sign in and look at the bookings, so there is something saved.
      await _launch(tester);
      await _signIn(tester, _password);
      await _settle(tester);
      await tester.tap(find.text('My bookings').first);
      await _settle(tester, seconds: 3);
      await tester.pumpWidget(const SizedBox());

      // Start the app again against an address nobody answers on (what no connection looks like).
      await _launch(tester, api: 'http://10.0.2.2:1');
      await tester.pump(const Duration(seconds: 6));
      await tester.pumpAndSettle(const Duration(milliseconds: 500));
      expect(
        find.text('Welcome back'),
        findsNothing,
        reason: 'not thrown to sign-in: ${_screenText(tester)}',
      );
      expect(find.byKey(const Key('offline-banner')), findsOneWidget);
      await _shot(tester, binding, '20-offline');
      await tester.tap(find.text('My bookings').first);
      await _settle(tester, seconds: 6);
      expect(
        find.byKey(const Key('offline-banner')),
        findsOneWidget,
        reason: _screenText(tester),
      );
      await _shot(tester, binding, '21-offline-bookings');

      // Leave the device clean for the next test: sign out (works offline, locally).
      await tester.tap(find.text('Account').first);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('sign-out')));
      await tester.tap(find.byKey(const Key('sign-out')));
      await _settle(tester, seconds: 4);
      expect(find.text('Welcome back'), findsOneWidget);
    },
  );

  testWidgets(
    'J-A5 change the profile photo from the gallery stand-in: saved, shown, then removed',
    (tester) async {
      await _launch(tester, picker: _GalleryStandIn());
      await _signIn(tester, _password);
      await _settle(tester);
      await tester.tap(find.text('Account').first);
      await _settle(tester, seconds: 2);
      await _shot(tester, binding, '30-account-with-photo');

      await tester.tap(find.byKey(const Key('change-photo')));
      await _settle(tester, seconds: 1);
      await tester.tap(find.byKey(const Key('photo-choose')));
      await _settle(tester, seconds: 4);
      expect(find.text('Photo updated'), findsOneWidget);
      await _shot(tester, binding, '31-photo-updated');

      // With a photo the sheet offers to remove it; removing goes back to the initial letter.
      await tester.tap(find.byKey(const Key('change-photo')));
      await _settle(tester, seconds: 1);
      expect(find.byKey(const Key('photo-remove')), findsOneWidget);
      await _shot(tester, binding, '32-photo-sheet');
      await tester.tap(find.byKey(const Key('photo-remove')));
      await _settle(tester, seconds: 4);
      expect(
        find.text('Photo removed'),
        findsOneWidget,
        reason: 'on screen: ${_screenText(tester)}',
      );
    },
  );

  testWidgets('J-A2 a wrong password is explained and nobody is signed in', (
    tester,
  ) async {
    await _launch(tester);
    await _signIn(tester, 'not-the-password');
    await _settle(tester);
    expect(
      find.byKey(const Key('auth-error')),
      findsOneWidget,
      reason: 'on screen: ${_screenText(tester)}',
    );
    expect(find.text('Welcome back'), findsOneWidget);
  });
}
