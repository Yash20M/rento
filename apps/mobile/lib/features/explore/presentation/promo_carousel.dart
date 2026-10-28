import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../app/theme.dart';
import '../../../core/api/models/models.dart';
import '../../../core/ui/brand.dart';
import '../../../core/ui/product_image.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/explore_providers.dart';

/// The banners staff set up, as swipeable cards with a dot for each. Nothing here is fixed in the app: the title, the
/// words on the button, the picture, the colour and which product it opens all come from the server, and a banner
/// that is off, not yet started or over is never sent.
class PromoCarousel extends ConsumerStatefulWidget {
  const PromoCarousel({
    super.key,
    required this.promotions,
    required this.onOpen,
  });

  final List<PublicPromotion> promotions;

  /// Called with the product a banner opens (only for banners that open one).
  final void Function(PublicPromotion promotion) onOpen;

  @override
  ConsumerState<PromoCarousel> createState() => _PromoCarouselState();
}

class _PromoCarouselState extends ConsumerState<PromoCarousel> {
  final _controller = PageController(viewportFraction: 0.92);
  Timer? _timer;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _schedule();
  }

  @override
  void didUpdateWidget(PromoCarousel old) {
    super.didUpdateWidget(old);
    if (_page >= widget.promotions.length) _page = 0;
  }

  /// Moves on by itself every few seconds when there is more than one banner, unless the person asked their phone for
  /// no animations (and never in tests).
  void _schedule() {
    _timer?.cancel();
    if (!ref.read(bannerAutoPlayProvider)) return;
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || widget.promotions.length < 2) return;
      if (MediaQuery.disableAnimationsOf(context)) return;
      if (!_controller.hasClients) return;
      final next = (_page + 1) % widget.promotions.length;
      unawaited(
        _controller.animateToPage(
          next,
          duration: const Duration(milliseconds: 450),
          curve: Curves.easeOutCubic,
        ),
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final width = MediaQuery.sizeOf(context).width;
    final height = (width * 0.46).clamp(150.0, 230.0);
    final promotions = widget.promotions;
    return Column(
      key: const Key('promo-carousel'),
      children: [
        SizedBox(
          height: height,
          child: PageView.builder(
            key: const Key('promo-pages'),
            controller: _controller,
            itemCount: promotions.length,
            onPageChanged: (i) => setState(() => _page = i),
            itemBuilder:
                (context, i) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Semantics(
                    label: l10n.bannerCountLabel(i + 1, promotions.length),
                    container: true,
                    child: _Banner(
                      promotion: promotions[i],
                      onOpen: () => widget.onOpen(promotions[i]),
                    ),
                  ),
                ),
          ),
        ),
        if (promotions.length > 1) ...[
          const SizedBox(height: 10),
          Row(
            key: const Key('promo-dots'),
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < promotions.length; i++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _page ? 20 : 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: i == _page ? scheme.primary : scheme.outlineVariant,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

/// Colours of a banner without a picture, and the colour of its words.
({List<Color> colors, Color ink}) bannerTheme(String theme) => switch (theme) {
  'ink' => (
    colors: const [Color(0xFF3A2A1C), Color(0xFF1F1408)],
    ink: Colors.white,
  ),
  'teal' => (
    colors: const [Color(0xFF14958A), Color(0xFF0B5E58)],
    ink: Colors.white,
  ),
  'plum' => (
    colors: const [Color(0xFF7C3AED), Color(0xFF4C1D95)],
    ink: Colors.white,
  ),
  _ => (
    colors: const [Color(0xFFF7A24B), Color(0xFFEF8E30)],
    ink: AppTheme.ink,
  ),
};

class _Banner extends ConsumerWidget {
  const _Banner({required this.promotion, required this.onOpen});

  final PublicPromotion promotion;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = bannerTheme(promotion.theme);
    final photo = promotion.imageUrl;
    final url =
        photo == null
            ? null
            : resolvePhotoUrl(ref.watch(envProvider).apiBaseUrl, photo);
    final onPicture = url != null;
    final ink = onPicture ? Colors.white : theme.ink;
    final textTheme = Theme.of(context).textTheme;
    final gradient = DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: theme.colors,
        ),
      ),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: Key('promo-${promotion.id}'),
          onTap: onOpen,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (url == null)
                gradient
              else
                Image.network(
                  url,
                  fit: BoxFit.cover,
                  gaplessPlayback: true,
                  errorBuilder: (_, _, _) => gradient,
                  frameBuilder:
                      (_, child, frame, sync) => fadeInImage(
                        fallback: gradient,
                        child: child,
                        frame: frame,
                        wasSynchronouslyLoaded: sync,
                      ),
                ),
              if (onPicture)
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                      colors: [
                        Colors.black.withValues(alpha: 0.72),
                        Colors.black.withValues(alpha: 0.05),
                      ],
                    ),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      promotion.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.titleLarge?.copyWith(
                        color: ink,
                        fontWeight: FontWeight.w800,
                        height: 1.15,
                      ),
                    ),
                    if (promotion.subtitle != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        promotion.subtitle!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.bodyMedium?.copyWith(
                          color: ink.withValues(alpha: 0.9),
                        ),
                      ),
                    ],
                    if (promotion.ctaLabel != null) ...[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: onPicture ? Colors.white : theme.ink,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          promotion.ctaLabel!,
                          style: TextStyle(
                            color: onPicture ? AppTheme.ink : theme.colors.last,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
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
