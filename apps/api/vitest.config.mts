import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC is required: esbuild does not emit decorator metadata, which Nest DI depends on.
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['test/unit/**/*.unit.spec.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'api',
          include: ['test/api/**/*.api.spec.ts'],
          // API tests run against a real PostGIS database (plan §6); files that don't need it ignore it.
          globalSetup: ['test/support/db/global-setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 180_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          include: ['test/db/**/*.db.spec.ts'],
          globalSetup: ['test/support/db/global-setup.ts'],
          testTimeout: 60_000,
          hookTimeout: 180_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'concurrency',
          include: ['test/concurrency/**/*.concurrency.spec.ts'],
          globalSetup: ['test/support/db/global-setup.ts'],
          // Run alone: CPU noise from parallel files must not cause (or hide) timing-dependent failures.
          fileParallelism: false,
          testTimeout: 120_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
});
