import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/models.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/ui/error_text.dart';
import '../../../core/ui/brand.dart';
import '../../../core/ui/kit.dart';
import '../../../core/ui/motion.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/explore_providers.dart';
import 'location_sheet.dart';

String _distance(int meters) =>
    meters < 1000 ? '$meters m' : '${(meters / 1000).toStringAsFixed(1)} km';

class ExplorePage extends ConsumerWidget {
  const ExplorePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final choice = ref.watch(locationChoiceProvider);
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
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              BrandHeader(
                art: true,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (name != null)
                      Text(
                        l10n.exploreGreeting(name),
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.white.withValues(alpha: 0.88),
                        ),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      l10n.exploreTitle,
                      style: Theme.of(
                        context,
                      ).textTheme.headlineMedium?.copyWith(color: Colors.white),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      l10n.exploreTagline,
                      style: TextStyle(
                        color: Theme.of(
                          context,
                        ).colorScheme.onPrimary.withValues(alpha: 0.85),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _LocationBar(choice: choice, l10n: l10n),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              if (choice == null)
                const _ChooseLocationPrompt()
              else
                nearby.when(
                  loading: () => const CardSkeletons(withImage: false),
                  error:
                      (error, _) =>
                          _NearbyError(error: error, ref: ref, l10n: l10n),
                  data: (result) => _NearbyList(result: result!),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LocationBar extends StatelessWidget {
  const _LocationBar({required this.choice, required this.l10n});

  final LocationChoice? choice;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.place_rounded, color: Colors.white),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              choice == null
                  ? l10n.chooseLocationTitle
                  : l10n.searchingNear(choice!.name ?? l10n.placeMyLocation),
              key: const Key('location-label'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          TextButton(
            key: const Key('change-location'),
            style: TextButton.styleFrom(foregroundColor: Colors.white),
            onPressed: () => showLocationSheet(context),
            child: Text(l10n.changeLocation),
          ),
        ],
      ),
    );
  }
}

class _ChooseLocationPrompt extends ConsumerWidget {
  const _ChooseLocationPrompt();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: EmptyView(
        icon: Icons.my_location_rounded,
        title: l10n.nearbyHeading,
        action: FilledButton.icon(
          key: const Key('choose-location'),
          onPressed: () => showLocationSheet(context),
          icon: const Icon(Icons.my_location),
          label: Text(l10n.chooseLocationTitle),
        ),
      ),
    );
  }
}

class _NearbyError extends StatelessWidget {
  const _NearbyError({
    required this.error,
    required this.ref,
    required this.l10n,
  });

  final Object error;
  final WidgetRef ref;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    // "Nowhere near a drawer" is an answer, not a failure: say so without a retry.
    if (error is ApiException &&
        (error as ApiException).code == ErrorCode.outsideServiceArea) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(
          icon: Icons.location_off_outlined,
          title: l10n.outsideServiceArea,
          key: const Key('outside-service-area'),
        ),
      );
    }
    return ErrorRetry(
      error: error,
      onRetry: () => ref.invalidate(nearbyProvider),
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
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(
          key: const Key('nearby-empty'),
          icon: Icons.storefront_outlined,
          title: l10n.nearbyEmpty,
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(l10n.nearbyHeading),
        if (result.drawers.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(l10n.nearbyEmpty, key: const Key('nearby-empty')),
          ),
        for (final (index, drawer) in result.drawers.indexed)
          FadeSlideIn(index: index, child: _DrawerCard(drawer: drawer)),
        if (result.unavailable.isNotEmpty) ...[
          const SizedBox(height: 8),
          SectionTitle(l10n.unavailableHeading),
          for (final drawer in result.unavailable)
            _DrawerCard(drawer: drawer, muted: true),
        ],
      ],
    );
  }
}

class _DrawerCard extends StatelessWidget {
  const _DrawerCard({required this.drawer, this.muted = false});

  final NearbyDrawer drawer;
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

                  height: 112,
                  overlay: Row(
                    children: [
                      Pill(
                        label: l10n.distanceAway(
                          _distance(drawer.distanceMeters),
                        ),
                        color: Colors.white,
                        icon: Icons.near_me_rounded,
                        filled: false,
                        onDark: true,
                      ),
                      const Spacer(),
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
