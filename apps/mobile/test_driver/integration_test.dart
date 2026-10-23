import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

/// Runs the integration tests through `flutter drive` so the screenshots they take land on disk:
/// `SHOT_DIR` (default `build/live-shots`) receives one PNG per `takeScreenshot(name)`.
Future<void> main() => integrationDriver(
  onScreenshot: (name, bytes, [args]) async {
    final dir = Platform.environment['SHOT_DIR'] ?? 'build/live-shots';
    File('$dir/$name.png')
      ..createSync(recursive: true)
      ..writeAsBytesSync(bytes);
    return true;
  },
);
