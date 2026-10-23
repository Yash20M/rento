import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/app/config/env.dart';

void main() {
  group('AppEnv.parse', () {
    test('E-01 defaults to dev with the Android-emulator loopback API', () {
      final env = AppEnv.parse({});
      expect(env.flavor, Flavor.dev);
      expect(env.apiBaseUrl, 'http://10.0.2.2:3000');
      expect(env.sentryDsn, isNull);
      expect(env.isProd, isFalse);
    });

    test('E-02 staging requires API_BASE_URL', () {
      expect(
        () => AppEnv.parse({'FLAVOR': 'staging'}),
        throwsA(
          isA<EnvException>().having(
            (e) => e.message,
            'message',
            contains('API_BASE_URL'),
          ),
        ),
      );
    });

    test('E-02b prod requires API_BASE_URL', () {
      expect(
        () => AppEnv.parse({'FLAVOR': 'prod'}),
        throwsA(isA<EnvException>()),
      );
    });

    test('E-03 prod must use https', () {
      expect(
        () => AppEnv.parse({
          'FLAVOR': 'prod',
          'API_BASE_URL': 'http://api.rento.example',
        }),
        throwsA(
          isA<EnvException>().having(
            (e) => e.message,
            'message',
            contains('https'),
          ),
        ),
      );
    });

    test('E-04 trims trailing slashes', () {
      final env = AppEnv.parse({
        'FLAVOR': 'prod',
        'API_BASE_URL': 'https://api.rento.example///',
      });
      expect(env.apiBaseUrl, 'https://api.rento.example');
      expect(env.isProd, isTrue);
    });

    test('E-05 rejects an unknown flavor, naming FLAVOR', () {
      expect(
        () => AppEnv.parse({'FLAVOR': 'qa'}),
        throwsA(
          isA<EnvException>().having(
            (e) => e.message,
            'message',
            contains('FLAVOR'),
          ),
        ),
      );
    });

    for (final bad in [
      'ftp://example.com',
      'not a url',
      'http://',
      'javascript:alert(1)',
    ]) {
      test('E-06 rejects API_BASE_URL "$bad"', () {
        expect(
          () => AppEnv.parse({'FLAVOR': 'dev', 'API_BASE_URL': bad}),
          throwsA(isA<EnvException>()),
        );
      });
    }

    test('E-07 empty SENTRY_DSN is null, a real one is kept', () {
      expect(AppEnv.parse({'SENTRY_DSN': ''}).sentryDsn, isNull);
      expect(AppEnv.parse({'SENTRY_DSN': '  '}).sentryDsn, isNull);
      expect(
        AppEnv.parse({
          'SENTRY_DSN': 'https://key@o1.ingest.sentry.io/1',
        }).sentryDsn,
        'https://key@o1.ingest.sentry.io/1',
      );
    });

    test('E-08 an error message never echoes the Sentry DSN', () {
      const dsn = 'https://supersecretkey@o1.ingest.sentry.io/1';
      try {
        AppEnv.parse({'FLAVOR': 'qa', 'SENTRY_DSN': dsn});
        fail('expected EnvException');
      } on EnvException catch (e) {
        expect(e.message, isNot(contains('supersecretkey')));
        expect(e.toString(), isNot(contains('supersecretkey')));
      }
    });

    test('E-09 dev accepts an explicit URL', () {
      final env = AppEnv.parse({'API_BASE_URL': 'http://192.168.1.20:3000'});
      expect(env.apiBaseUrl, 'http://192.168.1.20:3000');
    });

    test('E-10 trims whitespace around values', () {
      final env = AppEnv.parse({
        'FLAVOR': ' staging ',
        'API_BASE_URL': '  https://staging.rento.example/  ',
      });
      expect(env.flavor, Flavor.staging);
      expect(env.apiBaseUrl, 'https://staging.rento.example');
    });
  });
}
