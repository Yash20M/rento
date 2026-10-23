import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/core/api/models/models.dart';

import 'contract_guard.dart';

final Json _spec =
    jsonDecode(File('../../packages/contracts/openapi.json').readAsStringSync())
        as Json;

Json _sample(String schema) =>
    sampleFor(
          _spec,
          ((_spec['components'] as Json)['schemas'] as Json)[schema] as Json,
        )!
        as Json;

void main() {
  group('responses built from the real OpenAPI examples', () {
    test('R-01 AuthResponse round-trips', () {
      final json = _sample('AuthResponseDto');
      final model = AuthResponse.fromJson(json);

      expect(model.tokenType, 'Bearer');
      expect(model.expiresIn, 900);
      expect(model.user.emailVerified, isFalse);
      expect(model.toJson(), json);
    });

    test(
      'R-02 ProblemDetails with field errors parses; every contract code is known',
      () {
        final json = _sample('ProblemDetailsDto')
          ..['errors'] = [
            {'field': 'password', 'message': 'This password is too common.'},
          ];
        final model = ProblemDetails.fromJson(json);

        expect(model.status, 422);
        expect(model.errors, hasLength(1));
        expect(model.errors!.single.field, 'password');

        final codes =
            (((_spec['components'] as Json)['schemas'] as Json)['ErrorCode']
                    as Json)['enum']
                as List;
        for (final wire in codes.cast<String>()) {
          final parsed = ProblemDetails.fromJson({...json, 'code': wire});
          expect(parsed.code, isNot(ErrorCode.unknown), reason: wire);
        }
        expect(
          ProblemDetails.fromJson({...json, 'code': 'RETRY_LATER'}).code,
          ErrorCode.retryLater,
        );
      },
    );

    test(
      'R-02b an error code from a NEWER server degrades to unknown instead of failing',
      () {
        final json = _sample('ProblemDetailsDto')
          ..['code'] = 'SOME_FUTURE_CODE';
        final model = ProblemDetails.fromJson(json);

        expect(model.code, ErrorCode.unknown);
        expect(
          model.detail,
          isNotEmpty,
        ); // the rest of the response is still usable
      },
    );

    test(
      'R-03 UserSummary accepts null email and displayName and writes them back',
      () {
        final json =
            _sample('UserSummaryDto')
              ..['email'] = null
              ..['displayName'] = null;
        final model = UserSummary.fromJson(json);

        expect(model.email, isNull);
        expect(model.displayName, isNull);
        expect(model.toJson(), containsPair('email', null));
      },
    );

    test('R-04 health and readiness models parse', () {
      expect(
        HealthResponse.fromJson(_sample('HealthResponseDto')).status,
        'ok',
      );
      final ready = ReadinessResponse.fromJson(_sample('ReadinessResponseDto'));
      expect(ready.status, 'ready');
      expect(ready.checks.database, 'up');
    });

    test('R-05 a missing required field fails loudly and names the field', () {
      final json = _sample('AuthResponseDto')..remove('accessToken');

      expect(
        () => AuthResponse.fromJson(json),
        throwsA(
          predicate(
            (e) => e.toString().contains('accessToken'),
            'mentions accessToken',
          ),
        ),
      );
    });
  });

  group('requests', () {
    test(
      'R-06 RegisterRequest omits phone when absent and includes it when set',
      () {
        const without = RegisterRequest(
          email: 'asha@example.com',
          password: 'correct horse battery staple',
          name: 'Asha Rao',
        );
        expect(without.toJson().containsKey('phone'), isFalse);

        final withPhone = without.copyWith(phone: '+919876543210');
        expect(withPhone.toJson()['phone'], '+919876543210');
      },
    );

    test('R-07 models have value equality', () {
      const a = LoginRequest(email: 'a@example.com', password: 'x');
      const b = LoginRequest(email: 'a@example.com', password: 'x');
      expect(a, b);
      expect(a.hashCode, b.hashCode);
      expect(a.copyWith(password: 'y'), isNot(a));
    });

    test('R-08 request JSON matches the contract field names', () {
      expect(
        const LoginRequest(
          email: 'a@example.com',
          password: 'secret-pw',
        ).toJson(),
        {'email': 'a@example.com', 'password': 'secret-pw'},
      );
      expect(const RefreshTokenRequest(refreshToken: 'tok').toJson(), {
        'refreshToken': 'tok',
      });
    });
  });
}
