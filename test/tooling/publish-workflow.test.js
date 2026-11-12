import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../.github/workflows/publish.yml', import.meta.url),
  'utf8',
);

function assertIsolated(workflow) {
  const [build, publish] = workflow.split('\n  publish:\n');
  assert.ok(publish, 'publisher must be a separate job');
  assert.doesNotMatch(build, /id-token: write/);
  assert.match(publish, /needs: build/);
  assert.match(publish, /id-token: write/);
  assert.doesNotMatch(publish, /actions\/checkout|pnpm\/action-setup|setup-bun/);
  assert.doesNotMatch(publish, /(?:npm|pnpm|bun) (?:install|ci|run)|node scripts\//);
  assert.match(publish, /npm publish .*--ignore-scripts/);
  assert.match(publish, /--tag latest --registry https:\/\/registry\.npmjs\.org\//);
  assert.match(publish, /sha256sum --check --strict/);
  assert.match(publish, /assert\.deepEqual\(pkg\.publishConfig/);
}

test('publishing authority is isolated from package and dependency code', () => {
  assertIsolated(source);
});

test('rejects moving OIDC or dependency execution back into the build/publish jobs', () => {
  assert.throws(() =>
    assertIsolated(
      source.replace('  build:\n', '  build:\n    permissions:\n      id-token: write\n'),
    ),
  );
  assert.throws(() =>
    assertIsolated(source.replace('  publish:\n', '  publish:\n    run: npm install\n')),
  );
});

test('credential-job metadata check rejects redirected and mismatched packages', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const publish = source.split('\n  publish:\n')[1];
  const script = publish
    .match(/node --input-type=module <<'JS'\n([\s\S]*?)\n {10}JS/)[1]
    .replace(/^ {10}/gm, '');
  const directory = mkdtempSync(join(tmpdir(), 'sf-map-publish-'));
  const valid = {
    name: '@kahwee/sf-map-svg',
    version: '6.0.0',
    publishConfig: {
      access: 'public',
      registry: 'https://registry.npmjs.org/',
    },
  };
  try {
    for (const [pkg, tag, passes] of [
      [valid, 'v6.0.0', true],
      [{ ...valid, name: 'different' }, 'v6.0.0', false],
      [{ ...valid, private: true }, 'v6.0.0', false],
      [valid, 'v6.0.1', false],
      [valid, 'v6.0.0-rc.1', false],
      [
        {
          ...valid,
          publishConfig: {
            ...valid.publishConfig,
            registry: 'https://example.com',
          },
        },
        'v6.0.0',
        false,
      ],
      [{ ...valid, publishConfig: { ...valid.publishConfig, tag: 'other' } }, 'v6.0.0', false],
    ]) {
      writeFileSync(join(directory, 'packed-package.json'), JSON.stringify(pkg));
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        env: { ...process.env, RUNNER_TEMP: directory, RELEASE_TAG: tag },
        encoding: 'utf8',
      });
      assert.equal(result.status === 0, passes, result.stderr);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
