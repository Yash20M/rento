import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/models.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/ui/error_text.dart';
import '../../../core/ui/brand.dart';
import '../../../core/ui/kit.dart';
import '../../../core/ui/motion.dart';
import '../../../core/ui/product_image.dart';
import '../../../core/ui/responsive.dart';
import '../../../core/format/money.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/explore_providers.dart';

String _distance(int meters) =>
    meters < 1000 ? '$meters m' : '${(meters / 1000).toStringAsFixed(1)} km';

class ExplorePage extends ConsumerWidget {
  const ExplorePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    // Everything is shown at once; the phone's position is worked out in the background and only re-orders the list
    // (nearest first) if it arrives. Whether Rento serves the customer's area is checked when they try to order.
    ref.watch(autoLocateProvider);
    final nearby = ref.watch(nearbyProvider);
    final auth = ref.watch(authControllerProvider);
    final name =
        auth is SignedIn
            ? (auth.user.displayName ?? auth.user.email?.split('@').first)
            : null;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(nearbyProvider),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: pagePadding(context, maxWidth: 1100),
            children: [
              BrandHeader(
                art: true,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const RentoWordmark(height: 30, color: Colors.white),
                    const SizedBox(height: 18),
                    if (name != null)
                      Text(
                        l10n.exploreGreeting(name),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(
                          context,
                        ).textTheme.headlineMedium?.copyWith(
                          color: AppTheme.onBrand,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      l10n.exploreTagline,
                      style: TextStyle(
                        color: AppTheme.onBrand.withValues(alpha: 0.85),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              nearby.when(
                loading: () => const _AllDrawers(),
                error:
                    (error, _) => _AllDrawers(
                      key:
                          error is ApiException &&
                                  error.code == ErrorCode.outsideServiceArea
                              ? const Key('outside-service-area')
                              : null,
                    ),
                data:
                    (result) =>
                        result != null &&
                                (result.drawers.isNotEmpty ||
                                    result.unavailable.isNotEmpty)
                            ? _NearbyList(result: result)
                            : _AllDrawers(
                              key:
                                  result == null
                                      ? null
                                      : const Key('nearby-empty'),
                            ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NearbyList extends StatelessWidget {
  const _NearbyList({required this.result});

  final NearbyResponse result;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (result.drawers.isEmpty && result.unavailable.isEmpty) {
      return const _AllDrawers(key: Key('nearby-empty'));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (result.drawers.isNotEmpty || result.unavailable.isNotEmpty) ...[
          SectionTitle(l10n.rentNearYou),
          _Products(
            drawers: [
              for (final d in [
                ...result.drawers,
                ...result.unavailable,
              ].take(3))
                (id: d.id, name: d.name),
            ],
          ),
          const SizedBox(height: 8),
        ],
        SectionTitle(l10n.nearbyHeading),
        if (result.drawers.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(l10n.nearbyEmpty, key: const Key('nearby-empty')),
          ),
        CardGrid(
          children: [
            for (final (index, drawer) in result.drawers.indexed)
              FadeSlideIn(
                index: index,
                child: _DrawerCard(drawer: _DrawerInfo.nearby(drawer)),
              ),
          ],
        ),
        if (result.unavailable.isNotEmpty) ...[
          const SizedBox(height: 8),
          SectionTitle(l10n.unavailableHeading),
          CardGrid(
            children: [
              for (final drawer in result.unavailable)
                _DrawerCard(drawer: _DrawerInfo.nearby(drawer), muted: true),
            ],
          ),
        ],
      ],
    );
  }
}

/// What a drawer card shows; built from a nearby result (with a distance) or from the plain list of every drawer.
class _DrawerInfo {
  const _DrawerInfo({
    required this.id,
    required this.name,
    required this.address,
    required this.photoUrl,
    required this.openNow,
    this.distanceMeters,
    this.reason,
  });

  factory _DrawerInfo.nearby(NearbyDrawer d) => _DrawerInfo(
    id: d.id,
    name: d.name,
    address: d.address,
    photoUrl: d.photoUrl,
    openNow: d.openNow,
    distanceMeters: d.distanceMeters,
    reason: d.reason,
  );

  factory _DrawerInfo.plain(PublicDrawer d) => _DrawerInfo(
    id: d.id,
    name: d.name,
    address: d.address,
    photoUrl: d.photoUrl,
    openNow: d.openNow,
  );

  final String id;
  final String name;
  final String address;
  final String? photoUrl;
  final bool openNow;
  final int? distanceMeters;
  final String? reason;
}

class _DrawerCard extends StatelessWidget {
  const _DrawerCard({required this.drawer, this.muted = false});

  final _DrawerInfo drawer;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final reason = switch (drawer.reason) {
      'closed' => l10n.reasonClosed,
      'out_of_stock' => l10n.reasonOutOfStock,
      _ => null,
    };
    return PressScale(
      child: Opacity(
        opacity: muted ? 0.75 : 1,
        child: Card(
          key: Key('drawer-${drawer.id}'),
          child: InkWell(
            onTap: () => context.push('/drawer/${drawer.id}'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DrawerCover(
                  seed: drawer.id,
                  photo: drawer.photoUrl,

                  height: 168,
                  overlay: Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      if (drawer.distanceMeters != null)
                        Pill(
                          label: l10n.distanceAway(
                            _distance(drawer.distanceMeters!),
                          ),
                          color: Colors.white,
                          icon: Icons.near_me_rounded,
                          filled: false,
                          onDark: true,
                        ),
                      if (reason != null)
                        Pill(label: reason, color: scheme.error, filled: true)
                      else
                        Pill(
                          label:
                              drawer.openNow
                                  ? l10n.drawerOpenNow
                                  : l10n.drawerClosedNow,
                          color:
                              drawer.openNow
                                  ? const Color(0xFF138A4B)
                                  : scheme.error,
                          icon:
                              drawer.openNow
                                  ? Icons.circle
                                  : Icons.schedule_rounded,
                          filled: true,
                        ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              drawer.name,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              drawer.address,
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(color: scheme.onSurfaceVariant),
                            ),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, color: scheme.outline),
                    ],
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

/// The products of the nearest drawers as big picture cards — what a person comes here for. Each drawer's stock loads
/// on its own, so one slow or failing drawer never blanks the rest.
class _Products extends ConsumerWidget {
  const _Products({required this.drawers});

  final List<({String id, String name})> drawers;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = <Widget>[];
    var loading = false;
    for (final drawer in drawers) {
      final stock = ref.watch(inventoryProvider(drawer.id));
      if (stock.isLoading) loading = true;
      for (final item in stock.value ?? const <InventoryEntry>[]) {
        cards.add(
          _ProductCard(
            drawerId: drawer.id,
            drawerName: drawer.name,
            item: item,
          ),
        );
      }
    }
    if (cards.isEmpty) {
      return loading
          ? const CardSkeletons(count: 1, withImage: true)
          : const SizedBox.shrink();
    }
    return CardGrid(
      key: const Key('products-near-you'),
      minTileWidth: 300,
      children: [
        for (final (i, card) in cards.indexed)
          FadeSlideIn(index: i, child: card),
      ],
    );
  }
}

class _ProductCard extends ConsumerWidget {
  const _ProductCard({
    required this.drawerId,
    required this.drawerName,
    required this.item,
  });

  final String drawerId;
  final String drawerName;
  final InventoryEntry item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    // Only said when it is true where the customer is: in the area, and at least one unit free.
    final available =
        item.availableNow > 0 &&
        ref.watch(servedDrawerIdsProvider).contains(drawerId);
    return PressScale(
      child: Card(
        key: Key('product-$drawerId-${item.itemModelId}'),
        child: InkWell(
          onTap:
              () => context.push('/drawer/$drawerId/item/${item.itemModelId}'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  AspectRatio(
                    aspectRatio: 4 / 3,
                    child: ProductImage(
                      photo: item.photos.firstOrNull,
                      width: double.infinity,
                      radius: 0,
                    ),
                  ),
                  if (available)
                    Positioned(
                      left: 12,
                      top: 12,
                      child: Pill(
                        key: const Key('available-label'),
                        label: l10n.availableLabel,
                        color: AppTheme.success,
                        filled: true,
                      ),
                    ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      l10n.pricePerSlot(
                        formatPaise(item.pricePerSlotPaise),
                        item.slotMinutes,
                      ),
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: AppTheme.brandText(theme.brightness),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(
                          Icons.place_outlined,
                          size: 16,
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            l10n.fromDrawer(drawerName),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Every drawer Rento has, shown when the nearest ones cannot be worked out (location off, or nothing serves the place):
/// the screen is never empty, and nothing about location is shown.
class _AllDrawers extends ConsumerWidget {
  const _AllDrawers({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final drawers = ref.watch(drawersProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        drawers.when(
          loading: () => const CardSkeletons(withImage: true, count: 1),
          error:
              (error, _) => ErrorRetry(
                error: error,
                onRetry: () => ref.invalidate(drawersProvider),
              ),
          data: (all) {
            // Open ones first, so the products shown come from drawers that can serve someone now.
            final sorted = [...all]
              ..sort((a, b) => (b.openNow ? 1 : 0) - (a.openNow ? 1 : 0));
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (sorted.isNotEmpty) ...[
                  SectionTitle(l10n.rentFromDrawers),
                  _Products(
                    drawers: [
                      for (final d in sorted.take(3)) (id: d.id, name: d.name),
                    ],
                  ),
                  const SizedBox(height: 8),
                ],
                SectionTitle(l10n.allDrawersHeading),
                CardGrid(
                  children: [
                    for (final (i, d) in sorted.indexed)
                      FadeSlideIn(
                        index: i,
                        child: _DrawerCard(drawer: _DrawerInfo.plain(d)),
                      ),
                  ],
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}
