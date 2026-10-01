import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.SF_MAP_REPO || fileURLToPath(new URL('..', import.meta.url));
const { renderMap } = await import(`${root}/dist/src/api.js`);
const { staticMapData } = await import(`${root}/dist/src/static-data.js`);
const version = JSON.parse(await readFile(`${root}/package.json`, 'utf8')).version;
const require = createRequire(`${root}/package.json`);
const { build } = await import(require.resolve('vite'));
const { DOMParser } = require('@xmldom/xmldom');
const dir = resolve(process.argv[2] || `${root}/examples/generated/showcase`);
await mkdir(dir, { recursive: true });
const years = [2002, 2012, 2022];
const svgs = years.map(
  (year) =>
    renderMap(staticMapData, {
      year,
      width: 800,
      height: 800,
      title: `San Francisco supervisorial districts, ${year}`,
      idPrefix: `showcase-${year}`,
      landmarks: true,
      bartStations: true,
    }).svg,
);
for (let i = 0; i < years.length; i++) await writeFile(`${dir}/districts-${years[i]}.svg`, svgs[i]);
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1320" height="560" viewBox="0 0 1320 560"><rect width="1320" height="560" fill="#f7f6f2"/><text x="30" y="42" font-family="system-ui,sans-serif" font-size="26" fill="#173d40">San Francisco · three district maps</text>${svgs
  .map(
    (svg, i) =>
      `<text x="${30 + i * 440}" y="88" font-family="system-ui,sans-serif" font-size="21" fill="#173d40">${years[i]}</text>${svg
        .replace('<svg ', `<svg x="${i * 440}" y="100" `)
        .replace('width="800"', 'width="440"')
        .replace('height="800"', 'height="440"')}`,
  )
  .join(
    '',
  )}<text x="30" y="549" font-family="system-ui,sans-serif" font-size="12" fill="#173d40">@kahwee/sf-map-svg · canonical district geometry · DataSF sources documented in SOURCES.md</text></svg>`;
await writeFile(`${dir}/districts-contact-sheet.svg`, sheet);
const entry = resolve(root, 'examples/showcase.js');
const result = await build({
  configFile: false,
  root,
  logLevel: 'warn',
  build: { write: false, minify: true, lib: { entry, formats: ['iife'], name: 'SfShowcase' } },
});
const code = (Array.isArray(result) ? result[0] : result).output.find(
  (item) => item.type === 'chunk',
).code;
await writeFile(
  `${dir}/showcase.html`,
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>San Francisco · offline SVG showcase</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f6f2;color:#173d40;font:16px system-ui,sans-serif}main{max-width:1000px;margin:auto;padding:24px}h1{font-family:Georgia,serif;font-size:clamp(28px,5vw,44px);margin:0 0 8px}p{line-height:1.5}nav{display:flex;flex-wrap:wrap;gap:8px}button{padding:10px 14px;background:white;border:1px solid #789c9c;border-radius:6px;color:inherit;font:inherit;cursor:pointer}button[aria-pressed=true]{background:#173d40;color:white}#map{max-width:740px;margin:16px auto}#map>svg,#preview>svg{width:100%;height:auto}#preview{max-width:740px;margin:auto;border:2px solid #789c9c}#status{font-weight:600}footer{font-size:13px}a{color:inherit}</style><main><h1>One city. Three district maps.</h1><p>Real San Francisco boundaries, neighborhood selection, and a downloadable SVG. Works offline.</p><nav aria-label="Demo controls"><button id="play">Play 20-second demo</button>${years.map((year) => `<button data-year="${year}" aria-pressed="${year === 2002}">${year}</button>`).join('')}<button id="neighborhood">Inner Mission</button><button id="download">Download SVG</button></nav><p id="status" aria-live="polite">2002 supervisorial districts</p><div id="map"><noscript>${svgs[0]}</noscript></div><div id="preview" hidden aria-label="Static export preview"></div><footer>Built from local @kahwee/sf-map-svg ${version} source; this preview is not a published release. Software: MIT. Geography: DataSF, SFAR, BART; source terms documented in <a href="https://github.com/kahwee/sf-map-svg/blob/main/SOURCES.md">SOURCES.md</a>. <a href="https://github.com/kahwee/sf-map-svg">Source code</a>.</footer></main><script>${code.replaceAll('</script', '<\\/script')}</script></html>`,
);
for (const [i, svg] of [...svgs, sheet].entries()) {
  const doc = new DOMParser({
    onError: (level) => {
      throw new Error(level);
    },
  }).parseFromString(svg, 'image/svg+xml');
  if (doc.documentElement.localName !== 'svg') throw new Error(`Invalid SVG ${i}`);
}
console.log(
  JSON.stringify({
    directory: dir,
    htmlBytes: Buffer.byteLength(code),
    maps: 3,
    xml: 'valid',
    browser: 'not yet verified',
  }),
);
