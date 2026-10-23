import { it } from 'vitest';
import { runIsolationScenario } from '../support/db/isolation-scenario';

it('D-16b file B sees only its own data', async () => {
  await runIsolationScenario('file-b');
});
