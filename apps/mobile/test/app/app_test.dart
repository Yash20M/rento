import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/app/providers.dart';
import 'package:rento_mobile/app/router.dart';
import 'package:rento_mobile/app/theme.dart';
import 'package:rento_mobile/core/auth/auth_controller.dart';
import 'package:rento_mobile/core/api/models/models.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

FakeApi _signedInApi() =>
    FakeApi({'GET /v1/drawers': const StubResponse(200, <Object>[])});

void main() {
  testWidgets(
    'W-01 a first start with no saved session shows the sign-in screen',
    (tester) async {
      await pumpApp(tester, FakeApi({}));

      expect(find.text('Welcome back'), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
    },
  );

  testWidgets(
    'W-02 a saved session is restored and opens the app with its tabs',
    (tester) async {
      final api = _signedInApi();
      await pumpApp(tester, api, signedIn: true);

      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.text('Find a drawer'), findsWidgets); // explore tab title
      expect(api.to('POST', '/v1/auth/refresh').single.data, {
        'refreshToken': 'refresh-0',
      });
    },
  );

  testWidgets(
    'W-03 a refused saved session ends at the sign-in screen and is forgotten',
    (tester) async {
      final api = FakeApi({
        'POST /v1/auth/refresh': StubResponse(
          401,
          problemJson(401, 'UNAUTHENTICATED', detail: 'Invalid refresh token'),
        ),
      });
      final pumped = await pumpApp(
        tester,
        api,
        savedRefreshToken: 'refresh-stale',
      );

      expect(find.text('Welcome back'), findsOneWidget);
      expect(await pumped.store.read('refresh_token'), isNull);
    },
  );

  testWidgets('W-04 the app title and supported locale come from l10n', (
    tester,
  ) async {
    await pumpApp(tester, FakeApi({}));

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.supportedLocales, contains(const Locale('en')));
    expect(app.localizationsDelegates, isNotEmpty);
    final context = tester.element(find.byType(Scaffold).first);
    expect(Localizations.localeOf(context).languageCode, 'en');
  });

  testWidgets(
    'W-05 unknown routes show "Page not found" and recover to the app',
    (tester) async {
      final api = _signedInApi();
      final pumped = await pumpApp(tester, api, signedIn: true);

      pumped.container.read(routerProvider).go('/definitely/not/here');
      await tester.pumpAndSettle();
      expect(find.text('Page not found'), findsOneWidget);

      await tester.tap(find.text('Back to home'));
      await tester.pumpAndSettle();
      expect(find.byType(NavigationBar), findsOneWidget);
    },
  );

  testWidgets('W-06 Material 3 light and dark themes are distinct', (
    tester,
  ) async {
    await pumpApp(tester, FakeApi({}));

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.themeMode, ThemeMode.system);
    expect(app.theme?.useMaterial3, isTrue);
    expect(app.darkTheme?.useMaterial3, isTrue);
    expect(app.theme?.colorScheme.brightness, Brightness.light);
    expect(app.darkTheme?.colorScheme.brightness, Brightness.dark);
    expect(
      AppTheme.light().colorScheme.surface,
      isNot(AppTheme.dark().colorScheme.surface),
    );
  });

  test('envProvider throws unless overridden (no silent defaults)', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(() => container.read(envProvider), throwsA(anything));
  });

  group('who may be where (redirectFor)', () {
    final signedIn = SignedIn(UserSummary.fromJson(userJson()));

    test(
      'R-01 while the saved session is being checked, everything waits on the splash screen',
      () {
        expect(redirectFor(const AuthUnknown(), '/'), '/splash');
        expect(redirectFor(const AuthUnknown(), '/bookings'), '/splash');
        expect(redirectFor(const AuthUnknown(), '/splash'), isNull);
      },
    );

    test('R-02 signed-out people can only see the two sign-in screens', () {
      expect(redirectFor(const SignedOut(), '/'), '/login');
      expect(redirectFor(const SignedOut(), '/bookings'), '/login');
      expect(redirectFor(const SignedOut(), '/checkout/b-1'), '/login');
      expect(redirectFor(const SignedOut(), '/splash'), '/login');
      expect(redirectFor(const SignedOut(), '/login'), isNull);
      expect(redirectFor(const SignedOut(), '/register'), isNull);
    });

    test('R-03 signed-in people never see the sign-in screens again', () {
      expect(redirectFor(signedIn, '/login'), '/');
      expect(redirectFor(signedIn, '/register'), '/');
      expect(redirectFor(signedIn, '/splash'), '/');
      expect(redirectFor(signedIn, '/bookings'), isNull);
      expect(redirectFor(signedIn, '/drawer/d-1/item/m-1'), isNull);
    });
  });
}
