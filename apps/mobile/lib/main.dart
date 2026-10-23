import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'app/config/env.dart';
import 'app/env_error_app.dart';
import 'app/providers.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  final AppEnv env;
  try {
    env = AppEnv.fromDefines();
  } on EnvException catch (error) {
    runApp(EnvErrorApp(message: error.message));
    return;
  }

  runApp(
    ProviderScope(
      // Failures are shown with a "Try again" button; no silent background retries.
      retry: (_, _) => null,
      overrides: [envProvider.overrideWithValue(env)],
      child: const RentoApp(),
    ),
  );
}
