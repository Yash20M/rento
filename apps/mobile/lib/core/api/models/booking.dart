import 'package:freezed_annotation/freezed_annotation.dart';

part 'booking.freezed.dart';
part 'booking.g.dart';

/// `POST /v1/bookings` body (`CreateBookingDto`). Sent with an `Idempotency-Key` header.
@freezed
abstract class CreateBookingRequest with _$CreateBookingRequest {
  const factory CreateBookingRequest({
    @JsonKey(required: true) required String drawerId,
    @JsonKey(required: true) required String itemModelId,

    /// UTC instant on a whole minute; serialised as ISO-8601 with `Z`.
    @JsonKey(required: true) required DateTime startsAt,
    @JsonKey(required: true) required int durationMinutes,
  }) = _CreateBookingRequest;

  factory CreateBookingRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateBookingRequestFromJson(json);
}

@freezed
abstract class BookingDrawer with _$BookingDrawer {
  const factory BookingDrawer({
    @JsonKey(required: true) required String id,
    @JsonKey(required: true) required String name,
    @JsonKey(required: true) required String address,
    @JsonKey(required: true) required String timezone,
  }) = _BookingDrawer;

  factory BookingDrawer.fromJson(Map<String, dynamic> json) =>
      _$BookingDrawerFromJson(json);
}

@freezed
abstract class BookingItem with _$BookingItem {
  const factory BookingItem({
    @JsonKey(required: true) required String id,
    @JsonKey(required: true) required String name,

    /// Cover photo of the product: a path on the API or a link, or null.
    @JsonKey(required: true) required String? photoUrl,
  }) = _BookingItem;

  factory BookingItem.fromJson(Map<String, dynamic> json) =>
      _$BookingItemFromJson(json);
}

@freezed
abstract class BookingPayment with _$BookingPayment {
  const factory BookingPayment({
    /// `created`, `captured`, `failed` or `refunded`.
    @JsonKey(required: true) required String status,
    @JsonKey(required: true) required String orderId,
    @JsonKey(required: true) required int amountPaise,
  }) = _BookingPayment;

  factory BookingPayment.fromJson(Map<String, dynamic> json) =>
      _$BookingPaymentFromJson(json);
}

@freezed
abstract class BookingRefund with _$BookingRefund {
  const factory BookingRefund({
    @JsonKey(required: true) required int amountPaise,

    /// `pending`, `processed` or `failed`.
    @JsonKey(required: true) required String status,
  }) = _BookingRefund;

  factory BookingRefund.fromJson(Map<String, dynamic> json) =>
      _$BookingRefundFromJson(json);
}

/// The customer's view of a booking (`BookingDto`). Money is integer paise.
@freezed
abstract class Booking with _$Booking {
  const factory Booking({
    @JsonKey(required: true) required String id,

    /// `held`, `confirmed`, `active`, `overdue`, `completed`, `cancelled`, `expired` or `no_show`.
    @JsonKey(required: true) required String status,
    @JsonKey(required: true) required BookingDrawer drawer,
    @JsonKey(required: true) required BookingItem itemModel,
    @JsonKey(required: true) required String assetCode,
    @JsonKey(required: true) required DateTime startsAt,
    @JsonKey(required: true) required DateTime endsAt,
    @JsonKey(required: true) required int durationMinutes,
    @JsonKey(required: true) required int pricePaise,

    /// What the customer saved thanks to an offer, in paise (0 without one). Price + savings = the normal price.
    @JsonKey(required: true) required int discountPaise,
    @JsonKey(required: true) required int depositPaise,
    @JsonKey(required: true) required int totalPaise,
    @JsonKey(required: true) required String currency,

    /// While `held`: the payment must complete before this instant.
    @JsonKey(required: true) required DateTime? holdExpiresAt,
    @JsonKey(required: true) required bool cancellable,
    @JsonKey(required: true) required String? cancelReason,
    @JsonKey(required: true) required BookingPayment? payment,
    @JsonKey(required: true) required BookingRefund? refund,
    @JsonKey(required: true) required DateTime createdAt,
  }) = _Booking;

  factory Booking.fromJson(Map<String, dynamic> json) =>
      _$BookingFromJson(json);
}

/// `POST /v1/bookings/{id}/payment` — the order to pay (`PaymentOrderDto`).
@freezed
abstract class PaymentOrder with _$PaymentOrder {
  const factory PaymentOrder({
    @JsonKey(required: true) required String provider,
    @JsonKey(required: true) required String orderId,
    @JsonKey(required: true) required int amountPaise,
    @JsonKey(required: true) required String currency,
    @JsonKey(required: true) required DateTime? holdExpiresAt,
  }) = _PaymentOrder;

  factory PaymentOrder.fromJson(Map<String, dynamic> json) =>
      _$PaymentOrderFromJson(json);
}

/// What the (fake) gateway checkout hands the app (`SimulatedCheckoutDto`).
@freezed
abstract class SimulatedCheckout with _$SimulatedCheckout {
  const factory SimulatedCheckout({
    @JsonKey(required: true) required String orderId,
    @JsonKey(required: true) required String paymentId,
    @JsonKey(required: true) required String signature,
  }) = _SimulatedCheckout;

  factory SimulatedCheckout.fromJson(Map<String, dynamic> json) =>
      _$SimulatedCheckoutFromJson(json);
}

/// `POST /v1/bookings/{id}/payment/confirm` body (`ConfirmPaymentDto`).
@freezed
abstract class ConfirmPaymentRequest with _$ConfirmPaymentRequest {
  const factory ConfirmPaymentRequest({
    @JsonKey(required: true) required String orderId,
    @JsonKey(required: true) required String paymentId,
    @JsonKey(required: true) required String signature,
  }) = _ConfirmPaymentRequest;

  factory ConfirmPaymentRequest.fromJson(Map<String, dynamic> json) =>
      _$ConfirmPaymentRequestFromJson(json);
}

/// `POST /v1/bookings/{id}/extend` body: extra minutes, a multiple of the slot length.
@freezed
abstract class ExtendBookingRequest with _$ExtendBookingRequest {
  const factory ExtendBookingRequest({
    @JsonKey(required: true) required int extraMinutes,
  }) = _ExtendBookingRequest;

  factory ExtendBookingRequest.fromJson(Map<String, dynamic> json) =>
      _$ExtendBookingRequestFromJson(json);
}

/// The order for extra time. Nothing changes until it is paid.
@freezed
abstract class Extension with _$Extension {
  const factory Extension({
    @JsonKey(required: true) required String id,
    @JsonKey(required: true) required int extraMinutes,
    @JsonKey(required: true) required int pricePaise,
    @JsonKey(required: true) required DateTime newEndsAt,
    @JsonKey(required: true) required String orderId,
    @JsonKey(required: true) required String provider,
  }) = _Extension;

  factory Extension.fromJson(Map<String, dynamic> json) =>
      _$ExtensionFromJson(json);
}
