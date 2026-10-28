import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/api/models/models.dart';
import '../../../core/ui/error_text.dart';
import '../../../core/format/time.dart';
import '../../../core/ui/brand.dart';
import '../../../core/ui/kit.dart';
import '../../../core/ui/product_tile.dart';
import '../../../core/ui/responsive.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../explore/application/explore_providers.dart';

/// A drawer: where it is, when it is open, and what can be rented from it.
class DrawerPage extends ConsumerWidget {
  const DrawerPage({super.key, required this.drawerId});

  final String drawerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final drawers = ref.watch(drawersProvider);
    final inventory = ref.watch(inventoryProvider(drawerId));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          drawers.value?.where((d) => d.id == drawerId).firstOrNull?.name ??
              l10n.drawerHeading,
        ),
      ),
      body: drawers.when(
        loading:
            () => ListView(
              padding: const EdgeInsets.all(16),
              children: const [
                CardSkeletons(count: 1),
                CardSkeletons(count: 2, withImage: true),
              ],
            ),
        error:
            (error, _) => ErrorRetry(
              error: error,
              onRetry: () => ref.invalidate(drawersProvider),
            ),
        data: (all) {
          final drawer = all.where((d) => d.id == drawerId).firstOrNull;
          if (drawer == null) {
            return Center(child: Text(l10n.errorLoading));
          }
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(drawersProvider);
              ref.invalidate(inventoryProvider(drawerId));
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: pagePadding(context, maxWidth: 1000, top: 4),
              children: [
                _DrawerHeader(drawer: drawer),
                const SizedBox(height: 12),
                SectionTitle(l10n.itemsHeading),
                inventory.when(
                  loading: () => const CardSkeletons(withImage: true),
                  error:
                      (error, _) => ErrorRetry(
                        error: error,
                        onRetry:
                            () => ref.invalidate(inventoryProvider(drawerId)),
                      ),
                  data:
                      (items) =>
                          items.isEmpty
                              ? EmptyView(
                                icon: Icons.inventory_2_outlined,
                                title: l10n.itemsEmpty,
                              )
                              : ProductGrid(
                                children: [
                                  for (final item in items)
                                    _ItemTile(drawerId: drawerId, item: item),
                                ],
                              ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _DrawerHeader extends ConsumerWidget {
  const _DrawerHeader({required this.drawer});

  final PublicDrawer drawer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final days = [
      l10n.weekdayShort1,
      l10n.weekdayShort2,
      l10n.weekdayShort3,
      l10n.weekdayShort4,
      l10n.weekdayShort5,
      l10n.weekdayShort6,
      l10n.weekdayShort7,
    ];
    final byDay = {for (final h in drawer.hours) h.weekday: h};
    final openColor = drawer.openNow ? const Color(0xFF138A4B) : scheme.error;
    // Which weekday it is where the drawer is, not where the phone is.
    final today = inZone(ref.watch(clockProvider)(), drawer.timezone).weekday;

    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DrawerCover(
            seed: drawer.id,
            photo: drawer.photoUrl,
            height: 230,
            overlay: Row(
              children: [
                Pill(
                  key: const Key('drawer-open-state'),
                  label:
                      drawer.openNow
                          ? l10n.drawerOpenNow
                          : l10n.drawerClosedNow,
                  color: openColor,
                  icon: drawer.openNow ? Icons.circle : Icons.schedule_rounded,
                  filled: true,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.place_rounded, color: scheme.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        drawer.address,
                        style: theme.textTheme.bodyLarge,
                      ),
                    ),
                  ],
                ),
                if (drawer.pickupInstructions != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: scheme.secondaryContainer.withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.pickupInstructions,
                          style: theme.textTheme.titleSmall,
                        ),
                        const SizedBox(height: 2),
                        Text(drawer.pickupInstructions!),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Theme(
                  data: theme.copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    key: const Key('hours-tile'),
                    tilePadding: EdgeInsets.zero,
                    childrenPadding: EdgeInsets.zero,
                    title: Text(
                      l10n.hoursHeading,
                      style: theme.textTheme.titleSmall,
                    ),
                    subtitle: Text(
                      byDay[today] == null
                          ? l10n.hoursClosedDay
                          : '${byDay[today]!.opensAt}–${byDay[today]!.closesAt}',
                    ),
                    children: [
                      for (var day = 1; day <= 7; day++)
                        Builder(
                          builder: (context) {
                            final isToday = day == today;
                            final color =
                                isToday
                                    ? scheme.onPrimaryContainer
                                    : scheme.onSurfaceVariant;
                            final weight =
                                isToday ? FontWeight.w800 : FontWeight.w500;
                            return Container(
                              key: Key('hours-day-$day'),
                              margin: const EdgeInsets.symmetric(vertical: 1.5),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color:
                                    isToday
                                        ? scheme.primaryContainer
                                        : Colors.transparent,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                children: [
                                  SizedBox(
                                    width: 56,
                                    child: Text(
                                      days[day - 1],
                                      style: theme.textTheme.bodyMedium
                                          ?.copyWith(
                                            fontWeight: weight,
                                            color: color,
                                          ),
                                    ),
                                  ),
                                  Text(
                                    byDay[day] == null
                                        ? l10n.hoursClosedDay
                                        : '${byDay[day]!.opensAt}–${byDay[day]!.closesAt}',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      fontWeight: weight,
                                      color: color,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      const SizedBox(height: 4),
                      Text(
                        l10n.timesInZone(drawer.timezone),
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemTile extends ConsumerWidget {
  const _ItemTile({required this.drawerId, required this.item});

  final String drawerId;
  final InventoryEntry item;

  @override
  Widget build(BuildContext context, WidgetRef ref) => ProductTile(
    key: Key('item-${item.itemModelId}'),
    imageKey: Key('item-photo-${item.itemModelId}'),
    name: item.name,
    photo: item.photos.firstOrNull,
    pricePaise: item.pricePerSlotPaise,
    listPricePaise: item.originalPricePerSlotPaise,
    slotMinutes: item.slotMinutes,
    discountPercent: item.discountPercent,
    isNew: item.isNew,
    available:
        item.availableNow > 0 &&
        ref.watch(servedDrawerIdsProvider).contains(drawerId),
    onTap: () => context.push('/drawer/$drawerId/item/${item.itemModelId}'),
  );
}
