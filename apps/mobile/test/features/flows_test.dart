import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/core/location/location_service.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

FakeApi _browseApi([Map<String, Object> extra = const {}]) => FakeApi({
  'GET /v1/drawers': StubResponse(200, [drawerJson()]),
  'GET /v1/drawers/d-1/inventory': StubResponse(200, [inventoryJson()]),
  'GET /v1/drawers/d-1/items/m-1/availability': StubResponse(
    200,
    availabilityJson(),
  ),
  'GET /v1/bookings': const StubResponse(200, <Object>[]),
  ...extra,
});

Future<void> _tapText(WidgetTester tester, String text) async {
  // The pictures are big now: what the person taps may be below the fold, so scroll to it like a person would.
  await tester.ensureVisible(find.text(text).first);
  await tester.pumpAndSettle();
  await tester.tap(find.text(text).first);
  await tester.pumpAndSettle();
}

Future<void> _chooseDemoPlace(WidgetTester tester) async {
  await chooseDemoPlace(tester);
}

void main() {
  group('signing in', () {
    testWidgets('F-01 valid credentials sign in and open the app', (
      tester,
    ) async {
      final api = FakeApi({
        'POST /v1/auth/login': StubResponse(200, authJson()),
        'GET /v1/drawers': const StubResponse(200, <Object>[]),
      });
      final pumped = await pumpApp(tester, api);
      await enterText(tester, 'Email', ' asha@example.com ');
      await enterText(tester, 'Password', 'a long enough password');
      await tester.tap(find.text('Sign in').last);
      await tester.pumpAndSettle();

      expect(find.byType(NavigationBar), findsOneWidget);
      expect(api.to('POST', '/v1/auth/login').single.data, {
        'email': 'asha@example.com',
        'password': 'a long enough password',
      });
      expect(await pumped.store.read('refresh_token'), 'refresh-1');
    });

    testWidgets(
      'F-02 the button waits for both fields; a wrong password shows one generic message',
      (tester) async {
        final api = FakeApi({
          'POST /v1/auth/login': StubResponse(
            401,
            problemJson(
              401,
              'UNAUTHENTICATED',
              detail: 'Invalid email or password',
            ),
          ),
        });
        await pumpApp(tester, api);
        final button = find.widgetWithText(FilledButton, 'Sign in');
        expect(tester.widget<FilledButton>(button).onPressed, isNull);
        await enterText(tester, 'Email', 'asha@example.com');
        expect(tester.widget<FilledButton>(button).onPressed, isNull);
        await enterText(tester, 'Password', 'wrong password!!');
        await tester.tap(button);
        await tester.pumpAndSettle();

        expect(find.text('Incorrect email or password.'), findsOneWidget);
        expect(find.byType(NavigationBar), findsNothing);
      },
    );

    testWidgets(
      'F-03 registering signs in; a taken email and a weak password are explained',
      (tester) async {
        final api = FakeApi({
          'POST /v1/auth/register': (RequestOptions o) {
            final password = (o.data as Map)['password'];
            if (password == 'password123') {
              return StubResponse(
                422,
                problemJson(
                  422,
                  'VALIDATION_FAILED',
                  errors: [
                    {'field': 'password', 'message': 'is too common'},
                  ],
                ),
              );
            }
            if ((o.data as Map)['email'] == 'taken@example.com') {
              return StubResponse(409, problemJson(409, 'EMAIL_TAKEN'));
            }
            return StubResponse(201, authJson());
          },
          'GET /v1/drawers': const StubResponse(200, <Object>[]),
        });
        await pumpApp(tester, api);
        await _tapText(tester, 'New to Rento? Create an account');
        await enterText(tester, 'Your name', 'Asha');
        await enterText(tester, 'Email', 'asha@example.com');
        await enterText(tester, 'Password', 'password123');
        await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
        await tester.pumpAndSettle();
        expect(find.text('is too common'), findsOneWidget);

        await enterText(tester, 'Email', 'taken@example.com');
        await enterText(tester, 'Password', 'a long enough password');
        await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
        await tester.pumpAndSettle();
        expect(find.textContaining('already exists'), findsOneWidget);

        await enterText(tester, 'Email', 'new@example.com');
        await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
        await tester.pumpAndSettle();
        expect(find.byType(NavigationBar), findsOneWidget);
      },
    );

    testWidgets(
      'F-04 signing out clears the session and returns to the sign-in screen',
      (tester) async {
        final api = _browseApi({
          'POST /v1/auth/logout': const StubResponse(204),
        });
        final pumped = await pumpApp(tester, api, signedIn: true);
        await _tapText(tester, 'Account');
        expect(find.text('Signed in as asha@example.com'), findsOneWidget);
        await tester.tap(find.byKey(const Key('sign-out')));
        await tester.pumpAndSettle();

        expect(find.text('Welcome back'), findsOneWidget);
        expect(await pumped.store.read('refresh_token'), isNull);
        expect(api.to('POST', '/v1/auth/logout').single.data, {
          'refreshToken': 'refresh-1',
        });
      },
    );
  });

  group('finding a drawer', () {
    testWidgets(
      'E-01 choosing a demo place lists the nearest open drawers, and the coordinates go in the request',
      (tester) async {
        final api = _browseApi({
          'POST /v1/drawers/nearby': StubResponse(200, {
            'drawers': [
              nearbyDrawerJson(distance: 850),
              nearbyDrawerJson(id: 'd-2', name: 'Koramangala', distance: 2400),
            ],
            'unavailable': [
              nearbyDrawerJson(
                id: 'd-3',
                name: 'Whitefield',
                distance: 4100,
                openNow: false,
                reason: 'closed',
              ),
            ],
          }),
        });
        await pumpApp(tester, api, signedIn: true);
        await _chooseDemoPlace(tester);

        expect(
          find.text('Near Bengaluru · Indiranagar'),
          findsNothing,
          reason: 'no location bar',
        );
        expect(find.text('Indiranagar'), findsOneWidget);
        expect(find.text('850 m away'), findsOneWidget);
        expect(find.text('2.4 km away'), findsOneWidget);
        expect(
          find.text('Nearby, but not available right now'),
          findsOneWidget,
        );
        expect(find.text('Closed'), findsOneWidget);
        final body = api.to('POST', '/v1/drawers/nearby').single.data as Map;
        expect(body['latitude'], 12.9784);
        expect(
          body['longitude'],
          77.6408,
        ); // longitude is the second coordinate
      },
    );

    testWidgets('E-02 nowhere near a drawer is an answer, not an error', (
      tester,
    ) async {
      final api = _browseApi({
        'POST /v1/drawers/nearby': StubResponse(
          422,
          problemJson(422, 'OUTSIDE_SERVICE_AREA'),
        ),
      });
      await pumpApp(tester, api, signedIn: true);
      await _chooseDemoPlace(tester);

      expect(find.byKey(const Key('outside-service-area')), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
    });

    testWidgets(
      'E-03 a failing nearby search never blanks the screen: everything is shown',
      (tester) async {
        final api = _browseApi({
          'POST /v1/drawers/nearby': StubResponse(
            503,
            problemJson(503, 'RETRY_LATER'),
          ),
        });
        await pumpApp(tester, api, signedIn: true);
        await _chooseDemoPlace(tester);
        expect(find.byKey(const Key('drawer-d-1')), findsOneWidget);
        expect(find.textContaining('busy'), findsNothing);
        expect(find.text('Try again'), findsNothing);
      },
    );

    testWidgets(
      'E-05 the device position is used for the search, without asking',
      (tester) async {
        final api = _browseApi({
          'POST /v1/drawers/nearby': StubResponse(200, {
            'drawers': [nearbyDrawerJson()],
            'unavailable': <Object>[],
          }),
        });
        await pumpApp(
          tester,
          api,
          signedIn: true,
          location: FakeLocation(
            point: const GeoPoint(latitude: 28.6, longitude: 77.2),
          ),
          autoLocate: true,
        );
        expect(
          find.text('Near your location'),
          findsNothing,
          reason: 'no location bar',
        );
        expect(
          (api.to('POST', '/v1/drawers/nearby').single.data as Map)['latitude'],
          28.6,
        );
      },
    );
  });

  group('booking', () {
    Future<void> toSlotPicker(
      WidgetTester tester,
      FakeApi api, {
      FakeNow? now,
    }) async {
      await pumpApp(tester, api, signedIn: true, now: now);
      await _chooseDemoPlace(tester);
      await _tapText(tester, 'Indiranagar');
      await _tapText(tester, 'PlayStation 5');
    }

    FakeApi bookingApi([Map<String, Object> extra = const {}]) => _browseApi({
      'POST /v1/drawers/nearby': StubResponse(200, {
        'drawers': [nearbyDrawerJson()],
        'unavailable': <Object>[],
      }),
      ...extra,
    });

    testWidgets(
      'B-01 the drawer shows where, when open, pickup instructions and what can be rented',
      (tester) async {
        final api = bookingApi();
        await pumpApp(tester, api, signedIn: true);
        await _chooseDemoPlace(tester);
        await _tapText(tester, 'Indiranagar');

        expect(find.text('1 Test Street, Bengaluru'), findsOneWidget);
        expect(find.text('Ring the bell at the glass door'), findsOneWidget);
        expect(find.byKey(const Key('drawer-open-state')), findsOneWidget);
        expect(find.text('₹49'), findsOneWidget);
        expect(find.text('per 30 min'), findsOneWidget);
        expect(
          find.text('Available'),
          findsOneWidget,
        ); // in the area, units free
      },
    );

    testWidgets(
      'B-02 slot times are shown in the DRAWER\'s zone; only bookable starts, only fitting lengths, price in rupees',
      (tester) async {
        await toSlotPicker(tester, bookingApi());

        expect(find.text('Times are in Asia/Kolkata'), findsOneWidget);
        expect(find.text('10:00 AM'), findsOneWidget); // 04:30Z
        expect(find.text('10:30 AM'), findsOneWidget);
        expect(find.text('11:00 AM'), findsNothing); // nobody free
        await tester.ensureVisible(find.text('10:00 AM'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('10:00 AM'));
        await tester.pumpAndSettle();
        for (final minutes in [30, 60, 90, 120]) {
          expect(find.byKey(Key('duration-$minutes')), findsOneWidget);
        }
        expect(
          find.byKey(const Key('duration-150')),
          findsNothing,
        ); // only 120 min free from 10:00
        await tester.ensureVisible(find.byKey(const Key('duration-60')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('duration-60')));
        await tester.pumpAndSettle();
        expect(
          tester.widget<Text>(find.byKey(const Key('summary-total'))).data,
          '₹298',
        );
      },
    );

    testWidgets(
      'B-03 the shorter window of a later start limits the lengths offered',
      (tester) async {
        await toSlotPicker(tester, bookingApi());
        await tester.ensureVisible(find.text('10:30 AM'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('10:30 AM'));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('duration-60')), findsOneWidget);
        expect(find.byKey(const Key('duration-90')), findsNothing);
      },
    );

    testWidgets('B-04 a closed day says so and offers no times', (
      tester,
    ) async {
      final api = bookingApi({
        'GET /v1/drawers/d-1/items/m-1/availability': StubResponse(
          200,
          availabilityJson(open: false, slots: <Map<String, dynamic>>[]),
        ),
      });
      await toSlotPicker(tester, api);
      expect(find.byKey(const Key('closed-day')), findsOneWidget);
      expect(find.byKey(const Key('reserve')), findsOneWidget);
      expect(
        tester.widget<FilledButton>(find.byKey(const Key('reserve'))).onPressed,
        isNull,
      );
    });

    testWidgets(
      'B-05 choosing another day asks for that day (in the drawer\'s calendar)',
      (tester) async {
        final api = bookingApi();
        await toSlotPicker(tester, api);
        await tester.ensureVisible(find.byKey(const Key('day-2030-01-09')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('day-2030-01-09')));
        await tester.pumpAndSettle();
        final dates = api
            .to('GET', '/v1/drawers/d-1/items/m-1/availability')
            .map((r) => r.queryParameters['date']);
        expect(dates, containsAllInOrder(['2030-01-07', '2030-01-09']));
      },
    );

    testWidgets(
      'B-06 reserving sends the exact slot with an Idempotency-Key, then shows the payment screen with a countdown',
      (tester) async {
        final api = bookingApi({
          'POST /v1/bookings': StubResponse(201, bookingJson()),
          'GET /v1/bookings/b-1': StubResponse(200, bookingJson()),
        });
        await toSlotPicker(tester, api);
        await tester.ensureVisible(find.text('10:00 AM'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('10:00 AM'));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.byKey(const Key('duration-60')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('duration-60')));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.byKey(const Key('reserve')));
        await tester.tap(find.byKey(const Key('reserve')));
        await tester.pumpAndSettle();

        final request = api.to('POST', '/v1/bookings').single;
        expect(request.data, {
          'drawerId': 'd-1',
          'itemModelId': 'm-1',
          'startsAt': '2030-01-07T04:30:00.000Z',
          'durationMinutes': 60,
        });
        expect(
          request.headers['Idempotency-Key'],
          matches(
            RegExp(
              r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
            ),
          ),
        );
        expect(find.text('Complete your booking'), findsOneWidget);
        expect(
          find.text('We are holding this for you for 10:00'),
          findsOneWidget,
        );
        expect(find.text('Pay ₹298'), findsOneWidget);
        expect(find.text('Demo payment: no money is charged.'), findsOneWidget);
      },
    );

    testWidgets(
      'B-07 "someone just took it" explains, clears the choice and refreshes the times; the next attempt uses a NEW key',
      (tester) async {
        final api = bookingApi({
          'POST /v1/bookings': StubResponse(
            409,
            problemJson(409, 'BOOKING_SLOT_TAKEN'),
          ),
        });
        await toSlotPicker(tester, api);
        Future<void> attempt() async {
          await tester.ensureVisible(find.text('10:00 AM'));
          await tester.pumpAndSettle();
          await tester.tap(find.text('10:00 AM'));
          await tester.pumpAndSettle();
          await tester.ensureVisible(find.byKey(const Key('duration-60')));
          await tester.pumpAndSettle();
          await tester.tap(find.byKey(const Key('duration-60')));
          await tester.pumpAndSettle();
          await tester.ensureVisible(find.byKey(const Key('reserve')));
          await tester.tap(find.byKey(const Key('reserve')));
          await tester.pumpAndSettle();
        }

        await attempt();
        expect(
          find.text('Someone just took that time. Please pick another.'),
          findsOneWidget,
        );
        expect(
          tester
              .widget<FilledButton>(find.byKey(const Key('reserve')))
              .onPressed,
          isNull,
        );
        expect(
          api.to('GET', '/v1/drawers/d-1/items/m-1/availability'),
          hasLength(2),
        ); // refreshed
        await attempt();
        final keys =
            api
                .to('POST', '/v1/bookings')
                .map((r) => r.headers['Idempotency-Key'])
                .toSet();
        expect(keys, hasLength(2));
      },
    );

    testWidgets(
      'B-08 a busy server keeps the SAME key so the retry cannot create a second hold',
      (tester) async {
        var calls = 0;
        final api = bookingApi({
          'POST /v1/bookings': (_) {
            calls++;
            return calls == 1
                ? StubResponse(503, problemJson(503, 'RETRY_LATER'))
                : StubResponse(201, bookingJson());
          },
          'GET /v1/bookings/b-1': StubResponse(200, bookingJson()),
        });
        await toSlotPicker(tester, api);
        await tester.ensureVisible(find.text('10:00 AM'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('10:00 AM'));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.byKey(const Key('duration-60')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('duration-60')));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.byKey(const Key('reserve')));
        await tester.tap(find.byKey(const Key('reserve')));
        await tester.pumpAndSettle();
        expect(find.textContaining('busy'), findsOneWidget);
        await tester.tap(find.byKey(const Key('reserve')));
        await tester.pumpAndSettle();

        final keys =
            api
                .to('POST', '/v1/bookings')
                .map((r) => r.headers['Idempotency-Key'])
                .toList();
        expect(keys, hasLength(2));
        expect(keys[0], keys[1]);
        expect(find.text('Complete your booking'), findsOneWidget);
      },
    );

    testWidgets(
      'B-08b the answer is LOST on a flaky network: the retry cannot create a second booking (one booking server-side)',
      (tester) async {
        // A stand-in for the real server's idempotency: a key it has seen returns the SAME booking, never a new one.
        final createdFor = <String, String>{};
        var lostOnce = false;
        final api = bookingApi({
          'POST /v1/bookings': (RequestOptions options) {
            final key = options.headers['Idempotency-Key'] as String;
            createdFor.putIfAbsent(key, () => 'b-${createdFor.length + 1}');
            if (!lostOnce) {
              lostOnce =
                  true; // the server did the work, the phone never heard back
              return const StubResponse.networkDown();
            }
            return StubResponse(201, bookingJson(id: createdFor[key]!));
          },
          'GET /v1/bookings/b-1': StubResponse(200, bookingJson()),
        });
        await toSlotPicker(tester, api);
        await tester.ensureVisible(find.text('10:00 AM'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('10:00 AM'));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.byKey(const Key('duration-60')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('duration-60')));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.byKey(const Key('reserve')));
        await tester.tap(find.byKey(const Key('reserve')));
        await tester.pumpAndSettle();
        expect(find.textContaining('Cannot reach Rento'), findsWidgets);
        expect(
          tester
              .widget<FilledButton>(find.byKey(const Key('reserve')))
              .onPressed,
          isNull,
          reason: 'booking is switched off while Rento cannot be reached',
        );

        // Back online, the person taps Reserve again.
        await tester.tap(find.byKey(const Key('offline-check')));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.byKey(const Key('reserve')));
        await tester.tap(find.byKey(const Key('reserve')));
        await tester.pumpAndSettle();

        final keys =
            api
                .to('POST', '/v1/bookings')
                .map((r) => r.headers['Idempotency-Key'])
                .toList();
        expect(keys, hasLength(2));
        expect(keys[0], keys[1], reason: 'the retry must reuse the key');
        expect(createdFor, hasLength(1), reason: 'one booking server-side');
        expect(find.text('Complete your booking'), findsOneWidget);
      },
    );

    FakeApi payApi({StubResponse? confirm}) => bookingApi({
      'POST /v1/bookings': StubResponse(201, bookingJson()),
      'GET /v1/bookings/b-1': StubResponse(200, bookingJson()),
      'POST /v1/bookings/b-1/payment': const StubResponse(200, {
        'provider': 'fake',
        'orderId': 'order-1',
        'amountPaise': 29800,
        'currency': 'INR',
        'holdExpiresAt': null,
      }),
      'POST /v1/bookings/b-1/payment/simulate': const StubResponse(200, {
        'orderId': 'order-1',
        'paymentId': 'pay-1',
        'signature': 'sig-1',
      }),
      'POST /v1/bookings/b-1/payment/confirm':
          confirm ??
          StubResponse(
            200,
            bookingJson(
              status: 'confirmed',
              holdExpiresAt: null,
              payment: paidJson(),
            ),
          ),
    });

    Future<void> reserve(WidgetTester tester) async {
      await tester.ensureVisible(find.text('10:00 AM'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('10:00 AM'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('10:00 AM'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('duration-60')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('duration-60')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('duration-60')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('reserve')));
      await tester.tap(find.byKey(const Key('reserve')));
      await tester.pumpAndSettle();
    }

    testWidgets(
      'B-09b after paying, "View booking" shows the booking as CONFIRMED, not the stale "awaiting payment" copy',
      (tester) async {
        // The server answers with the held booking until the payment is confirmed, then with the confirmed one.
        var paid = false;
        final api = payApi();
        api.on(
          'GET /v1/bookings/b-1',
          (_) => StubResponse(
            200,
            paid
                ? bookingJson(
                  status: 'confirmed',
                  holdExpiresAt: null,
                  payment: paidJson(),
                )
                : bookingJson(),
          ),
        );
        api.on('POST /v1/bookings/b-1/payment/confirm', (_) {
          paid = true;
          return StubResponse(
            200,
            bookingJson(
              status: 'confirmed',
              holdExpiresAt: null,
              payment: paidJson(),
            ),
          );
        });
        await toSlotPicker(tester, api);
        await reserve(tester);
        await tester.ensureVisible(find.byKey(const Key('pay')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('pay')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('demo-pay-card-ok')));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.byKey(const Key('view-booking')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('view-booking')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('status-confirmed')), findsOneWidget);
        expect(find.text('Awaiting payment'), findsNothing);
      },
    );

    testWidgets(
      'B-09 paying confirms through the SERVER: order, checkout, signed confirmation — then "You are booked!"',
      (tester) async {
        final api = payApi();
        await toSlotPicker(tester, api);
        await reserve(tester);
        await tester.ensureVisible(find.byKey(const Key('pay')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('pay')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('demo-pay-card-ok')));
        await tester.pumpAndSettle();

        expect(api.to('POST', '/v1/bookings/b-1/payment/confirm').single.data, {
          'orderId': 'order-1',
          'paymentId': 'pay-1',
          'signature': 'sig-1',
        });
        expect(find.byKey(const Key('confirmed-title')), findsOneWidget);
        expect(find.text('Paid'), findsOneWidget);
        expect(find.byKey(const Key('booking-when')), findsOneWidget);
      },
    );

    testWidgets(
      'B-09b a declined test card keeps the slot held, confirms nothing and lets the customer retry',
      (tester) async {
        final api = payApi();
        await toSlotPicker(tester, api);
        await reserve(tester);
        await tester.ensureVisible(find.byKey(const Key('pay')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('pay')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('demo-pay-card-fail')));
        await tester.pumpAndSettle();

        expect(find.byKey(const Key('payment-declined')), findsOneWidget);
        expect(api.to('POST', '/v1/bookings/b-1/payment/confirm'), isEmpty);
        expect(find.byKey(const Key('pay')), findsOneWidget);

        await tester.ensureVisible(find.byKey(const Key('pay')));

        await tester.pumpAndSettle();

        await tester.tap(find.byKey(const Key('pay')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('demo-pay-upi')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('confirmed-title')), findsOneWidget);
      },
    );

    testWidgets(
      'B-10 a payment that does not verify is explained, nothing is shown as paid',
      (tester) async {
        final api = payApi(
          confirm: StubResponse(422, problemJson(422, 'PAYMENT_INVALID')),
        );
        await toSlotPicker(tester, api);
        await reserve(tester);
        await tester.ensureVisible(find.byKey(const Key('pay')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('pay')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('demo-pay-card-ok')));
        await tester.pumpAndSettle();

        expect(find.textContaining('could not be confirmed'), findsOneWidget);
        expect(find.byKey(const Key('confirmed-title')), findsNothing);
        expect(find.byKey(const Key('pay')), findsOneWidget); // can try again
      },
    );

    testWidgets(
      'B-11 when the hold runs out the screen says so and the pay button is gone',
      (tester) async {
        final api = payApi();
        final now = FakeNow(DateTime.utc(2030, 1, 7, 3, 0));
        await toSlotPicker(tester, api, now: now);
        await reserve(tester);
        expect(find.byKey(const Key('pay')), findsOneWidget);

        now.advance(const Duration(minutes: 10, seconds: 1));
        await tester.pump(const Duration(seconds: 1));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('hold-expired')), findsOneWidget);
        expect(find.byKey(const Key('pay')), findsNothing);
      },
    );

    testWidgets(
      'B-12 paying a hold that expired meanwhile (410) is explained',
      (tester) async {
        final api = payApi(
          confirm: StubResponse(410, problemJson(410, 'HOLD_EXPIRED')),
        );
        await toSlotPicker(tester, api);
        await reserve(tester);
        await tester.ensureVisible(find.byKey(const Key('pay')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('pay')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('demo-pay-card-ok')));
        await tester.pumpAndSettle();
        expect(
          find.text('The slot was released. Please choose a time again.'),
          findsWidgets,
        );
      },
    );

    testWidgets(
      'B-13 releasing the slot cancels the hold and returns to explore',
      (tester) async {
        final api = payApi();
        api.on(
          'POST /v1/bookings/b-1/cancel',
          StubResponse(
            200,
            bookingJson(status: 'cancelled', cancellable: false),
          ),
        );
        await toSlotPicker(tester, api);
        await reserve(tester);
        await tester.ensureVisible(find.byKey(const Key('release')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('release')));
        await tester.pumpAndSettle();
        expect(api.to('POST', '/v1/bookings/b-1/cancel'), hasLength(1));
        expect(find.text('Rent what you need, by the hour.'), findsWidgets);
      },
    );
  });

  group('my bookings', () {
    FakeApi listApi(
      List<Map<String, dynamic>> bookings, [
      Map<String, Object> extra = const {},
    ]) => FakeApi({
      'GET /v1/bookings': StubResponse(200, bookings),
      'GET /v1/drawers': const StubResponse(200, <Object>[]),
      ...extra,
    });

    testWidgets(
      'M-01 current and future bookings come first, finished ones are under "Past"',
      (tester) async {
        final api = listApi([
          bookingJson(
            id: 'b-1',
            status: 'confirmed',
            holdExpiresAt: null,
            payment: paidJson(),
          ),
          bookingJson(
            id: 'b-2',
            status: 'cancelled',
            cancellable: false,
            holdExpiresAt: null,
          ),
        ]);
        await pumpApp(tester, api, signedIn: true);
        await _tapText(tester, 'My bookings');
        expect(find.byKey(const Key('booking-b-1')), findsOneWidget);
        expect(find.byKey(const Key('booking-b-2')), findsNothing);
        expect(find.textContaining('Mon, 7 Jan · 10:00 AM'), findsOneWidget);
        await _tapText(tester, 'Past');
        expect(find.byKey(const Key('booking-b-2')), findsOneWidget);
      },
    );

    testWidgets('M-02 an empty list says so; a failing list can be retried', (
      tester,
    ) async {
      var fail = true;
      final api = FakeApi({
        'GET /v1/bookings':
            (_) =>
                fail
                    ? StubResponse(503, problemJson(503, 'RETRY_LATER'))
                    : const StubResponse(200, <Object>[]),
        'GET /v1/drawers': const StubResponse(200, <Object>[]),
      });
      await pumpApp(tester, api, signedIn: true);
      await _tapText(tester, 'My bookings');
      expect(find.text('Try again'), findsOneWidget);
      fail = false;
      await _tapText(tester, 'Try again');
      expect(find.text('No upcoming bookings'), findsOneWidget);
    });

    testWidgets('M-03 an unpaid hold in the list continues to payment', (
      tester,
    ) async {
      final api = listApi(
        [bookingJson()],
        {'GET /v1/bookings/b-1': StubResponse(200, bookingJson())},
      );
      await pumpApp(tester, api, signedIn: true);
      await _tapText(tester, 'My bookings');
      await tester.tap(find.byKey(const Key('booking-b-1')));
      await tester.pumpAndSettle();
      expect(find.text('Complete your booking'), findsOneWidget);
    });

    testWidgets(
      'M-04 cancelling asks first, then shows the cancelled booking and the refund',
      (tester) async {
        var cancelled = false;
        final api = listApi(
          [
            bookingJson(
              status: 'confirmed',
              holdExpiresAt: null,
              payment: paidJson(),
            ),
          ],
          {
            'GET /v1/bookings/b-1':
                (_) => StubResponse(
                  200,
                  cancelled
                      ? bookingJson(
                        status: 'cancelled',
                        cancellable: false,
                        holdExpiresAt: null,
                        payment: {...paidJson(), 'status': 'refunded'},
                        refund: {'amountPaise': 29800, 'status': 'processed'},
                      )
                      : bookingJson(
                        status: 'confirmed',
                        holdExpiresAt: null,
                        payment: paidJson(),
                      ),
                ),
            'POST /v1/bookings/b-1/cancel': (_) {
              cancelled = true;
              return StubResponse(
                200,
                bookingJson(status: 'cancelled', cancellable: false),
              );
            },
          },
        );
        await pumpApp(tester, api, signedIn: true);
        await _tapText(tester, 'My bookings');
        await tester.tap(find.byKey(const Key('booking-b-1')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('cancel-booking')));
        await tester.pumpAndSettle();
        expect(find.text('Cancel this booking?'), findsOneWidget);
        expect(
          api.to('POST', '/v1/bookings/b-1/cancel'),
          isEmpty,
        ); // nothing yet

        await tester.tap(find.byKey(const Key('keep-booking')));
        await tester.pumpAndSettle();
        expect(api.to('POST', '/v1/bookings/b-1/cancel'), isEmpty);

        await tester.tap(find.byKey(const Key('cancel-booking')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('confirm-cancel')));
        await tester.pumpAndSettle();
        expect(api.to('POST', '/v1/bookings/b-1/cancel'), hasLength(1));
        expect(find.byKey(const Key('status-cancelled')), findsOneWidget);
        expect(find.text('₹298 (Processed)'), findsOneWidget);
        expect(find.byKey(const Key('cancel-booking')), findsNothing);
      },
    );

    testWidgets(
      'M-05 a rental that has started cannot be cancelled: the server says so and it is explained',
      (tester) async {
        final api = listApi(
          [
            bookingJson(
              status: 'confirmed',
              holdExpiresAt: null,
              payment: paidJson(),
            ),
          ],
          {
            'GET /v1/bookings/b-1': StubResponse(
              200,
              bookingJson(
                status: 'confirmed',
                holdExpiresAt: null,
                payment: paidJson(),
              ),
            ),
            'POST /v1/bookings/b-1/cancel': StubResponse(
              409,
              problemJson(409, 'INVALID_STATE'),
            ),
          },
        );
        await pumpApp(tester, api, signedIn: true);
        await _tapText(tester, 'My bookings');
        await tester.tap(find.byKey(const Key('booking-b-1')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('cancel-booking')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('confirm-cancel')));
        await tester.pumpAndSettle();
        expect(
          find.text('This booking can no longer be cancelled.'),
          findsOneWidget,
        );
      },
    );
  });
}
