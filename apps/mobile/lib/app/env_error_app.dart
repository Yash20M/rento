import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';

/// Shown instead of the app when the build configuration is invalid, so a mis-built binary explains itself
/// rather than showing a blank screen or talking to the wrong backend.
class EnvErrorApp extends StatelessWidget {
  const EnvErrorApp({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder:
            (context) => Scaffold(
              body: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        AppLocalizations.of(context).envErrorTitle,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 12),
                      Text(message),
                    ],
                  ),
                ),
              ),
            ),
      ),
    );
  }
}
