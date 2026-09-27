import { geometryPath, rawProject } from '@kahwee/sf-map-svg/geometry';
import { createSFMap } from '@kahwee/sf-map-svg/legacy';
import { identifySpot } from './spot-model.js';

const svgNS = 'http://www.w3.org/2000/svg';
const samples = [
  { label: 'Ferry Building', point: [-122.3937, 37.7955] },
  { label: 'Dolores Park', point: [-122.4269, 37.7596] },
  { label: 'Golden Gate Park', point: [-122.4687, 37.77] },
  { label: 'Twin Peaks', point: [-122.4476, 37.7518] },
];

const markup = `<div class="spot-explorer">
  <div class="spot-toolbar"><div><span class="spot-kicker">01 / PICK A PLACE</span><h2>Start somewhere.</h2><p>Tap the map or choose a place. The point stays put while its names and district lines change.</p></div><div class="spot-samples" aria-label="Try a place"></div></div>
  <div class="spot-layout"><div class="spot-map-panel"><div class="spot-map-head"><span class="spot-map-label">SAN FRANCISCO <span aria-hidden="true">/</span> SELECT A POINT</span><span class="spot-coordinate"></span></div><div class="spot-map" aria-label="San Francisco map; click to inspect a point"></div><div class="spot-map-foot"><span><i class="spot-map-dot"></i> Selected point</span><span>Click anywhere on land</span></div></div>
  <div class="spot-sidebar"><div class="spot-step"><span class="spot-kicker">02 / COMPARE THE SOURCES</span><h2>One spot.<br><em>Three stories.</em></h2><p>These boundaries describe different ideas of a neighborhood. Select a source to trace its area on the map.</p></div><div class="spot-sources" role="group" aria-label="Neighborhood boundary sources"></div><div class="spot-step spot-step-district"><span class="spot-kicker">03 / TURN BACK TIME</span><h2>Which district?</h2><p>The point stays in place as the supervisorial map changes.</p><div class="spot-years" role="group" aria-label="District map year"></div><p class="spot-district-status" role="status"></p></div></div></div>
  <div class="spot-note"><span>THE FINE PRINT</span><p>Neighborhood areas are source-specific definitions, not official answers to where a place belongs. District maps show three dated boundary snapshots. A point on a shared boundary can be ambiguous at this scale.</p><a href="https://github.com/kahwee/sf-map-svg/blob/main/SOURCES.md">See geographic sources ↗</a></div>
</div>`;

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function toGeographic(point, project) {
  const origin = [-122.45, 37.75];
  const next = [-122.44, 37.75];
  const [x0, y0] = project(origin);
  const [x1] = project(next);
  const [rawX0, rawY0] = rawProject(origin);
  const [rawX1] = rawProject(next);
  const scale = (x1 - x0) / (rawX1 - rawX0);
  const rawX = rawX0 + (point.x - x0) / scale;
  const rawY = rawY0 + (point.y - y0) / scale;
  return [(rawX * 180) / Math.PI, ((2 * Math.atan(Math.exp(-rawY)) - Math.PI / 2) * 180) / Math.PI];
}

export function mountSpotExplorer(host, options = {}) {
  host.innerHTML = markup;
  const mapHost = host.querySelector('.spot-map');
  const sourcesHost = host.querySelector('.spot-sources');
  const yearsHost = host.querySelector('.spot-years');
  const samplesHost = host.querySelector('.spot-samples');
  const coordinate = host.querySelector('.spot-coordinate');
  const districtStatus = host.querySelector('.spot-district-status');
  let point = options.point || samples[0].point;
  let sourceId = 'realtor';
  let year = 2022;
  let map;
  let project;

  function draw() {
    const result = identifySpot(point);
    const base = createSFMap({
      year,
      districtFills: false,
      districtLines: true,
      districtLabels: false,
      landmarks: true,
      keyRoads: true,
      roadLabels: false,
      title: `San Francisco map, ${year} district boundaries`,
    });
    project = base.project;
    mapHost.innerHTML = base.svg;
    map = mapHost.querySelector('svg');
    map.removeAttribute('width');
    map.removeAttribute('height');
    map.classList.add('spot-svg');
    map.style.removeProperty('max-width');
    map.style.removeProperty('height');
    const layer = svgElement('g', { class: 'spot-overlays', 'pointer-events': 'none' });
    const district = result.districts.find((item) => item.year === year)?.feature;
    if (district)
      layer.append(
        svgElement('path', {
          class: 'spot-district-outline',
          d: geometryPath(district.geometry, project),
        }),
      );
    const active = result.neighborhoods.find((item) => item.id === sourceId);
    for (const feature of active?.matches || [])
      layer.append(
        svgElement('path', {
          class: `spot-source-outline spot-source-${sourceId}`,
          d: geometryPath(feature.geometry, project),
        }),
      );
    const [cx, cy] = project(point);
    layer.append(svgElement('circle', { class: 'spot-pin-halo', cx, cy, r: 23 }));
    layer.append(svgElement('circle', { class: 'spot-pin', cx, cy, r: 8 }));
    layer.append(svgElement('circle', { class: 'spot-pin-core', cx, cy, r: 2.3 }));
    map.append(layer);
    coordinate.textContent = `${Math.abs(point[1]).toFixed(4)}° N · ${Math.abs(point[0]).toFixed(4)}° W`;
    sourcesHost.replaceChildren();
    for (const source of result.neighborhoods) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `spot-source-card spot-card-${source.id}`;
      button.setAttribute('aria-pressed', String(source.id === sourceId));
      const label = source.matches.length
        ? source.matches.map((feature) => feature.properties.canonicalName).join(' / ')
        : 'No area at this point';
      const tag = document.createElement('span');
      tag.className = 'spot-card-tag';
      tag.textContent = source.label;
      const name = document.createElement('strong');
      name.textContent = label;
      const detail = document.createElement('small');
      detail.textContent = source.detail;
      button.append(tag, name, detail);
      button.addEventListener('click', () => {
        sourceId = source.id;
        draw();
      });
      sourcesHost.append(button);
    }
    for (const button of yearsHost.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.year) === year));
    }
    districtStatus.textContent = district
      ? `In ${year}, this point is in District ${district.properties.district}.`
      : `This point is outside the ${year} district map.`;
  }

  for (const sample of samples) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = sample.label;
    button.addEventListener('click', () => {
      point = sample.point;
      draw();
    });
    samplesHost.append(button);
  }
  for (const value of [2002, 2012, 2022]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.year = String(value);
    button.textContent = String(value);
    button.addEventListener('click', () => {
      year = value;
      draw();
    });
    yearsHost.append(button);
  }
  mapHost.addEventListener('click', (event) => {
    if (!map) return;
    const local = map.createSVGPoint();
    local.x = event.clientX;
    local.y = event.clientY;
    const transformed = local.matrixTransform(map.getScreenCTM().inverse());
    const candidate = toGeographic(transformed, project);
    const found = identifySpot(candidate);
    if (
      found.neighborhoods.some((source) => source.matches.length) ||
      found.districts.some((item) => item.feature)
    ) {
      point = candidate;
      draw();
    }
  });
  draw();
  return {
    selectPoint(next) {
      point = next;
      draw();
    },
    destroy() {
      host.replaceChildren();
    },
  };
}
