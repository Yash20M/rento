import 'package:flutter/material.dart';

import '../../app/theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../format/money.dart';
import '../format/time.dart';

/// The price of a product on its own page: what one slot costs now, big; and during an offer the normal price struck
/// out, the percent off, and when the offer ends.
class PriceBlock extends StatelessWidget {
  const PriceBlock({
    super.key,
    required this.pricePaise,
    required this.listPricePaise,
    required this.slotMinutes,
    this.discountPercent,
    this.offerEndsAt,
    this.timezone,
  });

  final int pricePaise;
  final int listPricePaise;
  final int slotMinutes;
  final int? discountPercent;
  final DateTime? offerEndsAt;

  /// The drawer's zone, in which the end of the offer is shown.
  final String? timezone;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final onOffer = discountPercent != null && listPricePaise > pricePaise;
    final end = offerEndsAt;
    return Column(
      key: const Key('price-block'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 10,
          runSpacing: 4,
          children: [
            Text(
              formatPaise(pricePaise),
              key: const Key('price-now'),
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: AppTheme.brandText(theme.brightness),
              ),
            ),
            if (onOffer)
              Text(
                formatPaise(listPricePaise),
                key: const Key('price-was'),
                style: theme.textTheme.titleMedium?.copyWith(
                  decoration: TextDecoration.lineThrough,
                  color: scheme.onSurfaceVariant,
                ),
              ),
            if (onOffer)
              Container(
                key: const Key('offer-chip'),
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.ink,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  l10n.discountBadge(discountPercent!),
                  style: const TextStyle(
                    color: Color(0xFFFFB566),
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                  ),
                ),
              ),
          ],
        ),
        Text(
          l10n.perSlotShort(slotMinutes),
          style: theme.textTheme.bodyMedium?.copyWith(
            color: scheme.onSurfaceVariant,
          ),
        ),
        if (onOffer && end != null) ...[
          const SizedBox(height: 6),
          Row(
            key: const Key('offer-ends'),
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.schedule_rounded,
                size: 16,
                color: AppTheme.brandText(theme.brightness),
              ),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  l10n.offerEndsOn(
                    formatDateTime(end, timezone ?? 'Asia/Kolkata'),
                  ),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppTheme.brandText(theme.brightness),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
