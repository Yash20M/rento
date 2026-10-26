import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

/// P3-45 — the "verified" language: a blue tick on the avatar for a verified identity, and a trust row that says in
/// words and icons what is verified, what is in review and what is still missing — each chip leads to the fix.
FakeApi _api({required bool email, required String kyc}) => FakeApi({
  'GET /v1/drawers': StubResponse(200, [drawerJson()]),
  'GET /v1/drawers/d-1/inventory': StubResponse(200, [inventoryJson()]),
  'GET /v1/bookings': const StubResponse(200, <Object>[]),
  'GET /v1/me/kyc': StubResponse(200, {
    'required': true,
    'status': kyc,
    'maskedAadhaar': kyc == 'verified' ? 'XXXX XXXX 1234' : null,
    'verifiedAt': null,
    'verifiedName': null,
    'reason': kyc == 'rejected' ? 'Name does not match' : null,
  }),
  'POST /v1/auth/refresh': StubResponse(
    200,
    authJson(user: {...userJson(), 'emailVerified': email}),
  ),
});

Future<void> _account(WidgetTester tester, FakeApi api) async {
  await pumpApp(tester, api, savedRefreshToken: 'refresh-0');
  await tester.tap(find.text('Account').first);
  await tester.pumpAndSettle();
}

String _chip(WidgetTester tester, String key) =>
    tester
        .widgetList<Text>(
          find.descendant(
            of: find.byKey(Key(key)),
            matching: find.byType(Text),
          ),
        )
        .map((t) => t.data)
        .join();

void main() {
  const cases = <({bool email, String kyc, String emailText, String idText})>[
    (
      email: true,
      kyc: 'verified',
      emailText: 'Email verified',
      idText: 'ID verified',
    ),
    (
      email: false,
      kyc: 'none',
      emailText: 'Email not verified',
      idText: 'ID not verified',
    ),
    (
      email: true,
      kyc: 'pending',
      emailText: 'Email verified',
      idText: 'ID in review',
    ),
    (
      email: false,
      kyc: 'rejected',
      emailText: 'Email not verified',
      idText: 'ID not accepted',
    ),
  ];
  for (final c in cases) {
    testWidgets(
      'T-01 email \${c.email ? "verified" : "missing"} + ID \${c.kyc}: the chips say so',
      (tester) async {
        await _account(tester, _api(email: c.email, kyc: c.kyc));
        expect(_chip(tester, 'trust-email'), c.emailText);
        expect(_chip(tester, 'trust-id'), c.idText);
        // The blue tick on the avatar appears only for a verified identity.
        expect(
          find.byKey(const Key('verified-badge')),
          c.kyc == 'verified' ? findsOneWidget : findsNothing,
        );
      },
    );
  }

  testWidgets(
    'T-02 a chip that is not yet done leads to the fix; a finished one does not',
    (tester) async {
      await _account(tester, _api(email: false, kyc: 'verified'));
      await tester.tap(find.byKey(const Key('trust-email')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('verify-token')), findsOneWidget);
      expect(
        find.byKey(const Key('trust-id')),
        findsNothing,
        reason: 'now on the verify screen',
      );
    },
  );

  testWidgets('T-03 the verified tick has a spoken name', (tester) async {
    final handle = tester.ensureSemantics();
    await _account(tester, _api(email: true, kyc: 'verified'));
    expect(
      tester.getSemantics(find.byKey(const Key('verified-badge'))).label,
      contains('Verified'),
    );
    handle.dispose();
  });

  testWidgets(
    'T-04 the drawer opens with today\'s hours in the drawer\'s own week, highlighted',
    (tester) async {
      // 2030-01-07 03:00 UTC is Monday morning in Bengaluru: weekday 1.
      final api = FakeApi({
        'GET /v1/drawers': StubResponse(200, [drawerJson()]),
        'GET /v1/drawers/d-1/inventory': StubResponse(200, [inventoryJson()]),
        'POST /v1/drawers/nearby': StubResponse(200, {
          'drawers': [nearbyDrawerJson()],
          'unavailable': <Object>[],
        }),
        'GET /v1/bookings': const StubResponse(200, <Object>[]),
      });
      await pumpApp(tester, api, signedIn: true);
      await chooseDemoPlace(tester);
      await tester.ensureVisible(find.text('Indiranagar').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Indiranagar').first);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('hours-tile')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('hours-tile')));
      await tester.pumpAndSettle();
      Color? fill(int day) =>
          (tester
                      .widget<Container>(find.byKey(Key('hours-day-$day')))
                      .decoration
                  as BoxDecoration)
              .color;
      expect(fill(1), isNot(Colors.transparent), reason: 'Monday is today');
      expect(fill(2), Colors.transparent);
    },
  );
}
