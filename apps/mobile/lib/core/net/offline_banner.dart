import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../l10n/generated/app_localizations.dart';
import 'connectivity.dart';

/// Wraps the whole app: while Rento cannot be reached a bar says so (saved information stays readable, booking and
/// payments are switched off on their own screens). "Check again" asks the server; any answer brings the app back.
class OfflineShell extends ConsumerWidget {
  const OfflineShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(onlineProvider);
    if (online) return child;
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        Material(
          key: const Key('offline-banner'),
          color: scheme.errorContainer,
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
              child: Row(
                children: [
                  Icon(
                    Icons.cloud_off_outlined,
                    color: scheme.onErrorContainer,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      l10n.offlineBanner,
                      style: TextStyle(color: scheme.onErrorContainer),
                    ),
                  ),
                  TextButton(
                    key: const Key('offline-check'),
                    style: TextButton.styleFrom(
                      foregroundColor: scheme.onErrorContainer,
                    ),
                    onPressed: () async {
                      try {
                        await ref.read(dioProvider).get<dynamic>('/healthz');
                      } on Object {
                        // Still offline: the interceptor keeps the banner.
                      }
                    },
                    child: Text(l10n.offlineCheckAgain),
                  ),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          // The banner already covers the status bar.
          child: MediaQuery.removePadding(
            context: context,
            removeTop: true,
            child: child,
          ),
        ),
      ],
    );
  }
}
