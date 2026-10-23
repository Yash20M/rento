// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Identity _$IdentityFromJson(Map<String, dynamic> json) => $checkedCreate(
  '_Identity',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const ['provider', 'email', 'emailVerified', 'linkedAt'],
    );
    final val = _Identity(
      provider: $checkedConvert('provider', (v) => v as String),
      email: $checkedConvert('email', (v) => v as String?),
      emailVerified: $checkedConvert('emailVerified', (v) => v as bool),
      linkedAt: $checkedConvert('linkedAt', (v) => DateTime.parse(v as String)),
    );
    return val;
  },
);

Map<String, dynamic> _$IdentityToJson(_Identity instance) => <String, dynamic>{
  'provider': instance.provider,
  'email': instance.email,
  'emailVerified': instance.emailVerified,
  'linkedAt': instance.linkedAt.toIso8601String(),
};

_UpdateProfileRequest _$UpdateProfileRequestFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('_UpdateProfileRequest', json, ($checkedConvert) {
  final val = _UpdateProfileRequest(
    name: $checkedConvert('name', (v) => v as String?),
    phone: $checkedConvert('phone', (v) => v as String?),
    email: $checkedConvert('email', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$UpdateProfileRequestToJson(
  _UpdateProfileRequest instance,
) => <String, dynamic>{
  if (instance.name case final value?) 'name': value,
  if (instance.phone case final value?) 'phone': value,
  if (instance.email case final value?) 'email': value,
};

_Profile _$ProfileFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_Profile', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'email',
          'displayName',
          'phone',
          'emailVerified',
          'avatarUrl',
          'needsProfileCompletion',
        ],
      );
      final val = _Profile(
        id: $checkedConvert('id', (v) => v as String),
        email: $checkedConvert('email', (v) => v as String?),
        displayName: $checkedConvert('displayName', (v) => v as String?),
        phone: $checkedConvert('phone', (v) => v as String?),
        emailVerified: $checkedConvert('emailVerified', (v) => v as bool),
        avatarUrl: $checkedConvert('avatarUrl', (v) => v as String?),
        needsProfileCompletion: $checkedConvert(
          'needsProfileCompletion',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ProfileToJson(_Profile instance) => <String, dynamic>{
  'id': instance.id,
  'email': instance.email,
  'displayName': instance.displayName,
  'phone': instance.phone,
  'emailVerified': instance.emailVerified,
  'avatarUrl': instance.avatarUrl,
  'needsProfileCompletion': instance.needsProfileCompletion,
};
