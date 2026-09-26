import { mkdir, writeFile } from 'node:fs/promises';
import { renderSFMap } from '../src/index.js';
const target = new URL('./generated/', import.meta.url);
await mkdir(target, { recursive: true });
const variants = [
  ['districts', 'Districts', { districtLines: true }],
  ['neighborhoods', 'Districts + neighborhoods', { neighborhoodLines: true }],
  ['outline', 'Simple outlines', { districtFills: false, neighborhoodLines: true }],
];
for (const [name, , options] of variants)
  await writeFile(new URL(`${name}.svg`, target), renderSFMap({ ...options, idPrefix: name }));
await writeFile(
  new URL('index.html', target),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>San Francisco SVG maps</title><style>body{margin:0;background:#f7f5ef;color:#193c40;font:16px system-ui}header{padding:32px}h1{margin:0 0 8px;font-size:32px}p{margin:0;color:#536466}main{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:0 32px 32px}article{min-width:0}h2{font-size:18px}img{width:100%;height:auto;border:1px solid #ced6d5;border-radius:12px}a{color:inherit}@media(max-width:800px){main{grid-template-columns:1fr}header,main{padding:20px}}</style><header><h1>San Francisco, in SVG.</h1><p>2022 district boundaries · optional neighborhood outlines · no map tiles</p></header><main>${variants.map(([name, title]) => `<article><h2>${title}</h2><a href="${name}.svg"><img src="${name}.svg" alt="${title} map of San Francisco"></a></article>`).join('')}</main></html>`,
);
