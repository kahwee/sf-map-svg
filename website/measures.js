import { renderSFMap } from '@kahwee/sf-map-svg';
import election from '../data/elections/2026-06-02.json';
import { passed, shareColor, yesShare } from './measures-model.js';

const $ = (id) => document.getElementById(id);
const format = new Intl.NumberFormat('en-US');
const percent = (share) => (share === null ? 'No votes' : `${(share * 100).toFixed(2)}%`);
const node = (tag, text) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
};
for (const m of election.measures) $('measure').add(new Option(`${m.id} · ${m.title}`, m.id));
for (let d = 1; d <= 11; d++) $('district').add(new Option(`District ${d}`, String(d)));
$('workbook').href = election.source;
$('certification').href = election.certificationSource;
// Only renderer-generated SVG is inserted; all data and URL state use textContent or validated values.
$('results-map').innerHTML = renderSFMap({
  year: 2022,
  title: 'San Francisco district ballot measure results',
  idPrefix: 'measures',
});
const svg = $('results-map').querySelector('svg');
svg.setAttribute('role', 'group');
svg.setAttribute('aria-label', 'Choose a district to view its vote counts');
const paths = [...svg.querySelectorAll('[data-layer="district-fills"] path')];
for (const path of paths) {
  path.setAttribute('role', 'button');
  path.setAttribute('tabindex', '0');
  const choose = () => {
    $('district').value = path.dataset.district;
    update();
  };
  path.addEventListener('click', choose);
  path.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose();
    }
  });
}
function update(writeUrl = true) {
  const measure = election.measures.find((m) => m.id === $('measure').value);
  const district = Number($('district').value);
  const votes = district
    ? measure.districts.find((d) => d.district === district)
    : measure.citywide;
  $('measure-title').textContent = `Measure ${measure.id} · ${measure.title}`;
  $('outcome').textContent =
    `${passed(measure) ? 'Passed' : 'Did not pass'} citywide · Certified results`;
  $('threshold').textContent =
    `Required ${measure.threshold === 'two-thirds' ? 'two-thirds (66⅔%)' : 'more than 50%'} Yes citywide. Received ${percent(yesShare(measure.citywide))} Yes.`;
  $('official-measure').href = measure.sourceUrl;
  const heading = node('h2', district ? `District ${district}` : 'All San Francisco');
  heading.id = 'area-title';
  const big = node('p', `${percent(yesShare(votes))} Yes`);
  big.className = 'share-number';
  const bar = node('div');
  bar.className = 'vote-bar';
  bar.setAttribute('aria-hidden', 'true');
  const yes = node('span');
  yes.style.width = `${(yesShare(votes) ?? 0) * 100}%`;
  bar.append(yes);
  const details = node('dl');
  for (const [label, value] of [
    ['Yes votes', votes.yes],
    ['No votes', votes.no],
    ['Valid votes', votes.yes + votes.no],
    ['Undervotes', votes.undervotes],
    ['Overvotes', votes.overvotes],
  ])
    details.append(node('dt', label), node('dd', format.format(value)));
  $('area-summary').replaceChildren(heading, big, bar, details);
  for (const path of paths) {
    const row = measure.districts.find((d) => d.district === Number(path.dataset.district));
    path.setAttribute('fill', shareColor(yesShare(row)));
    path.setAttribute('aria-label', `District ${row.district}: ${percent(yesShare(row))} Yes`);
    path.setAttribute('aria-pressed', String(row.district === district));
  }
  const rows = [...measure.districts];
  if ($('sort').value === 'yes') rows.sort((a, b) => yesShare(b) - yesShare(a));
  $('table-caption').textContent =
    `Measure ${measure.id} · Yes share of valid votes. Select a district for details.`;
  $('district-rows').replaceChildren(
    ...rows.map((row) => {
      const tr = node('tr');
      tr.dataset.selected = String(row.district === district);
      const th = node('th');
      th.scope = 'row';
      const button = node('button', `District ${row.district}`);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(row.district === district));
      button.addEventListener('click', () => {
        $('district').value = String(row.district);
        update();
        $('district').focus();
      });
      th.append(button);
      tr.append(th);
      for (const value of [
        format.format(row.yes),
        format.format(row.no),
        percent(yesShare(row)),
        format.format(row.yes + row.no),
      ])
        tr.append(node('td', value));
      return tr;
    }),
  );
  $('share-status').textContent = '';
  if (writeUrl) history.replaceState(null, '', `#measure=${measure.id}&district=${district}`);
}
function restore() {
  const params = new URLSearchParams(location.hash.slice(1));
  $('measure').value = election.measures.some((m) => m.id === params.get('measure'))
    ? params.get('measure')
    : 'A';
  const district = Number(params.get('district'));
  $('district').value = String(
    Number.isInteger(district) && district >= 0 && district <= 11 ? district : 0,
  );
  update(false);
}
for (const id of ['measure', 'district', 'sort']) $(id).addEventListener('change', () => update());
window.addEventListener('hashchange', restore);
$('share').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $('share-status').textContent = 'Link copied.';
  } catch {
    $('share-status').textContent = 'Copy the address from your browser to share this view.';
  }
});
restore();
