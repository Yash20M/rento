import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

Map<String, dynamic> _active({String ends = '2030-01-07T05:30:00.000Z'}) =>
    bookingJson(
      status: 'active',
      holdExpiresAt: null,
      cancellable: false,
      payment: paidJson(),
      endsAt: ends,
    );

Map<String, dynamic> _extension() => {
  'id': 'e-1',
  'extraMinutes': 30,
  'pricePaise': 4900,
  'newEndsAt': '2030-01-07T06:00:00.000Z',
  'orderId': 'order-e',
  'provider': 'fake',
};

FakeApi _rentalApi([Map<String, Object> extra = const {}]) => FakeApi({
  'GET /v1/bookings': StubResponse(200, [_active()]),
  'GET /v1/bookings/b-1': StubResponse(200, _active()),
  'GET /v1/drawers': const StubResponse(200, <Object>[]),
  ...extra,
});

Future<void> _openDetail(WidgetTester tester) async {
  await tester.tap(find.text('My bookings').first);
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('booking-b-1')));
  await tester.pumpAndSettle();
}

void main() {
  group('extending a rental', () {
    testWidgets('X-01 only a running rental offers "Extend rental"', (
      tester,
    ) async {
      final api = FakeApi({
        'GET /v1/bookings': StubResponse(200, [
          bookingJson(
            status: 'confirmed',
            holdExpiresAt: null,
            payment: paidJson(),
          ),
        ]),
        'GET /v1/bookings/b-1': StubResponse(
          200,
          bookingJson(
            status: 'confirmed',
            holdExpiresAt: null,
            payment: paidJson(),
          ),
        ),
        'GET /v1/drawers': const StubResponse(200, <Object>[]),
      });
      await pumpApp(tester, api, signedIn: true);
      await _openDetail(tester);
      expect(find.byKey(const Key('extend-booking')), findsNothing);
    });

    testWidgets(
      'X-02 choose time, see the price and the new end in the drawer\'s zone, pay, and the rental is refreshed',
      (tester) async {
        var extended = false;
        final api = _rentalApi({
          'GET /v1/bookings/b-1':
              (_) => StubResponse(
                200,
                _active(
                  ends:
                      extended
                          ? '2030-01-07T06:00:00.000Z'
                          : '2030-01-07T05:30:00.000Z',
                ),
              ),
          'POST /v1/bookings/b-1/extend': StubResponse(201, _extension()),
          'POST /v1/bookings/b-1/extensions/e-1/simulate': const StubResponse(
            200,
            {'orderId': 'order-e', 'paymentId': 'pay-e', 'signature': 'sig-e'},
          ),
          'POST /v1/bookings/b-1/extensions/e-1/confirm': (_) {
            extended = true;
            return StubResponse(200, _active(ends: '2030-01-07T06:00:00.000Z'));
          },
        });
        await pumpApp(tester, api, signedIn: true);
        await _openDetail(tester);
        expect(find.textContaining('– 11:00 AM'), findsOneWidget);
        await tester.tap(find.byKey(const Key('extend-booking')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('extend-30')));
        await tester.pumpAndSettle();
        expect(api.to('POST', '/v1/bookings/b-1/extend').single.data, {
          'extraMinutes': 30,
        });
        expect(find.text('Extra ₹49 for 30 min'), findsOneWidget);
        expect(
          find.text('Your rental now ends at 11:30 AM.'),
          findsOneWidget,
        ); // 06:00Z in India
        await tester.tap(find.byKey(const Key('extend-pay')));
        await tester.pumpAndSettle();

        expect(
          api.to('POST', '/v1/bookings/b-1/extensions/e-1/confirm').single.data,
          {'orderId': 'order-e', 'paymentId': 'pay-e', 'signature': 'sig-e'},
        );
        expect(
          find.textContaining('– 11:30 AM'),
          findsOneWidget,
        ); // the detail shows the later end
      },
    );

    testWidgets(
      'X-03 "booked after you" is explained with how many minutes are possible, and no payment is offered',
      (tester) async {
        final api = _rentalApi({
          'POST /v1/bookings/b-1/extend': StubResponse(
            409,
            problemJson(
              409,
              'EXTENSION_UNAVAILABLE',
              errors: [
                {'field': 'extraMinutes', 'message': 'at most 30 minutes'},
              ],
            ),
          ),
        });
        await pumpApp(tester, api, signedIn: true);
        await _openDetail(tester);
        await tester.tap(find.byKey(const Key('extend-booking')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('extend-90')));
        await tester.pumpAndSettle();
        expect(find.textContaining('at most 30 minutes'), findsOneWidget);
        expect(find.byKey(const Key('extend-pay')), findsNothing);
      },
    );

    testWidgets(
      'X-04 someone takes the gap while paying: nothing is charged and the order is dropped',
      (tester) async {
        final api = _rentalApi({
          'POST /v1/bookings/b-1/extend': StubResponse(201, _extension()),
          'POST /v1/bookings/b-1/extensions/e-1/simulate': const StubResponse(
            200,
            {'orderId': 'order-e', 'paymentId': 'pay-e', 'signature': 'sig-e'},
          ),
          'POST /v1/bookings/b-1/extensions/e-1/confirm': StubResponse(
            409,
            problemJson(
              409,
              'EXTENSION_UNAVAILABLE',
              errors: [
                {'field': 'extraMinutes', 'message': 'at most 0 minutes'},
              ],
            ),
          ),
        });
        await pumpApp(tester, api, signedIn: true);
        await _openDetail(tester);
        await tester.tap(find.byKey(const Key('extend-booking')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('extend-30')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('extend-pay')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('extend-error')), findsOneWidget);
        expect(find.byKey(const Key('extend-pay')), findsNothing);
      },
    );
  });

  group('forgotten password', () {
    testWidgets(
      'P-01 the same answer for every email; the code screen is one tap away',
      (tester) async {
        final api = FakeApi({
          'POST /v1/auth/password/forgot': const StubResponse(202),
        });
        await pumpApp(tester, api);
        await tester.tap(find.byKey(const Key('forgot-link')));
        await tester.pumpAndSettle();
        await enterText(tester, 'Email', 'nobody@example.com');
        await tester.tap(find.byKey(const Key('forgot-send')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('forgot-sent')), findsOneWidget);
        expect(api.to('POST', '/v1/auth/password/forgot').single.data, {
          'email': 'nobody@example.com',
        });
        await tester.tap(find.byKey(const Key('have-code')));
        await tester.pumpAndSettle();
        expect(find.text('Choose a new password'), findsWidgets);
      },
    );

    testWidgets(
      'P-02 a good code and password finish with a way back to sign-in',
      (tester) async {
        final api = FakeApi({
          'POST /v1/auth/password/reset': const StubResponse(204),
        });
        await pumpApp(tester, api);
        await tester.tap(find.byKey(const Key('forgot-link')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('have-code')));
        await tester.pumpAndSettle();
        await enterText(tester, 'Code from the email', ' abc123 ');
        await enterText(tester, 'Password', 'a long enough password');
        await tester.tap(find.byKey(const Key('reset-save')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('reset-done')), findsOneWidget);
        expect(api.to('POST', '/v1/auth/password/reset').single.data, {
          'token': 'abc123',
          'newPassword': 'a long enough password',
        });
      },
    );

    testWidgets(
      'P-03 a dead code and a weak password are explained separately',
      (tester) async {
        var n = 0;
        final api = FakeApi({
          'POST /v1/auth/password/reset': (_) {
            n++;
            return n == 1
                ? StubResponse(
                  422,
                  problemJson(
                    422,
                    'VALIDATION_FAILED',
                    errors: [
                      {'field': 'token', 'message': 'is not valid'},
                    ],
                  ),
                )
                : StubResponse(
                  422,
                  problemJson(
                    422,
                    'VALIDATION_FAILED',
                    errors: [
                      {'field': 'newPassword', 'message': 'is too common'},
                    ],
                  ),
                );
          },
        });
        await pumpApp(tester, api);
        await tester.tap(find.byKey(const Key('forgot-link')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('have-code')));
        await tester.pumpAndSettle();
        await enterText(tester, 'Code from the email', 'dead');
        await enterText(tester, 'Password', 'password123');
        await tester.tap(find.byKey(const Key('reset-save')));
        await tester.pumpAndSettle();
        expect(
          find.text('That code is not valid any more. Ask for a new email.'),
          findsOneWidget,
        );
        await tester.tap(find.byKey(const Key('reset-save')));
        await tester.pumpAndSettle();
        expect(find.text('is too common'), findsOneWidget);
      },
    );
  });
}
