import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { releaseNotes } from '../scripts/release-notes.mjs';

test('release notes contain every change for the package version and exclude other releases', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const result = releaseNotes(changelog, pkg.version);
  assert.match(result, /Breaking/);
  assert.match(result, /migration-v2/);
  assert.ok(!result.includes('## 1.5.2'));
});
test('missing, duplicate, undated or empty release sections cannot generate notes', () => {
  for (const content of [
    '',
    '## Unreleased\n- change',
    '## 2.0.0 — soon\n- change',
    '## 2.0.0 — 2026-09-27\n',
    '## 2.0.0 — 2026-09-27\n- A\n## 2.0.0 — 2026-09-27\n- B',
  ])
    assert.throws(() => releaseNotes(content, '2.0.0'));
  assert.equal(
    releaseNotes(
      '## Unreleased\n- next\n## 2.0.0 — 2026-09-27\n- A\n\n### Fixed\n- B\n\n## 1.0.0 — 2026-01-01\n- old',
      '2.0.0',
    ),
    '## 2.0.0 — 2026-09-27\n- A\n\n### Fixed\n- B\n',
  );
});
