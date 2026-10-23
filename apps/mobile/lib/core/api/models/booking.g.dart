// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'booking.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_CreateBookingRequest _$CreateBookingRequestFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('_CreateBookingRequest', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'drawerId',
      'itemModelId',
      'startsAt',
      'durationMinutes',
    ],
  );
  final val = _CreateBookingRequest(
    drawerId: $checkedConvert('drawerId', (v) => v as String),
    itemModelId: $checkedConvert('itemModelId', (v) => v as String),
    startsAt: $checkedConvert('startsAt', (v) => DateTime.parse(v as String)),
    durationMinutes: $checkedConvert(
      'durationMinutes',
      (v) => (v as num).toInt(),
    ),
  );
  return val;
});

Map<String, dynamic> _$CreateBookingRequestToJson(
  _CreateBookingRequest instance,
) => <String, dynamic>{
  'drawerId': instance.drawerId,
  'itemModelId': instance.itemModelId,
  'startsAt': instance.startsAt.toIso8601String(),
  'durationMinutes': instance.durationMinutes,
};

_BookingDrawer _$BookingDrawerFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_BookingDrawer', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['id', 'name', 'address', 'timezone'],
      );
      final val = _BookingDrawer(
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        address: $checkedConvert('address', (v) => v as String),
        timezone: $checkedConvert('timezone', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$BookingDrawerToJson(_BookingDrawer instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'address': instance.address,
      'timezone': instance.timezone,
    };

_BookingItem _$BookingItemFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_BookingItem', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['id', 'name', 'photoUrl']);
      final val = _BookingItem(
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        photoUrl: $checkedConvert('photoUrl', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$BookingItemToJson(_BookingItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'photoUrl': instance.photoUrl,
    };

_BookingPayment _$BookingPaymentFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_BookingPayment', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['status', 'orderId', 'amountPaise'],
      );
      final val = _BookingPayment(
        status: $checkedConvert('status', (v) => v as String),
        orderId: $checkedConvert('orderId', (v) => v as String),
        amountPaise: $checkedConvert('amountPaise', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$BookingPaymentToJson(_BookingPayment instance) =>
    <String, dynamic>{
      'status': instance.status,
      'orderId': instance.orderId,
      'amountPaise': instance.amountPaise,
    };

_BookingRefund _$BookingRefundFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_BookingRefund', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['amountPaise', 'status']);
      final val = _BookingRefund(
        amountPaise: $checkedConvert('amountPaise', (v) => (v as num).toInt()),
        status: $checkedConvert('status', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$BookingRefundToJson(_BookingRefund instance) =>
    <String, dynamic>{
      'amountPaise': instance.amountPaise,
      'status': instance.status,
    };

_Booking _$BookingFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('_Booking', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'status',
      'drawer',
      'itemModel',
      'assetCode',
      'startsAt',
      'endsAt',
      'durationMinutes',
      'pricePaise',
      'depositPaise',
      'totalPaise',
      'currency',
      'holdExpiresAt',
      'cancellable',
      'cancelReason',
      'payment',
      'refund',
      'createdAt',
    ],
  );
  final val = _Booking(
    id: $checkedConvert('id', (v) => v as String),
    status: $checkedConvert('status', (v) => v as String),
    drawer: $checkedConvert(
      'drawer',
      (v) => BookingDrawer.fromJson(v as Map<String, dynamic>),
    ),
    itemModel: $checkedConvert(
      'itemModel',
      (v) => BookingItem.fromJson(v as Map<String, dynamic>),
    ),
    assetCode: $checkedConvert('assetCode', (v) => v as String),
    startsAt: $checkedConvert('startsAt', (v) => DateTime.parse(v as String)),
    endsAt: $checkedConvert('endsAt', (v) => DateTime.parse(v as String)),
    durationMinutes: $checkedConvert(
      'durationMinutes',
      (v) => (v as num).toInt(),
    ),
    pricePaise: $checkedConvert('pricePaise', (v) => (v as num).toInt()),
    depositPaise: $checkedConvert('depositPaise', (v) => (v as num).toInt()),
    totalPaise: $checkedConvert('totalPaise', (v) => (v as num).toInt()),
    currency: $checkedConvert('currency', (v) => v as String),
    holdExpiresAt: $checkedConvert(
      'holdExpiresAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    cancellable: $checkedConvert('cancellable', (v) => v as bool),
    cancelReason: $checkedConvert('cancelReason', (v) => v as String?),
    payment: $checkedConvert(
      'payment',
      (v) =>
          v == null ? null : BookingPayment.fromJson(v as Map<String, dynamic>),
    ),
    refund: $checkedConvert(
      'refund',
      (v) =>
          v == null ? null : BookingRefund.fromJson(v as Map<String, dynamic>),
    ),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
  );
  return val;
});

Map<String, dynamic> _$BookingToJson(_Booking instance) => <String, dynamic>{
  'id': instance.id,
  'status': instance.status,
  'drawer': instance.drawer.toJson(),
  'itemModel': instance.itemModel.toJson(),
  'assetCode': instance.assetCode,
  'startsAt': instance.startsAt.toIso8601String(),
  'endsAt': instance.endsAt.toIso8601String(),
  'durationMinutes': instance.durationMinutes,
  'pricePaise': instance.pricePaise,
  'depositPaise': instance.depositPaise,
  'totalPaise': instance.totalPaise,
  'currency': instance.currency,
  'holdExpiresAt': instance.holdExpiresAt?.toIso8601String(),
  'cancellable': instance.cancellable,
  'cancelReason': instance.cancelReason,
  'payment': instance.payment?.toJson(),
  'refund': instance.refund?.toJson(),
  'createdAt': instance.createdAt.toIso8601String(),
};

_PaymentOrder _$PaymentOrderFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_PaymentOrder', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'provider',
          'orderId',
          'amountPaise',
          'currency',
          'holdExpiresAt',
        ],
      );
      final val = _PaymentOrder(
        provider: $checkedConvert('provider', (v) => v as String),
        orderId: $checkedConvert('orderId', (v) => v as String),
        amountPaise: $checkedConvert('amountPaise', (v) => (v as num).toInt()),
        currency: $checkedConvert('currency', (v) => v as String),
        holdExpiresAt: $checkedConvert(
          'holdExpiresAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$PaymentOrderToJson(_PaymentOrder instance) =>
    <String, dynamic>{
      'provider': instance.provider,
      'orderId': instance.orderId,
      'amountPaise': instance.amountPaise,
      'currency': instance.currency,
      'holdExpiresAt': instance.holdExpiresAt?.toIso8601String(),
    };

_SimulatedCheckout _$SimulatedCheckoutFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_SimulatedCheckout', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['orderId', 'paymentId', 'signature'],
      );
      final val = _SimulatedCheckout(
        orderId: $checkedConvert('orderId', (v) => v as String),
        paymentId: $checkedConvert('paymentId', (v) => v as String),
        signature: $checkedConvert('signature', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$SimulatedCheckoutToJson(_SimulatedCheckout instance) =>
    <String, dynamic>{
      'orderId': instance.orderId,
      'paymentId': instance.paymentId,
      'signature': instance.signature,
    };

_ConfirmPaymentRequest _$ConfirmPaymentRequestFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('_ConfirmPaymentRequest', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['orderId', 'paymentId', 'signature']);
  final val = _ConfirmPaymentRequest(
    orderId: $checkedConvert('orderId', (v) => v as String),
    paymentId: $checkedConvert('paymentId', (v) => v as String),
    signature: $checkedConvert('signature', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$ConfirmPaymentRequestToJson(
  _ConfirmPaymentRequest instance,
) => <String, dynamic>{
  'orderId': instance.orderId,
  'paymentId': instance.paymentId,
  'signature': instance.signature,
};

_ExtendBookingRequest _$ExtendBookingRequestFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('_ExtendBookingRequest', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['extraMinutes']);
  final val = _ExtendBookingRequest(
    extraMinutes: $checkedConvert('extraMinutes', (v) => (v as num).toInt()),
  );
  return val;
});

Map<String, dynamic> _$ExtendBookingRequestToJson(
  _ExtendBookingRequest instance,
) => <String, dynamic>{'extraMinutes': instance.extraMinutes};

_Extension _$ExtensionFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('_Extension', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'extraMinutes',
      'pricePaise',
      'newEndsAt',
      'orderId',
      'provider',
    ],
  );
  final val = _Extension(
    id: $checkedConvert('id', (v) => v as String),
    extraMinutes: $checkedConvert('extraMinutes', (v) => (v as num).toInt()),
    pricePaise: $checkedConvert('pricePaise', (v) => (v as num).toInt()),
    newEndsAt: $checkedConvert('newEndsAt', (v) => DateTime.parse(v as String)),
    orderId: $checkedConvert('orderId', (v) => v as String),
    provider: $checkedConvert('provider', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$ExtensionToJson(_Extension instance) =>
    <String, dynamic>{
      'id': instance.id,
      'extraMinutes': instance.extraMinutes,
      'pricePaise': instance.pricePaise,
      'newEndsAt': instance.newEndsAt.toIso8601String(),
      'orderId': instance.orderId,
      'provider': instance.provider,
    };
