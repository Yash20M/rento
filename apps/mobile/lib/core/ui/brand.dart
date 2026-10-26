import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../app/theme.dart';
import 'product_image.dart';

/// The Rento look in a few reusable pieces: the brand gradient surface, a drawn locker illustration (no image files),
/// the person's avatar and the "verified" tick.

/// A rounded surface in the brand gradient with soft decorative circles; text and icons on it are white.
class BrandSurface extends StatelessWidget {
  const BrandSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(20, 20, 20, 20),
    this.radius = 28,
    this.art = false,
  });

  final Widget child;
  final EdgeInsets padding;
  final double radius;

  /// Draw the locker illustration at the right edge.
  final bool art;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: AppTheme.brandGradient(dark),
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              right: -40,
              top: -50,
              child: _Disc(size: 170, alpha: 0.10),
            ),
            Positioned(
              left: -60,
              bottom: -80,
              child: _Disc(size: 190, alpha: 0.07),
            ),
            if (art)
              const Positioned(
                right: 14,
                top: 14,
                child: ExcludeSemantics(child: LockerArt(size: 92)),
              ),
            Padding(
              padding: padding,
              child: DefaultTextStyle.merge(
                style: const TextStyle(color: AppTheme.onBrand),
                child: IconTheme(
                  data: const IconThemeData(color: AppTheme.onBrand),
                  child: child,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Disc extends StatelessWidget {
  const _Disc({required this.size, required this.alpha});

  final double size;
  final double alpha;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: Colors.white.withValues(alpha: alpha),
    ),
  );
}

/// The Rento mark: the orange rounded tile with the white "Rento." wordmark of the logo. [size] is the tile's side.
class RentoLogo extends StatelessWidget {
  const RentoLogo({super.key, this.size = 56});

  final double size;

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Rento',
    image: true,
    child: ExcludeSemantics(
      child: Container(
        key: const Key('rento-logo'),
        width: size,
        height: size,
        padding: EdgeInsets.symmetric(horizontal: size * 0.1),
        decoration: BoxDecoration(
          color: AppTheme.seed,
          borderRadius: BorderRadius.circular(size * 0.28),
          boxShadow: [
            BoxShadow(
              color: AppTheme.seed.withValues(alpha: 0.35),
              blurRadius: size * 0.3,
              offset: Offset(0, size * 0.1),
            ),
          ],
        ),
        child: Image.asset(
          'assets/brand/wordmark_white.png',
          fit: BoxFit.contain,
        ),
      ),
    ),
  );
}

/// Just the wordmark "Rento." in one colour (ink on a light surface, white on a dark one), [height] tall.
class RentoWordmark extends StatelessWidget {
  const RentoWordmark({super.key, this.height = 22, this.color});

  final double height;
  final Color? color;

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Rento',
    header: true,
    child: ExcludeSemantics(
      child: Image.asset(
        'assets/brand/wordmark_white.png',
        height: height,
        color: color ?? Theme.of(context).colorScheme.onSurface,
        colorBlendMode: BlendMode.srcIn,
      ),
    ),
  );
}

/// A wall of rental lockers, drawn: three by two doors with handles, one of them lit.
class LockerArt extends StatelessWidget {
  const LockerArt({super.key, this.size = 96, this.color = Colors.white});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size.square(size), painter: _LockerPainter(color));
}

