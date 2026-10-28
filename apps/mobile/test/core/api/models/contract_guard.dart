import 'package:rento_mobile/core/api/models/models.dart';

/// How the Dart side parses and writes one OpenAPI schema.
class ModelBinding {
  const ModelBinding(this.fromJson, this.toJson);

  final Object Function(Map<String, dynamic> json) fromJson;
  final Map<String, dynamic> Function(Object model) toJson;
}

/// Every OpenAPI object schema the app models, by schema name. A schema in the spec that is neither here nor in
/// [ignoredSchemas] makes the guard fail — a new DTO forces an explicit decision.
final Map<String, ModelBinding> contractModels = {
  'HealthResponseDto': ModelBinding(
    HealthResponse.fromJson,
    (m) => (m as HealthResponse).toJson(),
  ),
  'ReadinessChecksDto': ModelBinding(
    ReadinessChecks.fromJson,
    (m) => (m as ReadinessChecks).toJson(),
  ),
  'ReadinessResponseDto': ModelBinding(
    ReadinessResponse.fromJson,
    (m) => (m as ReadinessResponse).toJson(),
  ),
  'FieldErrorDto': ModelBinding(
    FieldError.fromJson,
    (m) => (m as FieldError).toJson(),
  ),
  'ProblemDetailsDto': ModelBinding(
    ProblemDetails.fromJson,
    (m) => (m as ProblemDetails).toJson(),
  ),
  'RegisterDto': ModelBinding(
    RegisterRequest.fromJson,
    (m) => (m as RegisterRequest).toJson(),
  ),
  'LoginDto': ModelBinding(
    LoginRequest.fromJson,
    (m) => (m as LoginRequest).toJson(),
  ),
  'RefreshTokenDto': ModelBinding(
    RefreshTokenRequest.fromJson,
    (m) => (m as RefreshTokenRequest).toJson(),
  ),
  'ForgotPasswordDto': ModelBinding(
    ForgotPasswordRequest.fromJson,
    (m) => (m as ForgotPasswordRequest).toJson(),
  ),
  'ResetPasswordDto': ModelBinding(
    ResetPasswordRequest.fromJson,
    (m) => (m as ResetPasswordRequest).toJson(),
  ),
  'VerifyEmailDto': ModelBinding(
    VerifyEmailRequest.fromJson,
    (m) => (m as VerifyEmailRequest).toJson(),
  ),
  'GoogleLoginDto': ModelBinding(
    GoogleLoginRequest.fromJson,
    (m) => (m as GoogleLoginRequest).toJson(),
  ),
  'FacebookLoginDto': ModelBinding(
    FacebookLoginRequest.fromJson,
    (m) => (m as FacebookLoginRequest).toJson(),
  ),
  'AppleLoginDto': ModelBinding(
    AppleLoginRequest.fromJson,
    (m) => (m as AppleLoginRequest).toJson(),
  ),
  'SocialAuthResponseDto': ModelBinding(
    SocialAuthResponse.fromJson,
    (m) => (m as SocialAuthResponse).toJson(),
  ),
  'IdentityDto': ModelBinding(
    Identity.fromJson,
    (m) => (m as Identity).toJson(),
  ),
  'UpdateProfileDto': ModelBinding(
    UpdateProfileRequest.fromJson,
    (m) => (m as UpdateProfileRequest).toJson(),
  ),
  'ProfileDto': ModelBinding(Profile.fromJson, (m) => (m as Profile).toJson()),
  'UserSummaryDto': ModelBinding(
    UserSummary.fromJson,
    (m) => (m as UserSummary).toJson(),
  ),
  'AuthResponseDto': ModelBinding(
    AuthResponse.fromJson,
    (m) => (m as AuthResponse).toJson(),
  ),
  'HoursDto': ModelBinding(
    OpeningHours.fromJson,
    (m) => (m as OpeningHours).toJson(),
  ),
  'PublicDrawerDto': ModelBinding(
    PublicDrawer.fromJson,
    (m) => (m as PublicDrawer).toJson(),
  ),
  'NearbyRequestDto': ModelBinding(
    NearbyRequest.fromJson,
    (m) => (m as NearbyRequest).toJson(),
  ),
  'NearbyDrawerDto': ModelBinding(
    NearbyDrawer.fromJson,
    (m) => (m as NearbyDrawer).toJson(),
  ),
  'NearbyResponseDto': ModelBinding(
    NearbyResponse.fromJson,
    (m) => (m as NearbyResponse).toJson(),
  ),
  'PublicPromotionDto': ModelBinding(
    PublicPromotion.fromJson,
    (m) => (m as PublicPromotion).toJson(),
  ),
  'InventoryEntryDto': ModelBinding(
    InventoryEntry.fromJson,
    (m) => (m as InventoryEntry).toJson(),
  ),
  'SlotDto': ModelBinding(
    AvailabilitySlot.fromJson,
    (m) => (m as AvailabilitySlot).toJson(),
  ),
  'AvailabilityDto': ModelBinding(
    Availability.fromJson,
    (m) => (m as Availability).toJson(),
  ),
  'CreateBookingDto': ModelBinding(
    CreateBookingRequest.fromJson,
    (m) => (m as CreateBookingRequest).toJson(),
  ),
  'BookingDrawerDto': ModelBinding(
    BookingDrawer.fromJson,
    (m) => (m as BookingDrawer).toJson(),
  ),
  'BookingItemDto': ModelBinding(
    BookingItem.fromJson,
    (m) => (m as BookingItem).toJson(),
  ),
  'BookingPaymentDto': ModelBinding(
    BookingPayment.fromJson,
    (m) => (m as BookingPayment).toJson(),
  ),
  'BookingRefundDto': ModelBinding(
    BookingRefund.fromJson,
    (m) => (m as BookingRefund).toJson(),
  ),
  'BookingDto': ModelBinding(Booking.fromJson, (m) => (m as Booking).toJson()),
  'PaymentOrderDto': ModelBinding(
    PaymentOrder.fromJson,
    (m) => (m as PaymentOrder).toJson(),
  ),
  'SimulatedCheckoutDto': ModelBinding(
    SimulatedCheckout.fromJson,
    (m) => (m as SimulatedCheckout).toJson(),
  ),
  'ConfirmPaymentDto': ModelBinding(
    ConfirmPaymentRequest.fromJson,
    (m) => (m as ConfirmPaymentRequest).toJson(),
  ),
  'KycStatusDto': ModelBinding(
    KycStatus.fromJson,
    (m) => (m as KycStatus).toJson(),
  ),
  'StartAadhaarDto': ModelBinding(
    StartAadhaarRequest.fromJson,
    (m) => (m as StartAadhaarRequest).toJson(),
  ),
  'AadhaarRequestDto': ModelBinding(
    AadhaarRequest.fromJson,
    (m) => (m as AadhaarRequest).toJson(),
  ),
  'VerifyAadhaarDto': ModelBinding(
    VerifyAadhaarRequest.fromJson,
    (m) => (m as VerifyAadhaarRequest).toJson(),
  ),
  'ExtendBookingDto': ModelBinding(
    ExtendBookingRequest.fromJson,
    (m) => (m as ExtendBookingRequest).toJson(),
  ),
  'ExtensionDto': ModelBinding(
    Extension.fromJson,
    (m) => (m as Extension).toJson(),
  ),
};

