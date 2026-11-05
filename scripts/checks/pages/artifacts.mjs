import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// Initial JavaScript and CSS, gzip KB. Transit embeds the library's animation with its geometry.
const budgets = {
  index: 47.75, // Option/cluster boundaries and CSS modules: 47.45 KiB gzip measured.
  layers: 50.75, // Option/cluster boundaries and CSS modules: 50.55 KiB gzip measured.
  playground: 56.5, // Option/cluster boundaries and CSS modules: 56.19 KiB gzip measured.
  // TanStack Charts 1.2.1 adds typed scales, axes and accessible SVG (37.78 KB measured).
  election: 40,
  examples: 12,
  measures: 25,
  propositions: 25,
  candidates: 25,
  spot: 15,
  transit: 480,
  docs: 12.5, // Readable stacked reference records on phones.
  api: 12.5,
  404: 12,
};
// Pre-rendered maps and datasets, gzip KB. Full geography loads only when exporting.
const mapBudgets = { 'maps/display': 20, 'maps/thumb': 30, 'maps/figures': 30, 'maps/plates': 60 };
const dataBudgets = { 'data/site-map.json': 320, 'data/export-map.json': 2048 };
// Media is already compressed; enforce raw KiB limits separately from JS/CSS gzip budgets.
const mediaBudgets = {
  'media/markers-2000-desktop.webp': 110,
  'media/markers-2000-phone.webp': 50,
  'media/markers-2000-desktop.webm': 1250,
  'media/markers-2000-phone.webm': 520,
};

export async function checkArtifacts(root, fail) {
  // ---------- Size budgets ----------
  const gzipKb = async (path) => gzipSync(await readFile(join(root, path))).length / 1024;
  for (const [name, limit] of Object.entries(budgets)) {
    const html = await readFile(join(root, `${name}.html`), 'utf8');
    let total = 0;
    for (const [, path] of html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+\.(?:js|css))"/g))
      total += await gzipKb(path);
    if (total > limit)
      fail(`${name}.html loads ${total.toFixed(2)} KB gzip JS/CSS (budget ${limit} KB)`);
  }
  for (const [folder, limit] of Object.entries(mapBudgets)) {
    const files = (await readdir(join(root, folder))).filter((name) => name.endsWith('.svg'));
    if (!files.length) fail(`${folder} has no maps`);
    for (const name of files) {
      const size = await gzipKb(`${folder}/${name}`);
      if (size > limit)
        fail(`${folder}/${name} is ${size.toFixed(1)} KB gzip (budget ${limit} KB)`);
    }
  }
  for (const [path, limit] of Object.entries(dataBudgets)) {
    const size = await gzipKb(path);
    if (size > limit) fail(`${path} is ${size.toFixed(1)} KB gzip (budget ${limit} KB)`);
  }
  for (const [path, limit] of Object.entries(mediaBudgets)) {
    const size = (await stat(join(root, path))).size / 1024;
    if (size > limit) fail(`${path} is ${size.toFixed(1)} KiB (budget ${limit} KiB)`);
  }

  // Assistant-readable docs must match this build and every index link must resolve locally.
  const release = JSON.parse(await readFile(join(root, 'release.json'), 'utf8'));
  const llms = await readFile(join(root, 'llms.txt'), 'utf8');
  const fullDocs = await readFile(join(root, 'llms-full.txt'), 'utf8');
  const apiHtml = await readFile(join(root, 'api.html'), 'utf8');
  if (apiHtml.includes('Preview features') || apiHtml.includes('selected npm package'))
    fail('API reference exposes internal preview warnings');
  if (
    !apiHtml.includes(`This reference describes <code>@kahwee/sf-map-svg ${release.version}</code>`)
  )
    fail('API reference does not identify the documented package version');
  for (const [name, content] of [
    ['llms.txt', llms],
    ['llms-full.txt', fullDocs],
  ]) {
    if (!content.includes(`@kahwee/sf-map-svg ${release.version} ·`))
      fail(`${name} does not match the site's package version`);
    if (!content.includes(release.source === 'npm' ? 'npm package' : 'local working tree'))
      fail(`${name} does not match the site's package source`);
  }
  for (const [, path] of llms.matchAll(
    /\]\(https:\/\/kahwee\.github\.io\/sf-map-svg\/([^)]+)\)/g,
  )) {
    if (!(await stat(join(root, path)).catch(() => null))?.isFile())
      fail(`llms.txt links to missing ${path}`);
  }
}
