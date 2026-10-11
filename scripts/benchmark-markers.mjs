import { mkdir, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release } from 'node:os';
import { dirname } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import { startBrowserFixture } from './serve-browser-fixture.mjs';

const options = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
);
const samples = Number(options.samples ?? 20);
const warmup = 3;
const labels = options.labels !== 'false';
const reportPath = options.output ?? 'test-results/marker-benchmark.json';
const counts = (options.counts ?? '500,2000').split(',').map(Number);
const widths = (options.widths ?? '800,390').split(',').map(Number);
const engines = { chromium, firefox, webkit };
const browsers = (options.browsers ?? 'chromium').split(',');
if (
  !Number.isInteger(samples) ||
  samples < 5 ||
  counts.some((n) => !Number.isInteger(n) || n < 1) ||
  widths.some((n) => !Number.isInteger(n) || n < 100) ||
  browsers.some((name) => !Object.hasOwn(engines, name)) ||
  (options.labels !== undefined && !['true', 'false'].includes(options.labels))
)
  throw new Error(
    'Use --samples=20 --counts=500,2000 --widths=800,390 --browsers=chromium,firefox,webkit',
  );

const report = {
  date: new Date().toISOString(),
  environment: {
    node: process.version,
    os: `${platform()} ${release()} ${arch()}`,
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
  },
  samples,
  warmup,
  labels,
  methodology:
    'Production bundle; imports/fonts loaded before timing. Synthetic 50-column grid, clustering initially enabled, motion disabled. Sync measures call plus forced layout; settled includes two animation frames (not GPU paint). Six continuous scenarios: pan by ±2 screen px, zoom by reciprocal 1.2× factors, or resize host by 80 px each frame, with clustering on/off; each uses four initial frame callbacks followed by 60 measured intervals. Counts are sampled before/after, not during frame timing. No timing assertions.',
  results: [],
};
const { server, url } = await startBrowserFixture();
try {
  for (const name of browsers) {
    const browser = await engines[name].launch();
    try {
      for (const width of widths)
        for (const count of counts) {
          const page = await browser.newPage({
            viewport: { width, height: 900 },
            reducedMotion: 'reduce',
          });
          const errors = [];
          page.on('pageerror', (error) => errors.push(error.message));
          try {
            await page.goto(url);
            await page.waitForFunction(() => !!window.harness);
            const result = await page.evaluate(
              async ({ count, samples, warmup, labels }) => {
                const { mount, grid, settle } = window.harness;
                await document.fonts.ready;
                const pins = grid(count);
                const changed = grid(count, 1);
                const replacement = pins.map((pin) => ({ ...pin, id: `new-${pin.id}` }));
                mount({ markers: pins, labels });
                await settle();
                const operations = {
                  mount: {
                    prepare: () => {
                      window.map.destroy();
                      document.querySelector('#host').replaceChildren();
                    },
                    run: () => mount({ markers: pins, labels }),
                  },
                  pan: {
                    prepare: () => window.map.camera.set([100, 100, 400]),
                    run: () => window.map.camera.pan(20, 10),
                  },
                  zoom: {
                    prepare: () => window.map.camera.reset(),
                    run: () => window.map.camera.zoom(1.5),
                  },
                  'clustering off': {
                    prepare: () => window.map.configure({ features: { clustering: true } }),
                    run: () => window.map.configure({ features: { clustering: false } }),
                  },
                  'update retained IDs': {
                    prepare: () => window.map.setMarkers(pins),
                    run: () => window.map.setMarkers(changed),
                  },
                  'replace all IDs': {
                    prepare: () => window.map.setMarkers(pins),
                    run: () => window.map.setMarkers(replacement),
                  },
                  'identical update': {
                    prepare: () => window.map.setMarkers(pins),
                    run: () => window.map.setMarkers(pins),
                  },
                };
                const stats = (values) => {
                  const sorted = [...values].sort((a, b) => a - b);
                  const percentile = (p) =>
                    Number(sorted[Math.ceil(p * sorted.length) - 1].toFixed(2));
                  return { p50: percentile(0.5), p95: percentile(0.95), max: percentile(1) };
                };
                const timings = {};
                for (const [name, operation] of Object.entries(operations)) {
                  const sync = [],
                    settled = [];
                  for (let index = 0; index < warmup + samples; index++) {
                    // Every operation begins from the same camera/clustering/marker state.
                    window.map.configure({ features: { clustering: true } });
                    window.map.camera.reset();
                    operation.prepare();
                    await settle();
                    const start = performance.now();
                    operation.run();
                    window.map.element.getBoundingClientRect();
                    const called = performance.now() - start;
                    await settle();
                    if (index >= warmup) {
                      sync.push(called);
                      settled.push(performance.now() - start);
                    }
                  }
                  timings[name] = { syncMs: stats(sync), settledMs: stats(settled) };
                }
                // Each frame interval includes the previous frame's map work.
                // Four initial frame callbacks precede 60 measured intervals per scenario.
                const host = document.querySelector('#host');
                const originalWidth = host.style.width;
                const hostWidth = host.getBoundingClientRect().width;
                const mounted = () => ({
                  pins: window.map.element.querySelectorAll('[data-marker-id]').length,
                  clusters: window.map.element.querySelectorAll('[data-cluster-ids]').length,
                });
                const frameScenarios = {};
                let domNodes;
                for (const clustering of [true, false]) {
                  for (const action of ['pan', 'rapid zoom', 'resize']) {
                    host.style.width = originalWidth;
                    window.map.setMarkers(pins);
                    window.map.configure({ features: { clustering } });
                    window.map.camera.set([100, 100, 400]);
                    await settle();
                    const start = mounted();
                    const intervals = [];
                    let previous;
                    for (let index = 0; index < 64; index++) {
                      const now = await new Promise(requestAnimationFrame);
                      if (index > 3) intervals.push(now - previous);
                      previous = now;
                      if (action === 'pan') window.map.camera.pan(index % 2 ? 2 : -2, 0);
                      else if (action === 'rapid zoom')
                        window.map.camera.zoom(index % 2 ? 1 / 1.2 : 1.2);
                      else
                        host.style.width =
                          index % 2 ? originalWidth : `${Math.max(100, hostWidth - 80)}px`;
                    }
                    await settle();
                    const name = `${clustering ? 'clustered' : 'unclustered'} ${action}`;
                    frameScenarios[name] = { frameMs: stats(intervals), start, end: mounted() };
                    if (name === 'clustered pan')
                      domNodes = window.map.element.querySelectorAll('*').length;
                  }
                }
                host.style.width = originalWidth;
                await settle();
                const viewportStates = [];
                for (const clustering of [true, false]) {
                  window.map.configure({ features: { clustering } });
                  for (const view of [
                    [0, 0, 800],
                    [100, 100, 400],
                    [200, 200, 200],
                  ]) {
                    window.map.camera.set(view);
                    await settle();
                    viewportStates.push({
                      clustering,
                      view,
                      pins: window.map.element.querySelectorAll('[data-marker-id]').length,
                      clusters: window.map.element.querySelectorAll('[data-cluster-ids]').length,
                      pickerOptions: window.map.element.querySelectorAll(
                        '.sf-explorer-feature-controls select',
                      )[1].options.length,
                    });
                  }
                }
                // Separate, untimed allocation probe: include detached pin nodes.
                const originalCreate = document.createElementNS;
                const created = [];
                const allocationStates = [];
                document.createElementNS = function (...args) {
                  const node = originalCreate.apply(this, args);
                  if (args[1] === 'g') created.push(node);
                  return node;
                };
                try {
                  const recordAllocation = (stage) =>
                    allocationStates.push({
                      stage,
                      createdPins: created.filter((node) => node.hasAttribute('data-marker-id'))
                        .length,
                      ...mounted(),
                    });
                  mount({ markers: pins, labels });
                  await settle();
                  recordAllocation('clustered mount');
                  window.map.setMarkers(replacement);
                  await settle();
                  recordAllocation('replace all IDs');
                  window.map.selectMarker(replacement[0].id, { fit: false });
                  await settle();
                  recordAllocation('select first pin');
                } finally {
                  document.createElementNS = originalCreate;
                }
                window.map.destroy();
                return {
                  timings,
                  panFrameMs: frameScenarios['clustered pan'].frameMs,
                  frameScenarios,
                  domNodes,
                  viewportStates,
                  allocationStates,
                };
              },
              { count, samples, warmup, labels },
            );
            if (errors.length) throw new Error(errors.join('\n'));
            report.results.push({
              browser: name,
              version: browser.version(),
              width,
              count,
              ...result,
            });
            console.log(
              `${name} ${width}px / ${count} markers: mount p50 ${result.timings.mount.syncMs.p50}ms, pan frame p95 ${result.panFrameMs.p95}ms`,
            );
          } finally {
            await page.close();
          }
        }
    } finally {
      await browser.close();
    }
  }
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Full results: ${reportPath}`);
} finally {
  await server.close();
}
