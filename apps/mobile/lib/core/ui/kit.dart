import 'package:flutter/material.dart';

import 'brand.dart';

/// Small shared building blocks so every screen looks like one app (P3-39).

/// A rounded label such as "Open now", "2 free" or "1.2 km".
class Pill extends StatelessWidget {
  const Pill({
    super.key,
    required this.label,
    this.color,
    this.icon,
    this.filled = false,
    this.onDark = false,
  });

  final String label;

  /// Defaults to the primary colour.
  final Color? color;
  final IconData? icon;

  /// A solid pill (white text) instead of a tinted one.
  final bool filled;

  /// A frosted pill for sitting on a photo or the brand gradient (white text).
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color:
            onDark
                ? Colors.black.withValues(alpha: 0.55)
                : filled
                ? c
                : c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: filled || onDark ? Colors.white : c),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: filled || onDark ? Colors.white : c,
              fontWeight: FontWeight.w700,
              fontSize: 12.5,
            ),
          ),
        ],
      ),
    );
  }
}

/// A heading for a group of content, with an optional action on the right.
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 4, 10),
      child: Row(
        children: [
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.titleMedium),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// A grey placeholder block shown while content loads. Deliberately static: no endless animation, so screens settle.
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.width, this.height = 16, this.radius = 10});

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Theme.of(
          context,
        ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

/// Card-shaped placeholders for a list that is loading.
class CardSkeletons extends StatelessWidget {
  const CardSkeletons({super.key, this.count = 3, this.withImage = false});

  final int count;
  final bool withImage;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const Key('loading-skeleton'),
      children: [
        for (var i = 0; i < count; i++)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (withImage) ...[
                    const Skeleton(height: 120, radius: 14),
                    const SizedBox(height: 14),
                  ],
                  const Skeleton(width: 160, height: 18),
                  const SizedBox(height: 10),
                  const Skeleton(height: 12),
                  const SizedBox(height: 8),
                  const Skeleton(width: 120, height: 12),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// An empty state with an icon, a message and an optional action.
class EmptyView extends StatelessWidget {
  const EmptyView({
    super.key,
    required this.icon,
    required this.title,
    this.body,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // Scrollable so a short space (a small tab, a landscape phone) never overflows.
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            IllustrationBadge(icon: icon),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (body != null) ...[
              const SizedBox(height: 6),
              Text(
                body!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ],
            if (action != null) ...[const SizedBox(height: 16), action!],
          ],
        ),
      ),
    );
  }
}

/// A gradient block in the brand colours, used behind headings (see [BrandSurface]).
class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key, required this.child, this.art = false});

  final Widget child;
  final bool art;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: BrandSurface(art: art, child: child),
  );
}
