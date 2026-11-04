import { createDistrictMap } from './district-map.js';
import { freshness, validateSnapshot } from './election-model.js';
import { createTrend } from './election-trend.js';

const $ = (id) => document.getElementById(id);
let snapshot;
let map;
let feedFailed = false;
let selectedId = new URLSearchParams(location.search).get('contest') || 'local-A';
const time = (value) =>
  value
    ? new Date(value).toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        timeZoneName: 'short',
      })
    : 'not yet verified';
const scopeName = (c) =>
  ({
    citywide: 'San Francisco',
    statewide: 'California',
    regional: 'Bay Area',
    district: 'District contest',
    'appellate-district': 'First Appellate District',
  })[c.scope] || c.scope;
const label = (c) =>
  c.shortTitle
    ? `${c.id === 'RTM' ? 'RTM' : `Prop ${c.id.split('-').at(-1)}`} · ${c.shortTitle}`
    : c.title;
for (let id = 1; id <= 11; id++) $('region').add(new Option(`District ${id}`, String(id)));
function renderStatus() {
  const state = freshness(snapshot);
  $('status-title').textContent = snapshot.contests.some((c) => c.mediaUpdate)
    ? 'Preliminary results'
    : snapshot.status === 'pending'
      ? 'Awaiting official results'
      : 'Unofficial · uncalled';
  $('check-status').textContent =
    `${state === 'stale' ? 'Stale check · ' : ''}${snapshot.checkedAt ? `Checked ${time(snapshot.checkedAt)}` : 'Not checked yet'} · ${snapshot.checkStatus === 'not-checked' ? 'Source check pending' : snapshot.checkStatus === 'partial' || snapshot.checkStatus === 'error' ? 'Official check incomplete' : 'Official sources'}`;
  $('report-time').textContent = `Local SF report: ${time(snapshot.sourceReportTimestamp)}.`;
  const local = snapshot.sourceChecks?.find((source) => source.id === 'sf-local');
  $('source-detail').textContent =
    local?.status === 'error'
      ? `Official local feed unavailable${local.message?.match(/HTTP \d{3}/)?.[0] ? ` (${local.message.match(/HTTP \d{3}/)[0]})` : ''}. County counts cannot decide statewide or regional outcomes.`
      : 'County counts cannot decide statewide or regional outcomes.';
  if (feedFailed)
    $('check-status').textContent =
      'Feed unavailable · showing last loaded data, which may be stale.';
}
function renderContest(c) {
  const host = $('contests');
  host.classList.remove('is-loading');
  if (!c) {
    host.replaceChildren(
      Object.assign(document.createElement('p'), {
        textContent: 'No matching contests. Change the search or filter.',
      }),
    );
    return;
  }
  const article = document.createElement('article');
  article.dataset.contestId = c.id;
  const meta = Object.assign(document.createElement('p'), {
    className: 'contest-meta',
    textContent: `${c.kind === 'measure' ? (c.id === 'RTM' ? 'Regional measure' : `Proposition ${c.id.split('-').at(-1)}`) : 'Ballot contest'} · ${scopeName(c)} · ${c.mediaUpdate ? 'Preliminary' : 'Uncalled'}`,
  });
  const title = Object.assign(document.createElement('h2'), {
    textContent: c.shortTitle || c.title,
  });
  article.append(meta, title);
  if (c.summary)
    article.append(
      Object.assign(document.createElement('p'), {
        className: 'contest-summary',
        textContent: c.summary,
      }),
    );
  const reported = c.options.some((o) => o.votes !== null);
  const media = c.mediaUpdate;
  if (media?.projection) {
    const update = document.createElement('p');
    update.className = 'result-note';
    update.dataset.mediaProjection = 'true';
    const projection = Object.assign(document.createElement('a'), {
      href: media.projection.sourceUrl,
      textContent: 'Chronicle projects: rejected. Not certified.',
    });
    update.append(projection);
    article.append(update);
  }
  const list = document.createElement('ul');
  list.className = 'vote-list';
  list.setAttribute(
    'aria-label',
    !reported && media ? 'KQED preliminary vote totals' : 'Official vote totals',
  );
  const displayedOptions = !reported && media ? media.options : c.options;
  const total = displayedOptions.reduce((sum, option) => sum + (option.votes || 0), 0);
  for (const option of displayedOptions) {
    const row = document.createElement('li');
    const name = Object.assign(document.createElement('span'), { textContent: option.label });
    const votes = Object.assign(document.createElement('span'), {
      className: 'vote-count',
      textContent: option.votes === null ? 'Pending' : option.votes.toLocaleString('en-US'),
    });
    if (c.kind === 'measure' && option.votes !== null && total > 0) {
      const share = (option.votes / total) * 100;
      votes.textContent += ` · ${share.toFixed(1)}%`;
      const bar = document.createElement('span');
      bar.className = 'vote-share';
      bar.style.width = `${share}%`;
      bar.setAttribute('aria-hidden', 'true');
      row.append(bar);
    }
    row.append(name, votes);
    list.append(row);
  }
  if (c.resultHistory?.length)
    article.append(
      Object.assign(document.createElement('p'), {
        className: 'result-note',
        textContent: 'Latest reported totals',
      }),
    );
  article.append(list);
  if (!reported && media) {
    const attribution = document.createElement('p');
    attribution.className = 'result-note';
    attribution.dataset.mediaTally = 'true';
    attribution.append(
      Object.assign(document.createElement('a'), {
        href: media.sourceUrl,
        textContent: `${media.sourceName} preliminary tally`,
      }),
      ` · Updated ${time(media.sourceUpdatedAt)}.`,
    );
    article.append(attribution);
  }
  const note = c.resultStatus
    ? `SF county votes only · ${reported ? 'Unofficial' : 'Awaiting votes; source has a zero/pre-election report'}.`
    : media
      ? 'Shares of reported Yes/No votes; not ballot completion.'
      : 'Local results unavailable. Pending means unknown, not zero.';
  article.append(
    Object.assign(document.createElement('p'), {
      className: 'result-note',
      textContent: `${note}${c.resultCheckStatus && c.resultCheckStatus !== 'ok' ? ' Latest source check failed; retained counts may be stale.' : ''}${c.countingMethod === 'ranked-choice-first-choice' ? ' Ranked-choice: first choices do not determine the final winner.' : ''}`,
    }),
  );
  const details = document.createElement('div');
  details.className = 'contest-details';
  const source = Object.assign(document.createElement('a'), {
    href: c.summarySource?.url || c.sourceUrl,
    textContent: c.summarySource
      ? `Official guide · printed page ${c.summarySource.pages}`
      : 'Official ballot source',
  });
  details.append(source);
  if (c.resultStatus) {
    details.append(
      Object.assign(document.createElement('p'), {
        textContent: `SOS report: ${c.sourceReportTime}. Fetched: ${time(c.resultsFetchedAt)}.`,
      }),
    );
    details.append(
      Object.assign(document.createElement('a'), {
        href: c.resultSourceUrl,
        textContent: 'Official SF county count',
      }),
    );
  }
  article.append(details, createTrend(c));
  host.replaceChildren(article);
}
function render() {
  if (!snapshot) return;
  renderStatus();
  const district = Number($('region').value);
  const query = $('ballot-search').value.toLocaleLowerCase().trim();
  const kind = $('contest-kind').value;
  const contests = snapshot.contests.filter(
    (c) =>
      (kind === 'all' || c.kind === kind) &&
      (!district || !c.supervisorialDistrict || c.supervisorialDistrict === district) &&
      `${label(c)} ${c.title} ${c.shortTitle || ''} ${c.summary || ''} ${c.options.map((o) => o.label).join(' ')}`
        .toLocaleLowerCase()
        .includes(query),
  );
  if (!contests.some((c) => c.id === selectedId)) selectedId = contests[0]?.id || '';
  const picker = $('contest-select');
  picker.replaceChildren(
    ...contests.map((c) => new Option(label(c), c.id, false, c.id === selectedId)),
  );
  picker.disabled = !contests.length;
  if (!contests.length) picker.add(new Option('No matches', ''));
  $('match-count').textContent =
    `${contests.length} ${contests.length === 1 ? 'contest' : 'contests'}`;
  renderContest(contests.find((c) => c.id === selectedId));
  $('region-status').textContent =
    `${district ? `District ${district}: ` : ''}district vote totals unavailable. Map shows boundaries only.`;
  map?.select(district);
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
    snapshot = validateSnapshot(await response.json());
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
$('refresh').addEventListener('click', refresh);
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
createDistrictMap($('election-map'), {
  year: 2022,
  idPrefix: 'november-2026',
  title: 'Supervisor district boundaries — vote totals unavailable',
  label: (id) => `District ${id}: vote totals unavailable`,
  onSelect: (id) => {
    $('region').value = String(id);
    render();
  },
})
  .then((value) => {
    map = value;
    map.paint(() => ({ fill: '#d9d8cf' }));
    if (snapshot) map.select(Number($('region').value));
  })
  .catch(() => {
    $('election-map').textContent = 'Map unavailable. Use the district selector.';
  });
refresh();
setInterval(refresh, 10 * 60_000);
setInterval(() => {
  if (snapshot) renderStatus();
}, 60_000);
