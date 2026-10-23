import 'package:dio/dio.dart';

import 'api_exception.dart';
import 'models/models.dart';

/// The signed-in customer's bookings: hold → pay → confirm → cancel (README §9.4–§9.8).
class BookingApi {
  const BookingApi(this._dio);

  final Dio _dio;

  /// Holds the slot for a few minutes. [idempotencyKey] must be generated ONCE per booking attempt and reused when
  /// retrying that attempt: a retry then returns the original booking instead of creating a second hold.
  ///
  /// 409 `BOOKING_SLOT_TAKEN` = nobody is free any more; 422 `DRAWER_CLOSED` / `DURATION_INVALID` /
  /// `LEAD_TIME_VIOLATION` = the request breaks a rule; 503 `RETRY_LATER` = busy, retry with the same key.
  Future<Booking> create(
    CreateBookingRequest request, {
    required String idempotencyKey,
  }) => guardApi(() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/bookings',
      data: request.toJson(),
      options: Options(headers: {'Idempotency-Key': idempotencyKey}),
    );
    return Booking.fromJson(response.data!);
  });

  Future<List<Booking>> mine({String? status}) => guardApi(() async {
    final response = await _dio.get<List<dynamic>>(
      '/v1/bookings',
      queryParameters: {if (status != null) 'status': status},
    );
    return [
      for (final item in response.data!)
        Booking.fromJson(item as Map<String, dynamic>),
    ];
  });

  Future<Booking> get(String id) => guardApi(() async {
    final response = await _dio.get<Map<String, dynamic>>('/v1/bookings/$id');
    return Booking.fromJson(response.data!);
  });

  /// The order to pay for a hold; asking again returns the same order. 410 `HOLD_EXPIRED` once the hold ran out.
  Future<PaymentOrder> createPaymentOrder(String id) => guardApi(() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/bookings/$id/payment',
    );
    return PaymentOrder.fromJson(response.data!);
  });

  /// Development and demos only (fake payment provider): plays the part of the gateway's checkout screen. With a real
  /// gateway this endpoint answers 404 and the gateway's own SDK produces the same three values.
  Future<SimulatedCheckout> simulateCheckout(String id) => guardApi(() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/bookings/$id/payment/simulate',
    );
    return SimulatedCheckout.fromJson(response.data!);
  });

  /// The server verifies the gateway signature; only then is the booking `confirmed`. Never mark a booking paid
  /// because the app says so. 422 `PAYMENT_INVALID`, 410 `HOLD_EXPIRED` (slot lost, nothing charged).
  Future<Booking> confirmPayment(String id, ConfirmPaymentRequest request) =>
      guardApi(() async {
        final response = await _dio.post<Map<String, dynamic>>(
          '/v1/bookings/$id/payment/confirm',
          data: request.toJson(),
        );
        return Booking.fromJson(response.data!);
      });

  /// Cancelling twice is harmless. 409 `INVALID_STATE` once the rental has started.
  Future<Booking> cancel(String id) => guardApi(() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/bookings/$id/cancel',
    );
    return Booking.fromJson(response.data!);
  });

  /// Extends a RUNNING rental: returns the order for the extra time (nothing changes until it is paid).
  /// 409 EXTENSION_UNAVAILABLE = the unit is booked after this rental (the field extraMinutes says how many
  /// minutes are possible); 409 INVALID_STATE = the rental is not running.
  Future<Extension> extend(String id, int extraMinutes) => guardApi(() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/bookings/$id/extend',
      data: ExtendBookingRequest(extraMinutes: extraMinutes).toJson(),
    );
    return Extension.fromJson(response.data!);
  });

  /// Development and demos only (fake payment provider), like simulateCheckout.
  Future<SimulatedCheckout> simulateExtensionCheckout(
    String id,
    String extensionId,
  ) => guardApi(() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/bookings/$id/extensions/$extensionId/simulate',
    );
    return SimulatedCheckout.fromJson(response.data!);
  });

  /// The server verifies the signature and re-checks that the unit is still free; only then does the rental end later.
  Future<Booking> confirmExtension(
    String id,
    String extensionId,
    ConfirmPaymentRequest request,
  ) => guardApi(() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/bookings/$id/extensions/$extensionId/confirm',
      data: request.toJson(),
    );
    return Booking.fromJson(response.data!);
  });
}
