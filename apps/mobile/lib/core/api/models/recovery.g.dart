// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'recovery.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ForgotPasswordRequest _$ForgotPasswordRequestFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('_ForgotPasswordRequest', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['email']);
  final val = _ForgotPasswordRequest(
    email: $checkedConvert('email', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$ForgotPasswordRequestToJson(
  _ForgotPasswordRequest instance,
) => <String, dynamic>{'email': instance.email};

_ResetPasswordRequest _$ResetPasswordRequestFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('_ResetPasswordRequest', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['token', 'newPassword']);
  final val = _ResetPasswordRequest(
    token: $checkedConvert('token', (v) => v as String),
    newPassword: $checkedConvert('newPassword', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$ResetPasswordRequestToJson(
  _ResetPasswordRequest instance,
) => <String, dynamic>{
  'token': instance.token,
  'newPassword': instance.newPassword,
};

_VerifyEmailRequest _$VerifyEmailRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_VerifyEmailRequest', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['token']);
      final val = _VerifyEmailRequest(
        token: $checkedConvert('token', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$VerifyEmailRequestToJson(_VerifyEmailRequest instance) =>
    <String, dynamic>{'token': instance.token};
