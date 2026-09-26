import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

const released = process.argv.includes('--released');
let temporary;
try {
  let packageRoot = resolve('.');
  if (released) {
    const version =
      process.env.PAGES_VERSION ||
      execFileSync('npm', ['view', '@kahwee/sf-map-svg', 'version'], {
        encoding: 'utf8',
      }).trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable npm release');
    temporary = await mkdtemp(join(tmpdir(), 'sf-map-pages-'));
    execFileSync(
      'npm',
      [
        'install',
        '--prefix',
        temporary,
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
        `@kahwee/sf-map-svg@${version}`,
      ],
      { stdio: 'inherit' },
    );
    packageRoot = join(temporary, 'node_modules/@kahwee/sf-map-svg');
  }
  const { version } = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable package version');
  const releaseLabel = released ? `v${version} · Available on npm` : `v${version} · Local preview`;
  await build({
    configFile: false,
    root: 'website',
    base: './',
    resolve: {
      alias: {
        '@kahwee/sf-map-svg/explorer': join(packageRoot, 'dist/src/explorer.js'),
        '@kahwee/sf-map-svg/transit': join(packageRoot, 'dist/src/transit.js'),
        '@kahwee/sf-map-svg': join(packageRoot, 'dist/src/index.js'),
      },
    },
    plugins: [
      {
        name: 'release-metadata',
        transformIndexHtml: (html) =>
          html.replaceAll('%MAP_VERSION%', version).replaceAll('%RELEASE_LABEL%', releaseLabel),
      },
    ],
    build: {
      outDir: '../pages-dist',
      emptyOutDir: true,
      rollupOptions: {
        input: ['website/index.html', 'website/transit.html', 'website/measures.html'],
      },
    },
  });
  const { renderSFMap } = await import(pathToFileURL(join(packageRoot, 'dist/src/index.js')).href);
  await mkdir('pages-dist/maps', { recursive: true });
  for (const [name, options] of Object.entries({
    districts: {},
    transit: {
      theme: 'transit',
      keyRoads: true,
      districtLines: false,
      districtLabels: false,
      landmarks: true,
      bartStations: true,
      highways: true,
    },
    neighborhoods: { neighborhoodLines: true },
  })) {
    await writeFile(`pages-dist/maps/${name}.svg`, renderSFMap({ ...options, idPrefix: name }));
  }
  await mkdir('pages-dist/data', { recursive: true });
  await cp('data/elections/2026-06-02.json', 'pages-dist/data/measures-2026-06-02.json');
  await cp('docs/map-preview.png', 'pages-dist/social-preview.png');
  await writeFile(
    'pages-dist/release.json',
    `${JSON.stringify({ version, source: released ? 'npm' : 'local' })}\n`,
  );
  console.log(`Pages built with ${releaseLabel}`);
} finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
