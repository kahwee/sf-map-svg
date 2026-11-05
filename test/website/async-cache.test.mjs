import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsyncCache } from '../../website/shared/async-cache.js';

test('concurrent calls share work and successful results remain cached by key', async () => {
  const calls = [];
  const load = createAsyncCache(async (key) => {
    calls.push(key);
    return { key };
  });
  const first = load('a');
  assert.equal(load('a'), first);
  const value = await first;
  assert.equal(await load('a'), value);
  assert.deepEqual(await load('b'), { key: 'b' });
  assert.deepEqual(calls, ['a', 'b']);
});

test('rejected loads are evicted before callers retry, without disturbing other keys', async () => {
  let attempts = 0;
  const load = createAsyncCache(async (key) => {
    if (key === 'bad' && ++attempts === 1) throw new Error('offline');
    return key;
  });
  const good = load('good');
  const failed = load('bad');
  assert.equal(load('bad'), failed);
  await assert.rejects(failed, /offline/);
  assert.equal(await load('bad'), 'bad');
  assert.equal(load('good'), good);
  assert.equal(attempts, 2);
});

test('synchronous loader errors are rejected and can be retried', async () => {
  let attempts = 0;
  const load = createAsyncCache(() => {
    if (++attempts === 1) throw new Error('parse failed');
    return 42;
  });
  await assert.rejects(load('key'), /parse failed/);
  assert.equal(await load('key'), 42);
});

test('site geography retries HTTP and JSON failures, then reuses the successful request', async (t) => {
  const { loadSiteMapData } = await import('../../website/shared/site-map-data.js');
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    if (requests === 1) return new Response('', { status: 503 });
    if (requests === 2) return new Response('invalid JSON');
    return Response.json({ neighborhoods: {}, map: {} });
  });
  await assert.rejects(loadSiteMapData(), /Could not load/);
  await assert.rejects(loadSiteMapData(), SyntaxError);
  const data = await loadSiteMapData();
  assert.equal(await loadSiteMapData(), data);
  assert.equal(requests, 3);
});

test('display maps retry invalid SVG and keep independently cached years', async (t) => {
  const { DOMParser } = await import('@xmldom/xmldom');
  const original = Object.getOwnPropertyDescriptor(globalThis, 'DOMParser');
  Object.defineProperty(globalThis, 'DOMParser', { configurable: true, value: DOMParser });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'DOMParser', original);
    else delete globalThis.DOMParser;
  });
  const { loadDisplayMap } = await import('../../website/shared/display-map.js');
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return new Response(
      requests === 1
        ? '<html/>'
        : '<svg xmlns="http://www.w3.org/2000/svg"><title>Map</title></svg>',
    );
  });
  await assert.rejects(loadDisplayMap(2022), /Invalid/);
  const svg = await loadDisplayMap(2022);
  assert.equal(svg.localName, 'svg');
  assert.equal(await loadDisplayMap(2022), svg);
  await loadDisplayMap(2012);
  assert.equal(requests, 3);
});
