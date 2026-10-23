import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/app/theme.dart';
import 'package:rento_mobile/core/ui/kit.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

FakeApi _api({Map<String, Object> extra = const {}}) => FakeApi({
  'GET /v1/drawers': StubResponse(200, [drawerJson()]),
  'POST /v1/drawers/nearby': StubResponse(200, {
    'drawers': [nearbyDrawerJson()],
    'unavailable': <Object>[],
  }),
  'GET /v1/drawers/d-1/inventory': StubResponse(200, [inventoryJson()]),
  'GET /v1/drawers/d-1/items/m-1/availability': StubResponse(
    200,
    availabilityJson(),
  ),
  'GET /v1/bookings': const StubResponse(200, <Object>[]),
  ...extra,
});

Future<void> _toExplore(WidgetTester tester, FakeApi api) async {
  await pumpApp(tester, api, signedIn: true);
}

Future<void> _toSlotPicker(WidgetTester tester, FakeApi api) async {
  await _toExplore(tester, api);
  await tester.tap(find.byKey(const Key('choose-location')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('demo-Bengaluru · Indiranagar')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Indiranagar').first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('PlayStation 5').first);
  await tester.pumpAndSettle();
}

void main() {
  group('theme', () {
    test('D-01 both themes are Material 3 with the same brand colour', () {
      for (final theme in [AppTheme.light(), AppTheme.dark()]) {
        expect(theme.useMaterial3, isTrue);
        expect(
          theme.filledButtonTheme.style?.minimumSize?.resolve({})?.height,
          52,
        );
      }
      expect(AppTheme.light().colorScheme.brightness, Brightness.light);
      expect(AppTheme.dark().colorScheme.brightness, Brightness.dark);
      expect(
        AppTheme.light().colorScheme.primary,
        isNot(AppTheme.dark().colorScheme.primary),
      );
    });

    testWidgets('D-02 the shared pieces render in light and in dark', (
      tester,
    ) async {
      for (final theme in [AppTheme.light(), AppTheme.dark()]) {
        await tester.pumpWidget(
          MaterialApp(
            theme: theme,
            home: Scaffold(
              body: ListView(
                children: const [
                  Pill(label: 'Open now', icon: Icons.circle),
                  SectionTitle('Heading'),
                  CardSkeletons(count: 1, withImage: true),
                  SizedBox(
                    height: 240,
                    child: EmptyView(
                      icon: Icons.inbox,
                      title: 'Nothing here',
                      body: 'Come back later',
                    ),
                  ),
                  BrandHeader(child: Text('Hi')),
                ],
              ),
            ),
          ),
        );
        expect(find.text('Open now'), findsOneWidget);
        expect(find.text('Heading'), findsOneWidget);
        expect(find.byKey(const Key('loading-skeleton')), findsOneWidget);
        expect(find.text('Nothing here'), findsOneWidget);
        expect(find.text('Come back later'), findsOneWidget);
        expect(find.text('Hi'), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
    });
  });

  group('explore and drawer', () {
    testWidgets(
      'D-03 the explore screen greets the person and shows the nearby drawer with distance and open state',
      (tester) async {
        await _toExplore(tester, _api());
        expect(find.text('Hi, Asha'), findsOneWidget);
        expect(find.text('Find a drawer'), findsOneWidget);
        await tester.tap(find.byKey(const Key('choose-location')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('demo-Bengaluru · Indiranagar')));
        await tester.pumpAndSettle();
        expect(find.text('Open near you'), findsOneWidget);
        final card = find.byKey(const Key('drawer-d-1'));
        expect(
          find.descendant(of: card, matching: find.text('Open now')),
          findsOneWidget,
        );
        expect(find.byKey(const Key('location-label')), findsOneWidget);
      },
    );

    testWidgets(
      'D-04 the drawer page shows photo-first product cards with the stock as a pill',
      (tester) async {
        await _toExplore(tester, _api());
        await tester.tap(find.byKey(const Key('choose-location')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('demo-Bengaluru · Indiranagar')));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Indiranagar').first);
        await tester.pumpAndSettle();
        final tile = find.byKey(const Key('item-m-1'));
        expect(tile, findsOneWidget);
        expect(
          find.descendant(of: tile, matching: find.byType(Pill)),
          findsOneWidget,
        );
        expect(find.text('2 available now'), findsOneWidget);
      },
    );
  });

  group('slot picker', () {
    testWidgets(
      'D-05 the date strip selects a day and the reserve bar waits for a time and a length',
      (tester) async {
        await _toSlotPicker(tester, _api());
        // Nothing chosen: the bar asks for a time, and Reserve is off.
        expect(find.text('Pick a time and length'), findsOneWidget);
        expect(
          tester
              .widget<FilledButton>(find.byKey(const Key('reserve')))
              .onPressed,
          isNull,
        );
        await tester.tap(find.text('10:00 AM'));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('duration-60')));
        await tester.pumpAndSettle();
        // Now the total is fixed at the bottom and Reserve is on.
        expect(find.text('Total to pay'), findsOneWidget);
        expect(
          tester
              .widget<FilledButton>(find.byKey(const Key('reserve')))
              .onPressed,
          isNotNull,
        );
        expect(
          tester.widget<Text>(find.byKey(const Key('summary-total'))).data,
          '₹298',
        );
      },
    );

    testWidgets('D-06 picking another day clears the time and length', (
      tester,
    ) async {
      await _toSlotPicker(tester, _api());
      await tester.tap(find.text('10:00 AM'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('duration-60')), findsOneWidget);
      await tester.tap(find.byKey(const Key('day-2030-01-09')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('duration-60')), findsNothing);
      expect(find.text('Pick a time and length'), findsOneWidget);
    });

    testWidgets('D-07 each day card is a button with an accessible name', (
      tester,
    ) async {
      await _toSlotPicker(tester, _api());
      final semantics = tester.getSemantics(
        find.byKey(const Key('day-2030-01-09')),
      );
      expect(semantics.label, contains('Wed 9'));
    });
  });

  group('bookings and account', () {
    testWidgets('D-08 an empty bookings tab has a friendly empty state', (
      tester,
    ) async {
      await _toExplore(tester, _api());
      await tester.tap(find.text('My bookings').first);
      await tester.pumpAndSettle();
      expect(find.byType(EmptyView), findsWidgets);
      expect(find.text('No upcoming bookings'), findsWidgets);
    });

    testWidgets(
      'D-09 the account screen has a header with the initial and the name',
      (tester) async {
        await _toExplore(
          tester,
          _api(
            extra: {
              'GET /v1/me/kyc': const StubResponse(200, {
                'required': true,
                'status': 'none',
                'maskedAadhaar': null,
                'verifiedAt': null,
                'verifiedName': null,
                'reason': null,
              }),
            },
          ),
        );
        await tester.tap(find.text('Account').first);
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('account-name')), findsOneWidget);
        expect(find.text('A'), findsOneWidget); // the avatar initial of "Asha"
        expect(find.text('Signed in as asha@example.com'), findsOneWidget);
      },
    );

    testWidgets('D-10 the sign-in screen carries the brand mark', (
      tester,
    ) async {
      await pumpApp(tester, _api());
      expect(find.byKey(const Key('brand-mark')), findsOneWidget);
    });
  });
}
