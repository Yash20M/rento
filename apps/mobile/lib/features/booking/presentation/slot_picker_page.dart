import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/net/connectivity.dart';
import '../../../core/api/models/models.dart';
import '../../../core/format/money.dart';
import '../../../core/format/time.dart';
import '../../../core/ui/error_text.dart';
import '../../../core/ui/kit.dart';
import '../../../core/ui/responsive.dart';
import '../../../app/theme.dart';
import '../../../core/ui/product_image.dart';
import '../../../core/util/uuid.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../explore/application/explore_providers.dart';
import '../application/booking_providers.dart';
import '../application/slot_logic.dart';

/// Pick a day, a start time and a length, then reserve. Availability is a snapshot, so "Reserve" asks the server again
/// and may answer that someone was faster.
class SlotPickerPage extends ConsumerStatefulWidget {
  const SlotPickerPage({
    super.key,
    required this.drawerId,
    required this.itemModelId,
  });

  final String drawerId;
  final String itemModelId;

  @override
  ConsumerState<SlotPickerPage> createState() => _SlotPickerPageState();
}

class _SlotPickerPageState extends ConsumerState<SlotPickerPage> {
  String? _date;
  AvailabilitySlot? _slot;
  int? _duration;
  String? _attemptKey;
  bool _busy = false;
  Object? _error;
  AreaCheck? _area;

  AvailabilityKey _key(String date) => (
    drawerId: widget.drawerId,
    itemModelId: widget.itemModelId,
    date: date,
  );

  void _selectDay(String date) => setState(() {
    _date = date;
    _slot = null;
    _duration = null;
    _attemptKey = null;
    _error = null;
    _area = null;
  });

