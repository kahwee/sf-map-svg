import { writeFile } from 'node:fs/promises';
import { guideMapData } from '../dist/src/guide-data.js';
import { createGuideSVG } from '../dist/src/guide-static.js';
import { mapPalettes } from '../dist/src/presets.js';
import { escapeXml } from '../dist/src/svg.js';

// Use the existing geographic catalog, not copied consumer coordinates or content.
const places = guideMapData.map.landmarks
  .filter((place) => ['Golden Gate Park', 'Presidio', 'McLaren Park'].includes(place.name))
  .map((place, index) => ({
    id: `park-${index}`,
    label: place.name,
    lng: place.label[0],
    lat: place.label[1],
    color: mapPalettes.nightForest.markerColor,
    radius: 5,
  }));
const colors = mapPalettes.nightForest.colors;
const base = { colors, districtLabels: false, roadLabels: false, bartStations: false };
const target = new URL('./generated/', import.meta.url);
await writeFile(
  new URL('field-guide.svg', target),
  createGuideSVG({
    ...base,
    title: 'San Francisco park overview',
    markers: places,
    labelLayout: {
      width: 800,
      maxLabels: 12,
      haloColor: colors.land,
      compact: { width: 480, maxLabels: 4 },
    },
  }).svg,
);
for (const place of places)
  await writeFile(
    new URL(`${place.id}.svg`, target),
    createGuideSVG({ ...base, markers: [place], title: place.label, labels: false }).svg,
  );
await writeFile(
  new URL('field-guide.html', target),
  `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Field guide / SF Map SVG</title>
<style>
:root{color-scheme:light dark;--paper:#f4efe4;--ink:#16201c;--muted:#56615b;--surface:#fbf8f2;--line:#d5ccba;--link:#b23b10}
@media(prefers-color-scheme:dark){:root{--paper:#0f1916;--ink:#f1ebdf;--muted:#a2b0a8;--surface:#1a2824;--line:#2e403a;--link:#ff905f}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 system-ui}main{max-width:1200px;margin:auto;padding:clamp(20px,5vw,64px)}a{color:var(--link);text-underline-offset:4px}a:focus-visible{outline:3px solid var(--link);outline-offset:6px}header{padding:24px 0 48px}h1,h2{font-family:Georgia,serif;line-height:1.05}h1{font-size:clamp(48px,7vw,88px);max-width:12ch;margin:18px 0}h2{font-size:26px;margin:0 0 12px}.kicker{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:var(--link)}header p{max-width:540px;color:var(--muted)}.layout{display:grid;grid-template-columns:1.3fr 1fr;gap:40px;align-items:start}.overview{position:sticky;top:24px;overflow:hidden;border:1px solid #3b554e;border-radius:18px;background:#0a1412;color:#f1ebdf}.overview img{width:100%;height:auto;display:block}.caption{padding:24px;border-top:1px solid #3b554e}.caption p{margin:8px 0 0;color:#a2b0a8}.cards{display:grid;gap:24px}.card{display:grid;grid-template-columns:140px 1fr;overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--surface);scroll-margin-top:24px}.card img{width:100%;height:auto;align-self:center}.copy{padding:24px}.copy p{font-size:14px;color:var(--muted)}footer{margin-top:48px;border-top:1px solid var(--line);padding-top:24px;color:var(--muted);font-size:14px}@media(max-width:760px){.layout{grid-template-columns:1fr}.overview{position:static}.card{grid-template-columns:110px 1fr}.copy{padding:20px}h2{font-size:23px}}
</style><main><nav><a href="index.html">All map examples</a></nav><header><span class="kicker">A field-guide pattern</span><h1>A little more city. A little less noise.</h1><p>One overview connects the places. Small locator maps give each one a home. Try a narrow window and your browser’s dark appearance.</p></header><div class="layout"><section class="overview" aria-label="Park overview"><img src="field-guide.svg" width="800" height="800" alt="San Francisco map showing the three parks listed alongside" loading="lazy"><div class="caption"><h2>Three parks. One city.</h2><p>Fewer labels on small screens. Every pin stays in place.</p></div></section><section class="cards" aria-label="Park locators">${places.map((place) => `<article class="card" id="${place.id}"><img src="${place.id}.svg" width="800" height="800" alt="${escapeXml(place.label)} location in San Francisco" loading="lazy"><div class="copy"><span class="kicker">Find your bearings</span><h2>${escapeXml(place.label)}</h2><p>A city-scale locator using the shared geographic catalog.</p><a href="${place.id}.svg">Open locator<span class="sr-only"> for ${escapeXml(place.label)}</span></a></div></article>`).join('')}</section></div><footer>Pattern inspired by YorkSF · Maps generated offline with SF Map SVG · Geographic sources: DataSF. These examples show orientation, not entrances or walking directions.</footer></main></html>`,
);
