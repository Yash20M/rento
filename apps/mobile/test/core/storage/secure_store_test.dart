import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:rento_mobile/core/storage/secure_store.dart';

class _MockStorage extends Mock implements FlutterSecureStorage {}

void main() {
  late _MockStorage storage;
  late FlutterSecureStore store;

  setUp(() {
    storage = _MockStorage();
    store = FlutterSecureStore(storage: storage);
  });

  test('S-01 write prefixes the key with "rento."', () async {
    when(
      () => storage.write(key: any(named: 'key'), value: any(named: 'value')),
    ).thenAnswer((_) async {});

    await store.write('refresh_token', 'abc');

    verify(
      () => storage.write(key: 'rento.refresh_token', value: 'abc'),
    ).called(1);
  });

  test(
    'S-02 read and delete use the prefixed key; missing keys read as null',
    () async {
      when(() => storage.read(key: 'rento.k')).thenAnswer((_) async => 'v');
      when(
        () => storage.read(key: 'rento.missing'),
      ).thenAnswer((_) async => null);
      when(
        () => storage.delete(key: any(named: 'key')),
      ).thenAnswer((_) async {});

      expect(await store.read('k'), 'v');
      expect(await store.read('missing'), isNull);
      await store.delete('k');

      verify(() => storage.delete(key: 'rento.k')).called(1);
    },
  );

  test(
    'S-03 the default storage uses first-unlock-this-device Keychain accessibility',
    () {
      final defaults = FlutterSecureStore.defaultStorage();
      expect(
        defaults.iOptions.toMap()['accessibility'],
        'first_unlock_this_device',
      );
    },
  );

  test('S-04 InMemorySecureStore round-trips and deletes', () async {
    final memory = InMemorySecureStore();
    expect(await memory.read('a'), isNull);
    await memory.write('a', '1');
    expect(await memory.read('a'), '1');
    await memory.delete('a');
    expect(await memory.read('a'), isNull);
  });
}
