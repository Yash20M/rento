// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'social.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_GoogleLoginRequest _$GoogleLoginRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_GoogleLoginRequest', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['idToken']);
      final val = _GoogleLoginRequest(
        idToken: $checkedConvert('idToken', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$GoogleLoginRequestToJson(_GoogleLoginRequest instance) =>
    <String, dynamic>{'idToken': instance.idToken};

_FacebookLoginRequest _$FacebookLoginRequestFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('_FacebookLoginRequest', json, ($checkedConvert) {
  final val = _FacebookLoginRequest(
    accessToken: $checkedConvert('accessToken', (v) => v as String?),
    authenticationToken: $checkedConvert(
      'authenticationToken',
      (v) => v as String?,
    ),
    nonce: $checkedConvert('nonce', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$FacebookLoginRequestToJson(
  _FacebookLoginRequest instance,
) => <String, dynamic>{
  if (instance.accessToken case final value?) 'accessToken': value,
  if (instance.authenticationToken case final value?)
    'authenticationToken': value,
  if (instance.nonce case final value?) 'nonce': value,
};

_AppleLoginRequest _$AppleLoginRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_AppleLoginRequest', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['identityToken', 'nonce']);
      final val = _AppleLoginRequest(
        identityToken: $checkedConvert('identityToken', (v) => v as String),
        nonce: $checkedConvert('nonce', (v) => v as String),
        fullName: $checkedConvert('fullName', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$AppleLoginRequestToJson(_AppleLoginRequest instance) =>
    <String, dynamic>{
      'identityToken': instance.identityToken,
      'nonce': instance.nonce,
      if (instance.fullName case final value?) 'fullName': value,
    };

_SocialAuthResponse _$SocialAuthResponseFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_SocialAuthResponse', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'accessToken',
          'refreshToken',
          'tokenType',
          'expiresIn',
          'user',
          'needsProfileCompletion',
        ],
      );
      final val = _SocialAuthResponse(
        accessToken: $checkedConvert('accessToken', (v) => v as String),
        refreshToken: $checkedConvert('refreshToken', (v) => v as String),
        tokenType: $checkedConvert('tokenType', (v) => v as String),
        expiresIn: $checkedConvert('expiresIn', (v) => (v as num).toInt()),
        user: $checkedConvert(
          'user',
          (v) => UserSummary.fromJson(v as Map<String, dynamic>),
        ),
        needsProfileCompletion: $checkedConvert(
          'needsProfileCompletion',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SocialAuthResponseToJson(_SocialAuthResponse instance) =>
    <String, dynamic>{
      'accessToken': instance.accessToken,
      'refreshToken': instance.refreshToken,
      'tokenType': instance.tokenType,
      'expiresIn': instance.expiresIn,
      'user': instance.user.toJson(),
      'needsProfileCompletion': instance.needsProfileCompletion,
    };
