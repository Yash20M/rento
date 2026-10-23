// Fails if regenerating committed generated code changes anything, so a model/ARB edit cannot be committed
// without its generated output (and generated files cannot be hand-edited or left stale).
//
// build_runner's incremental cache trusts its own records and never re-checks output content, so this guard starts
// from a clean slate: it removes the generated files and the build cache, regenerates everything, and compares with
// what was there before. Works without git. If regeneration itself fails, the original files are restored.
//   Usage: node scripts/check-generated.mjs mobile
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const TARGETS = {
  mobile: {
    dir: path.join(root, 'apps', 'mobile'),
    // Generated Dart: freezed / json_serializable parts and the gen-l10n output.
    isGenerated: (file) =>
      /\.(g|freezed)\.dart$/.test(file) ||
      file.includes(`${path.sep}l10n${path.sep}generated${path.sep}`),
    scanRoot: 'lib',
    // Caches that would otherwise let a stale or hand-edited output survive.
    caches: [path.join('.dart_tool', 'build')],
    commands: ['dart run build_runner build --delete-conflicting-outputs', 'flutter gen-l10n'],
    fixHint: 'pnpm mobile:codegen',
  },
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const normalize = (text) => text.replaceAll('\r\n', '\n');
const sha = (text) => createHash('sha256').update(normalize(text)).digest('hex');

/** @returns {Map<string, string>} absolute path → file content */
function readGenerated(target) {
  const files = walk(path.join(target.dir, target.scanRoot)).filter(target.isGenerated);
  return new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));
}

const rel = (file) => path.relative(root, file).split(path.sep).join('/');

const name = process.argv[2] ?? 'mobile';
const target = TARGETS[name];
if (!target) {
  console.error(`unknown target "${name}" (known: ${Object.keys(TARGETS).join(', ')})`);
  process.exit(2);
}

const original = readGenerated(target);

// Clean slate.
for (const file of original.keys()) rmSync(file);
for (const cache of target.caches)
  rmSync(path.join(target.dir, cache), { recursive: true, force: true });

const restore = () => {
  for (const [file, content] of original) writeFileSync(file, content);
};

for (const command of target.commands) {
  console.log(`$ ${command}`);
  // Static commands (no user input); a shell is needed for the Windows .bat shims.
  const result = spawnSync(command, { cwd: target.dir, shell: true, stdio: 'inherit' });
  if (result.status !== 0) {
    restore();
    console.error(`generation failed: ${command} (original files restored)`);
    process.exit(1);
  }
}

const regenerated = readGenerated(target);
const problems = [];
for (const [file, content] of regenerated) {
  if (!original.has(file)) problems.push(`${rel(file)} is new — commit the generated file`);
  else if (sha(original.get(file)) !== sha(content)) {
    problems.push(
      `${rel(file)} differs from a fresh regeneration (stale or hand-edited) — run ${target.fixHint} and commit`,
    );
  }
}
for (const file of original.keys()) {
  if (!existsSync(file)) problems.push(`${rel(file)} is no longer generated — delete it`);
}

if (problems.length > 0) {
  console.error(
    'generated code is out of date (files on disk now hold the fresh output):\n' +
      problems.map((p) => `  - ${p}`).join('\n'),
  );
  process.exit(1);
}
console.log(`generated code is up to date (${regenerated.size} files checked)`);
