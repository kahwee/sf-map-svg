import { renderSFMap } from '@kahwee/sf-map-svg';
import election from '../data/elections/2026-06-02.json';
import {
  noShareColor,
  passed,
  readView,
  resultsCsv,
  shareColor,
  yesShare,
} from './measures-model.js';

const $ = (id) => document.getElementById(id);
const format = new Intl.NumberFormat('en-US');
const percent = (share) => (share === null ? 'No votes' : `${(share * 100).toFixed(2)}%`);
const difference = (share) => `${share > 0 ? '+' : ''}${(share * 100).toFixed(2)} pp`;
const ids = election.measures.map((m) => m.id);
const shortTitles = {
  A: 'Earthquake safety',
  B: 'Lifetime term limits',
  C: 'Business tax decreases',
  D: 'Executive pay tax',
};
let state = readView(location.hash, ids);
let viewport = [0, 0, 800];
let sort = 'district';
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
const measureById = (id) => election.measures.find((m) => m.id === id);
const areaVotes = (m) =>
  state.district ? m.districts.find((d) => d.district === state.district) : m.citywide;
const areaName = () => (state.district ? `District ${state.district}` : 'All San Francisco');
const cards = new Map();
for (const m of election.measures) {
  const card = node('button', undefined, 'measure-card');
  card.type = 'button';
  card.setAttribute('aria-label', `Measure ${m.id}: ${m.title}`);
  card.dataset.measure = m.id;
  const letter = node('span', m.id, 'measure-letter');
  const words = node('span');
  words.append(
    node('span', shortTitles[m.id], 'card-title'),
    node('span', passed(m) ? 'Passed citywide' : 'Did not pass', 'card-meta'),
  );
  const share = node('span', percent(yesShare(m.citywide)), 'card-share');
  share.append(node('small', 'Yes citywide'));
  card.append(letter, words, share);
  card.addEventListener('click', () => {
    if (state.compare === m.id) state.compare = state.measure;
    state.measure = m.id;
    update();
  });
  cards.set(m.id, card);
  $('measure-cards').append(card);
  $('compare').add(new Option(`${m.id} · ${shortTitles[m.id]}`, m.id));
}
for (let d = 1; d <= 11; d++) $('district').add(new Option(`District ${d}`, String(d)));
$('workbook').href = election.source;
$('certification').href = election.certificationSource;

