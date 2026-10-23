import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/models.dart';
import '../../../core/ui/error_text.dart';
import '../../../l10n/generated/app_localizations.dart';

Future<void> showEditProfileDialog(BuildContext context) => showDialog<void>(
  context: context,
  builder: (_) => const _EditProfileDialog(),
);

/// Edits the display name and the mobile number. Loads the current values first; only changed fields are sent.
class _EditProfileDialog extends ConsumerStatefulWidget {
  const _EditProfileDialog();

  @override
  ConsumerState<_EditProfileDialog> createState() => _EditProfileDialogState();
}

class _EditProfileDialogState extends ConsumerState<_EditProfileDialog> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  Profile? _loaded;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final profile = await ref.read(meApiProvider).profile();
      if (!mounted) return;
      setState(() {
        _loaded = profile;
        _name.text = profile.displayName ?? '';
        _phone.text = profile.phone ?? '';
      });
    } on Object {
      if (!mounted) return;
      final l10n = AppLocalizations.of(context);
      setState(() => _error = l10n.errorGeneric);
    }
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final loaded = _loaded!;
    final name = _name.text.trim();
    final phone = _phone.text.trim();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final saved = await guardApi(
        () => ref
            .read(meApiProvider)
            .updateProfile(
              UpdateProfileRequest(
                name:
                    name != (loaded.displayName ?? '') && name.isNotEmpty
                        ? name
                        : null,
                phone:
                    phone != (loaded.phone ?? '') && phone.isNotEmpty
                        ? phone
                        : null,
              ),
            ),
      );
      if (!mounted) return;
      final newName = saved.displayName;
      if (newName != null) {
        ref.read(authControllerProvider.notifier).markNameChanged(newName);
      }
      Navigator.of(context).pop();
      messenger.showSnackBar(SnackBar(content: Text(l10n.editProfileSaved)));
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error =
            error.code == ErrorCode.validationFailed
                ? l10n.editProfileInvalid
                : errorText(l10n, error);
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final ready = _loaded != null;
    return AlertDialog(
      key: const Key('edit-profile-dialog'),
      title: Text(l10n.editProfileTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            key: const Key('profile-name'),
            controller: _name,
            enabled: ready && !_busy,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(labelText: l10n.editProfileName),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('profile-phone'),
            controller: _phone,
            enabled: ready && !_busy,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              labelText: l10n.editProfilePhone,
              helperText: l10n.editProfilePhoneHint,
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                _error!,
                key: const Key('profile-error'),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
          child: Text(l10n.actionCancel),
        ),
        FilledButton(
          key: const Key('profile-save'),
          onPressed: ready && !_busy ? _save : null,
          child: Text(l10n.editProfileSave),
        ),
      ],
    );
  }
}
