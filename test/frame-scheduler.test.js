import assert from 'node:assert/strict';
import test from 'node:test';
import { createCamera } from '../dist/src/camera.js';
import { createFrameScheduler } from '../dist/src/frame-scheduler.js';

function rig(render = () => {}) {
  let id = 0;
  const queue = new Map();
  const frames = createFrameScheduler({
    request: (fn) => {
      queue.set(++id, fn);
      return id;
    },
    cancel: (key) => queue.delete(key),
    render,
  });
  return {
    frames,
    queue,
    tick(time = 0) {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback(time);
    },
  };
}

test('camera and invalidated screen-space work share one frame, camera first', () => {
  const order = [];
  const r = rig(() => order.push('render'));
  r.frames.invalidate();
  r.frames.invalidate();
  r.frames.request(() => {
    order.push('camera');
    r.frames.invalidate();
  });
  assert.equal(r.queue.size, 1);
  r.tick();
  assert.deepEqual(order, ['camera', 'render']);
  assert.equal(r.queue.size, 0);
});
test('next camera tick waits for the next frame while current rendering is not deferred', () => {
  const order = [];
  const r = rig(() => order.push('render'));
  r.frames.request(() => {
    order.push('first');
    r.frames.invalidate();
    r.frames.request(() => {
      order.push('second');
      r.frames.invalidate();
    });
  });
  r.tick();
  assert.deepEqual(order, ['first', 'render']);
  assert.equal(r.queue.size, 1);
  r.tick();
  assert.deepEqual(order, ['first', 'render', 'second', 'render']);
});
test('cancelling camera work preserves dirty rendering and ignores obsolete tokens', () => {
  let renders = 0;
  const r = rig(() => renders++);
  const old = r.frames.request(() => assert.fail('obsolete camera'));
  const current = r.frames.request(() => assert.fail('cancelled camera'));
  r.frames.cancel(old);
  r.frames.invalidate();
  r.frames.cancel(current);
  r.tick();
  assert.equal(renders, 1);
  const idle = r.frames.request(() => assert.fail('idle camera'));
  r.frames.cancel(idle);
  assert.equal(r.queue.size, 0);
});
test('destroy during a camera callback prevents rendering and rescheduling', () => {
  const r = rig(() => assert.fail('render after destruction'));
  r.frames.request(() => {
    r.frames.invalidate();
    r.frames.destroy();
    r.frames.request(() => assert.fail('camera after destruction'));
    r.frames.invalidate();
  });
  r.tick();
  assert.equal(r.queue.size, 0);
});
test('invalidation during rendering is retained for the following frame', () => {
  let renders = 0;
  const r = rig(() => {
    if (++renders === 1) r.frames.invalidate();
  });
  r.frames.invalidate();
  r.tick();
  assert.equal(r.queue.size, 1);
  r.tick();
  assert.equal(renders, 2);
  assert.equal(r.queue.size, 0);
});

test('reentrant camera replacement and stop still render the latest committed view', () => {
  let view = [0, 0, 800];
  let rendered;
  let time = 0;
  let first = true;
  const r = rig(() => {
    rendered = [...view];
  });
  const camera = createCamera({
    read: () => view,
    write: (next) => {
      view = next;
      r.frames.invalidate();
      if (first) {
        first = false;
        camera.move([100, 100, 500]);
      } else camera.stop();
    },
    duration: () => 100,
    reduced: () => false,
    request: r.frames.request,
    cancel: r.frames.cancel,
    now: () => time,
  });
  camera.move([200, 200, 400]);
  time = 30;
  r.tick(time);
  assert.deepEqual(rendered, view);
  assert.equal(r.queue.size, 1);
  time = 60;
  r.tick(time);
  assert.deepEqual(rendered, view);
  assert.equal(r.queue.size, 0);
});
