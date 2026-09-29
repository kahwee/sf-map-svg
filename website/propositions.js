import results from '../data/propositions/2024-11-05.json';
import { displayMapCopy } from './display-map.js';
import { createDistrictMap } from './district-map.js';
import { yesShare } from './measures-model.js';
import { countTo, growMap, reorderList, staggerChildren, whenVisible } from './motion-kit.js';
import { diverging, divergingInk } from './palette.js';
import { element, enhanceCode } from './ui.js';

const $ = (id) => document.getElementById(id);
const format = new Intl.NumberFormat('en-US');
const percent = (share) => `${(share * 100).toFixed(1)}%`;
const propositions = results.propositions;
const params = new URLSearchParams(location.hash.slice(1));
let proposition =
  propositions.find((item) => item.number === Number(params.get('prop'))) ?? propositions[0];
let district = Number(params.get('district')) || 0;
let map;
let shownShare = 0;
const shownBars = new Map();
enhanceCode();

const districtRow = (id) => proposition.districts.find((row) => row.district === id);

// ---------- Small multiples ----------
async function buildMultiples() {
  const list = $('multiples');
  for (const item of propositions) {
    const li = element('li');
    const button = element('button', undefined, 'multiple');
    button.type = 'button';
    button.dataset.prop = String(item.number);
    const share = yesShare(item.citywide);
    button.setAttribute(
      'aria-label',
      `Proposition ${item.number}, ${item.title}: ${percent(share)} Yes in San Francisco`,
    );
    const frame = element('span', undefined, 'multiple-map map-surface');
    const caption = element('span', undefined, 'multiple-text');
    caption.append(
      element('strong', `Prop ${item.number}`),
      element('span', item.title, 'multiple-title'),
      element('span', `${percent(share)} Yes`, `multiple-share ${share >= 0.5 ? 'yes' : 'no'}`),
    );
    button.append(frame, caption);
    button.addEventListener('click', () => {
      choose(item.number);
      $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    li.append(button);
    list.append(li);
    displayMapCopy(2022, {
      size: 'thumb',
      idPrefix: `mini-${item.number}`,
      title: `Prop ${item.number}`,
    })
      .then((svg) => {
        svg.setAttribute('aria-hidden', 'true');
        for (const path of svg.querySelectorAll('[data-layer="district-fills"] path')) {
          const row = item.districts.find((d) => d.district === Number(path.dataset.district));
          path.setAttribute('fill', diverging(yesShare(row)));
        }
        svg.querySelector('[data-layer="district-labels"]')?.remove();
        frame.append(svg);
        growMap(frame);
      })
      .catch(() => frame.classList.add('plate-failed'));
  }
}

// ---------- Detail ----------
function headline() {
  const row = district ? districtRow(district) : proposition.citywide;
  const share = yesShare(row);
  const where = district ? `District ${district}` : 'All San Francisco';
  const figure = element('p', undefined, 'headline-figure');
  const counter = element('span');
  counter.setAttribute('aria-hidden', 'true');
  figure.append(element('span', `${percent(share)} Yes`, 'sr-only'), counter);
  countTo(counter, share * 100, {
    from: shownShare * 100,
    duration: 700,
    format: (value) => `${value.toFixed(1)}% Yes`,
  });
  shownShare = share;
  const verdict = element(
    'p',
    share >= 0.5 ? 'A Yes majority' : 'A No majority',
    `verdict ${share >= 0.5 ? 'yes' : 'no'}`,
  );
  const counts = element(
    'p',
    `${format.format(row.yes)} Yes · ${format.format(row.no)} No`,
    'headline-counts num',
  );
  const ranked = [...proposition.districts].sort((a, b) => yesShare(b) - yesShare(a));
  const range = element(
    'p',
    `Strongest in District ${ranked[0].district} (${percent(yesShare(ranked[0]))}); weakest in District ${ranked.at(-1).district} (${percent(yesShare(ranked.at(-1)))}).`,
    'headline-range',
  );
  $('headline').replaceChildren(element('p', where, 'eyebrow'), figure, verdict, counts, range);
}

function strip() {
  const host = $('strip');
  const city = yesShare(proposition.citywide);
  $('strip-city').style.setProperty('--x', String(city));
  // Stack districts that would overlap into rows, in share order.
  const rows = [];
  const placed = [...proposition.districts]
    .map((row) => ({ id: row.district, x: yesShare(row) }))
    .sort((a, b) => a.x - b.x)
    .map((dot) => {
      let row = 0;
      while (rows[row] !== undefined && dot.x - rows[row] < 0.035) row++;
      rows[row] = dot.x;
      return { ...dot, row };
    });
  for (const { id, x, row } of placed) {
    let dot = host.querySelector(`[data-district="${id}"]`);
    if (!dot) {
      dot = element('span', String(id), 'strip-dot');
      dot.dataset.district = String(id);
      host.append(dot);
    }
    dot.style.setProperty('--x', String(x));
    dot.style.setProperty('--row', String(row));
    dot.style.setProperty('--fill', diverging(x));
    dot.style.setProperty('--dot-ink', divergingInk(x));
    dot.classList.toggle('is-selected', id === district);
  }
  host.style.setProperty('--rows', String(rows.length));
}

function ranking() {
  const sorted = [...proposition.districts].sort((a, b) => yesShare(b) - yesShare(a));
  reorderList(
    $('ranking'),
    'district',
    sorted.map((row, index) => {
      const share = yesShare(row);
      const button = element('button', undefined, 'rank-row');
      button.type = 'button';
      button.dataset.district = String(row.district);
      button.setAttribute('aria-pressed', String(row.district === district));
      button.setAttribute('aria-label', `District ${row.district}: ${percent(share)} Yes`);
      const bar = element('span', undefined, 'rank-bar');
      bar.setAttribute('aria-hidden', 'true');
      const fill = element('i', undefined, 'grow-bar');
      fill.style.setProperty('--v', String(share));
      fill.style.setProperty('--from', String(shownBars.get(row.district) ?? 0));
      fill.style.setProperty('--i', String(index));
      fill.style.background = diverging(share);
      shownBars.set(row.district, share);
      bar.append(fill);
      button.append(
        element('span', `District ${row.district}`, 'rank-name'),
        bar,
        element('span', percent(share), 'rank-value num'),
      );
      button.addEventListener('click', () =>
        selectDistrict(row.district === district ? 0 : row.district),
      );
      return button;
    }),
  );
}

function render(first = false) {
  $('prop-eyebrow').textContent =
    `Proposition ${proposition.number} · ${propositions.indexOf(proposition) + 1} of ${propositions.length}`;
  const title = $('prop-title');
  if (title.textContent !== proposition.title) {
    title.textContent = proposition.title;
    if (!first) staggerChildren(title.parentElement);
  }
  $('proposition').value = String(proposition.number);
  $('clear-district').hidden = !district;
  for (const button of document.querySelectorAll('.multiple'))
    button.setAttribute('aria-current', String(Number(button.dataset.prop) === proposition.number));
  map?.paint((id) => ({ fill: diverging(yesShare(districtRow(id))) }));
  map?.select(district);
  headline();
  strip();
  ranking();
  const hash = new URLSearchParams({ prop: String(proposition.number) });
  if (district) hash.set('district', String(district));
  history.replaceState(null, '', `#${hash}`);
}

function choose(number) {
  proposition = propositions.find((item) => item.number === number) ?? proposition;
  render();
}
function selectDistrict(id) {
  district = id;
  render();
}
function step(offset) {
  const index = propositions.indexOf(proposition);
  choose(propositions[(index + offset + propositions.length) % propositions.length].number);
}

for (const item of propositions)
  $('proposition').add(new Option(`Prop ${item.number} · ${item.title}`, String(item.number)));
$('proposition').addEventListener('change', (event) => choose(Number(event.target.value)));
$('prev-prop').addEventListener('click', () => step(-1));
$('next-prop').addEventListener('click', () => step(1));
$('clear-district').addEventListener('click', () => selectDistrict(0));
$('download-svg').addEventListener('click', () => {
  const blob = new Blob([map?.snapshot() ?? ''], { type: 'image/svg+xml' });
  const link = element('a');
  link.href = URL.createObjectURL(blob);
  link.download = `sf-prop-${proposition.number}-by-district.svg`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

buildMultiples();
render(true);
whenVisible(
  $('prop-map'),
  async () => {
    try {
      map = await createDistrictMap($('prop-map'), {
        year: 2022,
        idPrefix: 'props',
        title: 'California proposition votes in San Francisco',
        label: (id) =>
          `District ${id}: ${percent(yesShare(districtRow(id)))} Yes on Proposition ${proposition.number}`,
        onSelect: (id) => selectDistrict(id === district ? 0 : id),
      });
      render(true);
    } catch (error) {
      $('prop-map').textContent = 'The map could not load.';
      console.error(error);
    }
  },
  '300px',
);
