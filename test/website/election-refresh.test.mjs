import assert from 'node:assert/strict';
import test from 'node:test';
import { createRefreshController, isOlderSnapshot } from '../../website/election/refresh.js';

test('manual, due timer and visibility requests share one in-flight fetch', async () => {
  let release;
  let calls = 0;
  let now = 0;
  const controller = createRefreshController(
    () => {
      calls++;
      return new Promise((resolve) => {
        release = resolve;
      });
    },
    { now: () => now, interval: 100 },
  );
  const first = controller.run();
  await Promise.resolve();
  now = 200;
  assert.equal(controller.run(), first);
  assert.equal(controller.ifDue(), first);
  assert.equal(calls, 1);
  release();
  await first;
});

test('hidden tabs wait; returning visible refreshes only when due', async () => {
  let now = 0;
  let calls = 0;
  const controller = createRefreshController(
    () => {
      calls++;
    },
    { now: () => now, interval: 100 },
  );
  await controller.run();
  now = 99;
  await controller.ifDue();
  assert.equal(calls, 1);
  now = 101;
  await controller.ifDue(false);
  assert.equal(calls, 1);
  await controller.ifDue(true);
  assert.equal(calls, 2);
  await controller.ifDue(true);
  assert.equal(calls, 2);
});

test('failed refresh releases the gate for the next attempt', async () => {
  let calls = 0;
  const controller = createRefreshController(() => {
    if (++calls === 1) throw Error('network');
  });
  await assert.rejects(controller.run(), /network/);
  await controller.run();
  assert.equal(calls, 2);
});

test('older or missing check timestamps cannot replace known newer data', () => {
  const current = { checkedAt: '2026-11-04T06:00:00Z' };
  assert.equal(isOlderSnapshot(current, { checkedAt: '2026-11-04T05:59:59Z' }), true);
  assert.equal(isOlderSnapshot(current, { checkedAt: null }), true);
  assert.equal(isOlderSnapshot(current, { checkedAt: current.checkedAt }), false);
  assert.equal(isOlderSnapshot(current, { checkedAt: '2026-11-04T06:01:00Z' }), false);
  assert.equal(isOlderSnapshot(undefined, { checkedAt: null }), false);
});
