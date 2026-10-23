import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../../src/common/errors/error-codes';
import { RetryLaterError, SlotTakenError } from '../../src/db/errors';

const repoRoot = path.resolve(__dirname, '../../../..');
const read = (...parts: string[]) =>
  readFileSync(path.join(repoRoot, ...parts), 'utf8').replaceAll('\r\n', '\n');

const adrDir = path.join(repoRoot, 'docs', 'adr');
const adrFiles = readdirSync(adrDir)
  .filter((name) => /^ADR-\d{3}-.+\.md$/.test(name))
  .sort();
const STATUS_WORDS = ['Accepted', 'Proposed'];

/** `| **Status** | Accepted (2026-10-11) |` → "Accepted" */
function adrStatus(markdown: string): string | undefined {
  return /^\|\s*\*\*Status\*\*\s*\|\s*(\w+)/m.exec(markdown)?.[1];
}

describe('error catalog (docs/api/error-catalog.md)', () => {
  const catalog = read('docs', 'api', 'error-catalog.md');
  const rows = [...catalog.matchAll(/^\|\s*([\d/]+)\s*\|\s*`([A-Z_]+)`\s*\|/gm)].map((m) => ({
    http: m[1] as string,
    code: m[2] as string,
  }));
  const catalogCodes = rows.map((row) => row.code);

  it('T-05 documents exactly the ErrorCode values, each once', () => {
    expect(new Set(catalogCodes).size, 'duplicate code in catalog').toBe(catalogCodes.length);
    expect([...catalogCodes].sort()).toEqual(Object.values(ErrorCode).sort());
  });

  it('T-06 matches README §14.2', () => {
    const readme = read('README.md');
    const section = readme.slice(readme.indexOf('### 14.2'), readme.indexOf('### 14.3'));
    const readmeCodes = [...section.matchAll(/`([A-Z][A-Z_]{2,})`/g)].map((m) => m[1] as string);
    expect([...new Set(readmeCodes)].sort()).toEqual([...catalogCodes].sort());
  });

  it('T-07 HTTP statuses agree with the implemented domain errors', () => {
    const statusOf = (code: string) => rows.find((row) => row.code === code)?.http;
    expect(statusOf('BOOKING_SLOT_TAKEN')).toBe(String(new SlotTakenError().status));
    expect(statusOf('RETRY_LATER')).toBe(String(new RetryLaterError().status));
    expect(statusOf('INTERNAL_ERROR')).toBe('500');
  });
});

describe('ADRs (docs/adr)', () => {
  it('T-01 contains ADR-001…ADR-015, one file each', () => {
    const numbers = adrFiles.map((name) => name.slice(4, 7));
    expect(numbers).toEqual(Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(3, '0')));
  });

  it.each(adrFiles)('T-02 %s is well-formed', (name) => {
    const markdown = read('docs', 'adr', name);
    expect(markdown.split('\n')[0]).toMatch(new RegExp(`^# ADR-${name.slice(4, 7)} — .+`));
    expect(STATUS_WORDS).toContain(adrStatus(markdown));
    for (const heading of ['## Context', '## Decision', '## Consequences']) {
      expect(markdown, `${name} is missing "${heading}"`).toContain(heading);
    }
    if (adrStatus(markdown) === 'Proposed') {
      expect(markdown, `${name} must say what makes it Accepted`).toMatch(/Status note|Evidence/);
    }
  });

  it('T-03 README §19.4 rows match the files (ids, links, statuses)', () => {
    const readme = read('README.md');
    const rows = [
      ...readme.matchAll(
        /^\| \[ADR-(\d{3})\]\(([^)]+)\) \|.*\| (Accepted|Proposed)[^|]*\|[^|]*\|$/gm,
      ),
    ].map((m) => ({ id: m[1] as string, link: m[2] as string, status: m[3] as string }));
    expect(rows.map((row) => row.id)).toEqual(adrFiles.map((name) => name.slice(4, 7)));
    for (const row of rows) {
      const file = path.join(repoRoot, row.link);
      expect(existsSync(file), `${row.link} does not exist`).toBe(true);
      expect(adrStatus(readFileSync(file, 'utf8'))).toBe(row.status);
    }
  });

  it('T-04 the docs/adr index lists all ADRs with the files’ statuses', () => {
    const index = read('docs', 'adr', 'README.md');
    const rows = [
      ...index.matchAll(/^\| \[ADR-(\d{3})\]\(([^)]+)\) \|.*\| (Accepted|Proposed) \|$/gm),
    ].map((m) => ({ id: m[1] as string, link: m[2] as string, status: m[3] as string }));
    expect(rows).toHaveLength(15);
    for (const row of rows) {
      expect(adrStatus(read('docs', 'adr', row.link)), `index status for ADR-${row.id}`).toBe(
        row.status,
      );
    }
  });
});

describe('links', () => {
  const markdownFiles = [
    ...adrFiles.map((name) => path.join('docs', 'adr', name)),
    path.join('docs', 'adr', 'README.md'),
    path.join('docs', 'api', 'conventions.md'),
    path.join('docs', 'api', 'error-catalog.md'),
  ];

  it.each(markdownFiles)('T-08 every relative link in %s resolves', (file) => {
    const markdown = read(file);
    const links = [...markdown.matchAll(/\]\((?!https?:|mailto:|#)([^)#\s]+)(?:#[^)]*)?\)/g)].map(
      (m) => m[1] as string,
    );
    for (const link of links) {
      const target = path.resolve(repoRoot, path.dirname(file), link);
      expect(existsSync(target), `${file} → ${link}`).toBe(true);
    }
  });
});