  Future<void> _reserve(Availability availability) async {
    final slot = _slot;
    final duration = _duration;
    if (slot == null || duration == null) return;
    setState(() {
      _busy = true;
      _error = null;
      _area = null;
    });
    // Is this drawer in the customer's area? Looked up now, when they order, not while they browse.
    final area = await checkServiceArea(ref, widget.drawerId);
    if (!mounted) return;
    if (area != AreaCheck.ok) {
      setState(() {
        _area = area;
        _busy = false;
      });
      return;
    }
    // One key per attempt: a retry of THIS attempt (timeout, 503) returns the original hold instead of a second one.
    final key = _attemptKey ??= newUuid();
    try {
      final booking = await ref
          .read(bookingApiProvider)
          .create(
            CreateBookingRequest(
              drawerId: widget.drawerId,
              itemModelId: widget.itemModelId,
              startsAt: slot.startsAt.toUtc(),
              durationMinutes: duration,
            ),
            idempotencyKey: key,
          );
      if (!mounted) return;
      _attemptKey = null;
      context.go('/checkout/${booking.id}');
    } on ApiException catch (error) {
      if (!mounted) return;
      // A definite answer (slot taken, rule broken) ends this attempt; a transient failure keeps the key for a retry.
      final transient =
          error.isNetwork ||
          error.code == ErrorCode.retryLater ||
          error.code == ErrorCode.requestInProgress;
      setState(() {
        _error = error;
        if (!transient) {
          _attemptKey = null;
          _slot = null;
          _duration = null;
        }
      });
      if (error.code == ErrorCode.bookingSlotTaken) {
        ref.invalidate(availabilityProvider(_key(availability.date)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final drawers = ref.watch(drawersProvider);
    final inventory = ref.watch(inventoryProvider(widget.drawerId));

    final drawer =
        drawers.value?.where((d) => d.id == widget.drawerId).firstOrNull;
    final item =
        inventory.value
            ?.where((i) => i.itemModelId == widget.itemModelId)
            .firstOrNull;

    Widget scaffold(Widget body, {Widget? bar}) => Scaffold(
      appBar: AppBar(title: Text(item?.name ?? l10n.drawerHeading)),
      body: body,
      bottomNavigationBar: bar,
    );

    if (drawers.hasError || inventory.hasError) {
      return scaffold(
        ErrorRetry(
          error: (drawers.error ?? inventory.error)!,
          onRetry: () {
            ref.invalidate(drawersProvider);
            ref.invalidate(inventoryProvider(widget.drawerId));
          },
        ),
      );
    }
    if (drawer == null || item == null) {
      return scaffold(
        ListView(
          padding: const EdgeInsets.all(16),
          children: const [CardSkeletons(count: 2, withImage: true)],
        ),
      );
    }
    final now = ref.read(clockProvider)();
    final days = upcomingDays(now, drawer.timezone);
    final date = _date ?? days.first.date;
    final availability = ref.watch(availabilityProvider(_key(date)));
    final a = availability.value;
    final rental =
        (a == null || _duration == null)
            ? null
            : rentalPaise(
              minutes: _duration!,
              slotMinutes: a.slotMinutes,
              pricePerSlotPaise: a.pricePerSlotPaise,
            );

    return scaffold(
      ListView(
        padding: pagePadding(context, top: 0),
        children: [
          _Gallery(photos: item.photos),
          const SizedBox(height: 16),
          Text(
            item.name,
            key: const Key('item-title'),
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 6),
          Text(
            l10n.pricePerSlot(
              formatPaise(item.pricePerSlotPaise),
              item.slotMinutes,
            ),
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: AppTheme.brandText(Theme.of(context).brightness),
            ),
          ),
          const SizedBox(height: 18),
          SectionTitle(l10n.chooseDay),
          SizedBox(
            // taller with larger system text, so the weekday and the date never get cut off
            height:
                76 * MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.8),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: days.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder:
                  (context, i) => _DayCard(
                    key: Key('day-${days[i].date}'),
                    label: days[i].label,
                    selected: days[i].date == date,
                    onTap: () => _selectDay(days[i].date),
                  ),
            ),
          ),
          const SizedBox(height: 18),
          availability.when(
            loading: () => const CardSkeletons(count: 1),
            error:
                (error, _) => ErrorRetry(
                  error: error,
                  onRetry:
                      () => ref.invalidate(availabilityProvider(_key(date))),
                ),
            data: (a) => _slots(context, l10n, a, item),
          ),
        ],
      ),
      bar: _ReserveBar(
        notice: _notice(context, l10n),
        total: rental == null ? null : formatPaise(rental + item.depositPaise),
        enabled:
            a != null &&
            _slot != null &&
            _duration != null &&
            !_busy &&
            ref.watch(onlineProvider),
        busy: _busy,
        onReserve: a == null ? null : () => _reserve(a),
      ),
    );
  }

  /// Why a reservation failed (or that verification is needed). It sits in the bar that stays in view: with the big
  /// product picture on top, an error at the end of the list would be out of sight when the person taps Reserve.
  Widget? _notice(BuildContext context, AppLocalizations l10n) {
    final error = _error;
    final area = _area;
    if (error == null && area == null) return null;
    final scheme = Theme.of(context).colorScheme;
    final message =
        area != null
            ? (area == AreaCheck.locationNeeded
                ? l10n.locationNeededToOrder
                : l10n.notInYourArea)
            : errorText(l10n, error!);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: scheme.errorContainer,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.error_outline_rounded,
                  size: 20,
                  color: scheme.onErrorContainer,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    message,
                    key: const Key('reserve-error'),
                    style: TextStyle(color: scheme.onErrorContainer),
                  ),
                ),
              ],
            ),
          ),
          if (error is ApiException && error.code == ErrorCode.kycRequired)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: OutlinedButton(
                key: const Key('verify-now'),
                onPressed: () => context.push('/kyc'),
                child: Text(l10n.kycVerifyNow),
              ),
            ),
        ],
      ),
    );
  }

  Widget _slots(
    BuildContext context,
    AppLocalizations l10n,
    Availability a,
    InventoryEntry item,
  ) {
    final theme = Theme.of(context);
    final zone = a.timezone;
    final bookable = a.slots.where((s) => s.freeAssets > 0).toList();
    final durations =
        _slot == null
            ? const <int>[]
            : durationsFor(
              slotMinutes: a.slotMinutes,
              minDurationMin: a.minDurationMin,
              maxDurationMin: a.maxDurationMin,
              maxFreeMinutes: _slot!.maxFreeMinutes,
            );
    final rental =
        _duration == null
            ? null
            : rentalPaise(
              minutes: _duration!,
              slotMinutes: a.slotMinutes,
              pricePerSlotPaise: a.pricePerSlotPaise,
            );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(l10n.chooseStart),
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 10),
          child: Text(l10n.timesInZone(zone), style: theme.textTheme.bodySmall),
        ),
        if (a.opensAt == null)
          EmptyView(
            key: const Key('closed-day'),
            icon: Icons.event_busy_outlined,
            title: l10n.closedThisDay,
          )
        else if (bookable.isEmpty)
          EmptyView(
            key: const Key('no-slots'),
            icon: Icons.hourglass_disabled_outlined,
            title: l10n.noSlots,
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final slot in bookable)
                ChoiceChip(
                  key: Key('slot-${slot.startsAt.toUtc().toIso8601String()}'),
                  showCheckmark: false,
                  label: Text(formatTimeOfDay(slot.startsAt, zone)),
                  selected: _slot?.startsAt == slot.startsAt,
                  onSelected:
                      (_) => setState(() {
                        _slot = slot;
                        _duration = null;
                        _attemptKey = null;
                        _error = null;
                        _area = null;
                      }),
                ),
            ],
          ),
        if (_slot != null) ...[
          const SizedBox(height: 20),
          SectionTitle(l10n.chooseDuration),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final minutes in durations)
                ChoiceChip(
                  key: Key('duration-$minutes'),
                  showCheckmark: false,
                  label: Text(durationText(l10n, minutes)),
                  selected: _duration == minutes,
                  onSelected:
                      (_) => setState(() {
                        _duration = minutes;
                        _attemptKey = null;
                        _error = null;
                        _area = null;
                      }),
                ),
            ],
          ),
        ],
        if (rental != null) ...[
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _line(l10n.summaryRental, formatPaise(rental)),
                  _line(l10n.summaryDeposit, formatPaise(item.depositPaise)),
                  const Divider(height: 20),
                  _line(
                    l10n.summaryTotal,
                    formatPaise(rental + item.depositPaise),
                    bold: true,
                    key: const Key('summary-total'),
                  ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        Text(l10n.snapshotNote, style: theme.textTheme.bodySmall),
      ],
    );
  }

  Widget _line(String label, String value, {bool bold = false, Key? key}) {
    final style = bold ? const TextStyle(fontWeight: FontWeight.w800) : null;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(child: Text(label, style: style)),
          Text(value, key: key, style: style),
        ],
      ),
    );
  }
}

