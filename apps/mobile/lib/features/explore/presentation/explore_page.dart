import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/models.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/ui/brand.dart';
import '../../../core/ui/error_text.dart';
import '../../../core/ui/kit.dart';
import '../../../core/ui/motion.dart';
import '../../../core/ui/product_tile.dart';
import '../../../core/ui/responsive.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/explore_providers.dart';
import '../domain/home_sections.dart';
import 'promo_carousel.dart';

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
    final auth = ref.watch(authControllerProvider);
    final name =
        auth is SignedIn
            ? (auth.user.displayName ?? auth.user.email?.split('@').first)
            : null;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(nearbyProvider);
            ref.invalidate(promotionsProvider);
            ref.invalidate(drawersProvider);
          },
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
              const _Home(),
            ],
          ),
        ),
      ),
    );
  }
}

/// A place products are listed from: a drawer, with its distance when the position is known.
typedef _Source = ({String id, String name, int? distance});

/// Everything under the header, built from what the server sends: banners, then the offers, the new arrivals and the
/// featured products (each only when there is something to show), then every product in a two-column grid, then the
/// drawers. Products appear as each drawer's stock arrives; nothing waits for the position.
class _Home extends ConsumerWidget {
  const _Home();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final nearby = ref.watch(nearbyProvider);
    final result = nearby.value;
    final hasNearby =
        result != null &&
        (result.drawers.isNotEmpty || result.unavailable.isNotEmpty);
    final drawers = ref.watch(drawersProvider);

    final List<_Source> sources;
    if (hasNearby) {
      sources = [
        for (final d in [...result.drawers, ...result.unavailable])
          (id: d.id, name: d.name, distance: d.distanceMeters),
      ];
    } else {
      // open drawers first, so the products shown can be rented now
      final all = [...(drawers.value ?? const <PublicDrawer>[])]
        ..sort((a, b) => (b.openNow ? 1 : 0) - (a.openNow ? 1 : 0));
      sources = [for (final d in all) (id: d.id, name: d.name, distance: null)];
    }

    var stockLoading = false;
    final listings = <Listing>[];
    for (final src in sources.take(8)) {
      final stock = ref.watch(inventoryProvider(src.id));
      if (stock.isLoading) stockLoading = true;
      for (final item in stock.value ?? const <InventoryEntry>[]) {
        listings.add(
          Listing(
            drawerId: src.id,
            drawerName: src.name,
            item: item,
            distanceMeters: src.distance,
          ),
        );
      }
    }
    final sections = buildHomeSections(listings);
    final served = ref.watch(servedDrawerIdsProvider);
    final promotions = ref.watch(promotionsProvider).value ?? const [];

    void open(Listing l) =>
        context.push('/drawer/${l.drawerId}/item/${l.item.itemModelId}');

    void openBanner(PublicPromotion p) {
      final id = p.itemModelId;
      if (id == null) return;
      final listing = sections.all.where((l) => l.item.itemModelId == id);
      if (listing.isEmpty) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(l10n.promoNotAvailable)));
        return;
      }
      open(listing.first);
    }

    Widget tile(Listing l, {String prefix = 'product'}) => ProductTile(
      key: Key('$prefix-${l.drawerId}-${l.item.itemModelId}'),
      name: l.item.name,
      photo: l.item.photos.firstOrNull,
      pricePaise: l.item.pricePerSlotPaise,
      listPricePaise: l.item.originalPricePerSlotPaise,
      slotMinutes: l.item.slotMinutes,
      discountPercent: l.item.discountPercent,
      isNew: l.item.isNew,
      available: l.item.availableNow > 0 && served.contains(l.drawerId),
      place: l.drawerName,
      onTap: () => open(l),
    );

    Widget rail(String title, List<Listing> items, String prefix) {
      if (items.isEmpty) return const SizedBox.shrink();
      return Column(
        key: Key('section-$prefix'),
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionTitle(title),
          _Rail(
            children: [
              for (final (i, l) in items.take(10).indexed)
                FadeSlideIn(index: i, child: tile(l, prefix: prefix)),
            ],
          ),
          const SizedBox(height: 8),
        ],
      );
    }

    final noProductsYet =
        sections.isEmpty &&
        (stockLoading || drawers.isLoading || nearby.isLoading);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (promotions.isNotEmpty) ...[
          PromoCarousel(promotions: promotions, onOpen: openBanner),
          const SizedBox(height: 16),
        ],
        rail(l10n.offersForYou, sections.offers, 'offer'),
        rail(l10n.newArrivals, sections.newArrivals, 'new'),
        rail(l10n.featuredHeading, sections.featured, 'featured'),
        SectionTitle(l10n.allProducts),
        if (noProductsYet)
          const _GridSkeleton()
        else if (sections.isEmpty && drawers.hasError && !hasNearby)
          ErrorRetry(
            error: drawers.error!,
            onRetry: () => ref.invalidate(drawersProvider),
          )
        else if (sections.isEmpty)
          EmptyView(
            key: const Key('no-products'),
            icon: Icons.inventory_2_outlined,
            title: l10n.itemsEmpty,
          )
        else
          ProductGrid(
            key: const Key('products-near-you'),
            children: [
              for (final (i, l) in sections.all.indexed)
                FadeSlideIn(index: i, child: tile(l)),
            ],
          ),
        const SizedBox(height: 12),
        _DrawersSection(
          nearby: nearby,
          result: hasNearby ? result : null,
          all: drawers,
        ),
      ],
    );
  }
}

