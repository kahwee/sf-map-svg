import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlaygroundHistory } from '../website/playground/history.ts';
import { initialState } from '../website/playground/model.ts';

test('history isolates snapshots and discards redo only after a new edit', () => {
  const initial = initialState();
  const history = createPlaygroundHistory(initial);
  const next = structuredClone(initial);
  next.title = 'Second design';
  history.record(next);
  next.colors.water = '#000000';
  const restored = history.undo();
  assert.deepEqual(restored, initial);
  restored.colors.water = '#ffffff';
  history.record(initial);
  assert.equal(history.canRedo, true);
  assert.notEqual(history.redo().colors.water, next.colors.water);
  history.undo();
  history.record({ ...initial, title: 'New branch' });
  assert.equal(history.canRedo, false);
  assert.equal(history.redo(), undefined);
  assert.deepEqual(history.undo(), initial);
  assert.equal(history.undo(), undefined);
});

test('history retains at most 60 snapshots including the current design', () => {
  const state = initialState();
  const history = createPlaygroundHistory(state);
  for (let index = 1; index <= 70; index++) history.record({ ...state, title: String(index) });
  const restored = [];
  while (history.canUndo) restored.push(history.undo().title);
  assert.equal(restored.length, 59);
  assert.equal(restored.at(-1), '11');
  let last;
  while (history.canRedo) last = history.redo();
  assert.equal(last.title, '70');
});
