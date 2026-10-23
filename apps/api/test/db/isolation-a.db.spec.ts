import { it } from 'vitest';
import { runIsolationScenario } from '../support/db/isolation-scenario';

it('D-16a file A sees only its own data', async () => {
  await runIsolationScenario('file-a');
});