class _LockerPainter extends CustomPainter {
  const _LockerPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const cols = 3;
    const rows = 2;
    final gap = size.width * 0.07;
    final w = (size.width - gap * (cols - 1)) / cols;
    final h = (size.height * 0.78 - gap * (rows - 1)) / rows;
    final top = size.height * 0.11;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        final lit = r == 0 && c == 1;
        final rect = RRect.fromRectAndRadius(
          Rect.fromLTWH(c * (w + gap), top + r * (h + gap), w, h),
          Radius.circular(size.width * 0.07),
        );
        canvas.drawRRect(
          rect,
          Paint()..color = color.withValues(alpha: lit ? 0.9 : 0.22),
        );
        // the handle
        canvas.drawCircle(
          Offset(rect.right - w * 0.2, rect.center.dy),
          size.width * 0.025,
          Paint()..color = (lit ? AppTheme.ink : color).withValues(alpha: 0.7),
        );
      }
    }
    // a little shine
    canvas.drawArc(
      Rect.fromCircle(
        center: Offset(size.width * 0.88, size.height * 0.07),
        radius: size.width * 0.06,
      ),
      0,
      math.pi * 2,
      false,
      Paint()..color = color.withValues(alpha: 0.5),
    );
  }

  @override
  bool shouldRepaint(_LockerPainter old) => old.color != color;
}

/// The person: their photo when they have one, otherwise the first letter on the brand gradient.
class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.name,
    this.photoUrl,
    this.radius = 32,
    this.ring = true,
  });

  final String name;

  /// A full address, or `null`.
  final String? photoUrl;
  final double radius;

  /// A white ring around it (for use on the brand gradient).
  final bool ring;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final letter = name.trim().isEmpty ? '?' : name.trim().characters.first;
    final fallback = Container(
      width: radius * 2,
      height: radius * 2,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: AppTheme.brandGradient(dark).reversed.toList(),
        ),
      ),
      child: Text(
        letter.toUpperCase(),
        style: TextStyle(
          color: AppTheme.onBrand,
          fontSize: radius * 0.9,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
    final picture =
        photoUrl == null
            ? fallback
            : ClipOval(
              child: Image.network(
                photoUrl!,
                width: radius * 2,
                height: radius * 2,
                fit: BoxFit.cover,
                gaplessPlayback: true,
                errorBuilder: (_, _, _) => fallback,
                frameBuilder:
                    (_, child, frame, sync) => fadeInImage(
                      fallback: fallback,
                      child: child,
                      frame: frame,
                      wasSynchronouslyLoaded: sync,
                    ),
              ),
            );
    return Container(
      key: const Key('avatar'),
      padding: ring ? const EdgeInsets.all(3) : EdgeInsets.zero,
      decoration:
          ring
              ? const BoxDecoration(shape: BoxShape.circle, color: Colors.white)
              : null,
      child: picture,
    );
  }
}

/// The blue tick of a verified person, with a spoken label.
class VerifiedBadge extends StatelessWidget {
  const VerifiedBadge({super.key, required this.label, this.size = 22});

  final String label;
  final double size;

  @override
  Widget build(BuildContext context) => Semantics(
    label: label,
    child: Icon(Icons.verified_rounded, size: size, color: AppTheme.verified),
  );
}

enum TrustLevel { ok, pending, missing }

/// "Email verified" / "ID in review" — one fact about trust with a matching icon and colour.
class TrustChip extends StatelessWidget {
  const TrustChip({
    super.key,
    required this.label,
    required this.level,
    this.onTap,
  });

