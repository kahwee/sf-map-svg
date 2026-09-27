import { createSFMapWithData } from '@kahwee/sf-map-svg/custom-map';
import catalog from '../data/candidates/catalog.json';
import coast from '../data/coast.json';
import districts from '../data/districts-2022.json';
import { shareColor } from './measures-model.js';
import { growMap } from './motion-kit.js';

const $ = (id) => document.getElementById(id);
const numbers = new Intl.NumberFormat('en-US');
const percent = (share) => (share === null ? 'No eligible votes' : `${(100 * share).toFixed(1)}%`);
const params = new URLSearchParams(location.hash.slice(1));
let paths = [];
const shownBars = new Map();
let mapYear;
let election;
let contest;
let person = 0;
let district = Number(params.get('district')) || 0;
let requestId = 0;
for (const choice of catalog.elections)
  $('candidate-election').add(
    new Option(`${choice.label} · ${choice.contestCount} contests`, choice.date),
  );
async function makeMap(year) {
  if (year === mapYear) return;
  const collection =
    year === 2022 ? districts : (await import('../data/districts-2012.json')).default;
  const mapData = {
    coast: coast.features[0].geometry,
    districts: {
      [year]: collection.features.map(({ geometry, properties }) => ({
        id: properties.district,
        label: properties.label,
        labelPoints: properties.labelPoints,
        geometry,
        extras: properties.displayExtras,
      })),
    },
  };
  const result = createSFMapWithData(
    { year, title: 'Candidate votes cast in San Francisco', idPrefix: 'candidates' },
    mapData,
  );
  $('candidate-map').innerHTML = result.svg;
  const map = $('candidate-map').querySelector('svg');
  growMap($('candidate-map'));
  map.setAttribute('role', 'group');
  map.setAttribute(
    'aria-label',
    'San Francisco candidate vote map; choose a district with Tab and Enter',
  );
  paths = [...map.querySelectorAll('[data-layer="district-fills"] path')];
  for (const path of paths) {
    path.setAttribute('tabindex', '0');
    path.setAttribute('role', 'button');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    path.append(title);
    const select = () => {
      district = Number(path.dataset.district);
      render();
    };
    path.addEventListener('click', select);
    path.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
  }
  mapYear = year;
  document.querySelector('.prop-map-panel .eyebrow').textContent =
    `${year} supervisorial boundaries`;
}
const share = (result) => (result?.totalVotes ? result.votes[person] / result.totalVotes : null);
const selectedName = () => contest.candidates[person].name;
function render() {
  const name = selectedName();
  $('candidate-map-title').textContent = `${name} · Vote share`;
  const area = contest.districts.find((row) => row.district === district) ?? contest.citywide;
  const value = share(area);
  $('candidate-selection').textContent =
    `${district ? `District ${district}` : 'San Francisco'}: ${percent(value)} for ${name}${area?.totalVotes ? ` · ${numbers.format(area.votes[person])} of ${numbers.format(area.totalVotes)} valid votes` : ''}`;
  $('candidate-clear').hidden = !district;
  for (const path of paths) {
    const row = contest.districts[Number(path.dataset.district) - 1];
    const ratio = share(row);
    const label = `District ${row.district}: ${percent(ratio)} for ${name}${ratio === null ? '; outside contest area' : `, ${numbers.format(row.votes[person])} of ${numbers.format(row.totalVotes)} votes`}${row.partiallyEligible ? '; only part of this supervisorial district was eligible' : ''}`;
    path.setAttribute('fill', ratio === null ? '#d8dedb' : shareColor(ratio));
    path.setAttribute('stroke-width', row.district === district ? '2.5' : '1');
    path.setAttribute('stroke-dasharray', row.partiallyEligible ? '5 3' : 'none');
    path.setAttribute('aria-label', label);
    path.setAttribute('aria-pressed', String(row.district === district));
    path.querySelector('title').textContent = label;
  }
  $('candidate-list').replaceChildren(
    ...[...contest.districts]
      .sort((a, b) => (share(b) ?? -1) - (share(a) ?? -1))
      .map((row, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-pressed', String(district === row.district));
        const label = document.createElement('span');
        label.textContent = `District ${row.district}`;
        const bar = document.createElement('span');
        bar.className = 'bar';
        bar.setAttribute('aria-hidden', 'true');
        const fill = document.createElement('i');
        fill.className = 'grow-bar';
        fill.style.setProperty('--v', String(share(row) ?? 0));
        fill.style.setProperty('--from', String(shownBars.get(row.district) ?? 0));
        fill.style.setProperty('--i', String(index));
        shownBars.set(row.district, share(row) ?? 0);
        bar.append(fill);
        const value = document.createElement('span');
        value.textContent = percent(share(row));
        button.append(label, bar, value);
        button.addEventListener('click', () => {
          district = row.district;
          render();
        });
        return button;
      }),
  );
  $('candidate-method').textContent = election.method;
  $('candidate-geography').textContent = election.geography;
  const hash = new URLSearchParams({
    election: election.electionDate,
    contest: contest.id,
    candidate: String(person),
  });
  if (district) hash.set('district', String(district));
  history.replaceState(null, '', `#${hash}`);
}
function chooseContest(id, candidateIndex) {
  contest = election.contests.find((item) => item.id === id) ?? election.contests[0];
  $('candidate-contest').value = contest.id;
  const select = $('candidate-person');
  select.replaceChildren(
    ...contest.candidates.map(
      (item, index) =>
        new Option(`${item.name}${item.party ? ` · ${item.party}` : ''}`, String(index)),
    ),
  );
  person =
    Number.isInteger(candidateIndex) &&
    candidateIndex >= 0 &&
    candidateIndex < contest.candidates.length
      ? candidateIndex
      : contest.citywide.votes.indexOf(Math.max(...contest.citywide.votes));
  select.value = String(person);
  render();
}
async function chooseElection(date, contestId, candidateIndex) {
  const choice = catalog.elections.find((item) => item.date === date) ?? catalog.elections.at(-1);
  const current = ++requestId;
  $('candidate-election').value = choice.date;
  $('candidate-status').textContent = `Loading ${choice.label}…`;
  try {
    const response = await fetch(`./data/candidates/${choice.file}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (current !== requestId) return;
    await makeMap(data.districtYear);
    if (current !== requestId) return;
    election = data;
    $('candidate-contest').replaceChildren(
      ...data.contests.map((item) => new Option(item.title, item.id)),
    );
    $('candidate-workbook').href = data.source;
    $('candidate-json').href = `./data/candidates/${choice.file}`;
    $('candidate-status').textContent =
      `${data.contests.length} certified contests · downloaded ${data.downloadedDate}`;
    chooseContest(contestId, candidateIndex);
  } catch (error) {
    if (current === requestId)
      $('candidate-status').textContent = `Could not load this election: ${error.message}`;
  }
}
$('candidate-election').addEventListener('change', () => {
  district = 0;
  chooseElection($('candidate-election').value);
});
$('candidate-contest').addEventListener('change', () => {
  district = 0;
  chooseContest($('candidate-contest').value);
});
$('candidate-person').addEventListener('change', () => {
  person = Number($('candidate-person').value);
  render();
});
$('candidate-clear').addEventListener('click', () => {
  district = 0;
  render();
});
chooseElection(
  params.get('election') || '2024-11-05',
  params.get('contest') || 'united-states-senator',
  params.has('candidate') ? Number(params.get('candidate')) : undefined,
);
