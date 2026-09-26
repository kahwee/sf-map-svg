import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(join(tmpdir(), 'sf-map-package-'));
const [flag, archiveArgument, ...extra] = process.argv.slice(2);
assert(
  !flag || (flag === '--archive' && archiveArgument && !extra.length),
  'Usage: node scripts/smoke-package.mjs [--archive package.tgz]',
);
try {
  let archive;
  if (archiveArgument) {
    archive = resolve(archiveArgument);
  } else {
    execFileSync('pnpm', ['pack', '--pack-destination', temp], { cwd: root, stdio: 'inherit' });
    const archives = (await readdir(temp)).filter((file) => file.endsWith('.tgz'));
    assert.equal(archives.length, 1);
    archive = join(temp, archives[0]);
  }
  await writeFile(join(temp, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', archive],
    { cwd: temp, stdio: 'inherit' },
  );
  const installed = join(temp, 'node_modules/@kahwee/sf-map-svg');
  const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  assert.equal(manifest.license, 'MIT');
  assert.deepEqual(
    Object.keys(manifest.dependencies ?? {}),
    [],
    'Keep runtime dependencies at zero',
  );
  for (const exported of Object.values(manifest.exports)) {
    if (typeof exported === 'object' && exported.types) {
      assert((await readFile(join(installed, exported.types), 'utf8')).length > 0);
    }
  }
  assert.match(await readFile(join(installed, 'LICENSE'), 'utf8'), /MIT License/);
  await writeFile(
    join(temp, 'smoke.mjs'),
    `
import assert from 'node:assert/strict';
import { renderSFMap } from '@kahwee/sf-map-svg';
import { neighborhoods, getNeighborhood } from '@kahwee/sf-map-svg/data';
import * as geometry from '@kahwee/sf-map-svg/geometry';
import { createNeighborhoodExplorer } from '@kahwee/sf-map-svg/explorer';
import { createInteractiveSFMap } from '@kahwee/sf-map-svg/interactive';
import realtor from '@kahwee/sf-map-svg/data/neighborhoods-realtor.json' with { type: 'json' };
assert.match(renderSFMap({ landmarks: true, bartStations: true }), /<svg/);
assert.equal(neighborhoods.features.length, 92);
assert.equal(realtor.features.length, 92);
assert.equal(getNeighborhood('NoPa').properties.canonicalName, 'North Panhandle');
assert(Object.keys(geometry).length > 0);
assert.equal(typeof createNeighborhoodExplorer, 'function');
assert.equal(typeof createInteractiveSFMap, 'function');
console.log('Installed package entrypoints, JSON, rendering, aliases, and explorer import passed.');
`,
  );
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: temp, stdio: 'inherit' });
  await writeFile(
    join(temp, 'consumer.mts'),
    `
import { renderSFMap, type SFMapOptions } from '@kahwee/sf-map-svg';
import { getNeighborhood, type NeighborhoodSource } from '@kahwee/sf-map-svg/data';
import { createNeighborhoodExplorer } from '@kahwee/sf-map-svg/explorer';
import { createInteractiveSFMap } from '@kahwee/sf-map-svg/interactive';
import * as geometry from '@kahwee/sf-map-svg/geometry';
const options: SFMapOptions = { width: 390, landmarks: true, bartStations: true };
const source: NeighborhoodSource = 'realtor';
const svg: string = renderSFMap(options);
const name: string | undefined = getNeighborhood('NoPa', { source })?.properties.canonicalName;
const explorer: typeof createNeighborhoodExplorer = createNeighborhoodExplorer;
void [svg, name, explorer, geometry, createInteractiveSFMap];
`,
  );
  execFileSync(
    join(root, 'node_modules/.bin/tsc'),
    [
      '--noEmit',
      '--strict',
      '--module',
      'nodenext',
      '--target',
      'es2023',
      join(temp, 'consumer.mts'),
    ],
    { cwd: temp, stdio: 'inherit' },
  );
  console.log('Installed package TypeScript declarations passed.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