  final String label;
  final TrustLevel level;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final (icon, color) = switch (level) {
      TrustLevel.ok => (Icons.verified_rounded, AppTheme.verified),
      TrustLevel.pending => (Icons.hourglass_top_rounded, AppTheme.warning),
      TrustLevel.missing => (Icons.error_outline_rounded, scheme.outline),
    };
    return Semantics(
      button: onTap != null,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          constraints: const BoxConstraints(minHeight: 40),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 6),
              Flexible(
                child: ExcludeSemantics(
                  child: Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color:
                          level == TrustLevel.missing
                              ? scheme.onSurfaceVariant
                              : Color.lerp(color, scheme.onSurface, 0.35),
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The cover of a place: its photo when it has one, otherwise a gradient (a different hue per place) with the locker
/// illustration — so a list of places never looks like a list of grey boxes.
class DrawerCover extends ConsumerWidget {
  const DrawerCover({
    super.key,
    required this.seed,
    required this.photo,
    this.height = 120,
    this.overlay,
  });

  /// Anything stable (the place's id): picks the hue.
  final String seed;
  final String? photo;
  final double height;

  /// Shown at the top of the cover (distance, "Open now").
  final Widget? overlay;

  static const _hues = [
    [Color(0xFFF7A24B), Color(0xFFE67A1B)],
    [Color(0xFF3A2A1C), Color(0xFF8A5A2B)],
    [Color(0xFFE9612F), Color(0xFFF2A444)],
    [Color(0xFF0F766E), Color(0xFF5BB5A2)],
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors =
        _hues[seed.codeUnits.fold<int>(0, (a, b) => a + b) % _hues.length];
    final url =
        photo == null
            ? null
            : resolvePhotoUrl(ref.watch(envProvider).apiBaseUrl, photo!);
    final fallback = DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colors,
        ),
      ),
      child: const Align(
        alignment: Alignment.bottomRight,
        child: Padding(
          padding: EdgeInsets.all(10),
          child: ExcludeSemantics(child: LockerArt(size: 84)),
        ),
      ),
    );
    return SizedBox(
      height: height,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (url == null)
            fallback
          else
            Image.network(
              url,
              fit: BoxFit.cover,
              gaplessPlayback: true,
              errorBuilder: (_, _, _) => fallback,
              frameBuilder:
                  (_, child, frame, sync) => fadeInImage(
                    fallback: fallback,
                    child: child,
                    frame: frame,
                    wasSynchronouslyLoaded: sync,
                  ),
            ),
          // a soft scrim so the chips on top stay readable on any photo
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.center,
                colors: [
                  Colors.black.withValues(alpha: 0.28),
                  Colors.transparent,
                ],
              ),
            ),
          ),
          if (overlay != null)
            Positioned(left: 12, right: 12, top: 12, child: overlay!),
        ],
      ),
    );
  }
}

/// While a network picture has not painted its first frame, show [fallback] (never a blank box); then fade it in.
Widget fadeInImage({
  required Widget fallback,
  required Widget child,
  required int? frame,
  required bool wasSynchronouslyLoaded,
}) {
  if (wasSynchronouslyLoaded) return child;
  return Stack(
    fit: StackFit.passthrough,
    children: [
      Positioned.fill(child: fallback),
      AnimatedOpacity(
        opacity: frame == null ? 0 : 1,
        duration: const Duration(milliseconds: 250),
        child: child,
      ),
    ],
  );
}

/// The picture of an empty or failed state: a soft layered blob, dots and a gradient disc holding the icon.
/// [error] tints it with the error colours; [icon] says what the state is about.
class IllustrationBadge extends StatelessWidget {
  const IllustrationBadge({
    super.key,
    required this.icon,
    this.size = 128,
    this.error = false,
  });

  final IconData icon;
  final double size;
  final bool error;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final soft = error ? scheme.errorContainer : scheme.primaryContainer;
    final colors =
        error
            ? [scheme.error, Color.lerp(scheme.error, Colors.black, 0.25)!]
            : AppTheme.brandGradient(dark);
    return ExcludeSemantics(
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Container(
              width: size,
              height: size * 0.92,
              decoration: BoxDecoration(
                color: soft.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(size * 0.46),
              ),
            ),
            Positioned(
              top: size * 0.04,
              right: size * 0.06,
              child: _Dot(size: size * 0.16, color: soft),
            ),
            Positioned(
              bottom: size * 0.06,
              left: size * 0.02,
              child: _Dot(size: size * 0.11, color: soft),
            ),
            Positioned(
              top: size * 0.22,
              left: size * 0.0,
              child: _Dot(size: size * 0.07, color: scheme.outlineVariant),
            ),
            Container(
              width: size * 0.56,
              height: size * 0.56,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: colors,
                ),
                boxShadow: [
                  BoxShadow(
                    color: colors.first.withValues(alpha: 0.35),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Icon(
                icon,
                size: size * 0.28,
                color: error ? Colors.white : AppTheme.onBrand,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(shape: BoxShape.circle, color: color),
  );
}
