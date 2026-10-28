import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/app/providers.dart';
import 'package:rento_mobile/app/theme.dart';
import 'package:rento_mobile/core/ui/product_tile.dart';
import 'package:rento_mobile/core/ui/responsive.dart';
import 'package:rento_mobile/l10n/generated/app_localizations.dart';

import '../support/harness.dart';

Widget _host(Widget child, {double width = 360, double textScale = 1.0}) =>
    ProviderScope(
      overrides: [envProvider.overrideWithValue(devEnv)],
      child: MaterialApp(
        theme: AppTheme.light(),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: MediaQuery(
          data: MediaQueryData(
            size: Size(width, 900),
            textScaler: TextScaler.linear(textScale),
          ),
          child: Scaffold(body: SingleChildScrollView(child: child)),
        ),
      ),
    );

ProductTile _tile({
  String name = 'PlayStation 5',
  int price = 4900,
  int list = 4900,
  int? discount,
  bool isNew = false,
  bool available = false,
  String? place,
  VoidCallback? onTap,
}) => ProductTile(
  name: name,
  photo: null,
  pricePaise: price,
  listPricePaise: list,
  slotMinutes: 30,
  discountPercent: discount,
  isNew: isNew,
  available: available,
  place: place,
  onTap: onTap ?? () {},
);

void main() {
  group('the product card', () {
    testWidgets(
      'PT-01 a plain product shows its name and price and nothing that is not true',
      (tester) async {
        await tester.pumpWidget(_host(SizedBox(width: 170, child: _tile())));
        expect(find.text('PlayStation 5'), findsOneWidget);
        expect(find.text('₹49'), findsOneWidget);
        expect(find.text('per 30 min'), findsOneWidget);
        expect(find.byKey(const Key('discount-badge')), findsNothing);
        expect(find.byKey(const Key('tile-list-price')), findsNothing);
        expect(find.byKey(const Key('new-badge')), findsNothing);
        expect(find.byKey(const Key('available-label')), findsNothing);
      },
    );

    testWidgets(
      'PT-02 an offer shows the price to pay, the normal price struck out and the percent off',
      (tester) async {
        await tester.pumpWidget(
          _host(
            SizedBox(
              width: 170,
              child: _tile(price: 3920, list: 4900, discount: 20),
            ),
          ),
        );
        expect(find.text('₹39.20'), findsOneWidget);
        final was = tester.widget<Text>(
          find.byKey(const Key('tile-list-price')),
        );
        expect(was.data, '₹49');
        expect(was.style?.decoration, TextDecoration.lineThrough);
        expect(find.text('-20%'), findsOneWidget);
      },
    );

    testWidgets(
      'PT-03 a percent with no real saving (same price) is not shown as an offer',
      (tester) async {
        await tester.pumpWidget(
          _host(
            SizedBox(
              width: 170,
              child: _tile(price: 4900, list: 4900, discount: 20),
            ),
          ),
        );
        expect(find.byKey(const Key('discount-badge')), findsNothing);
        expect(find.byKey(const Key('tile-list-price')), findsNothing);
      },
    );

    testWidgets(
      'PT-04 new and available are shown when told, and the drawer name when given',
      (tester) async {
        await tester.pumpWidget(
          _host(
            SizedBox(
              width: 170,
              child: _tile(
                isNew: true,
                available: true,
                place: 'Indiranagar Hub',
              ),
            ),
          ),
        );
        expect(find.text('NEW'), findsOneWidget);
        expect(find.text('Available'), findsOneWidget);
        expect(find.text('at Indiranagar Hub'), findsOneWidget);
      },
    );

    testWidgets(
      'PT-05 a screen reader hears one sentence: name, price, offer, was-price, new, available, place',
      (tester) async {
        final handle = tester.ensureSemantics();
        await tester.pumpWidget(
          _host(
            SizedBox(
              width: 170,
              child: _tile(
                price: 3920,
                list: 4900,
                discount: 20,
                isNew: true,
                available: true,
                place: 'Indiranagar Hub',
              ),
            ),
          ),
        );
        expect(
          find.bySemanticsLabel(
            'PlayStation 5, ₹39.20 per 30 min, 20%, was ₹49, NEW, Available, at Indiranagar Hub',
          ),
          findsOneWidget,
        );
        handle.dispose();
      },
    );

    testWidgets('PT-06 tapping the card calls back', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        _host(SizedBox(width: 170, child: _tile(onTap: () => taps++))),
      );
      await tester.tap(find.byType(ProductTile));
      expect(taps, 1);
    });

    testWidgets(
      'PT-07 a very long name is cut at two lines and nothing overflows, even with large text',
      (tester) async {
        await tester.pumpWidget(
          _host(
            SizedBox(
              width: 150,
              child: _tile(
                name:
                    'An extremely long product name that goes on and on and on and on',
                price: 3920,
                list: 4900,
                discount: 20,
                isNew: true,
                available: true,
                place: 'A drawer with a rather long name indeed',
              ),
            ),
            textScale: 1.6,
          ),
        );
        expect(tester.takeException(), isNull);
      },
    );
  });

  group('two cards in a row', () {
    test('PG-01 two columns on every phone, more as the window grows', () {
      for (final w in <double>[280, 320, 360, 411, 430, 599]) {
        expect(productColumns(w), 2, reason: '$w');
      }
      expect(productColumns(600), 3);
      expect(productColumns(899), 3);
      expect(productColumns(900), 4);
      expect(productColumns(1199), 4);
      expect(productColumns(1200), 5);
      expect(productColumns(2560), 5);
    });

    for (final (width, columns) in [
      (320.0, 2),
      (360.0, 2),
      (430.0, 2),
      (700.0, 3),
      (1000.0, 4),
      (1400.0, 5),
    ]) {
      testWidgets(
        'PG-02 at $width px: $columns equal cards per row, in rows, with no overflow',
        (tester) async {
          tester.view.physicalSize = Size(width, 1600);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.reset);
          await tester.pumpWidget(
            _host(
              Padding(
                padding: const EdgeInsets.all(16),
                child: ProductGrid(
                  children: [
                    for (var i = 0; i < columns * 2 + 1; i++)
                      _tile(name: 'Item $i'),
                  ],
                ),
              ),
              width: width,
            ),
          );
          final tops = <double>{};
          final widths = <double>{};
          for (var i = 0; i < columns * 2 + 1; i++) {
            final box = find.widgetWithText(ProductTile, 'Item $i');
            tops.add(tester.getTopLeft(box).dy.roundToDouble());
            widths.add(tester.getSize(box).width.roundToDouble());
          }
          expect(
            tops.length,
            3,
            reason: 'two full rows and one card on a third',
          );
          expect(widths.length, 1, reason: 'every card is the same width');
          final firstRow = [
            for (var i = 0; i < columns; i++)
              tester.getTopLeft(find.widgetWithText(ProductTile, 'Item $i')).dx,
          ];
          expect(
            firstRow.toSet().length,
            columns,
            reason: 'side by side, not stacked',
          );
          expect(tester.takeException(), isNull);
        },
      );
    }
  });
}