/// Cards in a row that scrolls sideways: about two and a bit are visible, so it is clear there are more.
class _Rail extends StatelessWidget {
  const _Rail({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final tile = ((box.maxWidth - 12) / 2.25).clamp(150.0, 230.0);
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final (i, c) in children.indexed) ...[
                if (i > 0) const SizedBox(width: 12),
                SizedBox(width: tile, child: c),
              ],
            ],
          ),
        ),
      );
    },
  );
}

/// Placeholder cards while the first products load: the grid keeps its shape instead of jumping.
class _GridSkeleton extends StatelessWidget {
  const _GridSkeleton();

  @override
  Widget build(BuildContext context) => ProductGrid(
    key: const Key('loading-skeleton'),
    children: [
      for (var i = 0; i < 4; i++)
        const Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AspectRatio(aspectRatio: 1, child: Skeleton(radius: 14)),
                SizedBox(height: 12),
                Skeleton(width: 110, height: 14),
                SizedBox(height: 8),
                Skeleton(width: 70, height: 12),
              ],
            ),
          ),
        ),
    ],
  );
}

/// The drawers: near the customer when that is known (open ones, then closed or sold-out ones), otherwise all of them.
class _DrawersSection extends ConsumerWidget {
  const _DrawersSection({
    required this.nearby,
    required this.result,
    required this.all,
  });

  final AsyncValue<NearbyResponse?> nearby;
  final NearbyResponse? result;
  final AsyncValue<List<PublicDrawer>> all;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final error = nearby.error;
    final markerKey =
        error is ApiException && error.code == ErrorCode.outsideServiceArea
            ? const Key('outside-service-area')
            : (nearby.hasValue && nearby.value != null && result == null)
            ? const Key('nearby-empty')
            : null;
    if (result != null) {
      final r = result!;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionTitle(l10n.nearbyHeading),
          if (r.drawers.isEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(l10n.nearbyEmpty, key: const Key('nearby-empty')),
            ),
          CardGrid(
            children: [
              for (final (index, drawer) in r.drawers.indexed)
                FadeSlideIn(
                  index: index,
                  child: _DrawerCard(drawer: _DrawerInfo.nearby(drawer)),
                ),
            ],
          ),
          if (r.unavailable.isNotEmpty) ...[
            const SizedBox(height: 8),
            SectionTitle(l10n.unavailableHeading),
            CardGrid(
              children: [
                for (final drawer in r.unavailable)
                  _DrawerCard(drawer: _DrawerInfo.nearby(drawer), muted: true),
              ],
            ),
          ],
        ],
      );
    }
    return Column(
      key: markerKey,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(l10n.allDrawersHeading),
        all.when(
          loading: () => const CardSkeletons(withImage: true, count: 1),
          error:
              (e, _) => ErrorRetry(
                error: e,
                onRetry: () => ref.invalidate(drawersProvider),
              ),
          data: (drawers) {
            final sorted = [...drawers]
              ..sort((a, b) => (b.openNow ? 1 : 0) - (a.openNow ? 1 : 0));
            return CardGrid(
              children: [
                for (final (i, d) in sorted.indexed)
                  FadeSlideIn(
                    index: i,
                    child: _DrawerCard(drawer: _DrawerInfo.plain(d)),
                  ),
              ],
            );
          },
        ),
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
