import { readFile, writeFile, rename } from 'node:fs/promises';
import assert from 'node:assert/strict';
import polygonClipping from 'polygon-clipping';
import { findOverlaps, removeOverlaps } from './lib/topology.js';

const file = new URL('../data/neighborhoods-realtor.json', import.meta.url);
const original = JSON.parse(await readFile(file, 'utf8'));
const overlaps = findOverlaps(original.features);
if (!overlaps.length) {
  console.log('All 92 realtor neighborhoods have disjoint interiors. No changes needed.');
} else {
  const result = removeOverlaps(original);
  assert.deepEqual(findOverlaps(result.features), []);
  const before = polygonClipping.union(...original.features.map((f) => f.geometry.coordinates));
  const after = polygonClipping.union(...result.features.map((f) => f.geometry.coordinates));
  assert.deepEqual(
    polygonClipping.xor(before, after),
    [],
    'Normalization must preserve the combined geographic footprint.',
  );
  result.definition.description =
    '92 areas based on the August 2010 San Francisco Association of Realtors dataset, with boundary slivers normalized to disjoint interiors. These market-area definitions are not a universal neighborhood consensus.';
  result.topology = {
    policy: 'disjoint-interiors',
    sharedBoundariesAllowed: true,
    method:
      'Subtract previously assigned geometry in ascending stable-ID order; no rounding or buffering. Verify empty intersections and unchanged combined footprint.',
    tool: 'polygon-clipping 0.15.7',
    processedAt: '2026-09-25',
    sourceOverlapPairs: overlaps.length,
  };
  const geometries = [];
  const text = JSON.stringify(
    result,
    (key, value) => {
      if (key === 'geometry') return `__GEOMETRY_${geometries.push(value) - 1}__`;
      return value;
    },
    2,
  ).replace(/"__GEOMETRY_(\d+)__"/g, (_, index) => JSON.stringify(geometries[Number(index)]));
  const temporary = new URL(`${file.href}.tmp`);
  await writeFile(temporary, `${text}\n`);
  await rename(temporary, file);
  console.log(
    `Removed ${overlaps.length} overlapping pairs; all 92 neighborhoods and the combined footprint are preserved. Run pnpm data:catalog.`,
  );
}
