import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildLlmDocs } from '../scripts/build-llm-docs.mjs';

test('npm documentation uses installed contracts without borrowing newer checkout guides', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sf-llm-docs-'));
  try {
    await mkdir(join(root, 'docs'));
    await mkdir(join(root, 'dist'));
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        name: '@kahwee/sf-map-svg',
        version: '3.0.1',
        engines: { node: '>=24.0.0' },
        exports: { '.': { types: './dist/api.d.ts' } },
      }),
    );
    await writeFile(join(root, 'README.md'), '# Installed overview\n');
    await writeFile(join(root, 'SOURCES.md'), '# Installed sources\n');
    await writeFile(join(root, 'CHANGELOG.md'), '# Installed changelog\n');
    await writeFile(
      join(root, 'docs/consumer-integration.md'),
      '# Installed guide\n[Overview](../README.md)\n',
    );
    await writeFile(
      join(root, 'dist/api.d.ts'),
      "export type { OldOptions } from './options.js';\n",
    );
    await writeFile(
      join(root, 'dist/options.d.ts'),
      'export interface OldOptions { labels?: boolean; }\n',
    );
    const docs = await buildLlmDocs(root, { released: true });
    const full = docs.get('llms-full.txt');
    assert.match(full, /3\.0\.1 · npm package/);
    assert.match(full, /interface OldOptions/);
    assert.doesNotMatch(full, /districtMorph|local working tree|# Developer guide/);
    assert.match(docs.get('developer-guide.md'), /Installed guide/);
    assert.match(full, /blob\/v3\.0\.1\/README\.md/);
    for (const [, path] of docs
      .get('llms.txt')
      .matchAll(/\]\(https:\/\/kahwee\.github\.io\/sf-map-svg\/([^)]+)\)/g)) {
      assert.ok(docs.has(path), `Missing linked document: ${path}`);
    }
    await assert.rejects(buildLlmDocs(root), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
