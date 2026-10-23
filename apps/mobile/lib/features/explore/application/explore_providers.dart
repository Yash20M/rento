import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/models/models.dart';
import '../../../core/location/location_service.dart';

/// A place the customer chose to search around. [name] is null for "my location".
class LocationChoice {
  const LocationChoice({required this.point, this.name});

  final GeoPoint point;
  final String? name;
}

/// Where the customer is searching. Held in memory only — the precise position is never stored (README §10.6).
class LocationChoiceNotifier extends Notifier<LocationChoice?> {
  @override
  LocationChoice? build() => null;

  void choose(LocationChoice choice) => state = choice;
}

final locationChoiceProvider =
    NotifierProvider<LocationChoiceNotifier, LocationChoice?>(
      LocationChoiceNotifier.new,
    );

/// Drawers near the chosen place; `null` until a place is chosen. The request carries the coordinates for this search
/// only.
final nearbyProvider = FutureProvider.autoDispose<NearbyResponse?>((ref) async {
  final choice = ref.watch(locationChoiceProvider);
  if (choice == null) return null;
  return ref
      .watch(catalogApiProvider)
      .nearby(
        NearbyRequest(
          latitude: choice.point.latitude,
          longitude: choice.point.longitude,
        ),
      );
});

/// Every active drawer (also the lookup for a drawer's details when only its id is known).
final drawersProvider = FutureProvider.autoDispose<List<PublicDrawer>>(
  (ref) => ref.watch(catalogApiProvider).drawers(),
);

final inventoryProvider = FutureProvider.autoDispose
    .family<List<InventoryEntry>, String>(
      (ref, drawerId) => ref.watch(catalogApiProvider).inventory(drawerId),
    );

/// Demo shortcuts for non-production builds: places near the seeded demo drawers.
const List<({String name, double latitude, double longitude})> demoLocations = [
  (name: 'Bengaluru · Indiranagar', latitude: 12.9784, longitude: 77.6408),
  (name: 'Delhi · Connaught Place', latitude: 28.6315, longitude: 77.2167),
  (name: 'Pune · Koregaon Park', latitude: 18.5362, longitude: 73.8940),
  (name: 'Hyderabad · Banjara Hills', latitude: 17.4126, longitude: 78.4482),
];
