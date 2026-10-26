import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/core/ui/product_image.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

Map<String, dynamic> _item(List<String> photos) => {
  ...inventoryJson(),
  'photos': photos,
};

FakeApi _api(List<String> photos) => FakeApi({
  'GET /v1/drawers': StubResponse(200, [drawerJson()]),
  'POST /v1/drawers/nearby': StubResponse(200, {
    'drawers': [nearbyDrawerJson()],
    'unavailable': <Object>[],
  }),
  'GET /v1/drawers/d-1/inventory': StubResponse(200, [_item(photos)]),
  'GET /v1/drawers/d-1/items/m-1/availability': StubResponse(
    200,
    availabilityJson(),
  ),
  'GET /v1/bookings': const StubResponse(200, <Object>[]),
});

Future<void> _toDrawer(WidgetTester tester, FakeApi api) async {
  await pumpApp(tester, api, signedIn: true);
  await chooseDemoPlace(tester);
  await tester.ensureVisible(find.text('Indiranagar').first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('Indiranagar').first);
  await tester.pumpAndSettle();
  _drainImageErrors(tester);
}

/// The test network refuses every picture; those load errors are expected, the screens must simply keep working.
void _drainImageErrors(WidgetTester tester) {
  while (tester.takeException() != null) {}
}

List<String> _networkUrls(WidgetTester tester) =>
    tester
        .widgetList<Image>(find.byType(Image))
        .map((i) => i.image)
        .whereType<NetworkImage>()
        .map((i) => i.url)
        .toList();

void main() {
  test(
    'Q-01 an uploaded photo is a path on the API; a link stays as it is',
    () {
      expect(
        resolvePhotoUrl('https://api.rento.example', '/v1/media/abc'),
        'https://api.rento.example/v1/media/abc',
      );
      expect(
        resolvePhotoUrl(
          'https://api.rento.example',
          'https://cdn.example/a.jpg',
        ),
        'https://cdn.example/a.jpg',
      );
    },
  );

  testWidgets(
    'Q-02 the item list shows the cover photo, loaded from the API address',
    (tester) async {
      await _toDrawer(
        tester,
        _api([
          '/v1/media/11111111-1111-4111-8111-111111111111',
          'https://cdn.example/b.jpg',
        ]),
      );
      expect(find.byKey(const Key('item-photo-m-1')), findsOneWidget);
      expect(_networkUrls(tester), [
        'http://api.test/v1/media/11111111-1111-4111-8111-111111111111',
      ]);
      _drainImageErrors(tester);
    },
  );

  testWidgets('Q-03 a product without photos shows a neutral placeholder', (
    tester,
  ) async {
    await _toDrawer(tester, _api(const []));
    expect(find.byKey(const Key('item-photo-m-1')), findsOneWidget);
    expect(find.byIcon(Icons.image_outlined), findsOneWidget);
    expect(_networkUrls(tester), isEmpty);
  });

  testWidgets(
    'Q-04 the product page has a gallery with every photo; a photo that cannot load never breaks the screen',
    (tester) async {
      await _toDrawer(
        tester,
        _api([
          '/v1/media/11111111-1111-4111-8111-111111111111',
          'https://cdn.example/b.jpg',
        ]),
      );
      await tester.ensureVisible(find.text('PlayStation 5').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('PlayStation 5').first);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('item-gallery')), findsOneWidget);
      expect(
        find.text('Choose a day'),
        findsOneWidget,
      ); // the rest of the page is intact
      // The test network refuses every picture: the page still works and shows the placeholder instead.
      tester.takeException();
      expect(find.byIcon(Icons.image_outlined), findsWidgets);
    },
  );

  testWidgets(
    'Q-05 a product without photos still gets the big picture area, with a placeholder',
    (tester) async {
      await _toDrawer(tester, _api(const []));
      await tester.ensureVisible(find.text('PlayStation 5').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('PlayStation 5').first);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('item-gallery')), findsOneWidget);
      expect(find.byIcon(Icons.image_outlined), findsWidgets);
    },
  );

  testWidgets(
    'Q-06 several pictures: a counter, thumbnails that jump, one picture per thumbnail',
    (tester) async {
      await _toDrawer(
        tester,
        _api(['/v1/media/a', '/v1/media/b', 'https://cdn.example/c.jpg']),
      );
      await tester.ensureVisible(find.text('PlayStation 5').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('PlayStation 5').first);
      await tester.pumpAndSettle();
      _drainImageErrors(tester);

      expect(find.text('1 / 3'), findsOneWidget);
      expect(find.byKey(const Key('gallery-thumb-0')), findsOneWidget);
      expect(find.byKey(const Key('gallery-thumb-2')), findsOneWidget);
      expect(find.byKey(const Key('gallery-thumb-3')), findsNothing);

      await tester.tap(find.byKey(const Key('gallery-thumb-2')));
      await tester.pumpAndSettle();
      _drainImageErrors(tester);
      expect(find.text('3 / 3'), findsOneWidget);
    },
  );
}
