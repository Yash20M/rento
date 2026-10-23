import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

/// P3-22 — the ways to sign in: listed with their dates, removable one by one, never down to zero.
Map<String, Object?> _method(String provider, {String? email}) => {
  'provider': provider,
  'email': email,
  'emailVerified': true,
  'linkedAt': '2030-01-07T03:00:00.000Z',
};

final _two = [
  _method('password', email: 'asha@example.com'),
  _method('google', email: 'asha@gmail.com'),
];

FakeApi _api(List<Map<String, Object?>> methods, {Object? unlink}) => FakeApi({
  'GET /v1/drawers': const StubResponse(200, <Object>[]),
  'GET /v1/me/kyc': const StubResponse(200, {
    'required': true,
    'status': 'none',
    'maskedAadhaar': null,
    'verifiedAt': null,
    'verifiedName': null,
    'reason': null,
  }),
  'GET /v1/me/identities': StubResponse(200, methods),
  if (unlink != null) 'DELETE /v1/me/identities/google': unlink,
});

Future<void> _open(WidgetTester tester, FakeApi api) async {
  await pumpApp(tester, api, signedIn: true);
  await tester.tap(find.text('Account').first);
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.byKey(const Key('methods-tile')));
  await tester.tap(find.byKey(const Key('methods-tile')));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'S-01 lists each way to sign in with its address and date, and offers Remove on each when there are two',
    (tester) async {
      await _open(
        tester,
        _api([
          _method('password', email: 'asha@example.com'),
          _method('google', email: 'asha@gmail.com'),
        ]),
      );
      expect(find.text('Email and password'), findsOneWidget);
      expect(find.text('Google'), findsOneWidget);
      expect(find.text('asha@gmail.com'), findsOneWidget);
      expect(find.textContaining('Added 7 Jan 2030'), findsNWidgets(2));
      expect(find.byKey(const Key('unlink-password')), findsOneWidget);
      expect(find.byKey(const Key('unlink-google')), findsOneWidget);
    },
  );

  testWidgets(
    'S-02 the last way to sign in cannot be removed: no button, and it says why',
    (tester) async {
      await _open(tester, _api([_method('google', email: 'asha@gmail.com')]));
      expect(find.byKey(const Key('unlink-google')), findsNothing);
      expect(find.byKey(const Key('only-method-google')), findsOneWidget);
      expect(find.text('Your only way to sign in'), findsOneWidget);
    },
  );

  testWidgets(
    'S-03 removing asks first, then removes it and shows the shorter list',
    (tester) async {
      final api = _api(_two, unlink: const StubResponse(204, null));
      await _open(tester, api);
      await tester.tap(find.byKey(const Key('unlink-google')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('remove-method-dialog')), findsOneWidget);
      expect(api.to('DELETE', '/v1/me/identities/google'), isEmpty);

      // after the removal the server lists only the password
      api.on(
        'GET /v1/me/identities',
        StubResponse(200, [_method('password', email: 'asha@example.com')]),
      );
      await tester.tap(find.byKey(const Key('confirm-remove-method')));
      await tester.pumpAndSettle();
      expect(api.to('DELETE', '/v1/me/identities/google'), hasLength(1));
      expect(find.text('Removed'), findsOneWidget);
      expect(find.byKey(const Key('method-google')), findsNothing);
      expect(find.byKey(const Key('only-method-password')), findsOneWidget);
    },
  );

  testWidgets('S-04 backing out of the question removes nothing', (
    tester,
  ) async {
    final api = _api([
      _method('password', email: 'asha@example.com'),
      _method('google', email: 'asha@gmail.com'),
    ]);
    await _open(tester, api);
    await tester.tap(find.byKey(const Key('unlink-google')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(api.to('DELETE', '/v1/me/identities/google'), isEmpty);
    expect(find.byKey(const Key('method-google')), findsOneWidget);
  });

  testWidgets(
    'S-05 if the server says it is the last method (another device removed the rest), that is explained',
    (tester) async {
      final api = _api(
        _two,
        unlink: StubResponse(409, problemJson(409, 'LAST_LOGIN_METHOD')),
      );
      await _open(tester, api);
      await tester.tap(find.byKey(const Key('unlink-google')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('confirm-remove-method')));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'You need at least one way to sign in, so this one cannot be removed.',
        ),
        findsOneWidget,
      );
    },
  );
}
