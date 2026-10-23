import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_controller.dart';
import '../features/account/presentation/account_page.dart';
import '../features/auth/presentation/auth_pages.dart';
import '../features/auth/presentation/recovery_pages.dart';
import '../features/booking/presentation/booking_detail_page.dart';
import '../features/booking/presentation/checkout_page.dart';
import '../features/booking/presentation/my_bookings_page.dart';
import '../features/booking/presentation/slot_picker_page.dart';
import '../features/catalog/presentation/drawer_page.dart';
import '../features/explore/presentation/explore_page.dart';
import '../features/auth/presentation/verify_email_page.dart';
import '../features/kyc/presentation/kyc_page.dart';
import '../features/account/presentation/sign_in_methods_page.dart';
import '../l10n/generated/app_localizations.dart';
import 'home_shell.dart';
import 'not_found_page.dart';

const _signedOutPaths = {'/login', '/register', '/forgot', '/reset'};

/// Where an app in this sign-in state must be, or null when [location] is fine. Signed-out people can only see the
/// two sign-in screens; signed-in people never see them again.
String? redirectFor(AuthState auth, String location) {
  switch (auth) {
    case AuthUnknown():
      return location == '/splash' ? null : '/splash';
    case SignedOut():
      return _signedOutPaths.contains(location) ? null : '/login';
    case SignedIn():
      return (_signedOutPaths.contains(location) || location == '/splash')
          ? '/'
          : null;
  }
}

/// Route table. Sign-in redirects, three tabs (explore, my bookings, account) and the booking flow.
GoRouter buildRouter({
  required Listenable refreshListenable,
  required AuthState Function() authState,
}) => GoRouter(
  refreshListenable: refreshListenable,
  redirect: (context, state) => redirectFor(authState(), state.matchedLocation),
  routes: [
    GoRoute(path: '/splash', builder: (context, state) => const _Splash()),
    GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
    GoRoute(
      path: '/register',
      builder: (context, state) => const RegisterPage(),
    ),
    GoRoute(
      path: '/forgot',
      builder: (context, state) => const ForgotPasswordPage(),
    ),
    GoRoute(
      path: '/reset',
      builder: (context, state) => const ResetPasswordPage(),
    ),
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => HomeShell(shell: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/',
              builder: (context, state) => const ExplorePage(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/bookings',
              builder: (context, state) => const MyBookingsPage(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/account',
              builder: (context, state) => const AccountPage(),
            ),
          ],
        ),
      ],
    ),
    GoRoute(
      path: '/drawer/:drawerId',
      builder:
          (context, state) =>
              DrawerPage(drawerId: state.pathParameters['drawerId']!),
      routes: [
        GoRoute(
          path: 'item/:itemId',
          builder:
              (context, state) => SlotPickerPage(
                drawerId: state.pathParameters['drawerId']!,
                itemModelId: state.pathParameters['itemId']!,
              ),
        ),
      ],
    ),
    GoRoute(path: '/kyc', builder: (context, state) => const KycPage()),
    GoRoute(
      path: '/sign-in-methods',
      builder: (context, state) => const SignInMethodsPage(),
    ),
    GoRoute(
      path: '/verify-email',
      builder: (context, state) => const VerifyEmailPage(),
    ),
    GoRoute(
      path: '/checkout/:bookingId',
      builder:
          (context, state) =>
              CheckoutPage(bookingId: state.pathParameters['bookingId']!),
    ),
    GoRoute(
      path: '/booking/:bookingId',
      builder:
          (context, state) =>
              BookingDetailPage(bookingId: state.pathParameters['bookingId']!),
    ),
  ],
  errorBuilder: (context, state) => const NotFoundPage(),
);

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Semantics(
        label: AppLocalizations.of(context).appName,
        child: const CircularProgressIndicator(),
      ),
    ),
  );
}
