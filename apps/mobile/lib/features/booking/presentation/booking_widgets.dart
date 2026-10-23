import 'package:flutter/material.dart';

import '../../../core/api/models/models.dart';
import '../../../core/format/money.dart';
import '../../../core/format/time.dart';
import '../../../core/ui/product_image.dart';
import '../../../core/ui/error_text.dart';
import '../../../core/ui/kit.dart';
import '../../../l10n/generated/app_localizations.dart';

/// Colour of a booking status chip.
Color statusColor(ColorScheme scheme, String status) => switch (status) {
  'confirmed' => scheme.primary,
  'active' || 'completed' => const Color(0xFF138A4B),
  'held' => const Color(0xFFB7791F),
  'cancelled' || 'expired' => scheme.outline,
  _ => scheme.error,
};

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status, this.solid = false});

  final String status;

  /// A solid chip, for sitting on a photo.
  final bool solid;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Pill(
      key: Key('status-$status'),
      label: statusText(l10n, status),
      color: statusColor(Theme.of(context).colorScheme, status),
      filled: solid,
    );
  }
}

String paymentStateText(AppLocalizations l10n, BookingPayment? payment) =>
    switch (payment?.status) {
      'captured' => l10n.paymentCaptured,
      'created' => l10n.paymentCreated,
      'refunded' => l10n.paymentRefunded,
      _ => l10n.paymentNone,
    };

String refundStateText(AppLocalizations l10n, String status) =>
    switch (status) {
      'processed' => l10n.refundProcessed,
      'pending' => l10n.refundPending,
      'failed' => l10n.refundFailed,
      _ => status,
    };

/// What a booking is: the product's picture with its status, then when, where, which unit, the price split, payment and
/// refund. Times are in the DRAWER's zone.
class BookingSummary extends StatelessWidget {
  const BookingSummary({super.key, required this.booking});

  final Booking booking;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final zone = booking.drawer.timezone;

    Widget fact(IconData icon, Widget title, String? subtitle) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: scheme.primaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 20, color: scheme.onPrimaryContainer),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                title,
                if (subtitle != null)
                  Text(
                    subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );

    Widget money(String label, int paise, {bool strong = false}) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style:
                  strong
                      ? theme.textTheme.titleSmall
                      : theme.textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
            ),
          ),
          Text(
            formatPaise(paise),
            style:
                strong
                    ? theme.textTheme.titleMedium
                    : theme.textTheme.bodyMedium,
          ),
        ],
      ),
    );

    final paid = booking.payment?.status == 'captured';
    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 150,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ProductImage(
                  photo: booking.itemModel.photoUrl,
                  width: double.infinity,
                  height: 150,
                  radius: 0,
                ),
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        Colors.black.withValues(alpha: 0.62),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
                Positioned(
                  left: 18,
                  right: 18,
                  bottom: 14,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Text(
                          booking.itemModel.name,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                          ),
                        ),
                      ),
                      StatusChip(status: booking.status, solid: true),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 10, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                fact(
                  Icons.event_rounded,
                  Text(
                    '${formatDateTime(booking.startsAt, zone)} – ${formatTimeOfDay(booking.endsAt, zone)}',
                    key: const Key('booking-when'),
                    style: theme.textTheme.titleSmall,
                  ),
                  '${durationText(l10n, booking.durationMinutes)} · ${l10n.timesInZone(zone)}',
                ),
                fact(
                  Icons.place_rounded,
                  Text(booking.drawer.name, style: theme.textTheme.titleSmall),
                  booking.drawer.address,
                ),
                fact(
                  Icons.inventory_2_rounded,
                  Text(booking.assetCode, style: theme.textTheme.titleSmall),
                  l10n.unitLabel,
                ),
                const SizedBox(height: 6),
                Container(
                  key: const Key('booking-price'),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: scheme.surfaceContainerHigh.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      money(l10n.summaryRental, booking.pricePaise),
                      money(l10n.summaryDeposit, booking.depositPaise),
                      const Divider(height: 18),
                      money(
                        l10n.summaryTotal,
                        booking.totalPaise,
                        strong: true,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Pill(
                      label: paymentStateText(l10n, booking.payment),
                      color: paid ? const Color(0xFF138A4B) : scheme.outline,
                      icon:
                          paid
                              ? Icons.check_circle_rounded
                              : Icons.hourglass_empty_rounded,
                    ),
                    if (booking.refund != null)
                      Pill(
                        key: const Key('booking-refund'),
                        label: l10n.refundValue(
                          formatPaise(booking.refund!.amountPaise),
                          refundStateText(l10n, booking.refund!.status),
                        ),
                        color: scheme.tertiary,
                        icon: Icons.undo_rounded,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
