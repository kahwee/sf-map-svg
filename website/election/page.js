import { freshness, validateSnapshot } from './model.js';
import { createRefreshController, isOlderSnapshot } from './refresh.js';
import { contestLabel, createContestView, formatTime } from './view.js';

const $ = (id) => document.getElementById(id);
let snapshot;
let feedFailed = false;
const chartStates = new Map();
let selectedId = new URLSearchParams(location.search).get('contest') || 'local-A';
for (let id = 1; id <= 11; id++) $('region').add(new Option(`District ${id}`, String(id)));
function renderStatus() {
  const state = freshness(snapshot);
  $('status-title').textContent =
    snapshot.status === 'pending' ? 'Awaiting official results' : 'Unofficial · uncalled';
  $('check-status').textContent =
    `${state === 'stale' ? 'Stale check · ' : ''}${snapshot.checkedAt ? `Official sources checked ${formatTime(snapshot.checkedAt)}` : 'Official sources not checked yet'}`;
  $('report-time').textContent = `Local SF report: ${formatTime(snapshot.sourceReportTimestamp)}.`;
  const local = snapshot.sourceChecks?.find((source) => source.id === 'sf-local');
  $('source-detail').textContent =
    local?.status === 'error'
      ? `Official local feed unavailable${local.message?.match(/HTTP \d{3}/)?.[0] ? ` (${local.message.match(/HTTP \d{3}/)[0]})` : ''}. County counts cannot decide statewide or regional outcomes.`
      : 'County counts cannot decide statewide or regional outcomes.';
  if (feedFailed)
    $('check-status').textContent =
      'Feed unavailable · showing last loaded data, which may be stale.';
}
function renderContest(contest) {
  const host = $('contests');
  host.classList.remove('is-loading');
  if (contest && !chartStates.has(contest.id)) chartStates.set(contest.id, {});
  host.replaceChildren(createContestView(contest, chartStates.get(contest?.id)));
}
function render() {
  if (!snapshot) return;
  renderStatus();
  const district = Number($('region').value);
  const query = $('ballot-search').value.toLocaleLowerCase().trim();
  const kind = $('contest-kind').value;
  $('district-filter').hidden = kind !== 'candidate' && kind !== 'all';
  const contests = snapshot.contests.filter(
    (c) =>
      (kind === 'all' || c.kind === kind) &&
      (!district || !c.supervisorialDistrict || c.supervisorialDistrict === district) &&
      `${contestLabel(c)} ${c.title} ${c.shortTitle || ''} ${c.summary || ''} ${c.options.map((o) => o.label).join(' ')}`
        .toLocaleLowerCase()
        .includes(query),
  );
  if (!contests.some((c) => c.id === selectedId)) selectedId = contests[0]?.id || '';
  const picker = $('contest-select');
  picker.replaceChildren(
    ...contests.map((c) => new Option(contestLabel(c), c.id, false, c.id === selectedId)),
  );
  picker.disabled = !contests.length;
  if (!contests.length) picker.add(new Option('No matches', ''));
  $('match-count').textContent =
    `${contests.length} ${contests.length === 1 ? 'contest' : 'contests'}`;
  renderContest(contests.find((c) => c.id === selectedId));
}
async function refresh() {
  $('refresh').disabled = true;
  try {
    const response = await fetch('./elections/2026-11-03.json', {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const first = !snapshot;
    const incoming = validateSnapshot(await response.json());
    if (isOlderSnapshot(snapshot, incoming)) throw new Error('Older cached feed');
    snapshot = incoming;
    feedFailed = false;
    if (first && location.search) {
      const requested = snapshot.contests.find((c) => c.id === selectedId);
      if (requested) $('contest-kind').value = requested.kind;
    }
    render();
  } catch {
    feedFailed = true;
    if (snapshot) render();
    $('check-status').textContent =
      'Feed unavailable · showing last loaded data, which may be stale.';
  } finally {
    $('refresh').disabled = false;
  }
}
const refreshController = createRefreshController(refresh);
$('refresh').addEventListener('click', refreshController.run);
$('region').addEventListener('change', render);
$('ballot-search').addEventListener('input', render);
$('contest-kind').addEventListener('change', render);
$('contest-select').addEventListener('change', () => {
  selectedId = $('contest-select').value;
  const url = new URL(location.href);
  url.searchParams.set('contest', selectedId);
  history.replaceState(null, '', url);
  renderContest(snapshot.contests.find((c) => c.id === selectedId));
});
// The validated feed currently permits geography.type === 'none' only.
// Render no map until contest-specific geographic returns have a verified contract.
refreshController.run();
setInterval(() => refreshController.ifDue(!document.hidden), 60_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshController.ifDue();
});
setInterval(() => {
  if (snapshot) renderStatus();
}, 60_000);
