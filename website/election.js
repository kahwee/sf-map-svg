import { createDistrictMap } from './district-map.js';
import { freshness, validateSnapshot } from './election-model.js';

const $ = (id) => document.getElementById(id);
let snapshot;
let map;
const time = (value) =>
  value
    ? new Date(value).toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        timeZoneName: 'short',
      })
    : 'not yet verified';
for (let id = 1; id <= 11; id++) $('region').add(new Option(`District ${id}`, String(id)));
function render() {
  if (!snapshot) return;
  const state = freshness(snapshot);
  $('status-title').textContent =
    snapshot.status === 'pending' ? 'Awaiting verified results' : 'Unofficial results · uncalled';
  $('check-status').textContent =
    `${state === 'stale' ? 'Stale check — refresh overdue. ' : state === 'source-error' ? 'Official source check unavailable. ' : ''}${snapshot.message}`;
  $('report-time').textContent =
    `Official report time: ${time(snapshot.sourceReportTimestamp)}. Last successful results fetch: ${time(snapshot.lastSuccessfulFetchAt)}.`;
  $('fetch-time').textContent =
    `Last check attempt: ${time(snapshot.checkedAt)}. Page data generated: ${time(snapshot.generatedAt)}.`;
  const district = Number($('region').value);
  $('region-status').textContent =
    `${district ? `District ${district}: ` : ''}verified geographic vote totals are not available in this feed. No result colors are assigned.`;
  map?.select(district);
  const query = $('ballot-search').value.toLocaleLowerCase().trim();
  const cards = snapshot.contests
    .filter(
      (c) =>
        (!district || !c.supervisorialDistrict || c.supervisorialDistrict === district) &&
        `${c.title} ${c.options.map((o) => o.label).join(' ')}`.toLocaleLowerCase().includes(query),
    )
    .map((c) => {
      const article = document.createElement('article');
      const title = document.createElement('h3');
      title.textContent = c.title;
      const status = document.createElement('p');
      status.textContent = `${c.scope} · Uncalled${c.countingMethod === 'ranked-choice-first-choice' ? ' · Ranked-choice contest' : ''}`;
      const list = document.createElement('ul');
      for (const option of c.options) {
        const row = document.createElement('li');
        const label = document.createElement('span');
        const votes = document.createElement('span');
        label.textContent = option.label;
        votes.textContent =
          option.votes === null ? 'Pending' : option.votes.toLocaleString('en-US');
        row.append(label, votes);
        list.append(row);
      }
      article.append(title, status, list);
      if (c.rosterStatus) {
        const note = document.createElement('p');
        note.textContent =
          c.rosterStatus === 'verified-official-roster'
            ? 'Candidates verified against the official roster.'
            : 'Pamphlet statement names only; roster may be incomplete.';
        article.append(note);
      }
      return article;
    });
  $('contests').replaceChildren(...cards);
}
async function refresh() {
  $('refresh').disabled = true;
  try {
    const response = await fetch('./elections/2026-11-03.json', {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    snapshot = validateSnapshot(await response.json());
    render();
  } catch {
    if (snapshot) render();
    $('check-status').textContent =
      'Feed unavailable. Previously displayed data, if any, is retained and may be stale. Check the official results link.';
  } finally {
    $('refresh').disabled = false;
  }
}
$('refresh').addEventListener('click', refresh);
$('region').addEventListener('change', render);
$('ballot-search').addEventListener('input', render);
createDistrictMap($('election-map'), {
  year: 2022,
  idPrefix: 'november-2026',
  title: 'November 2026 district reference map — results unavailable',
  label: (id) => `District ${id}: results unavailable`,
  onSelect: (id) => {
    $('region').value = String(id);
    render();
  },
})
  .then((value) => {
    map = value;
    map.paint(() => ({ fill: '#d9d8cf' }));
    render();
  })
  .catch(() => {
    $('election-map').textContent = 'Map unavailable. Use the district selector.';
  });
refresh();
setInterval(refresh, 10 * 60_000);
setInterval(render, 60_000);
