import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const root = new URL('../', import.meta.url).pathname;
async function bundle(entry) {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root,
    build: {
      write: false,
      minify: true,
      lib: { entry: new URL(entry, new URL('../', import.meta.url)).pathname, formats: ['es'] },
      rollupOptions: {
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
        },
      },
    },
  });
  const outputs = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  const chunks = new Map(
    outputs.filter((item) => item.type === 'chunk').map((item) => [item.fileName, item]),
  );
  const entryChunk = [...chunks.values()].find((chunk) => chunk.isEntry);
  if (!entryChunk) throw new Error(`No entry chunk emitted for ${entry}`);
  const visit = (chunk, includeDynamic, seen = new Set()) => {
    if (seen.has(chunk.fileName)) return seen;
    seen.add(chunk.fileName);
    for (const path of chunk.imports)
      if (chunks.has(path)) visit(chunks.get(path), includeDynamic, seen);
    if (includeDynamic)
      for (const path of chunk.dynamicImports)
        if (chunks.has(path)) visit(chunks.get(path), includeDynamic, seen);
    return seen;
  };
  const staticFiles = [...visit(entryChunk, false)];
  const allFiles = [...visit(entryChunk, true)];
  const size = (files) =>
    files.reduce((sum, file) => sum + gzipSync(chunks.get(file).code).length, 0);
  const modules = (files) => files.flatMap((file) => Object.keys(chunks.get(file).modules));
  return {
    raw: staticFiles.reduce((sum, file) => sum + Buffer.byteLength(chunks.get(file).code), 0),
    gzip: size(staticFiles),
    detailGzip: size(allFiles) - size(staticFiles),
    files: staticFiles,
    modules: modules(staticFiles),
    dynamicModules: modules(allFiles).filter((module) => !modules(staticFiles).includes(module)),
  };
}

const previous = await bundle('src/interactive.ts');
const guide = await bundle('src/guide.ts');
const selected = guide.modules.map((module) => module.replaceAll('\\', '/'));
const forbidden = selected.filter((module) =>
  /data\/(districts-|neighborhoods\.json|neighborhoods-analysis\.json|catalog\.json)/.test(module),
);
if (forbidden.length)
  throw new Error(`Unexpected geography in the guide entry bundle: ${forbidden.join(', ')}`);
const expected = [
  'coast.json',
  'neighborhoods-realtor.json',
  'landmarks.json',
  'highways.json',
  'key-roads.json',
  'bart-stations.json',
];
const guideDataModules = selected.filter((module) => /\/data\/.*\.json$/.test(module));
if (guideDataModules.length !== expected.length)
  throw new Error(`Unexpected number of static guide data modules: ${guideDataModules.join(', ')}`);
for (const name of expected)
  if (!selected.some((module) => module.endsWith(`/data/guide/${name}`)))
    throw new Error(`Guide overview bundle is missing ${name}`);
const detailModules = guide.dynamicModules.map((module) => module.replaceAll('\\', '/'));
const forbiddenDetail = detailModules.filter((module) =>
  /data\/(districts-|neighborhoods\.json|neighborhoods-analysis\.json|highways\.json)/.test(module),
);
if (forbiddenDetail.length)
  throw new Error(`Unexpected detailed geography emitted: ${forbiddenDetail.join(', ')}`);
const expectedDetails = [
  '/data/coast.json',
  '/data/neighborhoods-realtor.json',
  '/data/landmarks.json',
  '/data/guide/highways-detailed.json',
  '/data/key-roads.json',
  '/data/bart-stations.json',
];
const detailedDataModules = detailModules.filter((module) => /\/data\/.*\.json$/.test(module));
if (detailedDataModules.length !== expectedDetails.length)
  throw new Error(`Unexpected detailed guide data modules: ${detailedDataModules.join(', ')}`);
for (const suffix of expectedDetails)
  if (!detailedDataModules.some((module) => module.endsWith(suffix)))
    throw new Error(`Explicit detail graph is missing ${suffix}`);
const percent = (((previous.gzip - guide.gzip) / previous.gzip) * 100).toFixed(1);
const report = `# Guide bundle size report

Generated ${new Date().toISOString().slice(0, 10)} by \`pnpm report:guide\` with Vite production minification and gzip compression. Each emitted JS chunk is compressed independently. The before measurement uses the compatibility \`@kahwee/sf-map-svg/interactive\` entry; the after measurement uses \`@kahwee/sf-map-svg/guide\` initial static imports.

| Entry | Initial JS, raw | Initial JS, gzip | Explicit detail JS, gzip |
| --- | ---: | ---: | ---: |
| Compatibility interactive (before) | ${(previous.raw / 1024).toFixed(1)} KB | ${(previous.gzip / 1024).toFixed(1)} KB | — |
| Guide preset (after) | ${(guide.raw / 1024).toFixed(1)} KB | ${(guide.gzip / 1024).toFixed(1)} KB | ${(guide.detailGzip / 1024).toFixed(1)} KB |

**Change in initial gzip:** ${percent}% smaller. **500 KB target:** ${guide.gzip < 500 * 1024 ? 'met' : 'not met'}.

The initial guide chunk graph includes only the overview coast, SFAR realtor neighborhoods, major parks, selected highways, six selected streets, and BART points. It excludes historical districts, SF Find neighborhoods, analysis neighborhoods, and the full catalog. Detailed coast, selected SFAR boundaries, parks, selected highway routes, streets, and BART data are in dynamic chunks and load only when \`loadGuideDetailedData()\` is called. The data inclusion assertions run as part of this report command.

## Emitted entry chunks

${guide.files.map((file) => `- \`${file}\``).join('\n')}
`;
await import('node:fs/promises').then(({ mkdir, writeFile }) =>
  mkdir(new URL('../docs/', import.meta.url), { recursive: true }).then(() =>
    writeFile(new URL('../docs/guide-bundle-report.md', import.meta.url), report),
  ),
);
console.log(`Compatibility entry: ${(previous.gzip / 1024).toFixed(1)} KB gzip`);
console.log(
  `Guide initial entry: ${(guide.gzip / 1024).toFixed(1)} KB gzip; detail on request: ${(guide.detailGzip / 1024).toFixed(1)} KB gzip`,
);
console.log(`Dataset inclusion verified; wrote docs/guide-bundle-report.md`);