/// A swipeable set of product photos with page dots.
class _Gallery extends StatefulWidget {
  const _Gallery({required this.photos});

  final List<String> photos;

  @override
  State<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends State<_Gallery> {
  final _controller = PageController();
  int _page = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _show(int i) => _controller.animateToPage(
    i,
    duration: const Duration(milliseconds: 250),
    curve: Curves.easeOut,
  );

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    // The picture is the point of renting something: nearly square on a phone, capped on a wide screen.
    final photos = widget.photos.isEmpty ? <String?>[null] : widget.photos;
    final height = (MediaQuery.sizeOf(context).width * 0.9).clamp(260.0, 440.0);
    return Column(
      children: [
        SizedBox(
          height: height,
          child: Stack(
            children: [
              PageView(
                key: const Key('item-gallery'),
                controller: _controller,
                onPageChanged: (i) => setState(() => _page = i),
                children: [
                  for (var i = 0; i < photos.length; i++)
                    Semantics(
                      label: l10n.galleryCount(i + 1, photos.length),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: ProductImage(
                          photo: photos[i],
                          height: height,
                          radius: 28,
                        ),
                      ),
                    ),
                ],
              ),
              if (photos.length > 1)
                Positioned(
                  right: 14,
                  top: 14,
                  child: Pill(
                    key: const Key('gallery-counter'),
                    label: '${_page + 1} / ${photos.length}',
                    onDark: true,
                    color: Colors.white,
                  ),
                ),
            ],
          ),
        ),
        if (photos.length > 1) ...[
          const SizedBox(height: 10),
          // Thumbnails: tap to jump (a mouse cannot swipe), and they show how many pictures there are.
          SizedBox(
            height: 64,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: photos.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder:
                  (context, i) => Semantics(
                    button: true,
                    selected: i == _page,
                    label: l10n.galleryCount(i + 1, photos.length),
                    child: InkWell(
                      key: Key('gallery-thumb-$i'),
                      borderRadius: BorderRadius.circular(14),
                      onTap: () => _show(i),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 64,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            width: 2,
                            color:
                                i == _page
                                    ? scheme.primary
                                    : Colors.transparent,
                          ),
                        ),
                        child: ProductImage(
                          photo: photos[i],
                          width: 60,
                          height: 60,
                          radius: 12,
                        ),
                      ),
                    ),
                  ),
            ),
          ),
        ],
      ],
    );
  }
}

