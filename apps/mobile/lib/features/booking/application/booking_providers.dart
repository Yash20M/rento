import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/models/models.dart';

typedef AvailabilityKey = ({String drawerId, String itemModelId, String date});

/// The slot grid of one local day. A SNAPSHOT: the booking request decides.
final availabilityProvider = FutureProvider.autoDispose
    .family<Availability, AvailabilityKey>(
      (ref, key) => ref
          .watch(catalogApiProvider)
          .availability(
            drawerId: key.drawerId,
            itemModelId: key.itemModelId,
            date: key.date,
          ),
    );

/// One booking, fresh from the server.
final bookingProvider = FutureProvider.autoDispose.family<Booking, String>(
  (ref, id) => ref.watch(bookingApiProvider).get(id),
);

/// The signed-in customer's bookings (latest 100).
final myBookingsProvider = FutureProvider.autoDispose<List<Booking>>(
  (ref) => ref.watch(bookingApiProvider).mine(),
);