function makeMap(hostId, prefix) {
  const host = $(hostId);
  host.innerHTML = renderSFMap({
    year: 2022,
    title: 'San Francisco ballot measure district map',
    idPrefix: prefix,
    colors: { water: '#edf4f4' },
  });
  const svg = host.querySelector('svg');
  svg.setAttribute('role', 'group');
  svg.setAttribute(
    'aria-label',
    'District map. Select a district; focus the map and use arrow keys to pan, plus or minus to zoom, Home to reset.',
  );
  svg.setAttribute('tabindex', '0');
  const paths = [...svg.querySelectorAll('[data-layer="district-fills"] path')];
  const originalColors = new Map(
    paths.map((path) => [path.dataset.district, path.getAttribute('fill')]),
  );
  for (const path of paths) {
    path.setAttribute('role', 'button');
    path.setAttribute('tabindex', '0');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    path.append(title);
    const choose = () => {
      state.district = Number(path.dataset.district);
      update();
    };
    path.addEventListener('click', choose);
    path.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        choose();
      }
    });
  }
  svg.addEventListener('keydown', (event) => {
    const step = viewport[2] * 0.1;
    const moves = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      setViewport([viewport[0] + dx, viewport[1] + dy, viewport[2]]);
    } else if (['+', '=', '-', 'Home'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'Home') setViewport([0, 0, 800]);
      else zoom(event.key === '-' ? 1 / 1.4 : 1.4);
    }
  });
  return { svg, paths, originalColors };
}
const primary = makeMap('results-map', 'measure-primary');
const secondary = makeMap('comparison-map', 'measure-secondary');
const maps = [primary, secondary];
function labelSizes() {
  for (const { svg } of maps) {
    const scale = svg.getScreenCTM()?.a;
    if (!scale) continue;
    svg
      .querySelector('[data-layer="district-labels"]')
      .setAttribute('font-size', String(11 / scale));
    for (const circle of svg.querySelectorAll('[data-layer="district-labels"] circle'))
      circle.setAttribute('r', String(9 / scale));
  }
}
const observer = new ResizeObserver(labelSizes);
for (const m of maps) observer.observe(m.svg);
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) observer.disconnect();
});
function setViewport(next) {
  const size = Math.max(800 / 6, Math.min(800, next[2]));
  viewport = [
    Math.max(0, Math.min(800 - size, next[0])),
    Math.max(0, Math.min(800 - size, next[1])),
    size,
  ];
  for (const { svg } of maps)
    svg.setAttribute('viewBox', `${viewport[0]} ${viewport[1]} ${size} ${size}`);
  $('zoom-level').textContent = `${Math.round((800 / size) * 100)}%`;
  $('zoom-out').disabled = size >= 800;
  $('zoom-in').disabled = size <= 800 / 6;
  labelSizes();
}
function zoom(factor) {
  const size = Math.max(800 / 6, Math.min(800, viewport[2] / factor));
  setViewport([
    viewport[0] + (viewport[2] - size) / 2,
    viewport[1] + (viewport[2] - size) / 2,
    size,
  ]);
}
function paint(map, m) {
  const { svg, paths, originalColors } = map;
  svg.querySelector('[data-layer="district-labels"]').style.display = state.labels ? '' : 'none';
  for (const path of paths) {
    const row = m.districts.find((d) => d.district === Number(path.dataset.district));
    const yes = yesShare(row);
    path.setAttribute(
      'fill',
      state.mode === 'districts'
        ? originalColors.get(path.dataset.district)
        : state.mode === 'no'
          ? noShareColor(yes === null ? null : 1 - yes)
          : shareColor(yes),
    );
    const description = `District ${row.district}: ${percent(yes)} Yes, ${percent(yes === null ? null : 1 - yes)} No. Measure ${m.id}.`;
    path.setAttribute('aria-label', description);
    path.querySelector('title').textContent = description;
    path.setAttribute('aria-pressed', String(row.district === state.district));
  }
  svg.querySelector('title').textContent =
    `Measure ${m.id}: ${m.title}. ${state.mode === 'districts' ? 'District colors' : state.mode === 'yes' ? 'Yes vote share' : 'No vote share'}. June 2, 2026 certified results.`;
}
function renderInspector(m, comparison) {
  const votes = areaVotes(m),
    yes = yesShare(votes),
    city = yesShare(m.citywide);
  const heading = node('h2', areaName());
  heading.id = 'area-title';
  const big = node('p', `${percent(yes)} Yes`, 'share-number');
  const context = node(
    'p',
    state.district
      ? `${difference(yes - city)} vs. citywide Yes share`
      : `${format.format(votes.yes + votes.no)} valid votes`,
    'area-context',
  );
  const bar = node('div', undefined, 'vote-bar');
  bar.setAttribute('aria-hidden', 'true');
  const yesBar = node('span');
  yesBar.style.width = `${(yes ?? 0) * 100}%`;
  bar.append(yesBar);
  const labels = node('div', undefined, 'vote-labels');
  labels.append(
    node('span', `Yes ${percent(yes)}`),
    node('span', `No ${percent(yes === null ? null : 1 - yes)}`),
  );
  const details = node('dl');
  for (const [label, value] of [
    ['Yes votes', votes.yes],
    ['No votes', votes.no],
    ['Undervotes', votes.undervotes],
    ['Overvotes', votes.overvotes],
  ])
    details.append(node('dt', label), node('dd', format.format(value)));
  $('area-summary').replaceChildren(heading, big, context, bar, labels, details);
  $('fit-district').disabled = !state.district;
  $('measure-title').textContent = `${m.id} · ${m.title}`;
  $('outcome').textContent = passed(m) ? 'Passed citywide' : 'Did not pass citywide';
  $('threshold').textContent =
    `Required ${m.threshold === 'two-thirds' ? 'two-thirds (66⅔%)' : 'more than 50%'} Yes. Citywide: ${percent(city)} Yes.`;
  $('official-measure').href = m.sourceUrl;
  $('comparison-summary').hidden = !comparison;
  if (comparison) {
    const other = yesShare(areaVotes(comparison));
    $('comparison-summary').replaceChildren(
      node('h3', `Compare: Measure ${comparison.id}`),
      node('p', `${percent(other)} Yes in ${areaName().toLowerCase()}`),
      node('p', `${difference(yes - other)} · ${m.id} minus ${comparison.id}`),
    );
  }
}
function renderTable(m, comparison) {
  const rows = [...m.districts];
  if (sort === 'yes') rows.sort((a, b) => yesShare(b) - yesShare(a));
  if (sort === 'no') rows.sort((a, b) => yesShare(a) - yesShare(b));
  if (sort === 'votes') rows.sort((a, b) => b.yes + b.no - (a.yes + a.no));
  $('compare-column').hidden = !comparison;
  $('compare-column').textContent = comparison ? `${comparison.id} Yes share` : '';
  $('table-caption').textContent =
    `Measure ${m.id} · ${m.title}${comparison ? ` · Comparing with ${comparison.id}` : ''}. Select any district to inspect its map.`;
  $('district-rows').replaceChildren(
    ...rows.map((row) => {
      const tr = node('tr');
      tr.dataset.selected = String(row.district === state.district);
      const th = node('th');
      th.scope = 'row';
      const button = node('button', `District ${row.district}`);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(row.district === state.district));
      button.addEventListener('click', () => {
        state.district = row.district;
        update();
        $('district').focus({ preventScroll: true });
        $('map-workspace').scrollIntoView({ block: 'start' });
      });
      th.append(button);
      tr.append(th);
      tr.append(node('td', format.format(row.yes)), node('td', format.format(row.no)));
      const share = node('td');
      const wrap = node('span', undefined, 'share-cell');
      const bar = node('span', undefined, 'mini-bar');
      bar.setAttribute('aria-hidden', 'true');
      const fill = node('i');
      fill.style.width = `${yesShare(row) * 100}%`;
      bar.append(fill);
      wrap.append(bar, node('span', percent(yesShare(row))));
      share.append(wrap);
      tr.append(share);
      tr.append(
        node('td', difference(yesShare(row) - yesShare(m.citywide))),
        node('td', format.format(row.yes + row.no)),
      );
      if (comparison)
        tr.append(
          node(
            'td',
            percent(yesShare(comparison.districts.find((d) => d.district === row.district))),
          ),
        );
      return tr;
    }),
  );
}
function update(writeUrl = true) {
  const m = measureById(state.measure),
    comparison = measureById(state.compare);
  for (const [id, card] of cards) card.setAttribute('aria-pressed', String(id === state.measure));
  $('district').value = String(state.district);
  $('mode').value = state.mode;
  $('compare').value = state.compare;
  for (const option of $('compare').options) option.disabled = option.value === state.measure;
  $('labels').setAttribute('aria-pressed', String(state.labels));
  $('comparison-figure').hidden = !comparison;
  $('maps').classList.toggle('is-comparing', !!comparison);
  $('primary-caption').textContent = `${m.id} · ${shortTitles[m.id]}`;
  if (comparison)
    $('comparison-caption').textContent = `${comparison.id} · ${shortTitles[comparison.id]}`;
  paint(primary, m);
  if (comparison) paint(secondary, comparison);
  $('legend-gradient').hidden = state.mode === 'districts';
  $('legend-low').textContent =
    state.mode === 'districts'
      ? 'Eleven districts · original map palette'
      : `0% ${state.mode === 'yes' ? 'Yes' : 'No'}`;
  $('legend-high').textContent =
    state.mode === 'districts' ? '' : `100% ${state.mode === 'yes' ? 'Yes' : 'No'}`;
  $('legend-gradient').style.background =
    state.mode === 'no'
      ? 'linear-gradient(to right,#f7f0e2,#a04e2c)'
      : 'linear-gradient(to right,#f0f4e8,#256967)';
  $('map-hint').textContent = state.district
    ? `District ${state.district} selected. Focus the map and use arrow keys to pan.`
    : 'Click a district to inspect it. Tab + Enter works too.';
  renderInspector(m, comparison);
  renderTable(m, comparison);
  labelSizes();
  $('action-status').textContent = '';
  if (writeUrl) {
    const params = new URLSearchParams({
      measure: state.measure,
      district: String(state.district),
      mode: state.mode,
    });
    if (state.compare) params.set('compare', state.compare);
    if (!state.labels) params.set('labels', '0');
    history.replaceState(null, '', `#${params}`);
  }
}
$('district').addEventListener('change', () => {
  state.district = Number($('district').value);
  update();
});
$('mode').addEventListener('change', () => {
  state.mode = $('mode').value;
  update();
});
$('compare').addEventListener('change', () => {
  state.compare = $('compare').value;
  update();
});
$('labels').addEventListener('click', () => {
  state.labels = !state.labels;
  update();
});
$('sort').addEventListener('change', () => {
  sort = $('sort').value;
  renderTable(measureById(state.measure), measureById(state.compare));
});
$('zoom-in').addEventListener('click', () => zoom(1.4));
$('zoom-out').addEventListener('click', () => zoom(1 / 1.4));
$('reset-view').addEventListener('click', () => setViewport([0, 0, 800]));
$('fit-district').addEventListener('click', () => {
  if (!state.district) return;
  const box = primary.paths.find((p) => Number(p.dataset.district) === state.district).getBBox();
  const size = Math.max(800 / 6, Math.min(800, Math.max(box.width, box.height) * 1.3));
  setViewport([box.x + box.width / 2 - size / 2, box.y + box.height / 2 - size / 2, size]);
});
$('share').addEventListener('click', async () => {
  update();
  try {
    await navigator.clipboard.writeText(location.href);
    $('action-status').textContent = 'View link copied.';
  } catch {
    $('action-status').textContent = 'Copy your browser address to share this view.';
  }
});
function download(contents, type, filename) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = node('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('export-csv').addEventListener('click', () => {
  const selected = [measureById(state.measure)];
  if (state.compare) selected.push(measureById(state.compare));
  download(
    resultsCsv(election, selected),
    'text/csv;charset=utf-8',
    `sf-measures-${selected.map((m) => m.id).join('-')}-2026-06-02.csv`,
  );
});
$('export-svg').addEventListener('click', () => {
  const clone = primary.svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('role', 'img');
  clone.removeAttribute('tabindex');
  clone.removeAttribute('aria-label');
  const desc = clone.querySelector('desc');
  desc.textContent = `Certified June 2, 2026 San Francisco election. Measure ${state.measure}. Colors: ${state.mode}. Yes/No shares exclude under/overvotes. Source: ${election.source}. Certified ${election.certifiedDate}. District 2022 display geometry: https://github.com/kahwee/sf-map-svg/blob/main/SOURCES.md`;
  for (const path of clone.querySelectorAll('[role="button"]')) {
    if (path.getAttribute('aria-pressed') === 'true') {
      path.setAttribute('stroke', '#a54830');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
    }
    path.removeAttribute('role');
    path.removeAttribute('tabindex');
    path.removeAttribute('aria-pressed');
  }
  download(
    new XMLSerializer().serializeToString(clone),
    'image/svg+xml',
    `sf-measure-${state.measure}-${state.mode}-2026-06-02.svg`,
  );
  $('action-status').textContent = 'Primary map exported with source attribution.';
});
for (const link of document.querySelectorAll('a[href^="#"]')) {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.setAttribute('tabindex', '-1');
    target.scrollIntoView();
    target.focus({ preventScroll: true });
  });
}
window.addEventListener('hashchange', () => {
  state = readView(location.hash, ids);
  update(false);
});
update(false);
setViewport([0, 0, 800]);
