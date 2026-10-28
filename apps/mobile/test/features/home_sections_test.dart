import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/core/api/models/models.dart';
import 'package:rento_mobile/features/explore/domain/home_sections.dart';

import '../support/fixtures.dart';

Listing _l(
  String id, {
  String drawer = 'd-1',
  int? discount,
  bool isNew = false,
  bool featured = false,
  String createdAt = '2029-11-01T00:00:00.000Z',
}) => Listing(
  drawerId: drawer,
  drawerName: 'Drawer $drawer',
  item: InventoryEntry.fromJson(
    inventoryJson(
      id: id,
      name: 'Item $id',
      discountPercent: discount,
      pricePaise: discount == null ? 4900 : 4900 - (4900 * discount ~/ 100),
      listPaise: 4900,
      isNew: isNew,
      featured: featured,
      createdAt: createdAt,
    ),
  ),
);

List<String> _ids(List<Listing> l) => [for (final x in l) x.item.itemModelId];

void main() {
  group('HS home sections come only from what the server sent', () {
    test('HS-01 nothing in, nothing out: every section is empty', () {
      final s = buildHomeSections(const []);
      expect(s.isEmpty, isTrue);
      expect(s.offers, isEmpty);
      expect(s.newArrivals, isEmpty);
      expect(s.featured, isEmpty);
    });

    test('HS-02 plain products appear only in "all", in the given order', () {
      final s = buildHomeSections([_l('a'), _l('b'), _l('c')]);
      expect(_ids(s.all), ['a', 'b', 'c']);
      expect(s.offers, isEmpty);
      expect(s.newArrivals, isEmpty);
      expect(s.featured, isEmpty);
    });

    test(
      'HS-03 offers are the products with a discount, the biggest first',
      () {
        final s = buildHomeSections([
          _l('a', discount: 10),
          _l('b'),
          _l('c', discount: 40),
          _l('d', discount: 25),
        ]);
        expect(_ids(s.offers), ['c', 'd', 'a']);
        expect(_ids(s.all), ['a', 'b', 'c', 'd']);
      },
    );

    test(
      'HS-04 new arrivals are the products flagged new, the newest first',
      () {
        final s = buildHomeSections([
          _l('old-new', isNew: true, createdAt: '2030-01-01T00:00:00.000Z'),
          _l('plain'),
          _l('newest', isNew: true, createdAt: '2030-01-05T00:00:00.000Z'),
        ]);
        expect(_ids(s.newArrivals), ['newest', 'old-new']);
      },
    );

    test('HS-05 featured keeps the order given', () {
      final s = buildHomeSections([
        _l('a', featured: true),
        _l('b'),
        _l('c', featured: true),
      ]);
      expect(_ids(s.featured), ['a', 'c']);
    });

    test(
      'HS-06 a product stocked at two drawers is listed once, at the first (nearest) one',
      () {
        final s = buildHomeSections([
          _l('x', drawer: 'near', discount: 20),
          _l('y', drawer: 'near'),
          _l('x', drawer: 'far', discount: 20),
        ]);
        expect(_ids(s.all), ['x', 'y']);
        expect(s.offers.single.drawerId, 'near');
      },
    );

    test('HS-07 one product can be in several sections at once', () {
      final s = buildHomeSections([
        _l('hot', discount: 30, isNew: true, featured: true),
      ]);
      expect(_ids(s.offers), ['hot']);
      expect(_ids(s.newArrivals), ['hot']);
      expect(_ids(s.featured), ['hot']);
      expect(_ids(s.all), ['hot']);
    });
  });
}
