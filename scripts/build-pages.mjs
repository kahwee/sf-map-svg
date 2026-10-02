import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { candidateInks, diverging, sequential } from '../website/palette.js';
import { buildLlmDocs } from './build-llm-docs.mjs';
import { checkPlaygroundCode } from './check-playground-code.mjs';
import { getMapCapabilities } from './map-capabilities.mjs';
import { simplifySvg } from './simplify-svg.mjs';
import { simplifyDataset } from './site-data.mjs';

const siteUrl = 'https://kahwee.github.io/sf-map-svg/';
const repository = 'https://github.com/kahwee/sf-map-svg';

// Display maps render at most ~700 CSS px from an 800-unit view box, so 0.3 units
// stays under half a device pixel even at 2x. Thumbnails render near 200 px.
const displayTolerance = 0.3;
const thumbTolerance = 1.2;
const darkWaterColor = '#122a30';
/** Dark twin of a pre-rendered map: only the water changes, like inline maps in dark mode. */
const darkWater = (svg) =>
  svg.replace(/(<rect width="\d+" height="\d+" fill=")#[0-9a-f]{6}("\/>)/, `$1${darkWaterColor}$2`);

// ---------- Shared page chrome ----------

/** Every page, its section in the masthead, and whether it belongs in the sitemap. */
const pages = [
  { file: 'index.html', section: 'atlas' },
  { file: 'layers.html', section: 'layers' },
  { file: 'playground.html', section: 'playground' },
  { file: 'examples.html', section: 'examples' },
  { file: 'measures.html', section: 'examples' },
  { file: 'propositions.html', section: 'examples' },
  { file: 'candidates.html', section: 'examples' },
  { file: 'spot.html', section: 'examples' },
  { file: 'transit.html', section: 'examples' },
  { file: 'docs.html', section: 'docs' },
  { file: 'api.html', section: 'api' },
  { file: '404.html', section: '', sitemap: false },
];
const sections = [
  ['atlas', './', 'Atlas'],
  ['layers', './layers.html', 'Layers'],
  ['playground', './playground.html', 'Playground'],
  ['examples', './examples.html', 'Examples'],
  ['docs', './docs.html', 'Docs'],
  ['api', './api.html', 'API'],
];

const themeToggle =
  '<button class="theme-toggle" type="button" aria-pressed="false" aria-label="Dark theme">' +
  '<svg viewBox="0 0 24 24" aria-hidden="true"><mask id="theme-toggle-mask">' +
  '<rect width="24" height="24" fill="#fff"/><circle class="tt-cut" cx="25" cy="3" r="7" fill="#000"/></mask>' +
  '<circle class="tt-core" cx="12" cy="12" r="5" fill="currentColor" mask="url(#theme-toggle-mask)"/>' +
  '<path class="tt-rays" d="M12 1.5v2.2M12 20.3v2.2M1.5 12h2.2M20.3 12h2.2M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg></button>';

function masthead(section) {
  const links = sections
    .map(
      ([id, href, label]) =>
        `<a href="${href}"${id === section ? ' aria-current="page"' : ''}>${label}</a>`,
    )
    .join('');
  return `<a class="skip" href="#content">Skip to content</a><header class="masthead"><div class="dateline shell"><span>An atlas of San Francisco in SVG</span><span>%RELEASE_LABEL%</span></div><div class="masthead-bar shell"><a class="wordmark" href="./" aria-label="SF / SVG home">SF<span aria-hidden="true"> / </span>SVG</a><nav aria-label="Main navigation">${links}</nav><div class="masthead-end"><a class="masthead-github" href="${repository}">GitHub ↗</a>${themeToggle}</div></div></header>`;
}

