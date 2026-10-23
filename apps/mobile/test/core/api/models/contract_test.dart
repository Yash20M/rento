import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'contract_guard.dart';

/// The committed OpenAPI document (single source of truth shared with the TypeScript clients).
Json _loadSpec() {
  final file = File('../../packages/contracts/openapi.json');
  return jsonDecode(file.readAsStringSync()) as Json;
}

Json _copy(Json spec) => jsonDecode(jsonEncode(spec)) as Json;

Json _schema(Json spec, String name) =>
    ((spec['components'] as Json)['schemas'] as Json)[name] as Json;

void main() {
  group('Dart models vs packages/contracts/openapi.json', () {
    test('D-01 the models are in sync with the real contract', () {
      expect(checkContract(_loadSpec()), isEmpty);
    });

    // The guard must actually bite: each mutation simulates a contract change that was not mirrored in Dart.
    test('D-02a a renamed property is detected', () {
      final spec = _copy(_loadSpec());
      final properties = _schema(spec, 'LoginDto')['properties'] as Json;
      properties['emailAddress'] = properties.remove('email');
      (_schema(spec, 'LoginDto')['required'] as List)
        ..remove('email')
        ..add('emailAddress');

      final problems = checkContract(spec);
      expect(problems, isNotEmpty);
      expect(problems.join('\n'), contains('LoginDto'));
    });

    test('D-02b a new required property is detected', () {
      final spec = _copy(_loadSpec());
      (_schema(spec, 'AuthResponseDto')['properties'] as Json)['sessionId'] = {
        'type': 'string',
      };
      (_schema(spec, 'AuthResponseDto')['required'] as List).add('sessionId');

      expect(checkContract(spec).join('\n'), contains('AuthResponseDto'));
    });

    test('D-02c an error code removed from the contract is detected', () {
      final spec = _copy(_loadSpec());
      (_schema(spec, 'ErrorCode')['enum'] as List).remove('EMAIL_TAKEN');

      expect(
        checkContract(spec),
        contains(
          'ErrorCode "EMAIL_TAKEN" is in the Dart enum but not in the contract.',
        ),
      );
    });

    test('D-02d an error code added to the contract is detected', () {
      final spec = _copy(_loadSpec());
      (_schema(spec, 'ErrorCode')['enum'] as List).add('SOMETHING_NEW');

      expect(
        checkContract(spec),
        contains(
          'ErrorCode "SOMETHING_NEW" is in the contract but not in the Dart enum.',
        ),
      );
    });

    test('D-02e nullability changes are detected', () {
      final spec = _copy(_loadSpec());
      (_schema(spec, 'UserSummaryDto')['properties'] as Json)['email'] = {
        'type': 'string',
      }; // no longer nullable

      expect(checkContract(spec).join('\n'), contains('UserSummaryDto.email'));
    });

    test('D-02f requiredness changes are detected', () {
      final spec = _copy(_loadSpec());
      (_schema(spec, 'RegisterDto')['required'] as List).add('phone');

      expect(checkContract(spec).join('\n'), contains('RegisterDto.phone'));
    });

    test('D-02g a brand-new schema forces a decision', () {
      final spec = _copy(_loadSpec());
      ((spec['components'] as Json)['schemas'] as Json)['ReviewDto'] = {
        'type': 'object',
        'properties': {
          'id': {'type': 'string'},
        },
        'required': ['id'],
      };

      expect(
        checkContract(spec),
        contains(
          'Schema "ReviewDto" is in the contract but has no Dart model.',
        ),
      );
    });

    test('D-02h a schema removed from the contract is detected', () {
      final spec = _copy(_loadSpec());
      ((spec['components'] as Json)['schemas'] as Json).remove('FieldErrorDto');

      expect(
        checkContract(spec),
        contains(
          'Dart models "FieldErrorDto" but the contract has no such schema.',
        ),
      );
    });
  });
}
