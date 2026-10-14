import assert from 'node:assert/strict';
import test from 'node:test';
import { spreadLabels } from '../dist/src/label-spread.js';

const label = (name, x, y, kind = 'neighborhood') => ({ name, point: [x, y], kind });
const labels = [
  label('cluster1', 10, 10),
  label('cluster2', 12, 12),
  label('east', 90, 10),
  label('south', 50, 90),
];
test('limited labels cover the map rather than consuming the budget in one cluster', () => {
  assert.deepEqual(
    spreadLabels(labels, 3, [], 100, 100).map((p) => p.name),
    ['cluster1', 'south', 'east'],
  );
  assert.deepEqual(spreadLabels(labels, undefined, [], 100, 100), labels);
  assert.deepEqual(spreadLabels(labels, 0, [], 100, 100), []);
});
test('nearby pins influence the first label and a selected marker keeps priority', () => {
  assert.equal(spreadLabels(labels, 1, [[89, 12]], 100, 100)[0].name, 'east');
  const selected = label('Selected place', 50, 50, 'selected-marker');
  const result = spreadLabels([...labels, selected], 2, [[89, 12]], 100, 100);
  assert.equal(result[0], selected);
  assert.equal(result.length, 2);
  assert.equal(new Set(result).size, result.length);
});
test('spatial selection is scale independent and does not mutate the candidates', () => {
  const before = structuredClone(labels);
  const result = spreadLabels(labels, 3, [[89, 12]], 100, 100).map((p) => p.name);
  const scaled = labels.map((p) => ({ ...p, point: p.point.map((v) => v * 2) }));
  assert.deepEqual(
    spreadLabels(scaled, 3, [[178, 24]], 200, 200).map((p) => p.name),
    result,
  );
  assert.deepEqual(labels, before);
});
