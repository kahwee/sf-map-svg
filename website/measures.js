import catalog from '../data/elections/catalog.json';
import { createDistrictMap } from './district-map.js';
import { passed, readView, resultsCsv, yesShare } from './measures-model.js';
import { countTo, reorderList, staggerChildren, whenVisible } from './motion-kit.js';
import { diverging, mix, sequential } from './palette.js';
import { copyText, element, enhanceCode, segmented } from './ui.js';

const $ = (id) => document.getElementById(id);
const format = new Intl.NumberFormat('en-US');
const count = (value) => (value === null || value === undefined ? '—' : format.format(value));
const percent = (share) => (share === null ? 'No votes' : `${(share * 100).toFixed(1)}%`);
const points = (value) => `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)} pts`;
enhanceCode();

const cache = new Map();
const load = (file) => {
  if (!cache.has(file))
    cache.set(
      file,
      fetch(`./data/elections/${file}`).then((response) => {
        if (!response.ok) throw new Error(`Could not load ${file}`);
        return response.json();
      }),
    );
  return cache.get(file);
};

const initial = new URLSearchParams(location.hash.slice(1));
let choice;
let election;
let view;
let map;
let shownShare = 0;
const shownBars = new Map();
let staggered;

const measureById = (id) => election.measures.find((item) => item.id === id);
const measure = () => measureById(view.measure);
const compared = () => (view.compare ? measureById(view.compare) : undefined);
const row = (item, id) => (id ? item.districts.find((d) => d.district === id) : item.citywide);
const shareFor = (item, id) => {
  const share = yesShare(row(item, id));
  return view.mode === 'no' && share !== null ? 1 - share : share;
};

// ---------- Color ----------
function scale() {
  const other = compared();
  if (other) {
    const diffs = measure().districts.map((d) => yesShare(d) - yesShare(row(other, d.district)));
    const reach = Math.max(0.05, Math.ceil(Math.max(...diffs.map(Math.abs)) * 20) / 20);
    return {
      fill: (id) =>
        diverging(0.5 + ((yesShare(row(measure(), id)) - yesShare(row(other, id))) / reach) * 0.42),
      low: `${other.id} higher`,
      high: `${measure().id} higher`,
      ramp: 'linear-gradient(90deg, #7e2c1a, #d18a6d, #f3efe2, #86b8ad, #1c4847)',
    };
  }
  const shares = measure().districts.map((d) => shareFor(measure(), d.district));
  const low = Math.floor(Math.min(...shares) * 20) / 20;
  const high = Math.max(low + 0.05, Math.ceil(Math.max(...shares) * 20) / 20);
  const ink = view.mode === 'no' ? '#8f3420' : undefined;
  return {
    fill: (id) => {
      const t = (shareFor(measure(), id) - low) / (high - low);
      return ink ? mix('#f3efe2', ink, 0.08 + 0.92 * t) : sequential(t);
    },
    low: `${Math.round(low * 100)}% ${view.mode === 'no' ? 'No' : 'Yes'}`,
    high: `${Math.round(high * 100)}% ${view.mode === 'no' ? 'No' : 'Yes'}`,
    ramp:
      view.mode === 'no'
        ? 'linear-gradient(90deg, #efe6d8, #8f3420)'
        : 'linear-gradient(90deg, #f3efe2, #8fbcb2, #2d6a68, #1c4847)',
  };
}

