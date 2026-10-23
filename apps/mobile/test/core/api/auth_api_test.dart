import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/app/config/env.dart';
import 'package:rento_mobile/core/api/api_client.dart';
import 'package:rento_mobile/core/api/auth_api.dart';
import 'package:rento_mobile/core/api/health_api.dart';
import 'package:rento_mobile/core/api/models/models.dart';

import '../../support/stub_http_adapter.dart';

const _env = AppEnv(flavor: Flavor.dev, apiBaseUrl: 'http://10.0.2.2:3000');

const _authBody = {
  'accessToken': 'access.jwt.token',
  'refreshToken': 'refresh-token-value',
  'tokenType': 'Bearer',
  'expiresIn': 900,
  'user': {
    'id': '0b1f6c1e-3c1a-4f55-9d2e-6a1b2c3d4e5f',
    'email': 'asha@example.com',
    'displayName': 'Asha Rao',
    'emailVerified': false,
    'avatarUrl': null,
  },
};

Dio _dio(StubHttpAdapter adapter) =>
    buildDio(_env, enableLogging: false)..httpClientAdapter = adapter;

void main() {
  group('AuthApi', () {
    test(
      'C-01 login posts the typed body and returns a typed response',
      () async {
        final adapter = StubHttpAdapter.constant(200, _authBody);
        final api = AuthApi(_dio(adapter));

        final result = await api.login(
          const LoginRequest(
            email: 'asha@example.com',
            password: 'a-strong-password',
          ),
        );

        final request = adapter.requests.single;
        expect(request.method, 'POST');
        expect(request.uri.toString(), 'http://10.0.2.2:3000/v1/auth/login');
        expect(request.headers['Accept'], 'application/json');
        expect(request.contentType, contains('application/json'));
        expect(request.data, {
          'email': 'asha@example.com',
          'password': 'a-strong-password',
        });
        expect(result.accessToken, 'access.jwt.token');
        expect(result.user.displayName, 'Asha Rao');
      },
    );

    test('C-02 register uses 201 and omits an absent phone', () async {
      final adapter = StubHttpAdapter.constant(201, _authBody);
      final api = AuthApi(_dio(adapter));

      final result = await api.register(
        const RegisterRequest(
          email: 'asha@example.com',
          password: 'a-strong-password',
          name: 'Asha Rao',
        ),
      );

      expect(adapter.requests.single.uri.path, '/v1/auth/register');
      expect(
        (adapter.requests.single.data as Map).containsKey('phone'),
        isFalse,
      );
      expect(result.user.email, 'asha@example.com');
    });

    test('C-03 refresh sends the refresh token', () async {
      final adapter = StubHttpAdapter.constant(200, _authBody);
      await AuthApi(
        _dio(adapter),
      ).refresh(const RefreshTokenRequest(refreshToken: 'tok'));

      expect(adapter.requests.single.uri.path, '/v1/auth/refresh');
      expect(adapter.requests.single.data, {'refreshToken': 'tok'});
    });

    test('C-04 logout accepts 204 with an empty body', () async {
      final adapter = StubHttpAdapter.constant(204);
      await AuthApi(
        _dio(adapter),
      ).logout(const RefreshTokenRequest(refreshToken: 'tok'));

      expect(adapter.requests.single.uri.path, '/v1/auth/logout');
    });

    test(
      'C-05 a problem+json error surfaces as DioException whose body parses as ProblemDetails',
      () async {
        final adapter = StubHttpAdapter.constant(409, {
          'type': 'urn:rento:problem:email-taken',
          'title': 'Conflict',
          'status': 409,
          'code': 'EMAIL_TAKEN',
          'detail': 'An account with this email already exists',
          'traceId': 'trace-1',
        });

        await expectLater(
          AuthApi(_dio(adapter)).register(
            const RegisterRequest(
              email: 'asha@example.com',
              password: 'a-strong-password',
              name: 'Asha Rao',
            ),
          ),
          throwsA(
            isA<DioException>().having(
              (e) =>
                  ProblemDetails.fromJson(
                    e.response!.data as Map<String, dynamic>,
                  ).code,
              'code',
              ErrorCode.emailTaken,
            ),
          ),
        );
      },
    );

    test(
      'C-06 a malformed success body fails loudly instead of returning garbage',
      () async {
        final adapter = StubHttpAdapter.constant(200, {
          'accessToken': 'only-this',
        });
        await expectLater(
          AuthApi(
            _dio(adapter),
          ).login(const LoginRequest(email: 'a@example.com', password: 'x')),
          throwsA(anything),
        );
      },
    );
  });

  group('AuthApi recovery', () {
    test('C-09 forgotPassword posts the email and accepts 202', () async {
      final adapter = StubHttpAdapter.constant(202);
      await AuthApi(
        _dio(adapter),
      ).forgotPassword(const ForgotPasswordRequest(email: 'asha@example.com'));

      expect(adapter.requests.single.uri.path, '/v1/auth/password/forgot');
      expect(adapter.requests.single.data, {'email': 'asha@example.com'});
    });

    test('C-10 resetPassword posts token + newPassword (204)', () async {
      final adapter = StubHttpAdapter.constant(204);
      await AuthApi(_dio(adapter)).resetPassword(
        const ResetPasswordRequest(token: 'tok', newPassword: 'a-new-password'),
      );

      expect(adapter.requests.single.uri.path, '/v1/auth/password/reset');
      expect(adapter.requests.single.data, {
        'token': 'tok',
        'newPassword': 'a-new-password',
      });
    });

    test('C-11 verifyEmail posts the token (204)', () async {
      final adapter = StubHttpAdapter.constant(204);
      await AuthApi(
        _dio(adapter),
      ).verifyEmail(const VerifyEmailRequest(token: 'tok'));

      expect(adapter.requests.single.uri.path, '/v1/auth/email/verify');
      expect(adapter.requests.single.data, {'token': 'tok'});
    });

    test('C-12 resendVerification posts without a body (202)', () async {
      final adapter = StubHttpAdapter.constant(202);
      await AuthApi(_dio(adapter)).resendVerification();

      expect(
        adapter.requests.single.uri.path,
        '/v1/auth/email/verification/resend',
      );
      expect(adapter.requests.single.method, 'POST');
    });

    test(
      'C-13 an invalid link is a 422 DioException with field token',
      () async {
        final adapter = StubHttpAdapter.constant(422, {
          'type': 'urn:rento:problem:validation-failed',
          'title': 'Unprocessable Entity',
          'status': 422,
          'code': 'VALIDATION_FAILED',
          'detail': 'The request is invalid',
          'traceId': 't',
          'errors': [
            {
              'field': 'token',
              'message': 'This link is invalid or has expired.',
            },
          ],
        });
        await expectLater(
          AuthApi(
            _dio(adapter),
          ).verifyEmail(const VerifyEmailRequest(token: 'x')),
          throwsA(
            isA<DioException>().having(
              (e) =>
                  ProblemDetails.fromJson(
                    e.response!.data as Map<String, dynamic>,
                  ).errors?.single.field,
              'field',
              'token',
            ),
          ),
        );
      },
    );
  });

  group('AuthApi social', () {
    const socialBody = {
      ..._authBody,
      'needsProfileCompletion': ['email'],
    };

    test(
      'C-14 signInWithGoogle posts idToken and parses profile completion',
      () async {
        final adapter = StubHttpAdapter.constant(200, socialBody);
        final result = await AuthApi(
          _dio(adapter),
        ).signInWithGoogle(const GoogleLoginRequest(idToken: 'g-token'));

        expect(adapter.requests.single.uri.path, '/v1/auth/social/google');
        expect(adapter.requests.single.data, {'idToken': 'g-token'});
        expect(result.needsProfileCompletion, ['email']);
        expect(result.user.id, isNotEmpty);
      },
    );

    test('C-15 facebook sends only the fields that are set', () async {
      final adapter = StubHttpAdapter.constant(200, socialBody);
      final api = AuthApi(_dio(adapter));
      await api.signInWithFacebook(
        const FacebookLoginRequest(accessToken: 'a'),
      );
      await api.signInWithFacebook(
        const FacebookLoginRequest(authenticationToken: 'b', nonce: 'n'),
      );

      expect(adapter.requests[0].data, {'accessToken': 'a'});
      expect(adapter.requests[1].data, {
        'authenticationToken': 'b',
        'nonce': 'n',
      });
      expect(adapter.requests[0].uri.path, '/v1/auth/social/facebook');
    });

    test('C-16 apple sends the nonce and the name only when given', () async {
      final adapter = StubHttpAdapter.constant(200, socialBody);
      final api = AuthApi(_dio(adapter));
      await api.signInWithApple(
        const AppleLoginRequest(
          identityToken: 'i',
          nonce: 'n',
          fullName: 'Anil Kumar',
        ),
      );
      await api.signInWithApple(
        const AppleLoginRequest(identityToken: 'i', nonce: 'n'),
      );

      expect(adapter.requests[0].data, {
        'identityToken': 'i',
        'nonce': 'n',
        'fullName': 'Anil Kumar',
      });
      expect(adapter.requests[1].data, {'identityToken': 'i', 'nonce': 'n'});
    });

    test('C-17 ACCOUNT_LINK_REQUIRED surfaces as a typed problem', () async {
      final adapter = StubHttpAdapter.constant(409, {
        'type': 'urn:rento:problem:account-link-required',
        'title': 'Conflict',
        'status': 409,
        'code': 'ACCOUNT_LINK_REQUIRED',
        'detail': 'An account with this email already exists.',
        'traceId': 't',
      });
      await expectLater(
        AuthApi(
          _dio(adapter),
        ).signInWithGoogle(const GoogleLoginRequest(idToken: 'x')),
        throwsA(
          isA<DioException>().having(
            (e) =>
                ProblemDetails.fromJson(
                  e.response!.data as Map<String, dynamic>,
                ).code,
            'code',
            ErrorCode.accountLinkRequired,
          ),
        ),
      );
    });
  });

  group('HealthApi', () {
    test('C-07 healthz and readyz parse', () async {
      final adapter = StubHttpAdapter(
        (options) =>
            options.uri.path == '/healthz'
                ? const StubResponse(200, {'status': 'ok'})
                : const StubResponse(200, {
                  'status': 'ready',
                  'checks': {'database': 'up'},
                }),
      );
      final api = HealthApi(_dio(adapter));

      expect((await api.healthz()).status, 'ok');
      expect((await api.readyz()).checks.database, 'up');
      expect(adapter.requests.map((r) => r.uri.path), ['/healthz', '/readyz']);
    });

    test('C-08 readyz 503 is a DioException (RETRY_LATER)', () async {
      final adapter = StubHttpAdapter.constant(503, {
        'type': 'urn:rento:problem:retry-later',
        'title': 'Service Unavailable',
        'status': 503,
        'code': 'RETRY_LATER',
        'detail': 'Database unavailable',
        'traceId': 't',
      });
      await expectLater(
        HealthApi(_dio(adapter)).readyz(),
        throwsA(
          isA<DioException>().having(
            (e) => e.response?.statusCode,
            'status',
            503,
          ),
        ),
      );
      expect(jsonEncode(adapter.requests.single.uri.path), '"/readyz"');
    });
  });
}