const colophon = `<footer class="colophon" data-rule><div class="shell colophon-grid"><div class="colophon-mark"><a class="wordmark" href="./">SF<span aria-hidden="true"> / </span>SVG</a><p>Offline, dependency-free SVG maps of San Francisco. Software under the MIT license; geography retains its sources’ terms.</p></div><nav aria-label="The atlas"><h2>The atlas</h2><a href="./">Home</a><a href="./layers.html">Layers &amp; divisions</a><a href="./playground.html">Map design playground</a><a href="./spot.html">One spot, three San Franciscos</a></nav><nav aria-label="Examples"><h2>Examples</h2><a href="./measures.html">Local measures</a><a href="./propositions.html">California propositions</a><a href="./candidates.html">Supervisorial votes</a><a href="./examples.html">All examples</a></nav><nav aria-label="Reference"><h2>Reference</h2><a href="./docs.html">Documentation</a><a href="./api.html">API reference</a><a href="${repository}/blob/main/SOURCES.md">Geographic sources</a><a href="${repository}/blob/main/CHANGELOG.md">Changelog</a></nav></div><p class="shell colophon-line">Set in your system’s serif and sans. Geography from DataSF, the San Francisco Association of Realtors, and BART. %RELEASE_LABEL%.</p></footer>`;

const arrowDirections = { '→': 'e', '▶': 'e', '↗': 'ne', '↓': 's', '←': 'w' };
const attribute = (value) =>
  value
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/gi, '&amp;')
    .replaceAll('"', '&quot;');

/** Social tags for pages that do not declare their own, from title, description, and canonical. */
function socialTags(page) {
  if (page.includes('property="og:title"')) return '';
  const title = page.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = page.match(/<meta name="description" content="([^"]+)">/)?.[1];
  const url = page.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  if (!title || !url) return '';
  return [
    `<meta property="og:title" data-generated-social content="${attribute(title)}">`,
    description ? `<meta property="og:description" content="${description}">` : '',
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${siteUrl}social-preview.png">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('');
}

/** Masthead, colophon, icon, theme color, social tags, boot script, motion, arrows, split titles. */
function addSiteChrome(html, boot, file) {
  const section = pages.find((page) => page.file === file)?.section ?? '';
  let page = html
    .replace('<!--site-header-->', masthead(section))
    .replace('<!--site-footer-->', colophon)
    .replace(
      '<link rel="icon" href="data:,">',
      '<link rel="icon" href="./favicon.svg" type="image/svg+xml">',
    );
  page = page.replace(
    '</head>',
    `${socialTags(page)}<link rel="describedby" href="./llms.txt">${['docs.html', 'api.html', 'examples.html'].includes(file) ? `<link rel="alternate" type="text/markdown" href="./${file.replace('.html', '.md')}">` : ''}<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f7f3e9"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#121816"><script>${boot}</script><link rel="expect" href="#page-end" blocking="render"><link rel="stylesheet" href="./site.css"></head>`,
  );
  page = page.replace(
    '</body>',
    '<span id="page-end" hidden></span><script type="module" src="./motion.js"></script></body>',
  );
  page = page.replace(
    / ([→▶↗↓←])(?=<\/)/g,
    (_, arrow) =>
      `<span class="arrow" data-dir="${arrowDirections[arrow]}" aria-hidden="true">${arrow}</span>`,
  );
  return page.replace(/<h1([^>]*?) data-split([^>]*)>([^<]+)<\/h1>/g, (_, before, after, text) => {
    const words = text
      .trim()
      .split(/\s+/)
      .map((word, index) => `<span class="w"><span style="--i:${index}">${word}</span></span>`);
    return `<h1${before}${after} class="split"><span class="sr-only">${text}</span><span aria-hidden="true">${words.join(' ')}</span></h1>`;
  });
}

// ---------- Pre-rendered plates and figures ----------

const share = (row) => (row && row.yes + row.no ? row.yes / (row.yes + row.no) : null);
const spread = (rows) => {
  const values = rows.map(share).filter((value) => value !== null);
  return Math.max(...values) - Math.min(...values);
};

