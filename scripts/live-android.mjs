// `pnpm test:live-android` — runs the REAL Flutter app on an Android emulator or phone against the REAL API and a
// throw-away database (see scripts/lib/live-stack.mjs). The app's integration tests (apps/mobile/integration_test) sign
// in as the demo customer, edit the profile, and so on; screenshots land in apps/mobile/build/live-shots.
//
//   pnpm test:live-android                     first connected device / running emulator
//   pnpm test:live-android -- -d emulator-5554 pick a device (extra arguments go to `flutter test`)
//   pnpm test:live-android --shots docs/ui/after   also save the screenshots the journeys take (uses `flutter drive`)
//
// Start an emulator first (Android Studio → Device Manager, or `emulator -avd <name>`). The emulator reaches this
// computer as 10.0.2.2, so the API listens on all interfaces for the duration of the run.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { root, run, withLiveStack } from './lib/live-stack.mjs';

const devices = spawnSync('adb', ['devices'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
if (devices.status !== 0 || !/\tdevice\b/.test(devices.stdout ?? '')) {
  console.error(
    '✖ No Android device or emulator is connected (`adb devices` is empty). Start one first.',
  );
  process.exit(1);
}

await withLiveStack({ host: '0.0.0.0' }, async (stack) => {
  stack.say('Running the app on the device');
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const shotsAt = args.indexOf('--shots');
  const shots = shotsAt === -1 ? undefined : path.resolve(args[shotsAt + 1] ?? 'docs/ui/after');
  const extra = shotsAt === -1 ? args : args.filter((_, i) => i !== shotsAt && i !== shotsAt + 1);
  const result = run(
    'flutter',
    [
      ...(shots
        ? [
            'drive',
            '--driver=test_driver/integration_test.dart',
            '--target=integration_test/account_journey_test.dart',
          ]
        : ['test', 'integration_test']),
      '--dart-define',
      `API_BASE_URL=http://10.0.2.2:${stack.apiPort}`,
      '--dart-define',
      'LIVE_EMAIL=demo.customer@rento.demo',
      '--dart-define',
      `LIVE_PASSWORD=${stack.demoPassword}`,
      ...extra,
    ],
    {
      cwd: path.join(root, 'apps/mobile'),
      env: { ...process.env, ...(shots && { SHOT_DIR: shots }) },
    },
  );
  return result.status ?? 1;
});
