// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'problem_details.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FieldError _$FieldErrorFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_FieldError', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['field', 'message']);
      final val = _FieldError(
        field: $checkedConvert('field', (v) => v as String),
        message: $checkedConvert('message', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$FieldErrorToJson(_FieldError instance) =>
    <String, dynamic>{'field': instance.field, 'message': instance.message};

_ProblemDetails _$ProblemDetailsFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_ProblemDetails', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'type',
          'title',
          'status',
          'code',
          'detail',
          'traceId',
        ],
      );
      final val = _ProblemDetails(
        type: $checkedConvert('type', (v) => v as String),
        title: $checkedConvert('title', (v) => v as String),
        status: $checkedConvert('status', (v) => (v as num).toInt()),
        code: $checkedConvert(
          'code',
          (v) => $enumDecode(
            _$ErrorCodeEnumMap,
            v,
            unknownValue: ErrorCode.unknown,
          ),
        ),
        detail: $checkedConvert('detail', (v) => v as String),
        errors: $checkedConvert(
          'errors',
          (v) =>
              (v as List<dynamic>?)
                  ?.map((e) => FieldError.fromJson(e as Map<String, dynamic>))
                  .toList(),
        ),
        traceId: $checkedConvert('traceId', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$ProblemDetailsToJson(_ProblemDetails instance) =>
    <String, dynamic>{
      'type': instance.type,
      'title': instance.title,
      'status': instance.status,
      'code': _$ErrorCodeEnumMap[instance.code]!,
      'detail': instance.detail,
      if (instance.errors?.map((e) => e.toJson()).toList() case final value?)
        'errors': value,
      'traceId': instance.traceId,
    };

const _$ErrorCodeEnumMap = {
  ErrorCode.validationFailed: 'VALIDATION_FAILED',
  ErrorCode.unauthenticated: 'UNAUTHENTICATED',
  ErrorCode.hasFutureBookings: 'HAS_FUTURE_BOOKINGS',
  ErrorCode.kycRequired: 'KYC_REQUIRED',
  ErrorCode.aadhaarInUse: 'AADHAAR_IN_USE',
  ErrorCode.invalidState: 'INVALID_STATE',
  ErrorCode.paymentInvalid: 'PAYMENT_INVALID',
  ErrorCode.alreadyExists: 'ALREADY_EXISTS',
  ErrorCode.inUse: 'IN_USE',
  ErrorCode.reauthRequired: 'REAUTH_REQUIRED',
  ErrorCode.tokenExpired: 'TOKEN_EXPIRED',
  ErrorCode.forbidden: 'FORBIDDEN',
  ErrorCode.notFound: 'NOT_FOUND',
  ErrorCode.emailTaken: 'EMAIL_TAKEN',
  ErrorCode.bookingSlotTaken: 'BOOKING_SLOT_TAKEN',
  ErrorCode.extensionUnavailable: 'EXTENSION_UNAVAILABLE',
  ErrorCode.requestInProgress: 'REQUEST_IN_PROGRESS',
  ErrorCode.holdExpired: 'HOLD_EXPIRED',
  ErrorCode.drawerClosed: 'DRAWER_CLOSED',
  ErrorCode.outsideServiceArea: 'OUTSIDE_SERVICE_AREA',
  ErrorCode.durationInvalid: 'DURATION_INVALID',
  ErrorCode.leadTimeViolation: 'LEAD_TIME_VIOLATION',
  ErrorCode.idempotencyKeyReused: 'IDEMPOTENCY_KEY_REUSED',
  ErrorCode.socialTokenInvalid: 'SOCIAL_TOKEN_INVALID',
  ErrorCode.accountLinkRequired: 'ACCOUNT_LINK_REQUIRED',
  ErrorCode.lastLoginMethod: 'LAST_LOGIN_METHOD',
  ErrorCode.mfaRequired: 'MFA_REQUIRED',
  ErrorCode.stepUpRequired: 'STEP_UP_REQUIRED',
  ErrorCode.identityInUse: 'IDENTITY_IN_USE',
  ErrorCode.permissionDenied: 'PERMISSION_DENIED',
  ErrorCode.roleEscalation: 'ROLE_ESCALATION',
  ErrorCode.lastSuperAdmin: 'LAST_SUPER_ADMIN',
  ErrorCode.roleInUse: 'ROLE_IN_USE',
  ErrorCode.roleLocked: 'ROLE_LOCKED',
  ErrorCode.rateLimited: 'RATE_LIMITED',
  ErrorCode.retryLater: 'RETRY_LATER',
  ErrorCode.internalError: 'INTERNAL_ERROR',
  ErrorCode.unknown: '__unknown__',
};
