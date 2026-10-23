import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/models.dart';
import '../../../core/ui/error_text.dart';
import '../../../l10n/generated/app_localizations.dart';

Future<void> showDeleteAccountDialog(BuildContext context) => showDialog<void>(
  context: context,
  builder: (_) => const _DeleteAccountDialog(),
);

/// Asks for the password, then deletes the account and signs out. A booking that is still live blocks it, and says so.
class _DeleteAccountDialog extends ConsumerStatefulWidget {
  const _DeleteAccountDialog();

  @override
  ConsumerState<_DeleteAccountDialog> createState() =>
      _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends ConsumerState<_DeleteAccountDialog> {
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await guardApi(
        () => ref.read(meApiProvider).deleteAccount(password: _password.text),
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      await ref.read(authControllerProvider.notifier).signOut();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = switch (error.code) {
          ErrorCode.unauthenticated => l10n.deleteAccountWrongPassword,
          ErrorCode.hasFutureBookings => l10n.deleteAccountBlocked,
          _ => errorText(l10n, error),
        };
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      key: const Key('delete-account-dialog'),
      title: Text(l10n.deleteAccountTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.deleteAccountBody),
          const SizedBox(height: 16),
          TextField(
            key: const Key('delete-password'),
            controller: _password,
            obscureText: true,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(labelText: l10n.deleteAccountPassword),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                _error!,
                key: const Key('delete-error'),
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
          key: const Key('delete-confirm'),
          style: FilledButton.styleFrom(
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
          onPressed: _busy || _password.text.isEmpty ? null : _delete,
          child: Text(l10n.deleteAccountConfirm),
        ),
      ],
    );
  }
}
