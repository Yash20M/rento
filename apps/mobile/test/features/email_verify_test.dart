import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

FakeApi _api({bool verified = false, Map<String, Object> extra = const {}}) =>
    FakeApi({
      'GET /v1/drawers': const StubResponse(200, <Object>[]),
      'GET /v1/me/kyc': const StubResponse(200, {
        'required': true,
        'status': 'none',
        'maskedAadhaar': null,
        'verifiedAt': null,
        'verifiedName': null,
        'reason': null,
      }),
      'POST /v1/auth/refresh': StubResponse(
        200,
        authJson(user: {...userJson(), 'emailVerified': verified}),
      ),
      ...extra,
    });

Future<void> _open(WidgetTester tester, FakeApi api) async {
  await pumpApp(tester, api, savedRefreshToken: 'refresh-0');
  await tester.tap(find.text('Account').first);
  await tester.pumpAndSettle();
}

void main() {
  restartJourney();
  testWidgets(
    'V-01 an unverified email is offered for verification on the account tab; a verified one is not',
    (tester) async {
      await _open(tester, _api());
      expect(find.text('Verify your email'), findsOneWidget);
    },
  );

  testWidgets('V-02 a verified email shows as verified, with no way in', (
    tester,
  ) async {
    await _open(tester, _api(verified: true));
    expect(find.text('Email verified'), findsOneWidget);
    expect(find.text('Verify your email'), findsNothing);
  });

  testWidgets(
    'V-03 the code from the link is sent trimmed; success is shown and the tile changes',
    (tester) async {
      final api = _api(
        extra: {'POST /v1/auth/email/verify': const StubResponse(204, null)},
      );
      await _open(tester, api);
      await tester.tap(find.byKey(const Key('email-tile')));
      await tester.pumpAndSettle();
      final submit = find.byKey(const Key('verify-submit'));
      expect(tester.widget<FilledButton>(submit).onPressed, isNull); // empty
      await tester.enterText(
        find.byKey(const Key('verify-token')),
        '  abcdefghijklmnopqrstuvwxyz  ',
      );
      await tester.pump();
      await tester.tap(submit);
      await tester.pumpAndSettle();

      expect(api.to('POST', '/v1/auth/email/verify').single.data, {
        'token': 'abcdefghijklmnopqrstuvwxyz',
      });
      expect(find.byKey(const Key('email-verified')), findsOneWidget);
      // Back on the account tab the tile now says verified.
      tester.state<NavigatorState>(find.byType(Navigator).first).pop();
      await tester.pumpAndSettle();
      expect(find.text('Email verified'), findsOneWidget);
    },
  );

  testWidgets('V-04 a dead or wrong code is explained and nothing changes', (
    tester,
  ) async {
    final api = _api(
      extra: {
        'POST /v1/auth/email/verify': StubResponse(
          422,
          problemJson(
            422,
            'VALIDATION_FAILED',
            errors: [
              {'field': 'token', 'message': 'is invalid or expired'},
            ],
          ),
        ),
      },
    );
    await _open(tester, api);
    await tester.tap(find.byKey(const Key('email-tile')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('verify-token')), 'wrong-code');
    await tester.pump();
    await tester.tap(find.byKey(const Key('verify-submit')));
    await tester.pumpAndSettle();
    expect(find.textContaining('not valid or has expired'), findsOneWidget);
    expect(find.byKey(const Key('email-verified')), findsNothing);
  });

  testWidgets('V-05 asking for a new link calls the server and confirms', (
    tester,
  ) async {
    final api = _api(
      extra: {
        'POST /v1/auth/email/verification/resend': const StubResponse(
          202,
          null,
        ),
      },
    );
    await _open(tester, api);
    await tester.tap(find.byKey(const Key('email-tile')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('verify-resend')));
    await tester.pumpAndSettle();
    expect(api.to('POST', '/v1/auth/email/verification/resend'), hasLength(1));
    expect(find.byKey(const Key('verify-resent')), findsOneWidget);
  });

  testWidgets('V-06 too many requests for a new link is explained', (
    tester,
  ) async {
    final api = _api(
      extra: {
        'POST /v1/auth/email/verification/resend': StubResponse(
          429,
          problemJson(429, 'RATE_LIMITED'),
        ),
      },
    );
    await _open(tester, api);
    await tester.tap(find.byKey(const Key('email-tile')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('verify-resend')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('verify-error')), findsOneWidget);
    expect(find.byKey(const Key('verify-resent')), findsNothing);
  });
}

void restartJourney() {
  testWidgets(
    'J-01 register → app restart → still signed in → sign out, and a second restart is signed out',
    (tester) async {
      final api = FakeApi({
        'POST /v1/auth/register': StubResponse(201, authJson()),
        'POST /v1/auth/refresh': StubResponse(200, authJson(n: 2)),
        'POST /v1/auth/logout': const StubResponse(204),
        'GET /v1/drawers': const StubResponse(200, <Object>[]),
        'GET /v1/me/kyc': const StubResponse(200, {
          'required': true,
          'status': 'none',
          'maskedAadhaar': null,
          'verifiedAt': null,
          'verifiedName': null,
          'reason': null,
        }),
      });
      final first = await pumpApp(tester, api);
      await tester.tap(find.text('New to Rento? Create an account'));
      await tester.pumpAndSettle();
      await enterText(tester, 'Your name', 'Asha');
      await enterText(tester, 'Email', 'asha@example.com');
      await enterText(tester, 'Password', 'a long enough password');
      await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
      await tester.pumpAndSettle();
      expect(find.byType(NavigationBar), findsOneWidget);
      final saved = await first.store.read('refresh_token');
      expect(saved, isNotNull);

      // "Restart": a brand-new app instance that only has what was saved on the device.
      await tester.pumpWidget(const SizedBox());
      final second = await pumpApp(tester, api, savedRefreshToken: saved);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(api.to('POST', '/v1/auth/refresh'), hasLength(1));

      await tester.tap(find.text('Account').first);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('sign-out')));
      await tester.pumpAndSettle();
      expect(find.text('Welcome back'), findsOneWidget);
      expect(await second.store.read('refresh_token'), isNull);

      // Nothing left on the device: the next start goes straight to sign-in.
      await tester.pumpWidget(const SizedBox());
      await pumpApp(tester, api);
      expect(find.text('Welcome back'), findsOneWidget);
      expect(api.to('POST', '/v1/auth/refresh'), hasLength(1));
    },
  );
}
