import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// The whole repository's gates run side by side, so a screen can need longer than the default second to appear on a busy
// machine. Waiting longer never hides a failure: an element that never appears still fails the test.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
});