// ---------- Rendering ----------
function renderList() {
  const query = $('measure-search').value.trim().toLocaleLowerCase();
  let shown = 0;
  const items = election.measures.map((item) => {
    const share = yesShare(item.citywide);
    const won = passed(item);
    const li = element('li');
    li.dataset.measure = item.id;
    li.hidden = !`${item.id} ${item.title}`.toLocaleLowerCase().includes(query);
    if (!li.hidden) shown++;
    const button = element('button', undefined, 'measure-card');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(item.id === view.measure));
    button.setAttribute(
      'aria-label',
      `Measure ${item.id}, ${item.title}: ${percent(share)} Yes, ${won ? 'passed' : 'did not pass'}`,
    );
    const bar = element('span', undefined, 'measure-bar');
    const fill = element('i', undefined, 'grow-bar');
    fill.style.setProperty('--v', String(share ?? 0));
    fill.style.setProperty('--i', String(shown));
    bar.append(fill);
    if (item.threshold === 'two-thirds') {
      const mark = element('b', undefined, 'threshold-mark');
      mark.style.setProperty('--x', String(2 / 3));
      bar.append(mark);
    } else {
      const mark = element('b', undefined, 'threshold-mark');
      mark.style.setProperty('--x', '0.5');
      bar.append(mark);
    }
    button.append(
      element('span', item.id, 'measure-letter'),
      element('span', item.title, 'measure-name'),
      element('span', `${percent(share)} Yes`, 'measure-share num'),
      element('span', won ? 'Passed' : 'Failed', `measure-verdict ${won ? 'yes' : 'no'}`),
      bar,
    );
    button.addEventListener('click', () => {
      view.measure = item.id;
      if (view.compare === item.id) view.compare = '';
      render();
      $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    li.append(button);
    return li;
  });
  $('measure-list').replaceChildren(...items);
  $('measure-count').textContent = `${shown} of ${election.measures.length} measures`;
}

function headline() {
  const item = measure();
  const area = view.district ? `District ${view.district}` : 'All San Francisco';
  const share = shareFor(item, view.district);
  const figure = element('p', undefined, 'headline-figure');
  const counter = element('span');
  counter.setAttribute('aria-hidden', 'true');
  const side = view.mode === 'no' ? 'No' : 'Yes';
  figure.append(element('span', `${percent(share)} ${side}`, 'sr-only'), counter);
  if (share === null) counter.textContent = 'No votes';
  else
    countTo(counter, share * 100, {
      from: shownShare * 100,
      duration: 700,
      format: (value) => `${value.toFixed(1)}% ${side}`,
    });
  shownShare = share ?? 0;
  const won = passed(item);
  const verdict = element(
    'p',
    `${won ? 'Passed' : 'Did not pass'} citywide · ${item.threshold === 'two-thirds' ? 'two-thirds' : 'majority'} required`,
    `verdict ${won ? 'yes' : 'no'}`,
  );
  const votes = row(item, view.district);
  const detail = element(
    'p',
    `${count(votes.yes)} Yes · ${count(votes.no)} No`,
    'headline-counts num',
  );
  const children = [element('p', area, 'eyebrow'), figure, verdict, detail];
  const other = compared();
  if (other) {
    const difference = yesShare(votes) - yesShare(row(other, view.district));
    children.push(
      element(
        'p',
        `${points(difference)} Yes compared with Measure ${other.id}.`,
        'headline-range',
      ),
    );
  } else if (view.district)
    children.push(
      element(
        'p',
        'District shares describe local patterns; passage is citywide.',
        'headline-range',
      ),
    );
  $('measure-headline').replaceChildren(...children);
}

function ranking() {
  const sorted = [...measure().districts].sort((a, b) => yesShare(b) - yesShare(a));
  const style = scale();
  reorderList(
    $('measure-ranking'),
    'district',
    sorted.map((d, index) => {
      const share = yesShare(d);
      const button = element('button', undefined, 'rank-row');
      button.type = 'button';
      button.dataset.district = String(d.district);
      button.setAttribute('aria-pressed', String(d.district === view.district));
      button.setAttribute('aria-label', `District ${d.district}: ${percent(share)} Yes`);
      const bar = element('span', undefined, 'rank-bar');
      bar.setAttribute('aria-hidden', 'true');
      const fill = element('i', undefined, 'grow-bar');
      fill.style.setProperty('--v', String(share ?? 0));
      fill.style.setProperty('--from', String(shownBars.get(d.district) ?? 0));
      fill.style.setProperty('--i', String(index));
      fill.style.background = style.fill(d.district);
      shownBars.set(d.district, share ?? 0);
      bar.append(fill);
      button.append(
        element('span', `District ${d.district}`, 'rank-name'),
        bar,
        element('span', percent(share), 'rank-value num'),
      );
      button.addEventListener('click', () =>
        selectDistrict(d.district === view.district ? 0 : d.district),
      );
      return button;
    }),
  );
}

function table() {
  const item = measure();
  const other = compared();
  $('compare-head').hidden = !other;
  $('compare-head').textContent = other ? `vs ${other.id}` : '';
  $('table-caption').textContent = `Measure ${item.id} results by supervisorial district`;
  const rows = [0, ...item.districts.map((d) => d.district)].map((id) => {
    const votes = row(item, id);
    const tr = element('tr');
    if (id === view.district) tr.className = 'is-selected';
    const head = element('th', id ? `District ${id}` : 'All San Francisco');
    head.scope = 'row';
    const cells = [
      count(votes.yes),
      count(votes.no),
      percent(yesShare(votes)),
      other ? points(yesShare(votes) - yesShare(row(other, id))) : '',
      count(votes.undervotes),
      count(votes.overvotes),
    ].map((text, index) => {
      const td = element('td', text, 'num');
      if (index === 3) td.hidden = !other;
      return td;
    });
    tr.append(head, ...cells);
    return tr;
  });
  $('table-body').replaceChildren(...rows);
}

function paint() {
  if (!map) return;
  const style = scale();
  map.paint((id) => ({ fill: style.fill(id) }));
  map.select(view.district);
}

function render() {
  const item = measure();
  $('measure-eyebrow').textContent =
    `Measure ${item.id} · ${choice.label} · ${election.districtYear} district map`;
  const title = $('measure-title');
  if (title.textContent !== item.title) {
    title.textContent = item.title;
    if (staggered) staggerChildren(title.parentElement);
    staggered = true;
  }
  const style = scale();
  $('legend-low').textContent = style.low;
  $('legend-high').textContent = style.high;
  $('legend-ramp').style.background = style.ramp;
  $('measure-caption').replaceChildren(
    element(
      'b',
      compared()
        ? `Measure ${item.id} compared with ${compared().id}.`
        : `${view.mode === 'no' ? 'No' : 'Yes'} share by district.`,
    ),
    compared()
      ? ' Teal districts gave this measure more Yes support than the comparison.'
      : ' Colors stretch across this measure’s range to show variation. Select a district to inspect it.',
  );
  $('district').value = String(view.district);
  const compare = $('compare');
  compare.replaceChildren(
    new Option('No comparison', ''),
    ...election.measures
      .filter((other) => other.id !== item.id)
      .map((other) => new Option(`Measure ${other.id} · ${other.title}`, other.id)),
  );
  compare.value = view.compare;
  for (const card of document.querySelectorAll('.measure-card'))
    card.setAttribute('aria-pressed', String(card.closest('li').dataset.measure === item.id));
  headline();
  ranking();
  table();
  paint();
  const hash = new URLSearchParams({ election: choice.date, measure: item.id });
  if (view.district) hash.set('district', String(view.district));
  if (view.compare) hash.set('compare', view.compare);
  if (view.mode !== 'yes') hash.set('mode', view.mode);
  history.replaceState(null, '', `#${hash}`);
}

function selectDistrict(id) {
  view.district = id;
  render();
}

async function chooseElection(date, hash = '') {
  choice = catalog.elections.find((item) => item.date === date) ?? catalog.elections[0];
  election = await load(choice.data);
  const ids = election.measures.map((item) => item.id);
  view = readView(hash, ids);
  if (view.mode === 'districts') view.mode = 'yes';
  electionControl.set(choice.date);
  modeControl.set(view.mode);
  $('source-links').replaceChildren(
    ...[
      [election.source, 'Certified results ↗'],
      [election.summarySource ?? election.titleSource, 'Measure titles and summaries ↗'],
      [election.certificationSource, 'Certification ↗'],
    ]
      .filter(([href]) => href)
      .map(([href, text]) => {
        const link = element('a', text, 'link-draw');
        link.href = href;
        return link;
      }),
  );
  $('election-method').textContent = [election.geography, election.method]
    .filter(Boolean)
    .join(' ');
  renderList();
  if (map && map.year !== election.districtYear) map.setYear(election.districtYear);
  render();
}

const electionControl = segmented($('election-control'), {
  label: 'Election',
  options: [...catalog.elections]
    .reverse()
    .map((item) => ({ value: item.date, label: item.date.slice(0, 4) })),
  value: initial.get('election') ?? catalog.elections[0].date,
  onChange: (date) => chooseElection(date),
});
const modeControl = segmented($('mode-control'), {
  label: 'Map shows',
  options: [
    { value: 'yes', label: 'Yes share' },
    { value: 'no', label: 'No share' },
  ],
  value: 'yes',
  onChange: (mode) => {
    view.mode = mode;
    render();
  },
});
for (let id = 1; id <= 11; id++) $('district').add(new Option(`District ${id}`, String(id)));
$('district').addEventListener('change', (event) => selectDistrict(Number(event.target.value)));
$('compare').addEventListener('change', (event) => {
  view.compare = event.target.value;
  render();
});
$('measure-search').addEventListener('input', renderList);

function download(contents, type, filename) {
  const link = element('a');
  link.href = URL.createObjectURL(new Blob([contents], { type }));
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
$('export-csv').addEventListener('click', () =>
  download(
    resultsCsv(election, [measure(), compared()].filter(Boolean)),
    'text/csv',
    `sf-${choice.date}-measure-${view.measure}.csv`,
  ),
);
$('export-svg').addEventListener('click', () =>
  download(map?.snapshot() ?? '', 'image/svg+xml', `sf-${choice.date}-measure-${view.measure}.svg`),
);
$('share-link').addEventListener('click', (event) => copyText(event.currentTarget, location.href));

await chooseElection(initial.get('election') ?? catalog.elections[0].date, location.hash);
whenVisible(
  $('measure-map'),
  async () => {
    try {
      map = await createDistrictMap($('measure-map'), {
        year: election.districtYear,
        idPrefix: 'measures',
        title: 'Local ballot measure results in San Francisco',
        label: (id) =>
          `District ${id}: ${percent(yesShare(row(measure(), id)))} Yes on Measure ${view.measure}`,
        onSelect: (id) => selectDistrict(id === view.district ? 0 : id),
      });
      paint();
    } catch (error) {
      $('measure-map').textContent = 'The map could not load.';
      console.error(error);
    }
  },
  '300px',
);