/// Schemas deliberately not modelled as classes (enums are checked separately).
const Set<String> ignoredSchemas = {
  'ErrorCode',
  // Admin-panel only (the React SPA uses the generated TypeScript client); the mobile app never calls these.
  'ChangePasswordDto', // admin panel first; the mobile app may add it later
  // Banners are set up in the admin panel; the app only reads the public view (PublicPromotionDto).
  'PromotionDto',
  'CreatePromotionDto',
  'UpdatePromotionDto',
  // Two-step verification is the admin panel's (P4-05); the mobile app never calls these.
  'MfaStatusDto',
  'MfaEnrolStartDto',
  'MfaSecretDto',
  'MfaCodeDto',
  'MfaEnrolConfirmDto',
  'MfaVerifyDto',
  'MfaSessionDto',
  'MfaProofDto',
  'MfaRecoveryCodesDto',
  'MfaStateDto',
  'RoleDto',
  'CreateRoleDto',
  'UpdateRoleDto',
  'PermissionDto',
  'PermissionGroupDto',
  'AssignmentInputDto',
  'InviteAdminDto',
  'SetRolesDto',
  'AcceptInvitationDto',
  'AcceptInvitationGoogleDto',
  'AssignmentDto',
  'AdminDto',
  'InvitedRoleDto',
  'InvitationDto',
  'AdminMeDto',
  // Booking engine (M3). Customer-facing ones are modelled in the mobile milestone (M5); the rest is admin-panel only.
  'AdminCancelDto',
  'CustomerDto',
  'CustomerDetailDto',
  'CustomerPageDto',
  'KycDecisionDto',
  'AdminBookingDto',
  'AdminBookingDetailDto',
  'AdminBookingPageDto',
  'BookingEventDto',
  'BookingCustomerDto',
  'DashboardDto',
  'DashboardNowDto',
  'DashboardWindowDto',
  'AuditActorDto',
  'AuditEntryDto',
  'AuditPageDto',
  'AssetDto',
  'AssetPageDto',
  'CategoryDto', // customer-facing: modelled in the mobile milestone (M5)
  'ClosureDto',
  'CreateAssetDto',
  'CreateCategoryDto',
  'CreateClosureDto',
  'CreateDrawerDto',
  'CreateItemModelDto',
  'DrawerDto',
  'ItemModelDto', // customer-facing: modelled in the mobile milestone (M5)
  'SetHoursDto',
  'UpdateAssetDto',
  'UpdateCategoryDto',
  'UpdateDrawerDto',
  'UpdateItemModelDto',
  'AdminIdentityDto',
  'DrawerScopeDto',
  // Operations, reports and settings (M10): admin panel only.
  'ReassignDto',
  'ReassignOptionDto',
  'BlockDto',
  'CreateBlockDto',
  'ImpactBookingDto',
  'ImpactDto',
  'ScheduleEntryDto',
  'ScheduleAssetDto',
  'ScheduleDto',
  'ReportTotalsDto',
  'ReportDayDto',
  'ReportRowDto',
  'ReportDto',
  'PaymentLedgerRowDto',
  'PaymentLedgerPageDto',
  'RefundTierDto',
  'SettingsDto',
  'DiscoverySettingsDto',
  // Transfers and account status (M11): admin panel only.
  'StartTransferDto',
  'TransferDto',
  'AccountStatusDto',
  'WebSessionDto', // browser sessions (admin panel cookie flow)
  'DeleteAccountDto', // sent as a plain map by the delete-account dialog
};

