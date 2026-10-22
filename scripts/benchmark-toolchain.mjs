import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { arch, platform, release } from 'node:os';
import { join, relative } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const options = process.argv.slice(2);
assert(
  options.every((option) => /^--samples=\d+$/.test(option)),
  'Use --samples=N',
);
const sampleCount = Number(options[0]?.split('=')[1] ?? 3);
assert(Number.isInteger(sampleCount) && sampleCount >= 1 && sampleCount <= 20);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trim();
}

async function outputDigest(directory = join(root, 'dist')) {
  const files = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) {
        files.push([
          relative(directory, file),
          createHash('sha256')
            .update(await readFile(file))
            .digest('hex'),
        ]);
      }
    }
  }
  await visit(directory);
  assert(files.length > 0, 'The library build must emit files');
  files.sort(([a], [b]) => a.localeCompare(b));
  return createHash('sha256').update(JSON.stringify(files)).digest('hex');
}

const report = {
  scope:
    'Library compilation only; excludes unchanged demos, Storybook, Pages, and archive prepack',
  platform: `${platform()} ${release()} ${arch()}`,
  node: process.version,
  bun: run('bun', ['--version']),
  pnpm: run('pnpm', ['--version']),
  base_commit: run('git', ['rev-parse', 'HEAD']),
  working_tree_modified: run('git', ['status', '--porcelain']).length > 0,
  command: 'pnpm build',
  samples: [],
};
let reference;
for (let sample = 1; sample <= sampleCount; sample++) {
  const cases = [
    ['repeated_builds', 4],
    ['reused_build', 1],
  ];
  if (sample % 2 === 0) cases.reverse();
  for (const [name, count] of cases) {
    const start = performance.now();
    for (let repeat = 0; repeat < count; repeat++) run('pnpm', ['build']);
    const seconds = Number(((performance.now() - start) / 1000).toFixed(3));
    const digest = await outputDigest();
    reference ??= digest;
    assert.equal(digest, reference, 'Build outputs changed across benchmark cases');
    report.samples.push({
      sample,
      case: name,
      library_build_invocations: count,
      seconds,
      outputs_identical: true,
    });
  }
}
console.log(JSON.stringify(report, null, 2));
