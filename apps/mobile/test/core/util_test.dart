import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/core/api/api_exception.dart';
import 'package:rento_mobile/core/api/models/models.dart';
import 'package:rento_mobile/core/format/money.dart';
import 'package:rento_mobile/core/format/time.dart';
import 'package:rento_mobile/core/util/uuid.dart';
import 'package:rento_mobile/features/booking/application/slot_logic.dart';

import '../support/fixtures.dart';

void main() {
  test('U-01 idempotency keys are valid, random version-4 UUIDs', () {
    final pattern = RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    );
    final keys = {for (var i = 0; i < 200; i++) newUuid()};
    expect(keys, hasLength(200));
    expect(keys.every(pattern.hasMatch), isTrue);
    expect(
      newUuid(Random(1)),
      newUuid(Random(1)),
    ); // deterministic for a seeded generator
  });

  test(
    'U-02 paise are shown as rupees with Indian grouping; whole rupees without decimals',
    () {
      expect(formatPaise(0), '₹0');
      expect(formatPaise(4900), '₹49');
      expect(formatPaise(29800), '₹298');
      expect(formatPaise(4950), '₹49.50');
      expect(formatPaise(123450), '₹1,234.50');
      expect(formatPaise(1234500000), '₹1,23,45,000');
    },
  );

  test('U-03 times are shown on the DRAWER\'s clock, not the phone\'s', () {
    final instant = DateTime.utc(2030, 1, 7, 4, 30);
    expect(formatTimeOfDay(instant, 'Asia/Kolkata'), '10:00 AM'); // +05:30
    expect(formatTimeOfDay(instant, 'UTC'), '4:30 AM');
    expect(
      formatTimeOfDay(instant, 'America/New_York'),
      '11:30 PM',
    ); // previous evening
    expect(formatDateTime(instant, 'Asia/Kolkata'), 'Mon, 7 Jan · 10:00 AM');
    expect(
      formatTimeOfDay(DateTime.utc(2030, 7, 15, 8), 'Europe/London'),
      '9:00 AM',
    ); // summer time
    expect(
      formatTimeOfDay(instant, 'Mars/Olympus'),
      '4:30 AM',
    ); // unknown zone falls back to UTC
  });

  test(
    'U-04 the calendar day follows the drawer: 20:00 UTC is already tomorrow in India',
    () {
      final instant = DateTime.utc(2030, 1, 7, 20, 0);
      expect(localDate(instant, 'Asia/Kolkata'), '2030-01-08');
      expect(localDate(instant, 'UTC'), '2030-01-07');
      final days = upcomingDays(instant, 'Asia/Kolkata', count: 3);
      expect(days.map((d) => d.date), [
        '2030-01-08',
        '2030-01-09',
        '2030-01-10',
      ]);
      expect(days.first.label, 'Tue 8');
    },
  );

  test(
    'U-05 the lengths offered: multiples of the slot, at least the minimum, at most the shortest of model limit and free time',
    () {
      List<int> offer({
        int slot = 30,
        int min = 30,
        int max = 240,
        required int free,
      }) => durationsFor(
        slotMinutes: slot,
        minDurationMin: min,
        maxDurationMin: max,
        maxFreeMinutes: free,
      );
      expect(offer(free: 120), [30, 60, 90, 120]);
      expect(offer(free: 1000), [30, 60, 90, 120, 150, 180, 210, 240]);
      expect(offer(free: 29), isEmpty);
      expect(offer(slot: 60, min: 90, free: 240), [
        120,
        180,
        240,
      ]); // minimum rounded up to a whole slot
      expect(offer(slot: 0, free: 120), isEmpty);
    },
  );

  test('U-06 price is whole slots times the slot price, in integers', () {
    expect(
      rentalPaise(minutes: 60, slotMinutes: 30, pricePerSlotPaise: 4900),
      9800,
    );
    expect(
      rentalPaise(minutes: 30, slotMinutes: 30, pricePerSlotPaise: 4900),
      4900,
    );
    expect(
      rentalPaise(minutes: 240, slotMinutes: 60, pricePerSlotPaise: 15000),
      60000,
    );
  });

  group('ApiException', () {
    DioException failure(int? status, Object? body) => DioException(
      requestOptions: RequestOptions(path: '/x'),
      response:
          status == null
              ? null
              : Response(
                requestOptions: RequestOptions(path: '/x'),
                statusCode: status,
                data: body,
              ),
    );

    test(
      'U-07 a problem+json body keeps its stable code, status and first message per field',
      () {
        final error = ApiException.fromDio(
          failure(
            422,
            problemJson(
              422,
              'VALIDATION_FAILED',
              errors: [
                {'field': 'password', 'message': 'too common'},
                {'field': 'password', 'message': 'too short'},
              ],
            ),
          ),
        );
        expect(error.code, ErrorCode.validationFailed);
        expect(error.status, 422);
        expect(error.fields, {'password': 'too common'});
        expect(error.isNetwork, isFalse);
      },
    );

    test(
      'U-08 a code from a newer server degrades to unknown instead of failing',
      () {
        final error = ApiException.fromDio(
          failure(409, problemJson(409, 'SOMETHING_NEW')),
        );
        expect(error.code, ErrorCode.unknown);
        expect(error.status, 409);
      },
    );

    test(
      'U-09 no response is a network failure; a non-problem body keeps only the status',
      () {
        expect(ApiException.fromDio(failure(null, null)).isNetwork, isTrue);
        final html = ApiException.fromDio(
          failure(502, '<html>bad gateway</html>'),
        );
        expect(html.code, ErrorCode.unknown);
        expect(html.status, 502);
        expect(html.isNetwork, isFalse);
      },
    );
  });
}
