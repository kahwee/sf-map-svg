import { createSFMapWithData } from '@kahwee/sf-map-svg/custom-map';
import coast from '../data/coast.json';
import catalog from '../data/elections/catalog.json';
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
const formatCount = (count) => (count === null ? 'Unavailable' : format.format(count));
const percent = (share) => (share === null ? 'No votes' : `${(share * 100).toFixed(2)}%`);
const difference = (share) => `${share > 0 ? '+' : ''}${(share * 100).toFixed(2)} pp`;
const datasets = import.meta.glob('../data/elections/*.json');
const districtDatasets = import.meta.glob('../data/districts-*.json');
const electionChoices = catalog.elections;
const shortTitles = {
  A: 'Earthquake safety',
  B: 'Lifetime term limits',
  C: 'Business tax decreases',
  D: 'Executive pay tax',
};
let election;
let ids = [];
let state;
let electionDate;
let mapData;
let viewport = [0, 0, 800];
let sort = 'district';
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
const measureById = (id) => election.measures.find((m) => m.id === id);
const measureTitle = (measure) =>
  electionDate === '2026-06-02' ? shortTitles[measure.id] : measure.title;
const areaVotes = (m) =>
  state.district ? m.districts.find((d) => d.district === state.district) : m.citywide;
const areaName = () => (state.district ? `District ${state.district}` : 'All San Francisco');
$('inspector').open = matchMedia('(min-width: 900px)').matches;
const cards = new Map();
for (const choice of electionChoices)
  $('election').add(new Option(`${choice.label} · ${choice.measureCount} measures`, choice.date));
for (let d = 1; d <= 11; d++) $('district').add(new Option(`District ${d}`, String(d)));

function filterCards() {
  const query = $('measure-search').value.trim().toLocaleLowerCase();
  let shown = 0;
  for (const [id, card] of cards) {
    const measure = measureById(id);
    card.hidden = !`${id} ${measure.title}`.toLocaleLowerCase().includes(query);
    if (!card.hidden) shown++;
  }
  $('measure-count').textContent = `${shown} of ${ids.length} local measures`;
}

