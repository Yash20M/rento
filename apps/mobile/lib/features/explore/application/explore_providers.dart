import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/models.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/location/location_service.dart';
import '../../../core/location/saved_place.dart';

/// A place the customer chose to search around. [name] is null for "my location".
class LocationChoice {
  const LocationChoice({required this.point, this.name});

  final GeoPoint point;
  final String? name;
}

/// Where the customer is searching. The exact point is held in memory for this run only; a copy rounded to ~1 km (and
/// the name of a named place) is kept on the phone so the app reopens there (ADR-016, README §10.6). Signing out
/// forgets both.
class LocationChoiceNotifier extends Notifier<LocationChoice?> {
  @override
  LocationChoice? build() {
    ref.listen(authControllerProvider, (_, next) {
      if (next is SignedOut) state = null;
    });
    unawaited(_restore());
    return null;
  }

  Future<void> _restore() async {
    final raw = await ref.read(secureStoreProvider).read(SavedPlace.storageKey);
    final saved = SavedPlace.decode(raw);
    // A place chosen while the saved one was loading wins.
    if (saved != null && state == null) {
      state = LocationChoice(point: saved.point, name: saved.name);
    }
  }

  void choose(LocationChoice choice) {
    state = choice;
    unawaited(
      ref
          .read(secureStoreProvider)
          .write(
            SavedPlace.storageKey,
            SavedPlace.encode(choice.point, name: choice.name),
          ),
    );
  }
}

final locationChoiceProvider =
    NotifierProvider<LocationChoiceNotifier, LocationChoice?>(
      LocationChoiceNotifier.new,
    );

/// Whether the app finds the phone's position by itself when nothing is remembered. Tests switch it off.
final autoLocateEnabledProvider = Provider<bool>((_) => true);

/// Finds where the customer is, once per signed-in session, when no place is remembered: the nearest drawers then
/// appear without a question. If the position cannot be had (permission, services off) nothing is chosen and the app
/// shows every drawer instead.
final autoLocateProvider = FutureProvider<void>((ref) async {
  if (!ref.watch(autoLocateEnabledProvider)) return;
  if (ref.watch(authControllerProvider) is! SignedIn) return;
  final saved = SavedPlace.decode(
    await ref.read(secureStoreProvider).read(SavedPlace.storageKey),
  );
  if (saved != null || ref.read(locationChoiceProvider) != null) return;
  try {
    final point = await ref.read(locationServiceProvider).current();
    if (ref.read(locationChoiceProvider) == null) {
      ref
          .read(locationChoiceProvider.notifier)
          .choose(LocationChoice(point: point));
    }
  } catch (_) {
    // No position: the explore screen falls back to showing every drawer.
  }
});

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

/// The answer to "does Rento serve where this person is?" for one drawer.
enum AreaCheck {
  /// The drawer is within reach of the customer.
  ok,

  /// Nothing, or not this drawer, serves the customer's position.
  outside,

  /// The position could not be found (location off or refused), so it cannot be said.
  locationNeeded,
}

/// Checked when the customer tries to order, not while they browse: finds the position if it is not known yet, asks the
/// server which drawers serve it and says whether [drawerId] is one of them. A failure of the check itself (network,
/// server) does not block the order: the booking rules on the server still apply.
Future<AreaCheck> checkServiceArea(WidgetRef ref, String drawerId) async {
  var choice = ref.read(locationChoiceProvider);
  if (choice == null) {
    try {
      final point = await ref.read(locationServiceProvider).current();
      choice = LocationChoice(point: point);
      ref.read(locationChoiceProvider.notifier).choose(choice);
    } on LocationException {
      return AreaCheck.locationNeeded;
    }
  }
  try {
    final result = await ref
        .read(catalogApiProvider)
        .nearby(
          NearbyRequest(
            latitude: choice.point.latitude,
            longitude: choice.point.longitude,
          ),
        );
    final served = [...result.drawers, ...result.unavailable];
    return served.any((d) => d.id == drawerId)
        ? AreaCheck.ok
        : AreaCheck.outside;
  } on ApiException catch (error) {
    if (error.code == ErrorCode.outsideServiceArea) return AreaCheck.outside;
    return AreaCheck.ok;
  }
}

/// The drawers that are open and in the customer's area right now (known once the nearby search has answered; empty
/// before that, and when the position is unknown or nothing serves it). Closed or sold-out drawers in the area are not
/// in it: nothing can be rented from them at the moment.
final servedDrawerIdsProvider = Provider.autoDispose<Set<String>>((ref) {
  final result = ref.watch(nearbyProvider).value;
  if (result == null) return const {};
  return {for (final d in result.drawers) d.id};
});
