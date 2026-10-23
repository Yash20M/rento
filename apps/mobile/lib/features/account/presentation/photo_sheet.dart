import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/media/photo_picker.dart';
import '../../../l10n/generated/app_localizations.dart';

Future<void> showPhotoSheet(BuildContext context) {
  // A message from the last change must not float over the choices (it would cover the last one).
  ScaffoldMessenger.of(context).hideCurrentSnackBar();
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (_) => const _PhotoSheet(),
  );
}

/// Take a photo, choose one, or remove the current one. The result shows on the account screen at once.
class _PhotoSheet extends ConsumerWidget {
  const _PhotoSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final auth = ref.watch(authControllerProvider);
    final hasPhoto = auth is SignedIn && auth.user.avatarUrl != null;

    Future<void> run(String done, Future<void> Function() action) async {
      final messenger = ScaffoldMessenger.of(context);
      Navigator.of(context).pop();
      try {
        await action();
        // A newer message replaces an older one instead of queueing behind it.
        messenger
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(done)));
      } on ApiException {
        messenger
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(l10n.photoFailed)));
      }
    }

    Future<void> pick(PhotoSource source) => run(l10n.photoSaved, () async {
      final photo = await ref.read(photoPickerProvider).pick(source);
      if (photo == null) return;
      final profile = await guardApi(
        () => ref
            .read(meApiProvider)
            .uploadAvatar(photo.bytes, photo.contentType),
      );
      ref
          .read(authControllerProvider.notifier)
          .markAvatarChanged(profile.avatarUrl);
    });

    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            key: const Key('photo-take'),
            leading: const Icon(Icons.photo_camera_outlined),
            title: Text(l10n.photoTake),
            onTap: () => pick(PhotoSource.camera),
          ),
          ListTile(
            key: const Key('photo-choose'),
            leading: const Icon(Icons.photo_library_outlined),
            title: Text(l10n.photoChoose),
            onTap: () => pick(PhotoSource.gallery),
          ),
          if (hasPhoto)
            ListTile(
              key: const Key('photo-remove'),
              leading: Icon(
                Icons.delete_outline,
                color: Theme.of(context).colorScheme.error,
              ),
              title: Text(l10n.photoRemove),
              onTap:
                  () => run(l10n.photoRemoved, () async {
                    await guardApi(
                      () => ref.read(meApiProvider).removeAvatar(),
                    );
                    ref
                        .read(authControllerProvider.notifier)
                        .markAvatarChanged(null);
                  }),
            ),
        ],
      ),
    );
  }
}
