import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/models.dart';
import '../../../core/format/money.dart';
import '../../../core/format/time.dart';
import '../../../core/ui/error_text.dart';
import '../../../l10n/generated/app_localizations.dart';

const _options = [30, 60, 90];

/// Add time to a rental that is running: choose how much, see the price, pay (demo gateway), done. The server checks the
/// unit is still free when the payment is confirmed; if someone booked it meanwhile nothing is charged.
Future<Booking?> showExtendSheet(BuildContext context, Booking booking) =>
    showModalBottomSheet<Booking>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => ExtendSheet(booking: booking),
    );

class ExtendSheet extends ConsumerStatefulWidget {
  const ExtendSheet({super.key, required this.booking});

  final Booking booking;

  @override
  ConsumerState<ExtendSheet> createState() => _ExtendSheetState();
}

class _ExtendSheetState extends ConsumerState<ExtendSheet> {
  Extension? _order;
  bool _busy = false;
  String? _error;

  Future<void> _choose(int minutes) async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
      _order = null;
    });
    try {
      final order = await ref
          .read(bookingApiProvider)
          .extend(widget.booking.id, minutes);
      if (mounted) setState(() => _order = order);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = _message(l10n, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _message(AppLocalizations l10n, ApiException error) {
    if (error.code == ErrorCode.extensionUnavailable) {
      return l10n.extendUnavailable(error.fields['extraMinutes'] ?? '');
    }
    return errorText(l10n, error);
  }

  Future<void> _pay() async {
    final l10n = AppLocalizations.of(context);
    final order = _order!;
    setState(() {
      _busy = true;
      _error = null;
    });
    final api = ref.read(bookingApiProvider);
    try {
      final checkout = await api.simulateExtensionCheckout(
        widget.booking.id,
        order.id,
      );
      final updated = await api.confirmExtension(
        widget.booking.id,
        order.id,
        ConfirmPaymentRequest(
          orderId: checkout.orderId,
          paymentId: checkout.paymentId,
          signature: checkout.signature,
        ),
      );
      if (mounted) Navigator.of(context).pop(updated);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = _message(l10n, error);
        if (error.code == ErrorCode.extensionUnavailable) _order = null;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final order = _order;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        16,
        0,
        16,
        16 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                Icons.more_time_rounded,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  l10n.extendTitle,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              for (final minutes in _options)
                ChoiceChip(
                  key: Key('extend-$minutes'),
                  label: Text(l10n.extendPlus(durationText(l10n, minutes))),
                  selected: order?.extraMinutes == minutes,
                  onSelected: _busy ? null : (_) => _choose(minutes),
                ),
            ],
          ),
          if (_busy)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: LinearProgressIndicator(minHeight: 3),
            ),
          if (order != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.extendPrice(
                      formatPaise(order.pricePaise),
                      durationText(l10n, order.extraMinutes),
                    ),
                    key: const Key('extend-price'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.schedule_rounded, size: 16),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          l10n.extendDone(
                            formatTimeOfDay(
                              order.newEndsAt,
                              widget.booking.drawer.timezone,
                            ),
                          ),
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              key: const Key('extend-pay'),
              onPressed: _busy ? null : _pay,
              child: Text(l10n.extendPayAction(formatPaise(order.pricePaise))),
            ),
            const SizedBox(height: 4),
            Text(
              l10n.demoPaymentNote,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    color: Theme.of(context).colorScheme.onErrorContainer,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      key: const Key('extend-error'),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onErrorContainer,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
