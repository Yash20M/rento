import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/models.dart';
import '../../../core/net/connectivity.dart';
import '../../../core/ui/error_text.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/booking_providers.dart';
import 'booking_guidance.dart';
import 'booking_widgets.dart';
import 'extend_sheet.dart';

/// One booking: what it is, its state, and — while allowed — a way to cancel it.
class BookingDetailPage extends ConsumerStatefulWidget {
  const BookingDetailPage({super.key, required this.bookingId});

  final String bookingId;

  @override
  ConsumerState<BookingDetailPage> createState() => _BookingDetailPageState();
}

class _BookingDetailPageState extends ConsumerState<BookingDetailPage> {
  bool _busy = false;
  Object? _error;

  Future<void> _cancel() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: Text(l10n.cancelConfirmTitle),
            content: Text(l10n.cancelConfirmBody),
            actions: [
              TextButton(
                key: const Key('keep-booking'),
                onPressed: () => Navigator.of(context).pop(false),
                child: Text(l10n.keepBookingAction),
              ),
              FilledButton(
                key: const Key('confirm-cancel'),
                onPressed: () => Navigator.of(context).pop(true),
                child: Text(l10n.cancelBookingAction),
              ),
            ],
          ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(bookingApiProvider).cancel(widget.bookingId);
      ref.invalidate(bookingProvider(widget.bookingId));
      ref.invalidate(myBookingsProvider);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final booking = ref.watch(bookingProvider(widget.bookingId));
    final online = ref.watch(onlineProvider);

    final b = booking.value;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.bookingDetailTitle)),
      // The actions stay in view while the details scroll.
      bottomNavigationBar: b == null ? null : _bar(context, l10n, b, online),
      body: booking.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:
            (error, _) => ErrorRetry(
              error: error,
              onRetry: () => ref.invalidate(bookingProvider(widget.bookingId)),
            ),
        data:
            (b) => ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_error != null) ...[
                  Text(
                    errorText(l10n, _error!),
                    key: const Key('cancel-error'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                BookingGuidance(booking: b),
                BookingSummary(booking: b),
              ],
            ),
      ),
    );
  }

  Widget? _bar(
    BuildContext context,
    AppLocalizations l10n,
    Booking b,
    bool online,
  ) {
    final actions = <Widget>[
      if (b.status == 'held')
        FilledButton(
          key: const Key('pay-now'),
          onPressed: online ? () => context.push('/checkout/${b.id}') : null,
          child: Text(l10n.payNowAction),
        ),
      if (b.status == 'active')
        FilledButton(
          key: const Key('extend-booking'),
          onPressed:
              !online
                  ? null
                  : () async {
                    final updated = await showExtendSheet(context, b);
                    if (updated != null) {
                      ref.invalidate(bookingProvider(widget.bookingId));
                      ref.invalidate(myBookingsProvider);
                    }
                  },
          child: Text(l10n.extendAction),
        ),
      if (b.cancellable)
        OutlinedButton(
          key: const Key('cancel-booking'),
          onPressed: _busy || !online ? null : _cancel,
          child: Text(l10n.cancelBookingAction),
        ),
    ];
    if (actions.isEmpty) return null;
    return Material(
      elevation: 8,
      color: Theme.of(context).colorScheme.surface,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < actions.length; i++) ...[
                if (i > 0) const SizedBox(height: 8),
                actions[i],
              ],
            ],
          ),
        ),
      ),
    );
  }
}