/** Pick the most geographically divided item so the teaser plates show real variation. */
async function examplePlates() {
  const catalog = JSON.parse(await readFile('data/elections/catalog.json', 'utf8'));
  const latest = catalog.elections.find((item) => item.districtYear === 2022);
  const election = JSON.parse(await readFile(`data/elections/${latest.data}`, 'utf8'));
  const measure = election.measures.toSorted(
    (a, b) => spread(b.districts) - spread(a.districts),
  )[0];
  const propositionFile = (await readFile('data/propositions/2024-11-05.json', 'utf8')).toString();
  const propositions = JSON.parse(propositionFile).propositions;
  const proposition = propositions.toSorted((a, b) => spread(b.districts) - spread(a.districts))[0];
  const candidates = JSON.parse(await readFile('data/candidates/2026-06-02.json', 'utf8'));
  const leaders = (contest) =>
    new Set(
      contest.districts
        .filter((row) => row.totalVotes)
        .map((row) => row.votes.indexOf(Math.max(...row.votes))),
    ).size;
  const contest = candidates.contests
    .filter((item) => item.districts.every((row) => row.totalVotes))
    .toSorted((a, b) => leaders(b) - leaders(a))[0];
  const low = Math.min(...measure.districts.map(share));
  const high = Math.max(...measure.districts.map(share));
  return {
    measures: {
      year: 2022,
      style: (d) => ({
        fill: sequential(
          (share(measure.districts.find((row) => row.district === d.id)) - low) / (high - low),
        ),
      }),
    },
    propositions: {
      year: 2022,
      style: (d) => ({
        fill: diverging(share(proposition.districts.find((row) => row.district === d.id))),
      }),
    },
    candidates: {
      year: candidates.districtYear,
      style: (d) => {
        const row = contest.districts.find((item) => item.district === d.id);
        const top = Math.max(...row.votes);
        return { fill: candidateInks[row.votes.indexOf(top) % candidateInks.length] };
      },
    },
  };
}

async function writePlate(name, svg) {
  await writeFile(`pages-dist/maps/plates/${name}.svg`, svg);
  await writeFile(`pages-dist/maps/plates/${name}-dark.svg`, darkWater(svg));
}