/// The wire value of every non-fallback [ErrorCode], derived through the models themselves.
Set<String> dartErrorCodeWireValues() => {
  for (final code in ErrorCode.values)
    if (code != ErrorCode.unknown)
      ProblemDetails(
            type: 't',
            title: 't',
            status: 400,
            code: code,
            detail: 'd',
            traceId: 'x',
          ).toJson()['code']
          as String,
};

typedef Json = Map<String, dynamic>;

Json _schemas(Json spec) =>
    ((spec['components'] as Json)['schemas'] as Json).cast<String, dynamic>();

Json _resolve(Json spec, Json node) {
  if (node[r'$ref'] case final String ref) {
    // A dangling $ref is a broken contract; resolve to an empty schema so the guard can report instead of crashing.
    final target = _schemas(spec)[ref.split('/').last] as Json?;
    return target == null ? <String, dynamic>{} : _resolve(spec, target);
  }
  if (node['allOf'] case final List<dynamic> parts when parts.length == 1) {
    return _resolve(spec, parts.single as Json);
  }
  return node;
}

/// A complete, valid sample generated from the schema itself (uses `example:` when the spec provides one).
Object? sampleFor(Json spec, Json node, [int depth = 0]) {
  if (depth > 8) return null;
  final schema = _resolve(spec, node);
  if (schema['example'] != null) return schema['example'];
  final enumValues = schema['enum'];
  if (enumValues is List && enumValues.isNotEmpty) return enumValues.first;
  switch (schema['type']) {
    case 'object':
      final properties = (schema['properties'] as Json?) ?? const {};
      return {
        for (final entry in properties.entries)
          entry.key: sampleFor(spec, entry.value as Json, depth + 1),
      };
    case 'array':
      return [sampleFor(spec, schema['items'] as Json, depth + 1)];
    case 'string':
      return switch (schema['format']) {
        'uuid' => '0b1f6c1e-3c1a-4f55-9d2e-6a1b2c3d4e5f',
        'date-time' => '2030-01-01T00:00:00.000Z',
        _ => 'sample',
      };
    case 'integer':
    case 'number':
      return 1;
    case 'boolean':
      return false;
  }
  return null;
}

