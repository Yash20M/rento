import '../../../core/api/models/models.dart';

/// One product as the home screen lists it: the product, where it is picked up and (when known) how far that is.
class Listing {
  const Listing({
    required this.drawerId,
    required this.drawerName,
    required this.item,
    this.distanceMeters,
  });

  final String drawerId;
  final String drawerName;
  final InventoryEntry item;
  final int? distanceMeters;
}

/// What the home screen shows, worked out from the listings only (no widgets, no clock): everything is decided by what
/// the server sent, so staff control it all.
class HomeSections {
  const HomeSections({
    required this.offers,
    required this.newArrivals,
    required this.featured,
    required this.all,
  });

  /// Products with an active offer, the biggest discount first.
  final List<Listing> offers;

  /// Products added in the last two weeks, the newest first.
  final List<Listing> newArrivals;

  /// Products staff marked as featured.
  final List<Listing> featured;

  /// Every product once, in the order given (nearest drawer first).
  final List<Listing> all;

  bool get isEmpty => all.isEmpty;
}

/// A product stocked at several drawers is listed once, at the first drawer given (the nearest, when the input is
/// ordered nearest first).
HomeSections buildHomeSections(List<Listing> listings) {
  final seen = <String>{};
  final unique = <Listing>[
    for (final l in listings)
      if (seen.add(l.item.itemModelId)) l,
  ];
  final offers =
      unique.where((l) => l.item.discountPercent != null).toList()..sort(
        (a, b) => (b.item.discountPercent ?? 0).compareTo(
          a.item.discountPercent ?? 0,
        ),
      );
  final fresh =
      unique.where((l) => l.item.isNew).toList()
        ..sort((a, b) => b.item.createdAt.compareTo(a.item.createdAt));
  return HomeSections(
    offers: offers,
    newArrivals: fresh,
    featured: unique.where((l) => l.item.featured).toList(),
    all: unique,
  );
}
