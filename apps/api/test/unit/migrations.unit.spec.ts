import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from '../../src/db/migrate';

const files = readdirSync(MIGRATIONS_DIR)
  .filter((name) => !name.startsWith('.'))
  .sort();

describe('migration files (forward-only, README §4.3)', () => {
  it('U-01a at least the baseline exists', () => {
    expect(files).toContain('0001_baseline.sql');
  });

  it('U-01b are named NNNN_snake_case.sql', () => {
    for (const name of files) expect(name).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
  });

  it('U-01c numbering is gapless from 0001', () => {
    const numbers = files.map((name) => Number.parseInt(name.slice(0, 4), 10));
    expect(numbers).toEqual(numbers.map((_, index) => index + 1));
  });

  it.each(files)('U-01d %s has no down section', (name) => {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
    expect(sql).not.toMatch(/^\s*--\s*Down Migration/im);
  });
});
