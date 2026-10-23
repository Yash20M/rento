import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import 'brand.dart';

/// The address of a product photo. Photos uploaded by staff are stored as a path on the API (`/v1/media/<id>`); photos
/// added as links are already full addresses.
String resolvePhotoUrl(String apiBaseUrl, String ref) =>
    ref.startsWith('/') ? '$apiBaseUrl$ref' : ref;

/// A product picture that never breaks the screen: while it loads or if it cannot be shown, a neutral placeholder.
class ProductImage extends ConsumerWidget {
  const ProductImage({
    super.key,
    required this.photo,
    this.width,
    this.height,
    this.radius = 8,
  });

  /// The first photo of the product, or `null` when it has none.
  final String? photo;
  final double? width;
  final double? height;
  final double radius;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final placeholder = Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [scheme.primaryContainer, scheme.surfaceContainerHigh],
        ),
      ),
      child: Icon(
        Icons.image_outlined,
        color: scheme.onPrimaryContainer.withValues(alpha: 0.6),
        size: 36,
      ),
    );
    final url =
        photo == null
            ? null
            : resolvePhotoUrl(ref.watch(envProvider).apiBaseUrl, photo!);
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child:
          url == null
              ? placeholder
              : Image.network(
                url,
                width: width,
                height: height,
                fit: BoxFit.cover,
                gaplessPlayback: true,
                errorBuilder: (_, _, _) => placeholder,
                frameBuilder:
                    (_, child, frame, sync) => fadeInImage(
                      fallback: placeholder,
                      child: child,
                      frame: frame,
                      wasSynchronouslyLoaded: sync,
                    ),
              ),
    );
  }
}
