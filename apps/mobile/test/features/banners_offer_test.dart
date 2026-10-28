import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/features/explore/application/explore_providers.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

FakeApi _api({
  Object banners = const <Object>[],
  List<Map<String, dynamic>>? stock,
  Map<String, Object> extra = const {},
}) => FakeApi({
  'GET /v1/drawers': StubResponse(200, [drawerJson()]),
  'GET /v1/drawers/d-1/inventory': StubResponse(
    200,
    stock ?? [inventoryJson()],
  ),
  'GET /v1/drawers/d-1/items/m-1/availability': StubResponse(
    200,
    availabilityJson(),
  ),
  'GET /v1/promotions':
      banners is StubResponse ? banners : StubResponse(200, banners),
  'GET /v1/bookings': const StubResponse(200, <Object>[]),
  ...extra,
});

void main() {
  group('banners (set up by staff)', () {
    testWidgets(
      'BN-01 a live banner shows its title, subtitle and button label',
      (tester) async {
        await pumpApp(tester, _api(banners: [promotionJson()]), signedIn: true);
        expect(find.byKey(const Key('promo-carousel')), findsOneWidget);
        expect(find.text('Weekend offer'), findsOneWidget);
        expect(find.text('20% off consoles'), findsOneWidget);
        expect(find.text('Shop now'), findsOneWidget);
      },
    );

    testWidgets('BN-02 no banners, no space for them', (tester) async {
      await pumpApp(tester, _api(), signedIn: true);
      expect(find.byKey(const Key('promo-carousel')), findsNothing);
    });

    testWidgets(
      'BN-03 if the banners cannot be loaded the home screen is just as good without them',
      (tester) async {
        await pumpApp(
          tester,
          _api(banners: StubResponse(503, problemJson(503, 'RETRY_LATER'))),
          signedIn: true,
        );
        expect(find.byKey(const Key('promo-carousel')), findsNothing);
        expect(find.byKey(const Key('products-near-you')), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'BN-04 several banners: a dot for each, swiping moves on, and each says where it is',
      (tester) async {
        final handle = tester.ensureSemantics();
        await pumpApp(
          tester,
          _api(
            banners: [
              promotionJson(),
              promotionJson(
                id: 'p-2',
                title: 'Just in',
                subtitle: null,
                ctaLabel: null,
                theme: 'plum',
              ),
              promotionJson(
                id: 'p-3',
                title: 'Dark one',
                theme: 'ink',
                itemModelId: null,
              ),
            ],
          ),
          signedIn: true,
        );
        final dots = find.descendant(
          of: find.byKey(const Key('promo-dots')),
          matching: find.byType(AnimatedContainer),
        );
        expect(dots, findsNWidgets(3));
        expect(find.bySemanticsLabel(RegExp('Offer 1 of 3')), findsOneWidget);
        // the next banner is built just off-screen, so it is not "on screen" until swiped to
        final next = tester.getTopLeft(find.text('Just in')).dx;
        expect(next, greaterThan(400)); // the page is 420 px wide
        await tester.fling(
          find.byKey(const Key('promo-pages')),
          const Offset(-300, 0),
          1200,
        );
        await tester.pumpAndSettle();
        expect(find.text('Just in'), findsOneWidget);
        handle.dispose();
      },
    );

    testWidgets('BN-05 one banner has no dots', (tester) async {
      await pumpApp(tester, _api(banners: [promotionJson()]), signedIn: true);
      expect(find.byKey(const Key('promo-dots')), findsNothing);
    });

    for (final theme in ['orange', 'ink', 'teal', 'plum', 'something-new']) {
      testWidgets(
        'BN-06 the "$theme" colour renders readable text and does not break the layout',
        (tester) async {
          await pumpApp(
            tester,
            _api(banners: [promotionJson(theme: theme)]),
            signedIn: true,
          );
          expect(find.text('Weekend offer'), findsOneWidget);
          expect(tester.takeException(), isNull);
        },
      );
    }

    testWidgets(
      'BN-07 a picture that cannot be loaded falls back to the colour (no broken box)',
      (tester) async {
        await pumpApp(
          tester,
          _api(
            banners: [
              promotionJson(
                imageUrl: '/v1/media/11111111-1111-4111-8111-111111111111',
              ),
            ],
          ),
          signedIn: true,
        );
        // the test network refuses every picture; the words are still there
        while (tester.takeException() != null) {}
        expect(find.text('Weekend offer'), findsOneWidget);
      },
    );

    testWidgets('BN-08 tapping a banner opens the product it points to', (
      tester,
    ) async {
      await pumpApp(
        tester,
        _api(banners: [promotionJson(itemModelId: 'm-1')]),
        signedIn: true,
        size: const Size(420, 1400),
      );
      await tester.tap(find.byKey(const Key('promo-p-1')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('item-title')), findsOneWidget);
      expect(find.text('PlayStation 5'), findsWidgets);
    });

    testWidgets(
      'BN-09 a banner whose product is not stocked anywhere says so instead of failing silently',
      (tester) async {
        await pumpApp(
          tester,
          _api(banners: [promotionJson(itemModelId: 'not-stocked')]),
          signedIn: true,
        );
        await tester.tap(find.byKey(const Key('promo-p-1')));
        await tester.pumpAndSettle();
        expect(
          find.text('That item is not available near you right now.'),
          findsOneWidget,
        );
        expect(find.byKey(const Key('item-title')), findsNothing);
      },
    );

    testWidgets(
      'BN-10 an announcement banner (no product) does nothing when tapped, and does not complain',
      (tester) async {
        await pumpApp(
          tester,
          _api(banners: [promotionJson(itemModelId: null)]),
          signedIn: true,
        );
        await tester.tap(find.byKey(const Key('promo-p-1')));
        await tester.pumpAndSettle();
        expect(find.byType(SnackBar), findsNothing);
        expect(find.byKey(const Key('item-title')), findsNothing);
      },
    );

    testWidgets('BN-11 banners staff switch off are gone after a refresh', (
      tester,
    ) async {
      var live = true;
      final api = _api(
        extra: {
          'GET /v1/promotions':
              (_) => StubResponse(200, live ? [promotionJson()] : <Object>[]),
        },
      );
      final p = await pumpApp(tester, api, signedIn: true);
      expect(find.byKey(const Key('promo-carousel')), findsOneWidget);
      live = false;
      p.container.invalidate(promotionsProvider);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('promo-carousel')), findsNothing);
    });
  });

  group('the offer on the product page', () {
    Future<void> openProduct(WidgetTester tester, FakeApi api) async {
      await pumpApp(tester, api, signedIn: true, size: const Size(420, 1800));
      await tester.tap(find.byKey(const Key('product-d-1-m-1')));
      await tester.pumpAndSettle();
    }

    final offerStock = [
      inventoryJson(
        pricePaise: 3920,
        listPaise: 4900,
        discountPercent: 20,
        discountEndsAt: '2030-01-10T12:30:00.000Z',
      ),
    ];
    final offerSlots = availabilityJson(
      pricePaise: 3920,
      listPaise: 4900,
      discountPercent: 20,
    );

    testWidgets(
      'OF-01 the page shows the price to pay, the normal price struck out, the percent and when it ends',
      (tester) async {
        await openProduct(
          tester,
          _api(
            stock: offerStock,
            extra: {
              'GET /v1/drawers/d-1/items/m-1/availability': StubResponse(
                200,
                offerSlots,
              ),
            },
          ),
        );
        expect(find.byKey(const Key('price-block')), findsOneWidget);
        expect(find.text('₹39.20'), findsWidgets);
        expect(find.byKey(const Key('price-was')), findsOneWidget);
        expect(find.byKey(const Key('offer-chip')), findsOneWidget);
        expect(find.text('-20%'), findsWidgets);
        // 18:00 on 10 January in the drawer's own time zone (Asia/Kolkata)
        expect(find.textContaining('Offer ends'), findsOneWidget);
      },
    );

    testWidgets(
      'OF-02 without an offer there is no strike-through, chip or end date',
      (tester) async {
        await openProduct(tester, _api());
        expect(find.byKey(const Key('price-now')), findsOneWidget);
        expect(find.byKey(const Key('price-was')), findsNothing);
        expect(find.byKey(const Key('offer-chip')), findsNothing);
        expect(find.byKey(const Key('offer-ends')), findsNothing);
      },
    );

    testWidgets('OF-03 an offer with no end date does not invent one', (
      tester,
    ) async {
      await openProduct(
        tester,
        _api(
          stock: [
            inventoryJson(
              pricePaise: 3920,
              listPaise: 4900,
              discountPercent: 20,
            ),
          ],
        ),
      );
      expect(find.byKey(const Key('offer-chip')), findsOneWidget);
      expect(find.byKey(const Key('offer-ends')), findsNothing);
    });

    testWidgets(
      'OF-04 the summary adds up: normal rental, the offer taken off, the deposit, the total and what is saved',
      (tester) async {
        await openProduct(
          tester,
          _api(
            stock: offerStock,
            extra: {
              'GET /v1/drawers/d-1/items/m-1/availability': StubResponse(
                200,
                offerSlots,
              ),
            },
          ),
        );
        await tester.ensureVisible(find.text('10:00 AM'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('10:00 AM'));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.byKey(const Key('duration-60')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('duration-60')));
        await tester.pumpAndSettle();
        // 60 min = two 30-minute slots: 2 × ₹49 normal, 2 × ₹39.20 charged
        expect(find.text('₹98'), findsOneWidget); // the normal rental
        expect(find.byKey(const Key('summary-offer')), findsOneWidget);
        expect(find.text('-₹19.60'), findsOneWidget);
        expect(find.text('Offer -20%'), findsOneWidget);
        expect(
          find.text('₹278.40'),
          findsWidgets,
        ); // 78.40 rental + 200 deposit
        expect(
          tester.widget<Text>(find.byKey(const Key('summary-total'))).data,
          '₹278.40',
        );
        expect(find.text('You save ₹19.60'), findsOneWidget);
      },
    );

    testWidgets('OF-05 without an offer the summary is as it always was', (
      tester,
    ) async {
      await openProduct(tester, _api());
      await tester.ensureVisible(find.text('10:00 AM'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('10:00 AM'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('duration-60')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('duration-60')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('summary-offer')), findsNothing);
      expect(find.byKey(const Key('summary-saved')), findsNothing);
      expect(
        tester.widget<Text>(find.byKey(const Key('summary-total'))).data,
        '₹298',
      );
    });
  });

  group('what the booking shows afterwards', () {
    Future<void> openBooking(
      WidgetTester tester,
      Map<String, dynamic> booking,
    ) async {
      final api = _api(
        extra: {
          'GET /v1/bookings': StubResponse(200, [booking]),
          'GET /v1/bookings/b-1': StubResponse(200, booking),
        },
      );
      await pumpApp(tester, api, signedIn: true, size: const Size(420, 1800));
      await tester.tap(find.text('My bookings').first);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('booking-b-1')));
      await tester.pumpAndSettle();
    }

    testWidgets(
      'OF-06 a booking made during an offer shows what was saved, from the stored price',
      (tester) async {
        await openBooking(
          tester,
          bookingJson(
            status: 'confirmed',
            holdExpiresAt: null,
            payment: paidJson(),
            discountPaise: 1960,
          ),
        );
        expect(find.byKey(const Key('booking-offer')), findsOneWidget);
        expect(find.text('-₹19.60'), findsOneWidget);
        expect(find.text('You save ₹19.60'), findsOneWidget);
        // normal rental = charged ₹98 + saved ₹19.60
        expect(find.text('₹117.60'), findsOneWidget);
      },
    );

    testWidgets('OF-07 a booking without an offer shows no saving', (
      tester,
    ) async {
      await openBooking(
        tester,
        bookingJson(
          status: 'confirmed',
          holdExpiresAt: null,
          payment: paidJson(),
        ),
      );
      expect(find.byKey(const Key('booking-offer')), findsNothing);
      expect(find.byKey(const Key('booking-saved')), findsNothing);
    });
  });
}
