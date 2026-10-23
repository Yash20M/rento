// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'kyc.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_KycStatus _$KycStatusFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_KycStatus', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'required',
          'status',
          'maskedAadhaar',
          'verifiedAt',
          'verifiedName',
          'reason',
        ],
      );
      final val = _KycStatus(
        required: $checkedConvert('required', (v) => v as bool),
        status: $checkedConvert('status', (v) => v as String),
        maskedAadhaar: $checkedConvert('maskedAadhaar', (v) => v as String?),
        verifiedAt: $checkedConvert(
          'verifiedAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        verifiedName: $checkedConvert('verifiedName', (v) => v as String?),
        reason: $checkedConvert('reason', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$KycStatusToJson(_KycStatus instance) =>
    <String, dynamic>{
      'required': instance.required,
      'status': instance.status,
      'maskedAadhaar': instance.maskedAadhaar,
      'verifiedAt': instance.verifiedAt?.toIso8601String(),
      'verifiedName': instance.verifiedName,
      'reason': instance.reason,
    };

_StartAadhaarRequest _$StartAadhaarRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_StartAadhaarRequest', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['aadhaarNumber']);
      final val = _StartAadhaarRequest(
        aadhaarNumber: $checkedConvert('aadhaarNumber', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$StartAadhaarRequestToJson(
  _StartAadhaarRequest instance,
) => <String, dynamic>{'aadhaarNumber': instance.aadhaarNumber};

_AadhaarRequest _$AadhaarRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_AadhaarRequest', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['requestId', 'expiresAt', 'maskedAadhaar'],
      );
      final val = _AadhaarRequest(
        requestId: $checkedConvert('requestId', (v) => v as String),
        expiresAt: $checkedConvert(
          'expiresAt',
          (v) => DateTime.parse(v as String),
        ),
        maskedAadhaar: $checkedConvert('maskedAadhaar', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$AadhaarRequestToJson(_AadhaarRequest instance) =>
    <String, dynamic>{
      'requestId': instance.requestId,
      'expiresAt': instance.expiresAt.toIso8601String(),
      'maskedAadhaar': instance.maskedAadhaar,
    };

_VerifyAadhaarRequest _$VerifyAadhaarRequestFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('_VerifyAadhaarRequest', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['requestId', 'otp']);
  final val = _VerifyAadhaarRequest(
    requestId: $checkedConvert('requestId', (v) => v as String),
    otp: $checkedConvert('otp', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$VerifyAadhaarRequestToJson(
  _VerifyAadhaarRequest instance,
) => <String, dynamic>{'requestId': instance.requestId, 'otp': instance.otp};