// ---------- Build ----------

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
  const { version, exports: packageExports } = JSON.parse(
    await readFile(join(packageRoot, 'package.json'), 'utf8'),
  );
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable package version');
  const releaseLabel = released ? `v${version} · on npm` : `v${version} · local preview`;
  const capabilities = await getMapCapabilities(packageRoot);
  await checkPlaygroundCode(packageRoot, capabilities);
  const referenceStatus = `<p class="shell reference-version" role="note">This reference describes <code>@kahwee/sf-map-svg ${version}</code>${released ? ', the version used throughout this site' : ' from the local working tree'}. Examples and options below match this version.</p>`;
  const boot = await readFile('website/boot.js', 'utf8');
  await build({
    configFile: false,
    root: 'website',
    base: './',
    logLevel: 'warn',
    resolve: {
      alias: {
        '@kahwee/sf-map-svg/static': join(packageRoot, packageExports['./static'].import),
        '@kahwee/sf-map-svg/data/static': join(packageRoot, packageExports['./data/static'].import),
        '@kahwee/sf-map-svg/geometry': join(packageRoot, 'dist/src/geometry.js'),
        '@kahwee/sf-map-svg/transit': join(packageRoot, 'dist/src/transit.js'),
        '@kahwee/sf-map-svg': join(packageRoot, packageExports['.'].import),
      },
    },
    plugins: [
      {
        name: 'package-capabilities',
        transform(_code, id) {
          if (id === resolve('website/site-capabilities.js'))
            return {
              code: `export const mapCapabilities = ${JSON.stringify(capabilities)};`,
              map: null,
            };
        },
      },
      {
        name: 'site-chrome',
        transformIndexHtml: {
          order: 'pre',
          handler: (html, context) => addSiteChrome(html, boot, basename(context.filename)),
        },
      },
      {
        name: 'release-metadata',
        transformIndexHtml: (html) =>
          html
            .replaceAll('%MAP_VERSION%', version)
            .replaceAll('%RELEASE_LABEL%', releaseLabel)
            .replaceAll(
              '%STATIC_MARKERS_TYPE%',
              capabilities.staticPresentation ? 'readonly MapMarker[]' : 'MapMarker[]',
            )
            .replaceAll('<!--reference-version-->', referenceStatus)
            .replaceAll(
              '%APPEARANCE_SHORT%',
              capabilities.runtimeAppearance
                ? 'Update live with configure.'
                : 'Set at construction.',
            )
            .replaceAll(
              '%APPEARANCE_HELP%',
              capabilities.runtimeAppearance
                ? 'Update with <code>map.configure({ appearance })</code> while preserving camera, selection and focus. Token objects merge by key; <code>appearance: undefined</code> resets the group.'
                : 'Appearance is set at construction. Recreate the map to change its palette and typography.',
            )
            .replaceAll(
              '%CONFIGURATION_KEYS%',
              capabilities.runtimeAppearance
                ? 'features?, layers?, controls?, appearance?, mode?, source?, year?, labels?'
                : 'features?, layers?, controls?',
            )
            .replaceAll(
              '%CONFIGURATION_SNAPSHOT%',
              capabilities.runtimeAppearance
                ? 'Detached feature, layer, control and appearance overrides. Styling callbacks keep their identity.'
                : 'Detached copy of features, layers and controls.',
            )
            .replaceAll(
              '%RUNTIME_HELP%',
              capabilities.runtimeAppearance
                ? 'Update <code>layers</code>, <code>controls</code>, <code>features</code>, <code>appearance</code>, mode, source, year and labels with <code>map.configure()</code>. Live appearance retains camera, selection and focus. Try it in the <a href="./playground.html">map design playground</a>.'
                : 'Options are grouped: <code>layers</code>, <code>controls</code> and <code>features</code> can change with <code>map.configure()</code>; appearance is set at construction. Explore palettes in the <a href="./playground.html">map design playground</a>.',
            )
            .replaceAll(
              '<!--static-presentation-->',
              capabilities.staticPresentation
                ? '<tr><td><code>layers</code>, <code>appearance</code></td><td>StaticMapLayers, StaticMapAppearance</td><td>Shared presentation vocabulary. Grouped keys override flat keys; static appearance supports theme, colors and districtStyle. Neighborhood labels remain browser-only.</td></tr>'
                : '',
            )
            .replaceAll(
              '<!--configuration-inspection-->',
              capabilities.runtimeAppearance
                ? '<tr><td><code>getResolvedConfiguration</code></td><td>() → ResolvedMapConfiguration</td><td>Current mode/source/year/labels and effective layer switches; label collision and zoom rules still apply.</td></tr><tr><td><code>getCapabilities</code></td><td>() → MapCapabilities</td><td>Supplied sources, years and layer data availability, independent of visibility.</td></tr>'
                : '',
            )
            .replaceAll(
              '<!--selection-envelope-->',
              capabilities.runtimeAppearance
                ? '<tr><td><code>selectionchange</code></td><td>{ kind, current, previous }</td><td>Common detached envelope for marker, neighborhood and district selection; null clears. Existing change events retain their payloads.</td></tr>'
                : '',
            ),
      },
    ],
    build: {
      outDir: '../pages-dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1600,
      rollupOptions: { input: pages.map((page) => `website/${page.file}`) },
    },
  });

  const [{ renderMap }, { fullMapData }] = await Promise.all([
    import(pathToFileURL(join(packageRoot, packageExports['./static'].import)).href),
    import(pathToFileURL(join(packageRoot, packageExports['./data/full'].import)).href),
  ]);

  // The simplified dataset powers createMap on the atlas, layers, and spot pages.
  const site = simplifyDataset(fullMapData);
  await mkdir('pages-dist/data', { recursive: true });
  await writeFile('pages-dist/data/site-map.json', JSON.stringify(site));
  // Full precision is fetched only when the design playground exports an SVG.
  await writeFile(
    'pages-dist/data/export-map.json',
    JSON.stringify({ map: fullMapData.map, neighborhoods: fullMapData.neighborhoods }),
  );

  // Full-precision downloads, display copies, and thumbnails with dark twins.
  for (const folder of ['display', 'thumb', 'plates', 'figures'])
    await mkdir(`pages-dist/maps/${folder}`, { recursive: true });
  for (const [name, options] of Object.entries({
    districts: {},
    'districts-2002': { year: 2002 },
    'districts-2012': { year: 2012 },
    'districts-2022': { year: 2022 },
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
    const svg = renderMap(fullMapData.map, { ...options, idPrefix: name }).svg;
    await writeFile(`pages-dist/maps/${name}.svg`, svg);
    if (name.startsWith('districts-'))
      await writeFile(`pages-dist/maps/display/${name}.svg`, simplifySvg(svg, displayTolerance));
    if (name.startsWith('districts-') || name === 'transit') {
      const thumb = simplifySvg(svg, name === 'transit' ? 0.6 : thumbTolerance);
      await writeFile(`pages-dist/maps/thumb/${name}.svg`, thumb);
      await writeFile(`pages-dist/maps/thumb/${name}-dark.svg`, darkWater(thumb));
    }
  }

  // Animated plates, drawn by renderMap's own `animation` option.
  const plate = (options) => simplifySvg(renderMap(site.map, options).svg, displayTolerance);
  await writePlate(
    'hero',
    plate({
      idPrefix: 'plate-hero',
      animation: { duration: 3600, delay: 200 },
      neighborhoodLines: true,
      landmarks: true,
      highways: true,
      bartStations: true,
      labels: false,
      title: 'San Francisco: coast, districts, SFAR neighborhoods, parks, highways and BART',
    }),
  );
  for (const [name, { year, style }] of Object.entries(await examplePlates()))
    await writePlate(
      name,
      plate({
        idPrefix: `plate-${name}`,
        year,
        districtStyle: style,
        districtLabels: false,
        animation: { duration: 2200 },
        title: `${name} example map`,
      }),
    );

  // Docs figures: one small map per layer and division.
  const neighborhoodsFrom = (source) =>
    site.neighborhoods[source].features.map((feature) => ({
      name: feature.properties.canonicalName,
      geometry: feature.geometry,
    }));
  const bare = { districtFills: false, districtLines: false, districtLabels: false };
  const figures = {
    coast: { ...bare },
    'districts-2002': { year: 2002, districtLabels: false },
    'districts-2012': { year: 2012, districtLabels: false },
    'districts-2022': { year: 2022, districtLabels: false },
    realtor: {
      ...bare,
      neighborhoodLines: true,
      map: { neighborhoods: neighborhoodsFrom('realtor') },
    },
    'sf-find': {
      ...bare,
      neighborhoodLines: true,
      map: { neighborhoods: neighborhoodsFrom('sf-find') },
    },
    analysis: {
      ...bare,
      neighborhoodLines: true,
      map: { neighborhoods: neighborhoodsFrom('analysis') },
    },
    parks: { ...bare, landmarks: true, labels: false },
    roads: { ...bare, highways: true, keyRoads: true, labels: false },
    bart: { ...bare, bartStations: true, labels: false },
  };
  for (const [name, { map: overrides, ...options }] of Object.entries(figures)) {
    const svg = simplifySvg(
      renderMap({ ...site.map, ...overrides }, { ...options, idPrefix: `figure-${name}` }).svg,
      thumbTolerance,
    );
    await writeFile(`pages-dist/maps/figures/${name}.svg`, svg);
    await writeFile(`pages-dist/maps/figures/${name}-dark.svg`, darkWater(svg));
  }

  await cp('data/elections', 'pages-dist/data/elections', { recursive: true });
  await cp('data/propositions', 'pages-dist/data/propositions', { recursive: true });
  await cp('data/candidates', 'pages-dist/data/candidates', { recursive: true });
  await cp('docs/map-preview.png', 'pages-dist/social-preview.png');
  await writeFile(
    'pages-dist/sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
      .filter((page) => page.sitemap !== false)
      .map(
        (page) =>
          `  <url><loc>${siteUrl}${page.file === 'index.html' ? '' : page.file}</loc></url>`,
      )
      .join('\n')}\n</urlset>\n`,
  );
  for (const [name, content] of await buildLlmDocs(packageRoot, { released }))
    await writeFile(join('pages-dist', name), content);
  await writeFile(
    'pages-dist/release.json',
    `${JSON.stringify({ version, source: released ? 'npm' : 'local' })}\n`,
  );
  console.log(`Pages built with ${releaseLabel}`);
} finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
