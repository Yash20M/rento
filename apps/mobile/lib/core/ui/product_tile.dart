import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../format/money.dart';
import 'kit.dart';
import 'motion.dart';
import 'product_image.dart';

/// One product as a compact card, the unit of every product grid and rail: a square picture with its badges, the name,
/// the price to pay (with the normal price struck out and the percent off while an offer runs) and where it is.
///
/// Everything shown is passed in, so the card never decides anything: the server says what is on offer, new or free.
class ProductTile extends ConsumerWidget {
  const ProductTile({
    super.key,
    required this.name,
    required this.photo,
    required this.pricePaise,
    required this.listPricePaise,
    required this.slotMinutes,
    required this.onTap,
    this.discountPercent,
    this.isNew = false,
    this.available = false,
    this.place,
    this.imageKey,
  });

  final String name;
  final String? photo;

  /// What one slot costs now (the offer price during an offer).
  final int pricePaise;

  /// The normal price: struck out next to [pricePaise] when it is higher.
  final int listPricePaise;
  final int slotMinutes;
  final int? discountPercent;
  final bool isNew;

  /// Can be rented now where the customer is (open, in the area, a unit free).
  final bool available;

  /// The drawer name, shown under the price when given.
  final String? place;
  final Key? imageKey;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final onOffer = discountPercent != null && listPricePaise > pricePaise;
    final spoken = [
      name,
      '${formatPaise(pricePaise)} ${l10n.perSlotShort(slotMinutes)}',
      if (onOffer) ...[
        l10n.discountBadge(discountPercent!).replaceFirst('-', ''),
        l10n.wasPrice(formatPaise(listPricePaise)),
      ],
      if (isNew) l10n.newBadge,
      if (available) l10n.availableLabel,
      if (place != null) l10n.fromDrawer(place!),
    ].join(', ');

    return PressScale(
      child: Semantics(
        button: true,
        label: spoken,
        excludeSemantics: true,
        child: Card(
          margin: EdgeInsets.zero,
          child: InkWell(
            onTap: onTap,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Stack(
                  children: [
                    AspectRatio(
                      aspectRatio: 1,
                      child: ProductImage(
                        key: imageKey,
                        photo: photo,
                        width: double.infinity,
                        radius: 0,
                      ),
                    ),
                    if (onOffer)
                      Positioned(
                        left: 8,
                        top: 8,
                        child: _Badge(
                          key: const Key('discount-badge'),
                          label: l10n.discountBadge(discountPercent!),
                          background: AppTheme.ink,
                          foreground: const Color(0xFFFFB566),
                        ),
                      ),
                    if (isNew)
                      Positioned(
                        right: 8,
                        top: 8,
                        child: _Badge(
                          key: const Key('new-badge'),
                          label: l10n.newBadge,
                          background: AppTheme.seed,
                          foreground: AppTheme.ink,
                        ),
                      ),
                    if (available)
                      Positioned(
                        left: 8,
                        bottom: 8,
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
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          height: 1.25,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.end,
                        spacing: 6,
                        children: [
                          Text(
                            formatPaise(pricePaise),
                            key: const Key('tile-price'),
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: AppTheme.brandText(theme.brightness),
                            ),
                          ),
                          if (onOffer)
                            Text(
                              formatPaise(listPricePaise),
                              key: const Key('tile-list-price'),
                              style: theme.textTheme.bodySmall?.copyWith(
                                decoration: TextDecoration.lineThrough,
                                color: scheme.onSurfaceVariant,
                              ),
                            ),
                        ],
                      ),
                      Text(
                        l10n.perSlotShort(slotMinutes),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                      if (place != null) ...[
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Icon(
                              Icons.place_outlined,
                              size: 14,
                              color: scheme.onSurfaceVariant,
                            ),
                            const SizedBox(width: 3),
                            Expanded(
                              child: Text(
                                l10n.fromDrawer(place!),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: scheme.onSurfaceVariant,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
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

class _Badge extends StatelessWidget {
  const _Badge({
    super.key,
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(8),
    ),
    child: Text(
      label,
      style: TextStyle(
        color: foreground,
        fontWeight: FontWeight.w800,
        fontSize: 12,
        height: 1.1,
      ),
    ),
  );
}
