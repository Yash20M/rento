import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

FakeApi _api(Object deleteAnswer) => FakeApi({
  'GET /v1/drawers': const StubResponse(200, <Object>[]),
  'GET /v1/me/kyc': const StubResponse(200, {
    'required': true,
    'status': 'none',
    'maskedAadhaar': null,
    'verifiedAt': null,
    'verifiedName': null,
    'reason': null,
  }),
  'DELETE /v1/me': deleteAnswer,
  'POST /v1/auth/logout': const StubResponse(204),
});

Future<void> _openDialog(WidgetTester tester, FakeApi api) async {
  await pumpApp(tester, api, signedIn: true);
  await tester.tap(find.text('Account').first);
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.byKey(const Key('delete-account')));
  await tester.tap(find.byKey(const Key('delete-account')));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('A-01 deleting needs the password; Cancel changes nothing', (
    tester,
  ) async {
    final api = _api(const StubResponse(204));
    await _openDialog(tester, api);
    expect(find.byKey(const Key('delete-account-dialog')), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('delete-confirm')))
          .onPressed,
      isNull,
    );
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('delete-account-dialog')), findsNothing);
    expect(api.to('DELETE', '/v1/me'), isEmpty);
  });

  testWidgets(
    'A-02 the password is sent, the person is signed out and lands on sign-in',
    (tester) async {
      final api = _api(const StubResponse(204));
      final pumped =
          await (() async {
            await _openDialog(tester, api);
          })();
      pumped;
      await tester.enterText(
        find.byKey(const Key('delete-password')),
        'my password!!',
      );
      await tester.pump();
      await tester.tap(find.byKey(const Key('delete-confirm')));
      await tester.pumpAndSettle();
      expect(api.to('DELETE', '/v1/me').single.data, {
        'password': 'my password!!',
      });
      expect(find.text('Welcome back'), findsOneWidget);
    },
  );

  testWidgets('A-03 a wrong password is explained and the account stays', (
    tester,
  ) async {
    final api = _api(StubResponse(401, problemJson(401, 'UNAUTHENTICATED')));
    await _openDialog(tester, api);
    await tester.enterText(find.byKey(const Key('delete-password')), 'wrong');
    await tester.pump();
    await tester.tap(find.byKey(const Key('delete-confirm')));
    await tester.pumpAndSettle();
    expect(find.text('That password is not right.'), findsOneWidget);
    expect(find.byKey(const Key('delete-account-dialog')), findsOneWidget);
  });

  testWidgets('A-04 a live booking blocks deletion and says what to do', (
    tester,
  ) async {
    final api = _api(
      StubResponse(409, problemJson(409, 'HAS_FUTURE_BOOKINGS')),
    );
    await _openDialog(tester, api);
    await tester.enterText(
      find.byKey(const Key('delete-password')),
      'my password!!',
    );
    await tester.pump();
    await tester.tap(find.byKey(const Key('delete-confirm')));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Cancel or finish your current bookings'),
      findsOneWidget,
    );
  });
}
