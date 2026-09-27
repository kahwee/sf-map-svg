import results from '../data/propositions/2024-11-05.json';
import { displayMapCopy } from './display-map.js';
import { shareColor, yesShare } from './measures-model.js';
import { growMap, reorderList } from './motion-kit.js';

const $ = (id) => document.getElementById(id);
const numbers = new Intl.NumberFormat('en-US');
const percent = (value) => `${(value * 100).toFixed(1)}%`;
const map = await displayMapCopy(2022, {
  idPrefix: 'props',
  title: 'California proposition votes in San Francisco',
});
$('prop-map').replaceChildren(map);
map.style.height = '100%';
map.style.width = '100%';
growMap($('prop-map'));
map.setAttribute('role', 'group');
map.setAttribute(
  'aria-label',
  'San Francisco supervisorial districts. Select a district to inspect its proposition votes.',
);
const shownBars = new Map();
const paths = [...map.querySelectorAll('[data-layer="district-fills"] path')];
let selected = Number(new URLSearchParams(location.hash.slice(1)).get('district')) || 0;
const params = new URLSearchParams(location.hash.slice(1));
let proposition =
  results.propositions.find((item) => item.number === Number(params.get('prop'))) ??
  results.propositions[0];

for (const item of results.propositions) {
  $('proposition').add(new Option(`Prop ${item.number} · ${item.title}`, String(item.number)));
}
function selectDistrict(district) {
  selected = district;
  render();
}
for (const path of paths) {
  path.setAttribute('tabindex', '0');
  path.setAttribute('role', 'button');
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  path.append(title);
  path.addEventListener('click', () => selectDistrict(Number(path.dataset.district)));
  path.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectDistrict(Number(path.dataset.district));
    }
  });
}
function render() {
  const shares = proposition.districts.map(yesShare);
  const low = Math.floor(Math.min(...shares) * 20) / 20;
  const high = Math.ceil(Math.max(...shares) * 20) / 20;
  $('proposition').value = String(proposition.number);
  $('map-title').textContent = `Prop ${proposition.number} · Yes vote share`;
  $('city-share').textContent = `${percent(yesShare(proposition.citywide))} Yes in SF`;
  $('legend-low').textContent = `${Math.round(low * 100)}% Yes`;
  $('legend-high').textContent = `${Math.round(high * 100)}% Yes`;
  const row = proposition.districts.find((district) => district.district === selected);
  $('selection').textContent = row
    ? `District ${selected}: ${percent(yesShare(row))} Yes · ${numbers.format(row.yes)} Yes / ${numbers.format(row.no)} No`
    : `San Francisco: ${percent(yesShare(proposition.citywide))} Yes · ${numbers.format(proposition.citywide.yes)} Yes / ${numbers.format(proposition.citywide.no)} No`;
  $('clear-district').hidden = !selected;
  for (const path of paths) {
    const district = proposition.districts.find(
      (item) => item.district === Number(path.dataset.district),
    );
    if (!district) continue;
    const label = `District ${district.district}: ${percent(yesShare(district))} Yes, ${numbers.format(district.yes)} Yes votes and ${numbers.format(district.no)} No votes on Proposition ${proposition.number}`;
    path.setAttribute('fill', shareColor((yesShare(district) - low) / (high - low)));
    path.setAttribute('stroke-width', district.district === selected ? '2.5' : '1');
    path.setAttribute('aria-label', label);
    path.setAttribute('aria-pressed', String(district.district === selected));
    path.querySelector('title').textContent = label;
  }
  reorderList(
    $('district-list'),
    'district',
    [...proposition.districts]
      .sort((a, b) => yesShare(b) - yesShare(a))
      .map((district, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.district = String(district.district);
        button.setAttribute('aria-pressed', String(district.district === selected));
        button.setAttribute(
          'aria-label',
          `District ${district.district}: ${percent(yesShare(district))} Yes`,
        );
        const name = document.createElement('span');
        name.textContent = `District ${district.district}`;
        const bar = document.createElement('span');
        bar.className = 'bar';
        bar.setAttribute('aria-hidden', 'true');
        const fill = document.createElement('i');
        fill.className = 'grow-bar';
        fill.style.setProperty('--v', String(yesShare(district)));
        fill.style.setProperty('--from', String(shownBars.get(district.district) ?? 0));
        fill.style.setProperty('--i', String(index));
        shownBars.set(district.district, yesShare(district));
        bar.append(fill);
        const value = document.createElement('span');
        value.textContent = percent(yesShare(district));
        button.append(name, bar, value);
        button.addEventListener('click', () => selectDistrict(district.district));
        return button;
      }),
  );
  const hash = new URLSearchParams({ prop: String(proposition.number) });
  if (selected) hash.set('district', String(selected));
  history.replaceState(null, '', `#${hash}`);
}
$('proposition').addEventListener('change', () => {
  proposition = results.propositions.find((item) => item.number === Number($('proposition').value));
  render();
});
$('clear-district').addEventListener('click', () => selectDistrict(0));
render();