function renderCards() {
  cards.clear();
  $('measure-cards').replaceChildren();
  $('compare').replaceChildren(new Option('No comparison', ''));
  for (const m of election.measures) {
    const card = node('button', undefined, 'measure-card');
    card.type = 'button';
    card.setAttribute('aria-label', `Measure ${m.id}: ${m.title}`);
    card.dataset.measure = m.id;
    const letter = node('span', m.id, 'measure-letter');
    const words = node('span');
    words.append(
      node('span', measureTitle(m), 'card-title'),
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
    $('compare').add(new Option(`${m.id} · ${m.title}`, m.id));
  }
  filterCards();
}

function enableGestures(svg) {
  const pointers = new Map();
  let previous = null;
  let moved = false;
  let origin = null;
  const gesture = () => {
    const points = [...pointers.values()];
    return {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
      distance:
        points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0,
    };
  };
  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      moved = false;
      origin = { x: event.clientX, y: event.clientY };
    }
    previous = gesture();
  });
  svg.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const next = gesture();
    if (
      !moved &&
      (pointers.size > 1 || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 5)
    ) {
      moved = true;
      svg.setPointerCapture(event.pointerId);
    }
    if (moved) {
      const scale = svg.getScreenCTM().a;
      if (next.distance && previous.distance) zoom(next.distance / previous.distance);
      setViewport([
        viewport[0] - (next.x - previous.x) / scale,
        viewport[1] - (next.y - previous.y) / scale,
        viewport[2],
      ]);
    }
    previous = next;
  });
  const end = (event) => {
    pointers.delete(event.pointerId);
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    previous = pointers.size ? gesture() : null;
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('lostpointercapture', (event) => pointers.delete(event.pointerId));
  svg.addEventListener(
    'click',
    (event) => {
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );
}
function makeMap(hostId, prefix) {
  const host = $(hostId);
  host.innerHTML = createSFMapWithData(
    {
      year: election.districtYear,
      title: 'San Francisco ballot measure district map',
      idPrefix: prefix,
      colors: { water: '#edf4f4' },
    },
    mapData,
  ).svg;
  const svg = host.querySelector('svg');
  svg.style.height = '100%';
  svg.setAttribute('role', 'group');
  svg.setAttribute(
    'aria-label',
    'District map. Select a district; focus the map and use arrow keys to pan, plus or minus to zoom, Home to reset.',
  );
  svg.setAttribute('tabindex', '0');
  enableGestures(svg);
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
let primary;
let secondary;
let maps = [];
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
    `Measure ${m.id}: ${m.title}. ${state.mode === 'districts' ? 'District colors' : state.mode === 'yes' ? 'Yes vote share' : 'No vote share'}. ${election.electionName}.`;
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
    details.append(node('dt', label), node('dd', formatCount(value)));
  $('selection-label').textContent = areaName();
  $('selection-share').textContent = `${percent(yes)} Yes`;
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
        $('results-dialog').close();
        $('inspector').open = true;
        $('district').focus({ preventScroll: true });
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
  cards.get(state.measure)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  $('district').value = String(state.district);
  $('mode').value = state.mode;
  $('compare').value = state.compare;
  for (const option of $('compare').options) option.disabled = option.value === state.measure;
  $('labels').setAttribute('aria-pressed', String(state.labels));
  $('comparison-figure').hidden = !comparison;
  $('maps').classList.toggle('is-comparing', !!comparison);
  $('primary-caption').textContent = `${m.id} · ${measureTitle(m)}`;
  if (comparison)
    $('comparison-caption').textContent = `${comparison.id} · ${measureTitle(comparison)}`;
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
    : 'Tap a district · Drag to pan · Pinch or + to zoom';
  renderInspector(m, comparison);
  renderTable(m, comparison);
  labelSizes();
  $('action-status').textContent = '';
  if (writeUrl) {
    const params = new URLSearchParams({
      election: electionDate,
      measure: state.measure,
      district: String(state.district),
      mode: state.mode,
    });
    if (state.compare) params.set('compare', state.compare);
    if (!state.labels) params.set('labels', '0');
    history.replaceState(null, '', `#${params}`);
  }
}
let loadSequence = 0;
async function selectElection(date, fromHash = false) {
  const choice = electionChoices.find((item) => item.date === date) ?? electionChoices[0];
  const sequence = ++loadSequence;
  const loader = datasets[`../data/elections/${choice.data}`];
  const districtLoader = districtDatasets[`../data/districts-${choice.districtYear}.json`];
  if (!loader) throw new Error(`Missing election dataset: ${choice.data}`);
  if (!districtLoader) throw new Error(`Missing district map: ${choice.districtYear}`);
  const [electionModule, districtModule] = await Promise.all([loader(), districtLoader()]);
  if (sequence !== loadSequence) return;
  election = electionModule.default;
  mapData = {
    coast: coast.features[0].geometry,
    districts: {
      [choice.districtYear]: districtModule.default.features.map(({ geometry, properties }) => ({
        id: properties.district,
        label: properties.label,
        labelPoints: properties.labelPoints,
        geometry,
        extras: properties.displayExtras,
      })),
    },
  };
  electionDate = election.electionDate;
  ids = election.measures.map((measure) => measure.id);
  state = readView(fromHash ? location.hash : '', ids);
  $('election').value = electionDate;
  $('measure-search').value = '';
  $('election-subtitle').textContent =
    `${choice.label} · ${ids.length} local measures · ${election.districtYear} district map`;
  $('district-year-note').textContent =
    `${election.districtYear} district boundaries · Same scale on both maps`;
  $('source-intro').textContent =
    `${election.electionName}. ${ids.length} local measures. ${election.certifiedDate ? `Certified ${election.certifiedDate}.` : 'Official final results.'} Downloaded ${election.downloadedDate}.`;
  $('source-method').textContent = election.method;
  $('source-geography').textContent =
    `${election.geography} The map illustrates district results, not precinct or neighborhood results. Colors express vote share, not endorsements.`;
  $('workbook').href = election.source;
  $('certification').hidden = !election.certificationSource;
  if (election.certificationSource) $('certification').href = election.certificationSource;
  $('results-json').href = `./data/elections/${electionDate}.json`;
  renderCards();
  observer.disconnect();
  primary = makeMap('results-map', 'measure-primary');
  secondary = makeMap('comparison-map', 'measure-secondary');
  maps = [primary, secondary];
  for (const map of maps) observer.observe(map.svg);
  setViewport([0, 0, 800]);
  update(!fromHash);
}
$('election').addEventListener('change', () => {
  selectElection($('election').value).catch((error) => {
    $('action-status').textContent = `Could not load election: ${error.message}`;
  });
});
$('measure-search').addEventListener('input', filterCards);
$('focus-map').addEventListener('click', () => {
  const focused = document.body.classList.toggle('map-focused');
  $('focus-map').setAttribute('aria-pressed', String(focused));
  $('focus-map').setAttribute('aria-label', focused ? 'Show panels' : 'Focus map');
  $('focus-map').textContent = focused ? 'Show panels ↗' : 'Focus map ⛶';
});
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
    `sf-measures-${selected.map((m) => m.id).join('-')}-${electionDate}.csv`,
  );
});
$('export-svg').addEventListener('click', () => {
  const clone = primary.svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('role', 'img');
  clone.removeAttribute('tabindex');
  clone.removeAttribute('aria-label');
  const desc = clone.querySelector('desc');
  desc.textContent = `${election.electionName}. Measure ${state.measure}. Colors: ${state.mode}. Yes/No shares exclude under/overvotes. Source: ${election.source}. District ${election.districtYear} display geometry: https://github.com/kahwee/sf-map-svg/blob/main/SOURCES.md`;
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
    `sf-measure-${state.measure}-${state.mode}-${electionDate}.svg`,
  );
  $('action-status').textContent = 'Primary map exported with source attribution.';
});
for (const link of document.querySelectorAll('a[href^="#"]')) {
  link.addEventListener('click', (event) => {
    const href = link.getAttribute('href');
    const dialog =
      href === '#district-table'
        ? $('results-dialog')
        : href === '#sources'
          ? $('sources-dialog')
          : null;
    if (dialog) {
      event.preventDefault();
      dialog.showModal();
      return;
    }
    const target = document.querySelector(href);
    if (!target) return;
    event.preventDefault();
    target.setAttribute('tabindex', '-1');
    target.scrollIntoView();
    target.focus({ preventScroll: true });
  });
}
window.addEventListener('hashchange', () => {
  const requested = new URLSearchParams(location.hash.replace(/^#/, '')).get('election');
  if (requested && requested !== electionDate) {
    selectElection(requested, true).catch((error) => {
      $('action-status').textContent = `Could not load election: ${error.message}`;
    });
  } else {
    state = readView(location.hash, ids);
    update(false);
  }
});
const requested = new URLSearchParams(location.hash.replace(/^#/, '')).get('election');
await selectElection(requested, true);
