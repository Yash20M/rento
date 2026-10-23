import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Small key-value store for secrets (README §11.4): refresh token in secure storage, access token only in
/// memory. Backed by the iOS Keychain / Android Keystore. P3-11 stores the refresh token through this.
abstract class SecureStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// [SecureStore] on `flutter_secure_storage`. Every key is namespaced with `rento.` so the app's entries
/// are recognisable and cannot collide with other libraries' keys.
class FlutterSecureStore implements SecureStore {
  FlutterSecureStore({FlutterSecureStorage? storage})
    : _storage = storage ?? defaultStorage();

  static const String keyPrefix = 'rento.';

  /// iOS items stay on this device and are readable after the first unlock (so background refresh works)
  /// but are never migrated to other devices via backups. Android uses the library's Keystore-backed
  /// defaults (`encryptedSharedPreferences` is deprecated in flutter_secure_storage 10).
  static FlutterSecureStorage defaultStorage() => const FlutterSecureStorage(
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: '$keyPrefix$key');

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: '$keyPrefix$key', value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: '$keyPrefix$key');
}

/// Non-persistent store for tests and previews.
class InMemorySecureStore implements SecureStore {
  final Map<String, String> _values = {};

  @override
  Future<String?> read(String key) async => _values[key];

  @override
  Future<void> write(String key, String value) async => _values[key] = value;

  @override
  Future<void> delete(String key) async => _values.remove(key);
}
