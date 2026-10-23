import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/app/config/env.dart';
import 'package:rento_mobile/core/api/api_client.dart';
import 'package:rento_mobile/core/api/me_api.dart';
import 'package:rento_mobile/core/api/models/models.dart';

import '../../support/stub_http_adapter.dart';

const _env = AppEnv(flavor: Flavor.dev, apiBaseUrl: 'http://10.0.2.2:3000');

const _identities = [
  {
    'provider': 'password',
    'email': 'asha@example.com',
    'emailVerified': true,
    'linkedAt': '2030-01-01T00:00:00.000Z',
  },
  {
    'provider': 'google',
    'email': null,
    'emailVerified': false,
    'linkedAt': '2030-01-02T10:30:00.000Z',
  },
];

Dio _dio(StubHttpAdapter adapter) =>
    buildDio(_env, enableLogging: false)..httpClientAdapter = adapter;

void main() {
  group('MeApi', () {
    test('C-18 identities parses the list', () async {
      final adapter = StubHttpAdapter.constant(200, _identities);
      final result = await MeApi(_dio(adapter)).identities();

      expect(adapter.requests.single.method, 'GET');
      expect(adapter.requests.single.uri.path, '/v1/me/identities');
      expect(result.map((i) => i.provider), ['password', 'google']);
      expect(result[1].email, isNull);
      expect(result[0].linkedAt, DateTime.utc(2030, 1, 1));
    });

    test(
      'C-19 link calls post the provider body and return the new list',
      () async {
        final adapter = StubHttpAdapter.constant(200, _identities);
        final api = MeApi(_dio(adapter));
        await api.linkGoogle(const GoogleLoginRequest(idToken: 'g'));
        await api.linkFacebook(const FacebookLoginRequest(accessToken: 'f'));
        final result = await api.linkApple(
          const AppleLoginRequest(identityToken: 'a', nonce: 'n'),
        );

        expect(adapter.requests.map((r) => r.uri.path), [
          '/v1/me/identities/google',
          '/v1/me/identities/facebook',
          '/v1/me/identities/apple',
        ]);
        expect(adapter.requests[0].data, {'idToken': 'g'});
        expect(adapter.requests[2].data, {'identityToken': 'a', 'nonce': 'n'});
        expect(result, hasLength(2));
      },
    );

    test('C-20 unlink deletes by provider and accepts 204', () async {
      final adapter = StubHttpAdapter.constant(204);
      await MeApi(_dio(adapter)).unlink('google');

      expect(adapter.requests.single.method, 'DELETE');
      expect(adapter.requests.single.uri.path, '/v1/me/identities/google');
    });

    test('C-21 updateProfile sends only the fields that are set', () async {
      final adapter = StubHttpAdapter.constant(200, {
        'id': '0b1f6c1e-3c1a-4f55-9d2e-6a1b2c3d4e5f',
        'email': null,
        'displayName': 'Asha',
        'phone': '+919876543210',
        'emailVerified': false,
        'avatarUrl': null,
        'needsProfileCompletion': ['email'],
      });
      final result = await MeApi(
        _dio(adapter),
      ).updateProfile(const UpdateProfileRequest(phone: '+919876543210'));

      expect(adapter.requests.single.method, 'PATCH');
      expect(adapter.requests.single.uri.path, '/v1/me');
      expect(adapter.requests.single.data, {'phone': '+919876543210'});
      expect(result.needsProfileCompletion, ['email']);
    });

    test(
      'C-22 IDENTITY_IN_USE and LAST_LOGIN_METHOD are typed problems',
      () async {
        for (final code in ['IDENTITY_IN_USE', 'LAST_LOGIN_METHOD']) {
          final adapter = StubHttpAdapter.constant(409, {
            'type': 'urn:rento:problem:conflict',
            'title': 'Conflict',
            'status': 409,
            'code': code,
            'detail': 'd',
            'traceId': 't',
          });
          await expectLater(
            MeApi(_dio(adapter)).unlink('google'),
            throwsA(
              isA<DioException>().having(
                (e) =>
                    ProblemDetails.fromJson(
                      e.response!.data as Map<String, dynamic>,
                    ).code,
                'code',
                code == 'IDENTITY_IN_USE'
                    ? ErrorCode.identityInUse
                    : ErrorCode.lastLoginMethod,
              ),
            ),
          );
        }
      },
    );
  });
}
