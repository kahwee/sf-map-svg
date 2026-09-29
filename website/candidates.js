import catalog from '../data/candidates/catalog.json';
import { createDistrictMap } from './district-map.js';
import { countTo, reorderList, whenVisible } from './motion-kit.js';
import { candidateInks, mix, sequential } from './palette.js';
import { element, enhanceCode, segmented } from './ui.js';

const $ = (id) => document.getElementById(id);
const format = new Intl.NumberFormat('en-US');
const percent = (share) => (share === null ? 'No eligible votes' : `${(share * 100).toFixed(1)}%`);
const paper = '#f3efe2';
const empty = '#d8d3c6';
const shownInks = candidateInks.length - 1;
enhanceCode();

const params = new URLSearchParams(location.hash.slice(1));
const cache = new Map();
let election;
let contest;
let view = params.get('view') === 'share' ? 'share' : 'leader';
let person = params.has('candidate') ? Number(params.get('candidate')) : undefined;
let district = Number(params.get('district')) || 0;
let map;
let shownShare = 0;
const shownBars = new Map();

/** Official sources print many names in capitals; show them in title case. */
function titleCase(name) {
  if (name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .replace(/(^|[\s"'(-])(\p{L})/gu, (_, lead, letter) => lead + letter.toUpperCase())
    .replace(/\bMc(\p{L})/gu, (_, letter) => `Mc${letter.toUpperCase()}`)
    .replace(/\b(Ii|Iii|Iv|Jr|Sr)\b/g, (suffix) =>
      suffix === 'Jr' || suffix === 'Sr' ? suffix : suffix.toUpperCase(),
    );
}
const load = (file) => {
  if (!cache.has(file))
    cache.set(
      file,
      fetch(`./data/candidates/${file}`).then((response) => {
        if (!response.ok) throw new Error(`Could not load ${file}`);
        return response.json();
      }),
    );
  return cache.get(file);
};

// ---------- Derived values ----------
const share = (row, index) => (row?.totalVotes ? row.votes[index] / row.totalVotes : null);
/** Candidate indexes by citywide votes; the leaders get distinct inks. */
function ranking() {
  return contest.candidates
    .map((candidate, index) => ({ ...candidate, index, votes: contest.citywide.votes[index] }))
    .sort((a, b) => b.votes - a.votes);
}
function inkFor(index) {
  const rank = ranking().findIndex((item) => item.index === index);
  return rank < shownInks ? candidateInks[rank] : candidateInks.at(-1);
}
const districtRow = (id) => contest.districts.find((row) => row.district === id);
function leader(row) {
  if (!row?.totalVotes) return null;
  const sorted = row.votes
    .map((votes, index) => ({ votes, index }))
    .sort((a, b) => b.votes - a.votes);
  const margin = (sorted[0].votes - (sorted[1]?.votes ?? 0)) / row.totalVotes;
  return { index: sorted[0].index, margin };
}
function shareScaleMax() {
  const values = contest.districts
    .map((row) => share(row, person))
    .filter((value) => value !== null);
  return Math.max(0.1, Math.ceil(Math.max(...values) * 10) / 10);
}
function fillFor(id) {
  const row = districtRow(id);
  if (!row?.totalVotes) return empty;
  if (view === 'share') return sequential(share(row, person) / shareScaleMax());
  const top = leader(row);
  return mix(paper, inkFor(top.index), 0.35 + 0.65 * Math.min(1, top.margin / 0.35));
}
function labelFor(id) {
  const row = districtRow(id);
  if (!row?.totalVotes) return `District ${id}: no eligible voters in this contest`;
  const partial = row.partiallyEligible ? '; only part of this district was eligible' : '';
  if (view === 'share')
    return `District ${id}: ${percent(share(row, person))} for ${titleCase(contest.candidates[person].name)}${partial}`;
  const top = leader(row);
  return `District ${id}: led by ${titleCase(contest.candidates[top.index].name)} with ${percent(share(row, top.index))}${partial}`;
}

// ---------- Rendering ----------
function headline() {
  const row = district ? districtRow(district) : contest.citywide;
  const where = district ? `District ${district}` : 'All San Francisco';
  const index = view === 'share' ? person : (leader(row)?.index ?? ranking()[0].index);
  const value = share(row, index);
  const name = titleCase(contest.candidates[index].name);
  const figure = element('p', undefined, 'headline-figure');
  const counter = element('span');
  counter.setAttribute('aria-hidden', 'true');
  figure.append(element('span', percent(value), 'sr-only'), counter);
  if (value === null) counter.textContent = '—';
  else
    countTo(counter, value * 100, {
      from: shownShare * 100,
      duration: 700,
      format: (number) => `${number.toFixed(1)}%`,
    });
  shownShare = value ?? 0;
  const who = element('p', undefined, 'headline-who');
  const swatch = element('i', undefined, 'swatch');
  swatch.style.background = inkFor(index);
  who.append(swatch, element('span', `${view === 'share' ? '' : 'Led by '}${name}`));
  const counts = element(
    'p',
    row?.totalVotes
      ? `${format.format(row.votes[index])} of ${format.format(row.totalVotes)} valid votes`
      : 'No eligible voters in this contest.',
    'headline-counts num',
  );
  $('vote-headline').replaceChildren(element('p', where, 'eyebrow'), figure, who, counts);
}

function leaderboard() {
  const leaders = ranking();
  const top = leaders.slice(0, shownInks);
  const rest = leaders.slice(shownInks);
  const items = top.map((candidate, rank) => {
    const value = candidate.votes / contest.citywide.totalVotes;
    const li = element('li');
    li.dataset.candidate = String(candidate.index);
    const button = element('button', undefined, 'leader-row');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(view === 'share' && person === candidate.index));
    const swatch = element('i', undefined, 'swatch');
    swatch.style.background = candidateInks[rank];
    const bar = element('span', undefined, 'rank-bar');
    bar.setAttribute('aria-hidden', 'true');
    const fill = element('i', undefined, 'grow-bar');
    fill.style.background = candidateInks[rank];
    fill.style.setProperty('--v', String(value));
    fill.style.setProperty('--from', String(shownBars.get(`c${candidate.index}`) ?? 0));
    fill.style.setProperty('--i', String(rank));
    shownBars.set(`c${candidate.index}`, value);
    bar.append(fill);
    const name = element('span', undefined, 'leader-name');
    name.append(swatch, element('span', titleCase(candidate.name)));
    if (candidate.party) name.append(element('span', candidate.party, 'party'));
    button.append(name, bar, element('span', percent(value), 'rank-value num'));
    button.setAttribute(
      'aria-label',
      `${titleCase(candidate.name)}: ${percent(value)} citywide. Show their share by district.`,
    );
    button.addEventListener('click', () => {
      person = candidate.index;
      view = 'share';
      viewControl.set('share');
      render();
    });
    li.append(button);
    return li;
  });
  if (rest.length) {
    const votes = rest.reduce((sum, item) => sum + item.votes, 0);
    const li = element(
      'li',
      `${rest.length} other ${rest.length === 1 ? 'candidate' : 'candidates'} · ${percent(votes / contest.citywide.totalVotes)} together`,
      'leader-rest',
    );
    li.dataset.candidate = 'rest';
    items.push(li);
  }
  reorderList($('leaderboard'), 'candidate', items);
}

function districtBars() {
  const leaders = ranking().slice(0, shownInks);
  reorderList(
    $('district-bars'),
    'district',
    contest.districts.map((row, rowIndex) => {
      const button = element('button', undefined, 'district-bar');
      button.type = 'button';
      button.dataset.district = String(row.district);
      button.setAttribute('aria-pressed', String(row.district === district));
      button.setAttribute('aria-label', labelFor(row.district));
      const track = element('span', undefined, 'stack');
      track.setAttribute('aria-hidden', 'true');
      let start = 0;
      if (row.totalVotes)
        for (const [rank, candidate] of leaders.entries()) {
          const value = share(row, candidate.index);
          const segment = element('i', undefined, 'stack-part');
          segment.style.background = candidateInks[rank];
          segment.style.setProperty('--start', String(start));
          segment.style.setProperty('--end', String(start + value));
          segment.style.setProperty('--i', String(rowIndex));
          start += value;
          track.append(segment);
        }
      const top = leader(row);
      const note = row.totalVotes
        ? `${titleCase(contest.candidates[top.index].name)} ${percent(share(row, top.index))}${row.partiallyEligible ? ' · partly eligible' : ''}`
        : 'Not in this contest';
      button.append(
        element('span', `District ${row.district}`, 'rank-name'),
        track,
        element('span', note, 'district-note'),
      );
      button.addEventListener('click', () => select(row.district === district ? 0 : row.district));
      return button;
    }),
  );
}

function paintMap() {
  if (!map) return;
  map.paint((id) => ({ fill: fillFor(id) }));
  map.select(district);
  for (const path of $('vote-map').querySelectorAll('[data-layer="district-lines"] path')) {
    const row = districtRow(Number(path.dataset.district));
    path.classList.toggle('is-partial', Boolean(row?.partiallyEligible));
  }
}

function render() {
  if (view === 'share' && (person === undefined || !contest.candidates[person]))
    person = ranking()[0].index;
  const status = `${election.label} · ${titleCase(contest.title)} · ${election.districtYear} supervisorial districts`;
  $('vote-status').textContent = status;
  $('vote-caption').replaceChildren(
    ...(view === 'share'
      ? [
          element('b', `Share for ${titleCase(contest.candidates[person].name)}.`),
          ` Scale runs from 0% to ${Math.round(shareScaleMax() * 100)}%; gray means no eligible voters.`,
        ]
      : [
          element('b', 'Leading candidate by district.'),
          ' Lighter fills mark closer races; gray means no eligible voters. Dashed outlines were only partly in the contest area.',
        ]),
  );
  headline();
  leaderboard();
  districtBars();
  paintMap();
  $('method-text').textContent = election.data.method;
  $('geography-text').textContent = election.data.geography;
  $('workbook').href = election.data.source;
  $('election-json').href = `./data/candidates/${election.file}`;
  const hash = new URLSearchParams({ election: election.date, contest: contest.id, view });
  if (view === 'share') hash.set('candidate', String(person));
  if (district) hash.set('district', String(district));
  history.replaceState(null, '', `#${hash}`);
}

function select(id) {
  district = id;
  render();
}

async function chooseElection(date) {
  const choice = catalog.elections.find((item) => item.date === date) ?? catalog.elections.at(-1);
  const data = await load(choice.file);
  election = { ...choice, data, districtYear: data.districtYear };
  const contestSelect = $('contest');
  contestSelect.replaceChildren(
    ...data.contests.map((item) => new Option(titleCase(item.title), item.id)),
  );
  const wanted = contest?.id ?? params.get('contest');
  contest = data.contests.find((item) => item.id === wanted) ?? data.contests[0];
  contestSelect.value = contest.id;
  if (person !== undefined && !contest.candidates[person]) person = undefined;
  electionControl.set(choice.date);
  if (map && map.year !== data.districtYear) map.setYear(data.districtYear);
  render();
}

const electionControl = segmented($('election-control'), {
  label: 'Election',
  options: catalog.elections.map((item) => ({
    value: item.date,
    // Each election year appears once, so the year alone is a clear label.
    label: item.date.slice(0, 4),
  })),
  value: params.get('election') ?? catalog.elections.at(-1).date,
  onChange: (date) => chooseElection(date),
});
const viewControl = segmented($('view-control'), {
  label: 'Map shows',
  options: [
    { value: 'leader', label: 'Leader' },
    { value: 'share', label: 'Share' },
  ],
  value: view,
  onChange: (next) => {
    view = next;
    render();
  },
});
$('contest').addEventListener('change', (event) => {
  contest = election.data.contests.find((item) => item.id === event.target.value);
  person = undefined;
  render();
});
$('download-svg').addEventListener('click', () => {
  const blob = new Blob([map?.snapshot() ?? ''], { type: 'image/svg+xml' });
  const link = element('a');
  link.href = URL.createObjectURL(blob);
  link.download = `sf-${election.date}-${contest.id}.svg`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

await chooseElection(params.get('election') ?? catalog.elections.at(-1).date);
whenVisible(
  $('vote-map'),
  async () => {
    try {
      map = await createDistrictMap($('vote-map'), {
        year: election.districtYear,
        idPrefix: 'votes',
        title: 'Candidate votes in San Francisco',
        label: labelFor,
        onSelect: (id) => select(id === district ? 0 : id),
      });
      paintMap();
    } catch (error) {
      $('vote-map').textContent = 'The map could not load.';
      console.error(error);
    }
  },
  '300px',
);
