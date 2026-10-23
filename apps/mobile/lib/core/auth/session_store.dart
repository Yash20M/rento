import 'dart:async';
import 'dart:convert';

import '../api/models/models.dart';
import '../storage/secure_store.dart';

/// Where the signed-in session's tokens live (README §11.4): the short-lived access token **only in memory**, the
/// refresh token in the platform's secure storage. Nothing here is ever logged.
class SessionStore {
  SessionStore(this._store, {this.onCleared});

  /// Runs whenever the session ends, so personal data kept on the device (the saved bookings) goes with it.
  final Future<void> Function()? onCleared;

  static const String refreshKey = 'refresh_token';
  static const String userKey = 'user';

  final SecureStore _store;
  final StreamController<void> _forcedSignOuts = StreamController.broadcast();

  String? _accessToken;

  String? get accessToken => _accessToken;

  Future<String?> readRefreshToken() => _store.read(refreshKey);

  Future<void> save(AuthResponse tokens) async {
    _accessToken = tokens.accessToken;
    await _store.write(refreshKey, tokens.refreshToken);
    // Who is signed in, so the app can open with the saved bookings when it starts without a connection.
    await _store.write(userKey, jsonEncode(tokens.user.toJson()));
  }

  Future<UserSummary?> readUser() async {
    final raw = await _store.read(userKey);
    if (raw == null) return null;
    try {
      return UserSummary.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } on Object {
      return null;
    }
  }

  /// Forgets the session. [forced] announces that the system ended it (refresh token refused) rather than the person.
  Future<void> clear({bool forced = false}) async {
    _accessToken = null;
    await _store.delete(refreshKey);
    await _store.delete(userKey);
    await onCleared?.call();
    if (forced) _forcedSignOuts.add(null);
  }

  /// Fires when the session was ended without the person asking for it.
  Stream<void> get forcedSignOuts => _forcedSignOuts.stream;

  void dispose() => _forcedSignOuts.close();
}
