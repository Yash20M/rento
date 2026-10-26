import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../app/theme.dart';
import '../../../core/api/models/models.dart';
import '../../../core/format/time.dart';
import '../../../core/ui/error_text.dart';
import '../../../l10n/generated/app_localizations.dart';

/// The next step of the rental in plain words: collect, in use, return, overdue, done. Hand-over and return are done
/// by staff at the drawer, so this explains what to do rather than offering buttons. Nothing for held, cancelled or
/// expired bookings (their own screens say what to do).
class BookingGuidance extends ConsumerWidget {
  const BookingGuidance({super.key, required this.booking});

  final Booking booking;

  static const _nearlyOver = Duration(minutes: 15);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final now = ref.watch(clockProvider)();
    final zone = booking.drawer.timezone;
    final drawer = booking.drawer.name;
    final ends = formatTimeOfDay(booking.endsAt, zone);

    String minutes(Duration d) =>
        durationText(l10n, d.inMinutes < 1 ? 1 : d.inMinutes);

    final (IconData icon, String title, String body, bool alert)? content =
        switch (booking.status) {
          'confirmed' => (
            Icons.storefront_outlined,
            l10n.guidanceConfirmedTitle,
            now.isBefore(booking.startsAt)
                ? l10n.guidanceConfirmedBefore(
                  minutes(booking.startsAt.difference(now)),
                  drawer,
                )
                : l10n.guidanceConfirmedNow(drawer),
            false,
          ),
          'active' => (
            Icons.timelapse,
            l10n.guidanceActiveTitle,
            booking.endsAt.difference(now) <= _nearlyOver
                ? l10n.guidanceActiveSoon(drawer, ends)
                : l10n.guidanceActiveBody(
                  drawer,
                  ends,
                  minutes(booking.endsAt.difference(now)),
                ),
            false,
          ),
          'overdue' => (
            Icons.error_outline,
            l10n.guidanceOverdueTitle,
            l10n.guidanceOverdueBody(ends, drawer),
            true,
          ),
          'completed' => (
            Icons.check_circle_outline,
            l10n.guidanceCompletedTitle,
            l10n.guidanceCompletedBody,
            false,
          ),
          'no_show' => (
            Icons.do_not_disturb_on_outlined,
            l10n.guidanceNoShowTitle,
            l10n.guidanceNoShowBody,
            false,
          ),
          _ => null,
        };
    if (content == null) return const SizedBox.shrink();

    final (icon, title, body, alert) = content;
    final scheme = Theme.of(context).colorScheme;
    final color =
        alert ? scheme.error : AppTheme.brandText(Theme.of(context).brightness);
    return Card(
      key: Key('guidance-${booking.status}'),
      color: alert ? scheme.errorContainer : scheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(
                      context,
                    ).textTheme.titleMedium?.copyWith(color: color),
                  ),
                  const SizedBox(height: 4),
                  Text(body),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
