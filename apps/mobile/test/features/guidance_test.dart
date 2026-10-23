import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

/// P3-20 — what the booking screen tells the customer to do at each stage of the rental: collect, in use, return,
/// overdue, done. (Hand-over and return are done by staff at the drawer; the customer's screen explains the step.)
Future<void> _open(
  WidgetTester tester, {
  required Map<String, dynamic> booking,
  required DateTime now,
  bool past = false,
}) async {
  final api = FakeApi({
    'GET /v1/drawers': StubResponse(200, [drawerJson()]),
    'GET /v1/bookings': StubResponse(200, [booking]),
    'GET /v1/bookings/b-1': StubResponse(200, booking),
    'GET /v1/me/kyc': const StubResponse(200, {
      'required': true,
      'status': 'none',
      'maskedAadhaar': null,
      'verifiedAt': null,
      'verifiedName': null,
      'reason': null,
    }),
  });
  await pumpApp(tester, api, signedIn: true, now: FakeNow(now));
  await tester.tap(find.text('My bookings').first);
  await tester.pumpAndSettle();
  if (past) {
    await tester.tap(find.text('Past'));
    await tester.pumpAndSettle();
  }
  await tester.tap(find.byKey(const Key('booking-b-1')));
  await tester.pumpAndSettle();
}

String _text(WidgetTester tester, String key) => tester
    .widgetList<Text>(
      find.descendant(of: find.byKey(Key(key)), matching: find.byType(Text)),
    )
    .map((t) => t.data ?? '')
    .join(' | ');

void main() {
  // The booking runs 10:00–11:00 in Bengaluru (04:30–05:30 UTC).
  final confirmed = bookingJson(
    status: 'confirmed',
    holdExpiresAt: null,
    payment: paidJson(),
  );

  testWidgets(
    'G-01 confirmed, before the start: when it starts and where to go',
    (tester) async {
      await _open(
        tester,
        booking: confirmed,
        now: DateTime.utc(2030, 1, 7, 3, 0),
      );
      final text = _text(tester, 'guidance-confirmed');
      expect(text, contains('Collect your item'));
      expect(text, contains('Starts in 1 h 30 min'));
      expect(text, contains('Indiranagar'));
      expect(text, contains('show this booking to the staff'));
    },
  );

  testWidgets('G-02 confirmed, once the time has started: go and collect it', (
    tester,
  ) async {
    await _open(
      tester,
      booking: confirmed,
      now: DateTime.utc(2030, 1, 7, 4, 40),
    );
    final text = _text(tester, 'guidance-confirmed');
    expect(text, contains('Your time has started'));
    expect(text, isNot(contains('Starts in')));
  });

  testWidgets('G-03 in use: return by when, where, and how long is left', (
    tester,
  ) async {
    await _open(
      tester,
      booking: bookingJson(
        status: 'active',
        holdExpiresAt: null,
        payment: paidJson(),
        cancellable: false,
      ),
      now: DateTime.utc(2030, 1, 7, 4, 50),
    );
    final text = _text(tester, 'guidance-active');
    expect(text, contains('In use'));
    expect(text, contains('11:00 AM'));
    expect(text, contains('Time left: 40 min'));
    expect(find.byKey(const Key('extend-booking')), findsOneWidget);
  });

  testWidgets('G-04 in use, nearly over: says so and points at extending', (
    tester,
  ) async {
    await _open(
      tester,
      booking: bookingJson(
        status: 'active',
        holdExpiresAt: null,
        payment: paidJson(),
        cancellable: false,
      ),
      now: DateTime.utc(2030, 1, 7, 5, 22),
    );
    final text = _text(tester, 'guidance-active');
    expect(text, contains('Almost time'));
    expect(text, contains('extend'));
  });

  testWidgets('G-05 overdue: asks plainly to return it now (no fee talk)', (
    tester,
  ) async {
    await _open(
      tester,
      booking: bookingJson(
        status: 'overdue',
        holdExpiresAt: null,
        payment: paidJson(),
        cancellable: false,
      ),
      now: DateTime.utc(2030, 1, 7, 6, 0),
    );
    final text = _text(tester, 'guidance-overdue');
    expect(text, contains('Please return it now'));
    expect(text, contains('11:00 AM'));
    expect(text.toLowerCase(), isNot(contains('fee')));
  });

  testWidgets('G-06 completed and not-collected bookings close the story', (
    tester,
  ) async {
    await _open(
      tester,
      booking: bookingJson(
        status: 'completed',
        holdExpiresAt: null,
        payment: paidJson(),
        cancellable: false,
      ),
      now: DateTime.utc(2030, 1, 8, 3, 0),
      past: true,
    );
    expect(_text(tester, 'guidance-completed'), contains('Returned'));
  });

  testWidgets(
    'G-07 no guidance where there is nothing to do (held, cancelled)',
    (tester) async {
      await _open(
        tester,
        booking: bookingJson(),
        now: DateTime.utc(2030, 1, 7, 3, 0),
      );
      expect(find.byKey(const Key('guidance-held')), findsNothing);
      expect(find.textContaining('Collect your item'), findsNothing);
    },
  );

  testWidgets('G-08 a not-collected booking says so', (tester) async {
    await _open(
      tester,
      booking: bookingJson(
        status: 'no_show',
        holdExpiresAt: null,
        payment: paidJson(),
        cancellable: false,
      ),
      now: DateTime.utc(2030, 1, 8, 3, 0),
      past: true,
    );
    expect(_text(tester, 'guidance-no_show'), contains('Not collected'));
  });
}
