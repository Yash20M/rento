import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

const _profile = {
  'id': 'u-1',
  'email': 'asha@example.com',
  'displayName': 'Asha',
  'phone': null,
  'emailVerified': true,
  'avatarUrl': null,
  'needsProfileCompletion': <String>[],
};

Map<String, Object?> _with(Map<String, Object?> change) => {
  ..._profile,
  ...change,
};

FakeApi _api(Object patchAnswer) => FakeApi({
  'GET /v1/drawers': const StubResponse(200, <Object>[]),
  'GET /v1/me/kyc': const StubResponse(200, {
    'required': true,
    'status': 'none',
    'maskedAadhaar': null,
    'verifiedAt': null,
    'verifiedName': null,
    'reason': null,
  }),
  'GET /v1/me': const StubResponse(200, _profile),
  'PATCH /v1/me': patchAnswer,
});

Future<void> _open(WidgetTester tester, FakeApi api) async {
  await pumpApp(tester, api, signedIn: true);
  await tester.tap(find.text('Account').first);
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('edit-profile')));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('P-01 shows the saved details; only what changed is sent', (
    tester,
  ) async {
    final api = _api(StubResponse(200, _with({'phone': '+919876543210'})));
    await _open(tester, api);
    expect(
      tester
          .widget<TextField>(find.byKey(const Key('profile-name')))
          .controller!
          .text,
      'Asha',
    );
    await tester.enterText(
      find.byKey(const Key('profile-phone')),
      '+919876543210',
    );
    await tester.tap(find.byKey(const Key('profile-save')));
    await tester.pumpAndSettle();
    expect(api.to('PATCH', '/v1/me').single.data, {'phone': '+919876543210'});
    expect(find.text('Details saved'), findsOneWidget);
    expect(find.byKey(const Key('edit-profile-dialog')), findsNothing);
  });

  testWidgets('P-02 a new name appears on the account screen at once', (
    tester,
  ) async {
    final api = _api(StubResponse(200, _with({'displayName': 'Asha K'})));
    await _open(tester, api);
    await tester.enterText(find.byKey(const Key('profile-name')), 'Asha K');
    await tester.tap(find.byKey(const Key('profile-save')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('account-name')), findsOneWidget);
    expect(
      tester.widget<Text>(find.byKey(const Key('account-name'))).data,
      'Asha K',
    );
  });

  testWidgets('P-03 a rejected number is explained and the dialog stays open', (
    tester,
  ) async {
    final api = _api(StubResponse(422, problemJson(422, 'VALIDATION_FAILED')));
    await _open(tester, api);
    await tester.enterText(find.byKey(const Key('profile-phone')), '12345');
    await tester.tap(find.byKey(const Key('profile-save')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('profile-error')), findsOneWidget);
    expect(find.byKey(const Key('edit-profile-dialog')), findsOneWidget);
  });
}
