import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const files = [
  'coast',
  'districts-2002',
  'districts-2012',
  'districts-2022',
  'highways',
  'landmarks',
  'bart-stations',
  'neighborhoods',
  'neighborhoods-analysis',
  'neighborhoods-realtor',
];
const collections = await Promise.all(
  files.map(async (file) => ({
    file: `${file}.json`,
    data: JSON.parse(await readFile(new URL(`../data/${file}.json`, import.meta.url), 'utf8')),
  })),
);
const catalog = {
  schemaVersion: 1,
  description:
    'Complete inventories of the three listed neighborhood sources, not a claim that every informal San Francisco neighborhood has one agreed boundary. Canonical names are package display names; sourceName preserves the source label. Aliases aid name lookup and do not establish identical boundaries across sources.',
  datasets: collections.map(({ file, data }) => ({
    id: data.id,
    file,
    title: data.title,
    featureCount: data.features.length,
    definition: data.definition,
    sources: data.sources,
  })),
  neighborhoods: collections
    .filter(({ data }) => ['sf-find', 'analysis', 'realtor'].includes(data.id))
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
