import { mkdir, writeFile } from 'node:fs/promises';
import { fullMapData } from '../dist/src/full-data.js';
import { renderMap } from '../dist/src/static.js';

const target = new URL('./generated/', import.meta.url);
await mkdir(target, { recursive: true });
const variants = [
  [
    'transit',
    'San Francisco · parks & transit',
    {
      theme: 'transit',
      keyRoads: true,
      districtLines: false,
      districtLabels: false,
      landmarks: true,
      bartStations: true,
      highways: true,
    },
  ],
  ['landmarks', 'Landmarks + BART', { landmarks: true, bartStations: true, highways: true }],
  ['districts', 'Districts', { districtLines: true }],
  ['neighborhoods', 'Districts + neighborhoods', { neighborhoodLines: true }],
  ['outline', 'Simple outlines', { districtFills: false, neighborhoodLines: true }],
];
for (const [name, , options] of variants)
  await writeFile(
    new URL(`${name}.svg`, target),
    renderMap(fullMapData.map, { ...options, idPrefix: name }).svg,
  );
await writeFile(
  new URL('index.html', target),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>San Francisco SVG maps</title><style>body{margin:0;background:#f4f7f9;color:#183e58;font:16px system-ui}header{padding:32px}h1{margin:0 0 8px;font-size:32px}p{margin:0;color:#536466}main{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:0 32px 32px}article{min-width:0}article:first-child{grid-column:1/-1;width:100%;max-width:900px;margin:0 auto}h2{font-size:18px}img{width:100%;height:auto;border:1px solid #ced6d5;border-radius:12px}a{color:inherit}@media(max-width:800px){main{grid-template-columns:1fr}header,main{padding:20px}}</style><header><h1>San Francisco, in SVG.</h1><p style="margin-bottom:12px"><a href="explorer.html">Explore neighborhoods →</a> · <a href="interactive.html">Reusable interactive map →</a></p><p>2022 district boundaries · parks and landmarks · BART stations · no map tiles</p><p style="margin-top:12px">Green areas: parks &nbsp; · &nbsp; Blue rings: BART stations &nbsp; · &nbsp; Warm gray lines: highways</p></header><main>${variants.map(([name, title]) => `<article><h2>${title}</h2><a href="${name}.svg"><img src="${name}.svg" alt="${title} map of San Francisco"></a></article>`).join('')}</main></html>`,
);

await writeFile(
  new URL('explorer.html', target),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>San Francisco neighborhood explorer</title><style>body{margin:0;padding:clamp(12px,3vw,36px);background:#f4f7f9;color:#183e58;font:16px system-ui}main{max-width:1200px;margin:auto}a{color:inherit}header{margin-bottom:20px}h1{font-size:clamp(24px,4vw,36px);margin:12px 0 8px}p{color:#536466}#explorer{min-height:400px}</style><main><header><a href="index.html">← All map examples</a><h1>Find your San Francisco.</h1><p>Explore neighborhood boundaries, discover local names, and take the data with you.</p></header><div id="explorer"></div></main><script type="module">import { createMap } from '../../dist/src/map.js'; import { fullMapData } from '../../dist/src/full-data.js'; const map = createMap(fullMapData, { mode: 'neighborhoods' }); document.querySelector('#explorer').append(map.element);</script></html>`,
);

await writeFile(
  new URL('interactive.html', target),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Reusable interactive SF map</title><style>body{margin:0;padding:20px;background:#f4f7f9;color:#183e58;font:16px system-ui}main{max-width:980px;margin:auto}button{font:inherit;min-height:44px;margin:4px;padding:8px}#selection{min-height:24px}a{color:inherit}</style><main><a href="index.html">Static map examples</a> · <a href="explorer.html">Full explorer</a><h1>A map inside your interface</h1><p>36 sample markers share six positions. Choose any marker from the menu, including markers obscured by others.</p><button id="fit">Fit all markers</button><button id="save">Save view</button><button id="restore">Restore view</button><button id="clear">Clear selection</button><p id="selection" aria-live="polite">Select a neighborhood or marker.</p><div id="map"></div><p>Page scrolling remains available over the map. Enable Touch navigation for map pan and pinch, then choose Done to resume page gestures.</p></main><script type="module" src="../interactive.mjs"></script></html>`,
);
