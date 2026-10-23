import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../api/api_exception.dart';
import '../api/models/models.dart';
import '../net/connectivity.dart';

sealed class AuthState {
  const AuthState();
}

/// The app has just started and is checking whether a saved session still works.
class AuthUnknown extends AuthState {
  const AuthUnknown();
}

class SignedOut extends AuthState {
  const SignedOut();
}

class SignedIn extends AuthState {
  const SignedIn(this.user);

  final UserSummary user;
}

/// Sign-in state of the app. Tokens live in `SessionStore`; this only says who is signed in.
class AuthController extends Notifier<AuthState> {
  StreamSubscription<void>? _forced;

  @override
  AuthState build() {
    final session = ref.watch(sessionStoreProvider);
    _forced = session.forcedSignOuts.listen((_) => state = const SignedOut());
    ref.onDispose(() => _forced?.cancel());
    // Opened offline with a saved session: once Rento can be reached again, finish signing in.
    ref.listen(onlineProvider, (_, online) {
      if (online && state is SignedIn && session.accessToken == null) {
        unawaited(_restore());
      }
    });
    unawaited(Future.microtask(_restore));
    return const AuthUnknown();
  }

  /// A reload / app start: the refresh token (if any) buys a new access token.
  Future<void> _restore() async {
    final session = ref.read(sessionStoreProvider);
    final refreshToken = await session.readRefreshToken();
    if (refreshToken == null) {
      state = const SignedOut();
      return;
    }
    try {
      final tokens = await guardApi(
        () => ref
            .read(authApiProvider)
            .refresh(RefreshTokenRequest(refreshToken: refreshToken)),
      );
      await session.save(tokens);
      state = SignedIn(tokens.user);
    } on ApiException catch (error) {
      if (!error.isNetwork) {
        // The server refused the token: the session is over.
        await session.clear();
        state = const SignedOut();
        return;
      }
      // No connection: open with what was saved (read-only) instead of throwing the person to the sign-in screen.
      final saved = await session.readUser();
      if (state is! SignedIn) {
        state = saved == null ? const SignedOut() : SignedIn(saved);
      }
    }
  }

  Future<void> signIn(String email, String password) async {
    final tokens = await guardApi(
      () => ref
          .read(authApiProvider)
          .login(LoginRequest(email: email.trim(), password: password)),
    );
    await _adopt(tokens);
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final tokens = await guardApi(
      () => ref
          .read(authApiProvider)
          .register(
            RegisterRequest(
              name: name.trim(),
              email: email.trim(),
              password: password,
            ),
          ),
    );
    await _adopt(tokens);
  }

  Future<void> signOut() async {
    final session = ref.read(sessionStoreProvider);
    final refreshToken = await session.readRefreshToken();
    await session.clear();
    state = const SignedOut();
    if (refreshToken != null) {
      try {
        await ref
            .read(authApiProvider)
            .logout(RefreshTokenRequest(refreshToken: refreshToken));
      } catch (_) {
        // The session is gone locally either way.
      }
    }
  }

  /// The server confirmed the email: the account screen stops asking.
  void markEmailVerified() {
    final current = state;
    if (current is SignedIn) {
      state = SignedIn(current.user.copyWith(emailVerified: true));
    }
  }

  /// The server accepted a new display name: show it at once.
  void markNameChanged(String name) {
    final current = state;
    if (current is SignedIn) {
      state = SignedIn(current.user.copyWith(displayName: name));
    }
  }

  /// The server accepted a new (or removed) profile photo: show it at once.
  void markAvatarChanged(String? avatarUrl) {
    final current = state;
    if (current is SignedIn) {
      state = SignedIn(current.user.copyWith(avatarUrl: avatarUrl));
    }
  }

  Future<void> _adopt(AuthResponse tokens) async {
    await ref.read(sessionStoreProvider).save(tokens);
    state = SignedIn(tokens.user);
  }
}
