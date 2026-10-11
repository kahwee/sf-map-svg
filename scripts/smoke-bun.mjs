import assert from 'node:assert/strict';
import { createMap, renderMap } from '../dist/src/api.js';
import { staticMapData } from '../dist/src/static-data.js';

assert.equal(typeof createMap, 'function');
const options = { year: 2022, landmarks: true, bartStations: true, idPrefix: 'bun-smoke' };
const result = renderMap(staticMapData, options);
assert.match(result.svg, /<svg\b/);
assert.match(result.svg, /data-layer="landmarks"/);
assert.ok(result.project([-122.43, 37.76]).every(Number.isFinite));
assert.equal(result.svg, renderMap(staticMapData, options).svg);
console.log(`Bun ${Bun.version}: compiled ESM/JSON imports, static SVG, and projection passed.`);
