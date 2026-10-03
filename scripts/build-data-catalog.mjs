import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { validateMapFeatureCollection } from './lib/validate-map-geojson.mjs';

const datasets = [
  { file: 'coast', role: 'coast' },
  { file: 'districts-2002', role: 'district' },
  { file: 'districts-2012', role: 'district' },
  { file: 'districts-2022', role: 'district' },
  { file: 'highways', role: 'highway' },
  { file: 'key-roads', role: 'road' },
  { file: 'landmarks', role: 'landmark' },
  { file: 'bart-stations', role: 'station' },
  { file: 'neighborhoods', role: 'neighborhood' },
  { file: 'neighborhoods-analysis', role: 'neighborhood' },
  { file: 'neighborhoods-realtor', role: 'neighborhood' },
  { file: 'guide/coast', role: 'coast' },
  { file: 'guide/highways', role: 'highway' },
  { file: 'guide/highways-detailed', role: 'highway' },
  { file: 'guide/key-roads', role: 'road' },
  { file: 'guide/landmarks', role: 'landmark' },
  { file: 'guide/bart-stations', role: 'station' },
  { file: 'guide/neighborhoods-realtor', role: 'neighborhood' },
];
const collections = await Promise.all(
  datasets.map(async ({ file, role }) => {
    const data = JSON.parse(
      await readFile(new URL(`../data/${file}.json`, import.meta.url), 'utf8'),
    );
    validateMapFeatureCollection(data, role, `${file}.json`);
    return { file: `${file}.json`, data };
  }),
);
const catalog = {
  schemaVersion: 1,
  description:
    'Complete inventories of the three listed neighborhood sources, not a claim that every informal San Francisco neighborhood has one agreed boundary. Canonical names are package display names; sourceName preserves the source label. Aliases aid name lookup and do not establish identical boundaries across sources.',
  datasets: collections
    .filter(({ file }) => !file.startsWith('guide/'))
    .map(({ file, data }) => ({
      id: data.id,
      file,
      title: data.title,
      featureCount: data.features.length,
      definition: data.definition,
      sources: data.sources,
    })),
  neighborhoods: collections
    .filter(
      ({ file, data }) =>
        !file.startsWith('guide/') && ['sf-find', 'analysis', 'realtor'].includes(data.id),
    )
    .flatMap(({ file, data }) =>
      data.features.map((f) => ({
        id: f.id,
        source: data.id,
        file,
        ...f.properties,
        bbox: f.bbox,
      })),
    ),
};
const output = `${JSON.stringify(catalog, null, 2)}\n`;
const target = new URL('../data/catalog.json', import.meta.url);
if (process.argv.includes('--check')) {
  assert.equal(await readFile(target, 'utf8'), output, 'Catalog is stale. Run pnpm data:catalog.');
  console.log(
    `Catalog matches ${catalog.datasets.length} datasets and ${catalog.neighborhoods.length} source-specific neighborhood definitions.`,
  );
} else {
  await writeFile(target, output);
}
