// `pnpm mobile:apk -- --api https://rento.onrender.com` — builds the Android app (release, installable APK) that talks to
// that API. The address is compiled in (README §11.4): the app has no settings screen for it, and no secret goes in.
//
// The APK is signed with the DEBUG key (fine for sideloading a demo; a store release needs its own key: P4-11).
// Output: apps/mobile/build/app/outputs/flutter-apk/app-release.apk, copied to dist/rento-demo.apk.
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { root, run } from './lib/live-stack.mjs';

const args = process.argv.slice(2).filter((a) => a !== '--');
const at = args.indexOf('--api');
const api = at === -1 ? undefined : args[at + 1];
if (!api || !/^https:\/\/[^/\s]+/.test(api)) {
  console.error('✖ Give the live API address: pnpm mobile:apk -- --api https://your-app.onrender.com');
  process.exit(1);
}
const apiBaseUrl = api.replace(/\/+$/, '');

const result = run(
  'flutter',
  [
    'build',
    'apk',
    '--release',
    '--dart-define',
    'FLAVOR=prod',
    '--dart-define',
    `API_BASE_URL=${apiBaseUrl}`,
  ],
  { cwd: path.join(root, 'apps/mobile') },
);
if (result.status !== 0) process.exit(result.status ?? 1);

const built = path.join(root, 'apps/mobile/build/app/outputs/flutter-apk/app-release.apk');
const target = path.join(root, 'dist/rento-demo.apk');
mkdirSync(path.dirname(target), { recursive: true });
copyFileSync(built, target);
console.log(`\n✔ ${target}  (${(statSync(target).size / 1024 / 1024).toFixed(1)} MB) — talks to ${apiBaseUrl}`);
