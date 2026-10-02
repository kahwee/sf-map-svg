import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkPlaygroundCode } from './check-playground-code.mjs';
import { getMapCapabilities } from './map-capabilities.mjs';

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
  const assistantDocs = await readFile(join(installed, 'llms-full.txt'), 'utf8');
  assert.ok(assistantDocs.includes(`@kahwee/sf-map-svg ${manifest.version} ·`));
  const documentedModules = [];
  for (const document of ['README.md', 'docs/developer-guide.md', 'docs/consumer-integration.md']) {
    const markdown = await readFile(join(installed, document), 'utf8');
    const recipe = [...markdown.matchAll(/```ts\n([\s\S]*?)```/g)]
      .map(([, code]) => code)
      .filter((code) => !code.includes('node:fs'))
      .join('\n');
    assert.ok(recipe.trim(), `${document} must contain a typed recipe`);
    const filename = join(
      temp,
      `documented-${document.replaceAll('/', '-').replace('.md', '.mts')}`,
    );
    await writeFile(filename, recipe);
    documentedModules.push(filename);
  }
  execFileSync(
    join(root, 'node_modules/.bin/tsc'),
    [
      '--noEmit',
      '--strict',
      '--exactOptionalPropertyTypes',
      '--noUncheckedIndexedAccess',
      '--module',
      'nodenext',
      '--target',
      'es2023',
      ...documentedModules,
    ],
    { cwd: temp, stdio: 'inherit' },
  );
  for (const removed of [
    './legacy',
    './custom-map',
    './explorer',
    './interactive',
    './interactive-data',
  ])
    assert.equal(manifest.exports[removed], undefined, `${removed} must be removed`);
  await writeFile(
    join(temp, 'smoke.mjs'),
    `
import assert from 'node:assert/strict';
import { createMap, renderMap } from '@kahwee/sf-map-svg';
import { fullMapData } from '@kahwee/sf-map-svg/data/full';
import { staticMapData } from '@kahwee/sf-map-svg/data/static';
import { neighborhoods, getNeighborhood } from '@kahwee/sf-map-svg/data';
import * as geometry from '@kahwee/sf-map-svg/geometry';
import { createGuideMap, createGuideController, mountGuideController, guideMapData, loadGuideDetailedData } from '@kahwee/sf-map-svg/guide';
import { createGuideSVG, createGuideShell } from '@kahwee/sf-map-svg/guide/static';
import realtor from '@kahwee/sf-map-svg/data/neighborhoods-realtor.json' with { type: 'json' };
import candidates from '@kahwee/sf-map-svg/data/candidates/2024-11-05.json' with { type: 'json' };
assert.equal(typeof createMap, 'function');
assert.match(renderMap(fullMapData.map, { landmarks: true, bartStations: true }).svg, /<svg/);
assert.equal(
  renderMap(staticMapData, { idPrefix: 'smoke-static' }).svg,
  renderMap(fullMapData.map, { idPrefix: 'smoke-static' }).svg,
);
assert.match(createGuideSVG().svg, /<svg/);
assert.match(createGuideShell(), /sf-guide-shell/);
assert.equal(neighborhoods.features.length, 92);
assert.equal(realtor.features.length, 92);
assert.equal(candidates.contests.length, 9);
assert.equal(getNeighborhood('NoPa').properties.canonicalName, 'North Panhandle');
assert(Object.keys(geometry).length > 0);
assert.equal(typeof createGuideMap, 'function');
assert.equal(typeof createGuideController, 'function');
assert.equal(typeof mountGuideController, 'function');
assert.equal(typeof loadGuideDetailedData, 'function');
assert.equal(guideMapData.neighborhoods.realtor.features.length, 92);
console.log('Installed package entrypoints, JSON, rendering, aliases, and guide import passed.');
`,
  );
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: temp, stdio: 'inherit' });
  await writeFile(
    join(temp, 'consumer.mts'),
    `
import { createMap, renderMap, type MapOptions, type StaticMapOptions } from '@kahwee/sf-map-svg';
import { fullMapData } from '@kahwee/sf-map-svg/data/full';
import { staticMapData } from '@kahwee/sf-map-svg/data/static';
import { getNeighborhood, type NeighborhoodSource } from '@kahwee/sf-map-svg/data';
import { createGuideMap, createGuideController, mountGuideController, guideMapData, loadGuideDetailedData } from '@kahwee/sf-map-svg/guide';
import * as geometry from '@kahwee/sf-map-svg/geometry';
const options: MapOptions = { features: { motion: true }, appearance: { colors: { water: '#fff' } } };
const controller = () => createMap(fullMapData, options);
const guideController = () => createGuideController(options);
const liveContract = () => {
  const map = controller();
  map.configure({ mode: 'districts', year: 2012, appearance: { colors: { water: '#123456' } } });
  map.configure({ appearance: undefined, layers: undefined, controls: undefined, features: undefined });
  map.configure({ appearance: { colors: { water: undefined }, labelStyle: { fontWeight: undefined }, labelSize: { min: undefined }, style: { ink: undefined }, areaStyle: { selectedFill: undefined } }, layers: { bartStations: undefined }, controls: { zoom: undefined } });
  map.getResolvedConfiguration().layers.bartStations satisfies boolean;
  map.getCapabilities().sources satisfies readonly NeighborhoodSource[];
  map.on('selectionchange', (event) => {
    if (event.kind === 'marker') event.current?.lng satisfies number | undefined;
  });
};
const shellController = (shell: HTMLElement) => mountGuideController(shell, options);
const staticOptions: StaticMapOptions = { layers: { bartStations: true }, appearance: { colors: { water: '#123456' } }, markers: [{ id: 'readonly', lng: -122.4, lat: 37.76 }] as const, width: 390, landmarks: true, bartStations: true, overlays: [{ id: 'route', geometry: { type: 'LineString', coordinates: [[-122.4, 37.7], [-122.41, 37.71]] } }] };
const svg: string = renderMap(fullMapData.map, staticOptions).svg;
const staticSvg: string = renderMap(staticMapData).svg;
const source: NeighborhoodSource = 'realtor';
const name: string | undefined = getNeighborhood('NoPa', { source })?.properties.canonicalName;
void [controller, liveContract, svg, staticSvg, name, geometry, createGuideMap, loadGuideDetailedData, guideMapData];
`,
  );
  execFileSync(
    join(root, 'node_modules/.bin/tsc'),
    [
      '--noEmit',
      '--strict',
      '--exactOptionalPropertyTypes',
      '--noUncheckedIndexedAccess',
      '--module',
      'nodenext',
      '--target',
      'es2023',
      join(temp, 'consumer.mts'),
    ],
    { cwd: temp, stdio: 'inherit' },
  );
  console.log('Installed package TypeScript declarations passed.');
  await checkPlaygroundCode(installed, await getMapCapabilities(installed));
} finally {
  await rm(temp, { recursive: true, force: true });
}
