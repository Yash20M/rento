import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/net/connectivity.dart';
import '../../../core/api/models/models.dart';
import '../../../core/format/money.dart';
import '../../../core/ui/error_text.dart';
import '../../../core/ui/motion.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/booking_providers.dart';
import 'booking_widgets.dart';
import '../../../core/ui/responsive.dart';

/// Pay for a held slot. The hold runs out after a few minutes; the booking only becomes `confirmed` when the SERVER has
/// verified the payment — never because this screen says so.
class CheckoutPage extends ConsumerStatefulWidget {
  const CheckoutPage({super.key, required this.bookingId});

  final String bookingId;

  @override
  ConsumerState<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends ConsumerState<CheckoutPage> {
  Timer? _ticker;
  bool _busy = false;
  Object? _error;
  Booking? _confirmed;
  bool _declined = false;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _pay(Booking booking) async {
    setState(() {
      _busy = true;
      _error = null;
      _declined = false;
    });
    final api = ref.read(bookingApiProvider);
    try {
      final order = await api.createPaymentOrder(widget.bookingId);
      if (!mounted) return;
      // Demo gateway (until real Razorpay keys exist): a stand-in for the gateway's own checkout screen.
      final choice = await showModalBottomSheet<bool>(
        context: context,
        showDragHandle: true,
        builder:
            (_) => _DemoCheckoutSheet(
              amount: formatPaise(order.amountPaise),
              orderId: order.orderId,
            ),
      );
      if (!mounted) return;
      if (choice == null) return; // closed the sheet: nothing happened
      if (!choice) {
        setState(() => _declined = true);
        return;
      }
      final checkout = await api.simulateCheckout(widget.bookingId);
      final booking = await api.confirmPayment(
        widget.bookingId,
        ConfirmPaymentRequest(
          orderId: checkout.orderId,
          paymentId: checkout.paymentId,
          signature: checkout.signature,
        ),
      );
      ref.invalidate(myBookingsProvider);
      // The booking screen reads the same cached copy: without this it keeps saying "awaiting payment".
      ref.invalidate(bookingProvider(widget.bookingId));
      if (mounted) setState(() => _confirmed = booking);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error);
      if (error.code == ErrorCode.holdExpired) {
        ref.invalidate(bookingProvider(widget.bookingId));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _release() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(bookingApiProvider).cancel(widget.bookingId);
      ref.invalidate(myBookingsProvider);
      if (mounted) context.go('/');
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final loaded = ref.watch(bookingProvider(widget.bookingId));
    final booking = _confirmed ?? loaded.value;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.checkoutTitle),
        automaticallyImplyLeading: false,
      ),
      bottomNavigationBar:
          booking == null ? null : _bar(context, l10n, booking),
      body:
          booking == null
              ? loaded.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error:
                    (error, _) => ErrorRetry(
                      error: error,
                      onRetry:
                          () =>
                              ref.invalidate(bookingProvider(widget.bookingId)),
                    ),
                data: (_) => const SizedBox.shrink(),
              )
              : _content(context, l10n, booking),
    );
  }

  bool _expired(Booking booking) {
    final now = ref.read(clockProvider)();
    final remaining = booking.holdExpiresAt?.difference(now) ?? Duration.zero;
    return (booking.status == 'held' && remaining <= Duration.zero) ||
        booking.status == 'expired';
  }

  Widget _content(
    BuildContext context,
    AppLocalizations l10n,
    Booking booking,
  ) {
    final now = ref.read(clockProvider)();
    final deadline = booking.holdExpiresAt;
    final remaining = deadline?.difference(now) ?? Duration.zero;
    final held = booking.status == 'held';
    final expired = _expired(booking);

    return ListView(
      padding: pagePadding(context),
      children: [
        // What went wrong comes first, where it cannot be missed.
        if (_declined) ...[
          Text(
            l10n.demoPaymentFailed,
            key: const Key('payment-declined'),
            textAlign: TextAlign.center,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
          const SizedBox(height: 12),
        ],
        if (_error != null) ...[
          Text(
            errorText(l10n, _error!),
            key: const Key('checkout-error'),
            textAlign: TextAlign.center,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
          const SizedBox(height: 12),
        ],
        if (booking.status == 'confirmed') ...[
          Center(
            child: PopIn(
              child: Container(
                width: 96,
                height: 96,
                decoration: const BoxDecoration(
                  color: Color(0xFFDDF5E7),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_rounded,
                  size: 56,
                  color: Color(0xFF138A4B),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.bookingConfirmedTitle,
            key: const Key('confirmed-title'),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          Text(
            l10n.bookingConfirmedBody(booking.drawer.name),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
        ],
        if (held && !expired) ...[
          _CountdownRing(
            remaining: remaining,
            total: deadline!.difference(booking.createdAt),
            child: Text(
              l10n.holdCountdown(_mmss(remaining)),
              key: const Key('hold-countdown'),
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          const SizedBox(height: 12),
        ],
        BookingSummary(booking: booking),
        if (expired) ...[
          const SizedBox(height: 16),
          Text(
            l10n.holdExpiredTitle,
            key: const Key('hold-expired'),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          Text(l10n.holdExpiredBody, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () => context.go('/'),
            child: Text(l10n.backToExplore),
          ),
        ],
      ],
    );
  }

  /// The actions stay in view while the details scroll: pay (or view the booking) is always one tap away.
  Widget? _bar(BuildContext context, AppLocalizations l10n, Booking booking) {
    final held = booking.status == 'held' && !_expired(booking);
    if (!held && booking.status != 'confirmed') return null;
    return Material(
      elevation: 8,
      color: Theme.of(context).colorScheme.surface,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            contentInset(context),
            12,
            contentInset(context),
            8,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (held) ...[
                FilledButton(
                  key: const Key('pay'),
                  onPressed:
                      _busy || !ref.watch(onlineProvider)
                          ? null
                          : () => _pay(booking),
                  child: Text(l10n.payAction(formatPaise(booking.totalPaise))),
                ),
                const SizedBox(height: 4),
                Text(
                  l10n.demoPaymentNote,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                TextButton(
                  key: const Key('release'),
                  onPressed: _busy ? null : _release,
                  child: Text(l10n.cancelHoldAction),
                ),
              ] else ...[
                FilledButton(
                  key: const Key('view-booking'),
                  onPressed: () => context.go('/booking/${booking.id}'),
                  child: Text(l10n.viewBookingAction),
                ),
                TextButton(
                  onPressed: () => context.go('/'),
                  child: Text(l10n.backToExplore),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _mmss(Duration d) {
    final total = d.inSeconds < 0 ? 0 : d.inSeconds;
    final minutes = (total ~/ 60).toString().padLeft(2, '0');
    final seconds = (total % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }
}

/// Stand-in for the gateway's checkout while no Razorpay keys exist. Pops `true` (paid) or `false` (declined).
class _DemoCheckoutSheet extends StatelessWidget {
  const _DemoCheckoutSheet({required this.amount, required this.orderId});

  final String amount;
  final String orderId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.demoCheckoutTitle,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 4),
            Text(
              '$amount · $orderId',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 4),
            Text(l10n.demoCheckoutNote),
            const SizedBox(height: 12),
            FilledButton.tonalIcon(
              key: const Key('demo-pay-card-ok'),
              icon: const Icon(Icons.credit_card),
              label: Text(l10n.demoMethodCardOk),
              onPressed: () => Navigator.of(context).pop(true),
            ),
            const SizedBox(height: 8),
            FilledButton.tonalIcon(
              key: const Key('demo-pay-upi'),
              icon: const Icon(Icons.account_balance_wallet_outlined),
              label: Text(l10n.demoMethodUpi),
              onPressed: () => Navigator.of(context).pop(true),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              key: const Key('demo-pay-card-fail'),
              icon: const Icon(Icons.credit_card_off_outlined),
              label: Text(l10n.demoMethodCardFail),
              onPressed: () => Navigator.of(context).pop(false),
            ),
          ],
        ),
      ),
    );
  }
}

/// The time left on the hold as a ring that empties, with the countdown text inside.
class _CountdownRing extends StatelessWidget {
  const _CountdownRing({
    required this.remaining,
    required this.total,
    required this.child,
  });

  final Duration remaining;
  final Duration total;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fraction =
        total.inSeconds <= 0
            ? 0.0
            : (remaining.inSeconds / total.inSeconds).clamp(0.0, 1.0);
    final urgent = remaining.inSeconds <= 60;
    final color =
        urgent
            ? scheme.error
            : AppTheme.brandText(Theme.of(context).brightness);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: (urgent ? scheme.errorContainer : scheme.primaryContainer)
            .withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 52,
            height: 52,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox.expand(
                  child: CircularProgressIndicator(
                    value: fraction,
                    strokeWidth: 6,
                    strokeCap: StrokeCap.round,
                    backgroundColor: scheme.surface,
                    color: color,
                  ),
                ),
                Icon(Icons.timer_outlined, size: 22, color: color),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(child: child),
        ],
      ),
    );
  }
}
