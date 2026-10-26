import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/models.dart';
import '../../../core/format/money.dart';
import '../../../core/format/time.dart';
import '../../../core/ui/error_text.dart';
import '../../../core/ui/kit.dart';
import '../../../core/ui/motion.dart';
import '../../../core/ui/product_image.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/booking_providers.dart';
import 'booking_widgets.dart';
import '../../../core/ui/responsive.dart';

const _finished = {'completed', 'cancelled', 'expired', 'no_show'};

/// The customer's bookings, current and future first.
class MyBookingsPage extends ConsumerWidget {
  const MyBookingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final bookings = ref.watch(myBookingsProvider);

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l10n.myBookingsTitle),
          bottom: TabBar(
            tabs: [
              Tab(text: l10n.bookingsUpcoming),
              Tab(text: l10n.bookingsPast),
            ],
          ),
        ),
        body: bookings.when(
          loading:
              () => ListView(
                padding: pagePadding(context),
                children: const [CardSkeletons(count: 3)],
              ),
          error:
              (error, _) => ErrorRetry(
                error: error,
                onRetry: () => ref.invalidate(myBookingsProvider),
              ),
          data: (all) {
            final current =
                all.where((b) => !_finished.contains(b.status)).toList()
                  ..sort((a, b) => a.startsAt.compareTo(b.startsAt));
            final past =
                all.where((b) => _finished.contains(b.status)).toList();
            return TabBarView(
              children: [
                _BookingList(bookings: current, ref: ref, upcoming: true),
                _BookingList(bookings: past, ref: ref, upcoming: false),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _BookingList extends StatelessWidget {
  const _BookingList({
    required this.bookings,
    required this.ref,
    required this.upcoming,
  });

  final List<Booking> bookings;
  final bool upcoming;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (bookings.isEmpty) {
      return EmptyView(
        icon: Icons.receipt_long_outlined,
        title: upcoming ? l10n.bookingsEmptyUpcoming : l10n.bookingsEmptyPast,
        body: upcoming ? l10n.bookingsEmptyUpcomingBody : null,
      );
    }
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(myBookingsProvider),
      child: ListView.builder(
        padding: pagePadding(context),
        itemCount: bookings.length,
        itemBuilder: (context, index) {
          final b = bookings[index];
          final scheme = Theme.of(context).colorScheme;
          final zone = b.drawer.timezone;
          return FadeSlideIn(
            index: index,
            child: Card(
              key: Key('booking-${b.id}'),
              child: InkWell(
                onTap:
                    () =>
                        b.status == 'held'
                            ? context.push('/checkout/${b.id}')
                            : context.push('/booking/${b.id}'),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ProductImage(
                        photo: b.itemModel.photoUrl,
                        width: 96,
                        height: 96,
                        radius: 18,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              b.itemModel.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              formatDateTime(b.startsAt, zone),
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                            Text(
                              '${b.drawer.name} · ${formatPaise(b.totalPaise)}',
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(color: scheme.onSurfaceVariant),
                            ),
                            const SizedBox(height: 8),
                            StatusChip(status: b.status),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
