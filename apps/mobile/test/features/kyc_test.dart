import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

Map<String, dynamic> _kyc(String status, {String? masked, String? reason}) => {
  'required': true,
  'status': status,
  'maskedAadhaar': masked,
  'verifiedAt': status == 'verified' ? '2030-01-07T03:00:00.000Z' : null,
  'verifiedName': status == 'verified' ? 'Aadhaar Holder (demo)' : null,
  'reason': reason,
};

FakeApi _api([Map<String, Object> extra = const {}]) => FakeApi({
  'GET /v1/drawers': const StubResponse(200, <Object>[]),
  'GET /v1/me/kyc': StubResponse(200, _kyc('none')),
  ...extra,
});

Future<void> _openKyc(WidgetTester tester) async {
  await tester.tap(find.text('Account').first);
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('kyc-tile')));
  await tester.pumpAndSettle();
}

Future<void> _typeNumber(WidgetTester tester, String text) async {
  await tester.enterText(find.byKey(const Key('kyc-number')), text);
  await tester.pump();
}

void main() {
  testWidgets(
    'K-01 the account tab shows the verification state and opens the screen',
    (tester) async {
      final api = _api({
        'GET /v1/me/kyc': StubResponse(
          200,
          _kyc('verified', masked: 'XXXX XXXX 0128'),
        ),
      });
      await pumpApp(tester, api, signedIn: true);
      await tester.tap(find.text('Account').first);
      await tester.pumpAndSettle();
      expect(find.text('Identity verified'), findsOneWidget);
    },
  );

  testWidgets(
    'K-02 digits are grouped in fours, capped at 12, letters ignored; Send needs all 12',
    (tester) async {
      await pumpApp(tester, _api(), signedIn: true);
      await _openKyc(tester);
      expect(find.text('Verify your identity'), findsWidgets);
      expect(
        find.textContaining('never store the full number'),
        findsOneWidget,
      );
      final send = find.byKey(const Key('kyc-send'));
      await _typeNumber(tester, '2345 abc 6789');
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('kyc-number')))
            .controller!
            .text,
        '2345 6789',
      );
      expect(tester.widget<FilledButton>(send).onPressed, isNull);
      await _typeNumber(tester, '234567890128999');
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('kyc-number')))
            .controller!
            .text,
        '2345 6789 0128',
      );
      expect(tester.widget<FilledButton>(send).onPressed, isNotNull);
    },
  );

  testWidgets(
    'K-03 number → code → verified; the number is sent once and the field is emptied',
    (tester) async {
      final api = _api({
        'POST /v1/me/kyc/aadhaar': StubResponse(200, {
          'requestId': 'r-1',
          'expiresAt': '2030-01-07T03:10:00.000Z',
          'maskedAadhaar': 'XXXX XXXX 0128',
        }),
        'POST /v1/me/kyc/aadhaar/verify': StubResponse(
          200,
          _kyc('verified', masked: 'XXXX XXXX 0128'),
        ),
      });
      await pumpApp(tester, api, signedIn: true);
      await _openKyc(tester);
      await _typeNumber(tester, '234567890128');
      await tester.tap(find.byKey(const Key('kyc-send')));
      await tester.pumpAndSettle();
      expect(api.to('POST', '/v1/me/kyc/aadhaar').single.data, {
        'aadhaarNumber': '2345 6789 0128',
      });
      expect(
        find.text('We sent a code to the phone linked to XXXX XXXX 0128.'),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('kyc-number')),
        findsNothing,
      ); // the number is gone from the screen

      await tester.enterText(find.byKey(const Key('kyc-code')), '123456');
      await tester.pump();
      await tester.tap(find.byKey(const Key('kyc-verify')));
      await tester.pumpAndSettle();
      expect(api.to('POST', '/v1/me/kyc/aadhaar/verify').single.data, {
        'requestId': 'r-1',
        'otp': '123456',
      });
      expect(find.byKey(const Key('kyc-verified')), findsOneWidget);
      expect(
        find.text('Aadhaar XXXX XXXX 0128 is verified. You can now book.'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'K-04 a wrong code shows how many attempts are left and stays on the code step',
    (tester) async {
      final api = _api({
        'POST /v1/me/kyc/aadhaar': StubResponse(200, {
          'requestId': 'r-1',
          'expiresAt': '2030-01-07T03:10:00.000Z',
          'maskedAadhaar': 'XXXX XXXX 0128',
        }),
        'POST /v1/me/kyc/aadhaar/verify': StubResponse(
          422,
          problemJson(
            422,
            'VALIDATION_FAILED',
            errors: [
              {
                'field': 'otp',
                'message': 'that code is not correct (4 attempts left)',
              },
            ],
          ),
        ),
      });
      await pumpApp(tester, api, signedIn: true);
      await _openKyc(tester);
      await _typeNumber(tester, '234567890128');
      await tester.tap(find.byKey(const Key('kyc-send')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('kyc-code')), '000000');
      await tester.pump();
      await tester.tap(find.byKey(const Key('kyc-verify')));
      await tester.pumpAndSettle();
      expect(
        find.text('that code is not correct (4 attempts left)'),
        findsOneWidget,
      );
      expect(find.byKey(const Key('kyc-verified')), findsNothing);
      await tester.tap(find.byKey(const Key('kyc-change')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('kyc-number')), findsOneWidget);
    },
  );

  testWidgets(
    'K-05 each refusal at the number step is explained in plain words',
    (tester) async {
      final answers = [
        StubResponse(
          422,
          problemJson(
            422,
            'VALIDATION_FAILED',
            errors: [
              {'field': 'aadhaarNumber', 'message': 'bad'},
            ],
          ),
        ),
        StubResponse(409, problemJson(409, 'AADHAAR_IN_USE')),
        StubResponse(429, problemJson(429, 'RATE_LIMITED')),
        StubResponse(409, problemJson(409, 'INVALID_STATE')),
      ];
      var i = 0;
      final api = _api({'POST /v1/me/kyc/aadhaar': (_) => answers[i++]});
      await pumpApp(tester, api, signedIn: true);
      await _openKyc(tester);
      final expected = [
        'That is not a valid Aadhaar number. Check the 12 digits.',
        'This Aadhaar is already verified on another account.',
        'Too many attempts. Please try again later.',
        'Your verification was declined. Please contact support.',
      ];
      for (final text in expected) {
        await _typeNumber(tester, '234567890128');
        await tester.tap(find.byKey(const Key('kyc-send')));
        await tester.pumpAndSettle();
        expect(find.text(text), findsOneWidget);
      }
    },
  );

  testWidgets(
    'K-06 reserving without verification explains why and offers "Verify now"',
    (tester) async {
      final api = FakeApi({
        'GET /v1/drawers': StubResponse(200, [drawerJson()]),
        'GET /v1/drawers/d-1/inventory': StubResponse(200, [inventoryJson()]),
        'GET /v1/drawers/d-1/items/m-1/availability': StubResponse(
          200,
          availabilityJson(),
        ),
        'POST /v1/drawers/nearby': StubResponse(200, {
          'drawers': [nearbyDrawerJson()],
          'unavailable': <Object>[],
        }),
        'POST /v1/bookings': StubResponse(
          403,
          problemJson(403, 'KYC_REQUIRED'),
        ),
        'GET /v1/me/kyc': StubResponse(200, _kyc('none')),
      });
      await pumpApp(tester, api, signedIn: true);
      await tester.tap(find.byKey(const Key('choose-location')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('demo-Bengaluru · Indiranagar')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Indiranagar').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('PlayStation 5').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('10:00 AM'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('duration-60')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('reserve')));
      await tester.tap(find.byKey(const Key('reserve')));
      await tester.pumpAndSettle();

      expect(
        find.text(
          'Verify your identity with your Aadhaar card before booking.',
        ),
        findsOneWidget,
      );
      await tester.ensureVisible(find.byKey(const Key('verify-now')));
      await tester.tap(find.byKey(const Key('verify-now')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('kyc-number')), findsOneWidget);
    },
  );
}
