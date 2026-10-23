// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'health.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_HealthResponse _$HealthResponseFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_HealthResponse', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['status']);
      final val = _HealthResponse(
        status: $checkedConvert('status', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$HealthResponseToJson(_HealthResponse instance) =>
    <String, dynamic>{'status': instance.status};

_ReadinessChecks _$ReadinessChecksFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_ReadinessChecks', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['database']);
      final val = _ReadinessChecks(
        database: $checkedConvert('database', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$ReadinessChecksToJson(_ReadinessChecks instance) =>
    <String, dynamic>{'database': instance.database};

_ReadinessResponse _$ReadinessResponseFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_ReadinessResponse', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['status', 'checks']);
      final val = _ReadinessResponse(
        status: $checkedConvert('status', (v) => v as String),
        checks: $checkedConvert(
          'checks',
          (v) => ReadinessChecks.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ReadinessResponseToJson(_ReadinessResponse instance) =>
    <String, dynamic>{
      'status': instance.status,
      'checks': instance.checks.toJson(),
    };