/// One day of the horizontal date strip: weekday on top, the date below.
class _DayCard extends StatelessWidget {
  const _DayCard({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  /// Like `Tue 8`.
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final parts = label.split(' ');
    final fg = selected ? scheme.onPrimary : scheme.onSurface;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: 62,
          decoration: BoxDecoration(
            color: selected ? scheme.primary : scheme.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: selected ? scheme.primary : scheme.outlineVariant,
            ),
          ),
          // scales down instead of overflowing when the system text is very large
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  parts.first,
                  style: TextStyle(
                    color: fg.withValues(alpha: selected ? 0.85 : 0.65),
                    fontWeight: FontWeight.w600,
                    fontSize: 12.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  parts.length > 1 ? parts.last : '',
                  style: TextStyle(
                    color: fg,
                    fontWeight: FontWeight.w800,
                    fontSize: 20,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Fixed at the bottom: what it will cost and the button to reserve.
class _ReserveBar extends StatelessWidget {
  const _ReserveBar({
    this.notice,
    required this.total,
    required this.enabled,
    required this.busy,
    required this.onReserve,
  });

  final Widget? notice;
  final String? total;
  final bool enabled;
  final bool busy;
  final VoidCallback? onReserve;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Material(
      elevation: 8,
      color: theme.colorScheme.surfaceContainerLowest,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            contentInset(context),
            12,
            contentInset(context),
            12,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (notice != null) notice!,
              LayoutBuilder(
                builder: (context, box) {
                  final summary = Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        total == null ? l10n.pickATimeFirst : l10n.totalToPay,
                        style: theme.textTheme.bodySmall,
                      ),
                      if (total != null)
                        Text(total!, style: theme.textTheme.titleLarge),
                    ],
                  );
                  final button = FilledButton(
                    key: const Key('reserve'),
                    onPressed: enabled ? onReserve : null,
                    child: Text(l10n.reserveAction),
                  );
                  // Side by side when there is room; stacked on a narrow screen or with very large text.
                  final stacked =
                      box.maxWidth < 340 ||
                      MediaQuery.textScalerOf(context).scale(1) > 1.3;
                  return stacked
                      ? Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [summary, const SizedBox(height: 8), button],
                      )
                      : Row(
                        children: [
                          Expanded(child: summary),
                          const SizedBox(width: 12),
                          button,
                        ],
                      );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