bool _deepEquals(Object? a, Object? b) {
  if (a is Map && b is Map) {
    return a.length == b.length &&
        a.keys.every((k) => b.containsKey(k) && _deepEquals(a[k], b[k]));
  }
  if (a is List && b is List) {
    return a.length == b.length &&
        List.generate(a.length, (i) => _deepEquals(a[i], b[i])).every((x) => x);
  }
  return a == b;
}

bool _throws(void Function() action) {
  try {
    action();
    return false;
  } catch (_) {
    return true;
  }
}

/// Compares the Dart models with an OpenAPI document and returns every disagreement (empty = in sync).
///
/// For each modelled schema it checks: nothing is dropped or invented on a round trip; every required property
/// is enforced; every optional property is optional; nullable properties accept null and non-nullable ones
/// reject it. For `ErrorCode` it checks the wire values match the contract exactly, and that unknown codes
/// from a newer server degrade to [ErrorCode.unknown] instead of failing the whole response.
List<String> checkContract(Json spec) {
  final problems = <String>[];
  final schemas = _schemas(spec);

  for (final name in schemas.keys) {
    if (!contractModels.containsKey(name) && !ignoredSchemas.contains(name)) {
      problems.add('Schema "$name" is in the contract but has no Dart model.');
    }
  }

  for (final entry in contractModels.entries) {
    final name = entry.key;
    final binding = entry.value;
    final schema = schemas[name] as Json?;
    if (schema == null) {
      problems.add('Dart models "$name" but the contract has no such schema.');
      continue;
    }
    final properties =
        ((schema['properties'] as Json?) ?? const {}).cast<String, dynamic>();
    final required =
        ((schema['required'] as List?) ?? const []).cast<String>().toSet();
    final sample = sampleFor(spec, schema) as Json;

    // 1. Nothing dropped or invented on a round trip.
    try {
      final roundTrip = binding.toJson(binding.fromJson(sample));
      if (!_deepEquals(roundTrip, sample)) {
        problems.add(
          '$name: round trip changed the JSON. contract=$sample dart=$roundTrip',
        );
      }
    } catch (e) {
      problems.add('$name: cannot parse a contract-shaped sample ($e).');
      continue;
    }

    for (final property in properties.keys) {
      final propertySchema = properties[property] as Json;
      final nullable = propertySchema['nullable'] == true;
      final without = Json.of(sample)..remove(property);
      final withNull = Json.of(sample)..[property] = null;

      // 2. Requiredness.
      final missingThrows = _throws(() => binding.fromJson(without));
      if (required.contains(property) && !missingThrows) {
        problems.add(
          '$name.$property is required by the contract but Dart accepts it missing.',
        );
      }
      if (!required.contains(property) && missingThrows) {
        problems.add(
          '$name.$property is optional in the contract but Dart requires it.',
        );
      }

      // 3. Nullability.
      final nullThrows = _throws(() => binding.fromJson(withNull));
      if (nullable && nullThrows) {
        problems.add(
          '$name.$property is nullable in the contract but Dart rejects null.',
        );
      }
      if (!nullable && !nullThrows && required.contains(property)) {
        problems.add(
          '$name.$property is non-null in the contract but Dart accepts null.',
        );
      }
    }
  }

  // 4. Error codes: closed set on the wire, tolerant in the app.
  final contractCodes =
      ((schemas['ErrorCode'] as Json?)?['enum'] as List?)
          ?.cast<String>()
          .toSet();
  if (contractCodes == null) {
    problems.add('Contract has no ErrorCode enum.');
  } else {
    final dartCodes = dartErrorCodeWireValues();
    for (final missing in contractCodes.difference(dartCodes)) {
      problems.add(
        'ErrorCode "$missing" is in the contract but not in the Dart enum.',
      );
    }
    for (final extra in dartCodes.difference(contractCodes)) {
      problems.add(
        'ErrorCode "$extra" is in the Dart enum but not in the contract.',
      );
    }
  }

  return problems;
}
