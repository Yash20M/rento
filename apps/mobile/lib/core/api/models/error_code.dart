import 'package:json_annotation/json_annotation.dart';

/// Stable machine-readable API error codes (README §14.2, `docs/api/error-catalog.md`).
///
/// The wire value of each member is its `@JsonValue`. [unknown] is **not** part of the contract: it is what a
/// code added by a newer server decodes to, so an older app still understands the rest of the error response
/// (README §11.5: support N−1 app versions).
enum ErrorCode {
  @JsonValue('VALIDATION_FAILED')
  validationFailed,
  @JsonValue('UNAUTHENTICATED')
  unauthenticated,
  @JsonValue('HAS_FUTURE_BOOKINGS')
  hasFutureBookings,
  @JsonValue('KYC_REQUIRED')
  kycRequired,
  @JsonValue('AADHAAR_IN_USE')
  aadhaarInUse,
  @JsonValue('INVALID_STATE')
  invalidState,
  @JsonValue('PAYMENT_INVALID')
  paymentInvalid,
  @JsonValue('ALREADY_EXISTS')
  alreadyExists,
  @JsonValue('IN_USE')
  inUse,
  @JsonValue('REAUTH_REQUIRED')
  reauthRequired,
  @JsonValue('TOKEN_EXPIRED')
  tokenExpired,
  @JsonValue('FORBIDDEN')
  forbidden,
  @JsonValue('NOT_FOUND')
  notFound,
  @JsonValue('EMAIL_TAKEN')
  emailTaken,
  @JsonValue('BOOKING_SLOT_TAKEN')
  bookingSlotTaken,
  @JsonValue('EXTENSION_UNAVAILABLE')
  extensionUnavailable,
  @JsonValue('REQUEST_IN_PROGRESS')
  requestInProgress,
  @JsonValue('HOLD_EXPIRED')
  holdExpired,
  @JsonValue('DRAWER_CLOSED')
  drawerClosed,
  @JsonValue('OUTSIDE_SERVICE_AREA')
  outsideServiceArea,
  @JsonValue('DURATION_INVALID')
  durationInvalid,
  @JsonValue('LEAD_TIME_VIOLATION')
  leadTimeViolation,
  @JsonValue('IDEMPOTENCY_KEY_REUSED')
  idempotencyKeyReused,
  @JsonValue('SOCIAL_TOKEN_INVALID')
  socialTokenInvalid,
  @JsonValue('ACCOUNT_LINK_REQUIRED')
  accountLinkRequired,
  @JsonValue('LAST_LOGIN_METHOD')
  lastLoginMethod,
  @JsonValue('MFA_REQUIRED')
  mfaRequired,
  @JsonValue('STEP_UP_REQUIRED')
  stepUpRequired,
  @JsonValue('IDENTITY_IN_USE')
  identityInUse,
  @JsonValue('PERMISSION_DENIED')
  permissionDenied,
  @JsonValue('ROLE_ESCALATION')
  roleEscalation,
  @JsonValue('LAST_SUPER_ADMIN')
  lastSuperAdmin,
  @JsonValue('ROLE_IN_USE')
  roleInUse,
  @JsonValue('ROLE_LOCKED')
  roleLocked,
  @JsonValue('RATE_LIMITED')
  rateLimited,
  @JsonValue('RETRY_LATER')
  retryLater,
  @JsonValue('INTERNAL_ERROR')
  internalError,

  /// A code this app version does not know. Never sent by the server.
  @JsonValue('__unknown__')
  unknown,
}
