import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { simplifySvg } from './simplify-svg.mjs';

// Display maps render at most ~700 CSS px from an 800-unit view box, so 0.3 units
// stays under half a device pixel even at 2x. Thumbnails render near 125 px.
const displayTolerance = 0.3;
const thumbTolerance = 1.2;
/** Dark thumbnail: only the water changes, matching inline maps in dark mode. */
const darkWater = (svg) =>
  svg.replace(/(<rect width="800" height="800" fill=")#[0-9a-f]{6}("\/>)/, '$1#10242a$2');

const themeToggle =
  '<button class="theme-toggle" type="button" aria-pressed="false" aria-label="Dark theme">' +
  '<svg viewBox="0 0 24 24" aria-hidden="true"><mask id="theme-toggle-mask">' +
  '<rect width="24" height="24" fill="#fff"/><circle class="tt-cut" cx="25" cy="3" r="7" fill="#000"/></mask>' +
  '<circle class="tt-core" cx="12" cy="12" r="5" fill="currentColor" mask="url(#theme-toggle-mask)"/>' +
  '<path class="tt-rays" d="M12 1.5v2.2M12 20.3v2.2M1.5 12h2.2M20.3 12h2.2M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg></button>';
const arrowDirections = { '→': 'e', '▶': 'e', '↗': 'ne', '↓': 's' };

const siteUrl = 'https://kahwee.github.io/sf-map-svg/';
const attribute = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

/** Social tags for pages that do not declare their own, from title, description, and canonical. */
function socialTags(page) {
  if (page.includes('property="og:title"')) return '';
  const title = page.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = page.match(/<meta name="description" content="([^"]+)">/)?.[1];
  const url = page.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  if (!title || !url) return '';
  return [
    `<meta property="og:title" content="${attribute(title)}">`,
    description ? `<meta property="og:description" content="${description}">` : '',
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${siteUrl}social-preview.png">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('');
}

/** Shared page chrome: icon, theme color, social tags, boot script, motion, arrows, split titles. */
function addSiteChrome(html, boot) {
  let page = html.replace(
    '<link rel="icon" href="data:,">',
    '<link rel="icon" href="./favicon.svg" type="image/svg+xml">',
  );
  page = page.replace(
    '</head>',
    `${socialTags(page)}<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f8f8f2"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0e1a1a"><script>${boot}</script><link rel="expect" href="#page-end" blocking="render"><link rel="stylesheet" href="./motion.css"></head>`,
  );
  page = page.replace(
    '</body>',
    '<span id="page-end" hidden></span><script type="module" async src="./motion.js"></script></body>',
  );
  const githubEnd = /(<a [^>]*>GitHub ↗<\/a>)\s*<\/nav>/;
  page = githubEnd.test(page)
    ? page.replace(githubEnd, `<span class="nav-end">$1${themeToggle}</span></nav>`)
    : page.replace('</nav>', `</nav>${themeToggle}`);
  page = page.replace(
    / ([→▶↗↓])(?=<\/)/g,
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
  const releaseLabel = released ? `v${version} · Available on npm` : `v${version} · Local preview`;
  const boot = await readFile('website/boot.js', 'utf8');
  await build({
    configFile: false,
    root: 'website',
    base: './',
    resolve: {
      alias: {
        '@kahwee/sf-map-svg/custom-map': join(packageRoot, 'dist/src/custom-map.js'),
        '@kahwee/sf-map-svg/guide': join(packageRoot, 'dist/src/guide.js'),
        '@kahwee/sf-map-svg/explorer': join(packageRoot, 'dist/src/explorer.js'),
        '@kahwee/sf-map-svg/geometry': join(packageRoot, 'dist/src/geometry.js'),
        '@kahwee/sf-map-svg/legacy': join(packageRoot, 'dist/src/index.js'),
        '@kahwee/sf-map-svg/transit': join(packageRoot, 'dist/src/transit.js'),
        '@kahwee/sf-map-svg': join(packageRoot, packageExports['.'].import),
      },
    },
    plugins: [
      {
        name: 'site-chrome',
        transformIndexHtml: { order: 'pre', handler: (html) => addSiteChrome(html, boot) },
      },
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
        input: [
          'website/index.html',
          'website/transit.html',
          'website/measures.html',
          'website/propositions.html',
          'website/candidates.html',
          'website/spot.html',
          'website/examples.html',
          'website/404.html',
        ],
      },
    },
  });
  const { renderSFMap } = await import(pathToFileURL(join(packageRoot, 'dist/src/index.js')).href);
  await mkdir('pages-dist/maps/display', { recursive: true });
  await mkdir('pages-dist/maps/thumb', { recursive: true });
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
    const svg = renderSFMap({ ...options, idPrefix: name });
    await writeFile(`pages-dist/maps/${name}.svg`, svg);
    // Display copies: the full-precision files above remain the downloads.
    if (name.startsWith('districts-'))
      await writeFile(`pages-dist/maps/display/${name}.svg`, simplifySvg(svg, displayTolerance));
    if (name.startsWith('districts-') || name === 'transit') {
      const thumb = simplifySvg(svg, name === 'transit' ? 0.6 : thumbTolerance);
      await writeFile(`pages-dist/maps/thumb/${name}.svg`, thumb);
      await writeFile(`pages-dist/maps/thumb/${name}-dark.svg`, darkWater(thumb));
    }
  }
  await mkdir('pages-dist/data', { recursive: true });
  await cp('data/elections', 'pages-dist/data/elections', { recursive: true });
  await cp('data/propositions', 'pages-dist/data/propositions', { recursive: true });
  await cp('data/candidates', 'pages-dist/data/candidates', { recursive: true });
  await cp('docs/map-preview.png', 'pages-dist/social-preview.png');
  const pages = [
    '',
    'examples.html',
    'measures.html',
    'candidates.html',
    'spot.html',
    'propositions.html',
    'transit.html',
  ];
  await writeFile(
    'pages-dist/sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((page) => `  <url><loc>${siteUrl}${page}</loc></url>`).join('\n')}\n</urlset>\n`,
  );
  await writeFile(
    'pages-dist/release.json',
    `${JSON.stringify({ version, source: released ? 'npm' : 'local' })}\n`,
  );
  console.log(`Pages built with ${releaseLabel}`);
} finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
