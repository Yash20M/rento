import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/models.dart';
import '../../../core/ui/error_text.dart';
import '../../../l10n/generated/app_localizations.dart';

/// The ways this person can sign in (password, Google, Facebook, Apple). Any of them can be removed, but never the
/// last one: the server refuses with `LAST_LOGIN_METHOD`, and the screen does not even offer it.
final signInMethodsProvider = FutureProvider.autoDispose<List<Identity>>(
  (ref) => ref.watch(meApiProvider).identities(),
);

String _providerName(AppLocalizations l10n, String provider) =>
    switch (provider) {
      'password' => l10n.methodPassword,
      'google' => l10n.methodGoogle,
      'facebook' => l10n.methodFacebook,
      'apple' => l10n.methodApple,
      _ => provider,
    };

IconData _providerIcon(String provider) => switch (provider) {
  'password' => Icons.password_rounded,
  'google' => Icons.g_mobiledata_rounded,
  'facebook' => Icons.facebook_rounded,
  'apple' => Icons.apple_rounded,
  _ => Icons.login_rounded,
};

class SignInMethodsPage extends ConsumerWidget {
  const SignInMethodsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final methods = ref.watch(signInMethodsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.signInMethodsTitle)),
      body: methods.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:
            (error, _) => ErrorRetry(
              error: error,
              onRetry: () => ref.invalidate(signInMethodsProvider),
            ),
        data:
            (items) => ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                Text(
                  l10n.signInMethodsIntro,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 12),
                for (final method in items)
                  _MethodCard(method: method, onlyOne: items.length <= 1),
              ],
            ),
      ),
    );
  }
}

class _MethodCard extends ConsumerWidget {
  const _MethodCard({required this.method, required this.onlyOne});

  final Identity method;
  final bool onlyOne;

  Future<void> _remove(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final name = _providerName(l10n, method.provider);
    final sure = await showDialog<bool>(
      context: context,
      builder:
          (dialog) => AlertDialog(
            key: const Key('remove-method-dialog'),
            title: Text(l10n.methodRemoveTitle),
            content: Text(l10n.methodRemoveBody(name)),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialog).pop(false),
                child: Text(l10n.actionCancel),
              ),
              FilledButton(
                key: const Key('confirm-remove-method'),
                onPressed: () => Navigator.of(dialog).pop(true),
                child: Text(l10n.methodRemove),
              ),
            ],
          ),
    );
    if (sure != true) return;
    try {
      await guardApi(() => ref.read(meApiProvider).unlink(method.provider));
      ref.invalidate(signInMethodsProvider);
      messenger.showSnackBar(SnackBar(content: Text(l10n.methodRemoved)));
    } on ApiException catch (error) {
      final text =
          error.code == ErrorCode.lastLoginMethod
              ? l10n.methodLastError
              : errorText(l10n, error);
      messenger.showSnackBar(SnackBar(content: Text(text)));
      ref.invalidate(signInMethodsProvider);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final linked = DateFormat('d MMM yyyy').format(method.linkedAt.toLocal());
    return Card(
      key: Key('method-${method.provider}'),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: scheme.primaryContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                _providerIcon(method.provider),
                color: scheme.onPrimaryContainer,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _providerName(l10n, method.provider),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  if (method.email != null)
                    Text(
                      method.email!,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  Text(
                    l10n.methodLinkedOn(linked),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  if (onlyOne) ...[
                    const SizedBox(height: 6),
                    Row(
                      key: Key('only-method-${method.provider}'),
                      children: [
                        Icon(
                          Icons.lock_outline_rounded,
                          size: 14,
                          color: scheme.primary,
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            l10n.methodOnlyOne,
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(color: scheme.primary),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            if (!onlyOne)
              TextButton(
                key: Key('unlink-${method.provider}'),
                style: TextButton.styleFrom(foregroundColor: scheme.error),
                onPressed: () => _remove(context, ref),
                child: Text(l10n.methodRemove),
              ),
          ],
        ),
      ),
    );
  }
}
