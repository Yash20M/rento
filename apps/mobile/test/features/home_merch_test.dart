import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/features/explore/application/explore_providers.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

/// M29 — the home screen is built from what the server says: banners, offers, new arrivals, featured products, then
/// every product two to a row. Nothing here is fixed in the app.
FakeApi _api({
  List<Map<String, dynamic>>? stock,
  List<Map<String, dynamic>> banners = const [],
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
  'GET /v1/promotions': StubResponse(200, banners),
  'GET /v1/bookings': const StubResponse(200, <Object>[]),
  ...extra,
});

Map<String, dynamic> _item(
  String id, {
  int? discount,
  bool isNew = false,
  bool featured = false,
}) => inventoryJson(
  id: id,
  name: 'Item $id',
  pricePaise: discount == null ? 4900 : 4900 - (4900 * discount ~/ 100),
  listPaise: 4900,
  discountPercent: discount,
  isNew: isNew,
  featured: featured,
);

Finder _tile(String id, [String prefix = 'product']) =>
    find.byKey(Key('$prefix-d-1-$id'));
double _top(WidgetTester t, Finder f) => t.getTopLeft(f).dy;
double _left(WidgetTester t, Finder f) => t.getTopLeft(f).dx;

void main() {
  group('the product grid', () {
    for (final width in [360.0, 430.0]) {
      testWidgets(
        'HM-01 two cards in a row at $width px, the third starts the next row',
        (tester) async {
          await pumpApp(
            tester,
            _api(
              stock: [
                for (final i in ['a', 'b', 'c', 'd', 'e']) _item(i),
              ],
            ),
            signedIn: true,
            size: Size(width, 1800),
          );
          final a = _tile('a');
          final b = _tile('b');
          final c = _tile('c');
          expect(
            _top(tester, a),
            _top(tester, b),
            reason: 'a and b share a row',
          );
          expect(_left(tester, b), greaterThan(_left(tester, a)));
          expect(
            _top(tester, c),
            greaterThan(_top(tester, a)),
            reason: 'c is below',
          );
          expect(
            _left(tester, c),
            _left(tester, a),
            reason: 'c starts the next row',
          );
          expect(tester.getSize(a).width, tester.getSize(b).width);
          expect(tester.takeException(), isNull);
        },
      );
    }

    testWidgets('HM-02 more columns on a tablet and a desktop window', (
      tester,
    ) async {
      final items = [
        for (final i in ['a', 'b', 'c', 'd', 'e', 'f']) _item(i),
      ];
      await pumpApp(
        tester,
        _api(stock: items),
        signedIn: true,
        size: const Size(800, 1800),
      );
      // 800 px wide: the rail takes 80, the page is three columns
      expect(_top(tester, _tile('a')), _top(tester, _tile('c')));
      expect(_top(tester, _tile('d')), greaterThan(_top(tester, _tile('a'))));
    });

    testWidgets('HM-03 a product stocked at two drawers appears once', (
      tester,
    ) async {
      final api = FakeApi({
        'GET /v1/drawers': StubResponse(200, [
          drawerJson(),
          drawerJson(id: 'd-2', name: 'Second'),
        ]),
        'GET /v1/drawers/d-1/inventory': StubResponse(200, [_item('a')]),
        'GET /v1/drawers/d-2/inventory': StubResponse(200, [
          _item('a'),
          _item('b'),
        ]),
        'GET /v1/promotions': const StubResponse(200, <Object>[]),
      });
      await pumpApp(tester, api, signedIn: true, size: const Size(420, 1800));
      expect(find.byKey(const Key('product-d-1-a')), findsOneWidget);
      expect(find.byKey(const Key('product-d-2-a')), findsNothing);
      expect(find.byKey(const Key('product-d-2-b')), findsOneWidget);
    });

    testWidgets(
      'HM-04 while the first products load the grid keeps its shape; with none it says so',
      (tester) async {
        final empty = _api(stock: const []);
        await pumpApp(tester, empty, signedIn: true);
        expect(find.byKey(const Key('no-products')), findsOneWidget);
        expect(find.text('Nothing to rent here yet.'), findsOneWidget);
      },
    );
  });

  group('offers, new arrivals and featured: only what the server sends', () {
    testWidgets(
      'HM-05 with nothing special there are no extra sections, just "All products"',
      (tester) async {
        await pumpApp(
          tester,
          _api(stock: [_item('a'), _item('b')]),
          signedIn: true,
        );
        expect(find.text('Offers for you'), findsNothing);
        expect(find.text('New arrivals'), findsNothing);
        expect(find.text('Featured'), findsNothing);
        expect(find.text('All products'), findsOneWidget);
      },
    );

    testWidgets(
      'HM-06 products with an offer get a section, the biggest discount first, with the offer shown on the card',
      (tester) async {
        await pumpApp(
          tester,
          _api(
            stock: [
              _item('plain'),
              _item('small', discount: 10),
              _item('big', discount: 40),
            ],
          ),
          signedIn: true,
          size: const Size(420, 2000),
        );
        expect(find.text('Offers for you'), findsOneWidget);
        expect(_tile('plain', 'offer'), findsNothing);
        final big = _tile('big', 'offer');
        final small = _tile('small', 'offer');
        expect(
          _left(tester, big),
          lessThan(_left(tester, small)),
          reason: '40% before 10%',
        );
        expect(
          find.descendant(of: big, matching: find.text('-40%')),
          findsOneWidget,
        );
        expect(
          find.descendant(
            of: big,
            matching: find.byKey(const Key('tile-list-price')),
          ),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'HM-07 new arrivals and featured products each get their own section',
      (tester) async {
        await pumpApp(
          tester,
          _api(
            stock: [
              _item('old'),
              _item('fresh', isNew: true),
              _item('star', featured: true),
            ],
          ),
          signedIn: true,
          size: const Size(420, 2400),
        );
        expect(find.text('New arrivals'), findsOneWidget);
        expect(find.text('Featured'), findsOneWidget);
        expect(_tile('fresh', 'new'), findsOneWidget);
        expect(_tile('old', 'new'), findsNothing);
        expect(_tile('star', 'featured'), findsOneWidget);
        expect(
          find.descendant(
            of: _tile('fresh', 'new'),
            matching: find.text('NEW'),
          ),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'HM-08 top to bottom: banners, offers, new, featured, all products, drawers',
      (tester) async {
        await pumpApp(
          tester,
          _api(
            stock: [_item('x', discount: 20, isNew: true, featured: true)],
            banners: [promotionJson()],
          ),
          signedIn: true,
          size: const Size(420, 3200),
        );
        final order = [
          _top(tester, find.byKey(const Key('promo-carousel'))),
          _top(tester, find.text('Offers for you')),
          _top(tester, find.text('New arrivals')),
          _top(tester, find.text('Featured')),
          _top(tester, find.text('All products')),
          _top(tester, find.text('All drawers')),
        ];
        expect(order, [...order]..sort());
        expect(
          order.toSet().length,
          order.length,
          reason: 'six distinct places',
        );
      },
    );

    testWidgets(
      'HM-09 an offer that staff remove disappears on the next refresh',
      (tester) async {
        var withOffer = true;
        final api = _api(
          extra: {
            'GET /v1/drawers/d-1/inventory':
                (_) => StubResponse(200, [
                  _item('a', discount: withOffer ? 25 : null),
                ]),
          },
        );
        final p = await pumpApp(
          tester,
          api,
          signedIn: true,
          size: const Size(420, 2000),
        );
        expect(find.text('Offers for you'), findsOneWidget);
        withOffer = false;
        // what pulling the list down does
        p.container.invalidate(inventoryProvider('d-1'));
        await tester.pumpAndSettle();
        expect(find.text('Offers for you'), findsNothing);
        expect(find.byKey(const Key('discount-badge')), findsNothing);
      },
    );
  });
}
