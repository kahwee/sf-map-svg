import { renderElectionChart } from './election-chart.js';

const make = (tag, text, className) =>
  Object.assign(document.createElement(tag), {
    textContent: text || '',
    className: className || '',
  });
const observedTime = (iso) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'short' });
function createHistoryTable({ points, values, selectedLabel, media, unit, share, batch, format }) {
  const tableHost = make('div', '', 'history-table-wrap');
  tableHost.tabIndex = 0;
  tableHost.setAttribute('role', 'region');
  tableHost.setAttribute(
    'aria-label',
    `${unit} data; scroll to see earlier and later observations`,
  );
  const table = document.createElement('table');
  table.append(
    make('caption', `${selectedLabel} — exact ${media ? 'newsroom' : 'batch'} observations`),
  );
  const head = document.createElement('thead');
  const header = document.createElement('tr');
  for (const text of [
    media ? 'Publisher page updated (Pacific)' : 'Official report time',
    'First observed (Pacific)',
    share ? 'Vote share' : 'Votes',
  ]) {
    const th = make('th', text);
    th.scope = 'col';
    header.append(th);
  }
  head.append(header);
  table.append(head);
  const body = document.createElement('tbody');
  points.forEach((p, i) => {
    const row = document.createElement('tr');
    if (i === batch) row.setAttribute('aria-current', 'true');
    const report = document.createElement('td');
    const link = make('a', p.sourceReportTime);
    link.href = p.resultSourceUrl;
    report.append(link);
    row.append(report, make('td', observedTime(p.observedAt)), make('td', format(values[i])));
    body.append(row);
  });
  table.append(body);
  tableHost.append(table);
  return tableHost;
}

export function createTrend(contest, state = {}) {
  const section = make('section', '', 'batch-history');
  const media = !contest.resultHistory?.length && !!contest.mediaHistory?.length;
  const unit = media ? 'Observation' : 'Batch';
  const units = media ? 'observations' : 'batches';
  section.setAttribute(
    'aria-label',
    media ? 'Newsroom observation history' : 'Reported batch history',
  );
  section.append(make('h3', media ? 'Newsroom observations' : 'Reported batches'));
  // Adapt only the presentation; never put newsroom records in resultHistory.
  const points = media
    ? contest.mediaHistory.map((p) => ({
        ...p,
        sourceReportTime: `${p.sourceName} · ${observedTime(p.sourceUpdatedAt)}`,
        resultSourceUrl: p.sourceUrl,
      }))
    : contest.resultHistory || [];
  if (!points.length) {
    const empty = make('div', '', 'batch-empty');
    empty.append(
      make('span', '○', 'batch-empty-mark'),
      make('p', 'Awaiting first batch with verified votes.'),
    );
    empty.firstChild.setAttribute('aria-hidden', 'true');
    section.append(empty);
    return section;
  }
  const controls = make('div', '', 'trend-controls');
  const optionLabel = make('label', 'View option');
  const optionSelect = document.createElement('select');
  optionSelect.setAttribute('aria-label', 'View option');
  for (const option of contest.options) optionSelect.add(new Option(option.label, option.id));
  if (contest.options.some((o) => o.id === state.optionId)) optionSelect.value = state.optionId;
  optionLabel.append(optionSelect);
  const metricLabel = make('label', 'Measure');
  const metricSelect = document.createElement('select');
  metricSelect.setAttribute('aria-label', 'Measure');
  metricSelect.add(new Option('Reported votes', 'votes'));
  metricSelect.add(new Option('Reported vote share', 'share'));
  metricSelect.value = state.metric === 'share' ? 'share' : 'votes';
  metricLabel.append(metricSelect);
  controls.append(optionLabel, metricLabel);
  const pointKey = (point) =>
    JSON.stringify([
      media ? 'media' : 'official',
      point.observedAt,
      point.sourceReportTime,
      point.resultSourceUrl,
      point.options,
    ]);
  const savedBatch = state.atLatest
    ? -1
    : points.findIndex((point) => pointKey(point) === state.observationKey);
  let batch = savedBatch < 0 ? points.length - 1 : savedBatch;
  const navigation = make('div', '', 'batch-navigation');
  const previous = make('button', '← Previous');
  previous.type = 'button';
  const next = make('button', 'Next →');
  next.type = 'button';
  const position = make('span', '', 'batch-position');
  navigation.append(previous, position, next);
  const rangeLabel = make('label', '', 'batch-range-label');
  const exploreLabel = media ? 'Explore newsroom observations' : 'Explore observed batches';
  const rangeText = make('span', exploreLabel);
  const range = document.createElement('input');
  range.setAttribute('aria-label', exploreLabel);
  range.type = 'range';
  range.min = '0';
  range.max = String(points.length - 1);
  range.step = '1';
  range.value = String(batch);
  range.disabled = points.length < 2;
  rangeLabel.append(rangeText, range);
  const panel = make('div', '', 'trend-panel');
  panel.setAttribute('aria-live', 'polite');
  const evidence = make('div', '', 'trend-evidence');
  const viewToggle = make('div', '', 'trend-view-toggle');
  viewToggle.setAttribute('role', 'group');
  viewToggle.setAttribute('aria-label', 'History view');
  const chartButton = make('button', 'Chart');
  const tableButton = make('button', 'Table');
  chartButton.type = tableButton.type = 'button';
  for (const [button, view] of [
    [chartButton, 'chart'],
    [tableButton, 'table'],
  ]) {
    button.addEventListener('click', () => {
      state.view = view;
      draw();
    });
    viewToggle.append(button);
  }
  const historyHeader = make('div', '', 'history-heading');
  historyHeader.append(section.querySelector('h3'), viewToggle);
  section.prepend(historyHeader);
  section.append(panel, controls, navigation, rangeLabel, evidence);
  function draw() {
    const selected = contest.options.find((o) => o.id === optionSelect.value);
    const share = metricSelect.value === 'share';
    state.optionId = selected.id;
    state.metric = metricSelect.value;
    state.observationKey = pointKey(points[batch]);
    state.atLatest = batch === points.length - 1;
    const values = points.map((p) => {
      const votes = p.options.find((o) => o.id === selected.id).votes;
      return share ? (100 * votes) / p.options.reduce((sum, o) => sum + o.votes, 0) : votes;
    });
    const format = (v) => (share ? `${v.toFixed(1)}%` : v.toLocaleString('en-US'));
    const last = values[batch];
    const change = batch > 0 ? last - values[batch - 1] : null;
    range.value = String(batch);
    range.setAttribute(
      'aria-valuetext',
      `${unit} ${batch + 1} of ${points.length}; report ${points[batch].sourceReportTime}; first observed ${observedTime(points[batch].observedAt)}`,
    );
    position.textContent = `${batch + 1} / ${points.length}`;
    previous.disabled = batch === 0;
    next.disabled = batch === points.length - 1;
    const delta =
      change === null
        ? points.length === 1
          ? `One ${unit.toLowerCase()}; no trend yet.`
          : `First ${unit.toLowerCase()}.`
        : `Change: ${change > 0 ? '+' : ''}${share ? `${change.toFixed(1)} percentage points` : `${change.toLocaleString('en-US')} votes`}.`;
    const headline = make(
      'p',
      `${unit} ${batch + 1} · ${selected.label}: ${format(last)} · ${delta}`,
      'trend-value',
    );
    const svg = new DOMParser().parseFromString(
      renderElectionChart(values, {
        share,
        batch,
        unit,
        label: `${selected.label}, ${share ? 'share of reported votes' : 'reported votes'}, ${points.length} ${media ? 'newsroom ' : 'reported '}${points.length === 1 ? unit.toLowerCase() : units}. ${delta}`,
      }),
      'image/svg+xml',
    ).documentElement;
    const note = make(
      'p',
      media
        ? `${contest.mediaUpdate?.resultGeography?.name || 'SF citywide'} · newsroom observations from the linked publishers. Steps compare cumulative published tallies, not newly cast ballots. Publisher update times are not official report times.`
        : 'SF county only · equally spaced reports and revisions. Changes are cumulative tally updates, not newly cast ballots. Share is of reported votes, not turnout.',
      'result-note',
    );
    const tableHost = createHistoryTable({
      points,
      values,
      selectedLabel: selected.label,
      media,
      unit,
      share,
      batch,
      format,
    });
    const tableView = state.view === 'table';
    chartButton.setAttribute('aria-pressed', String(!tableView));
    tableButton.setAttribute('aria-pressed', String(tableView));
    svg.hidden = tableView;
    if (tableView) svg.setAttribute('style', 'display:none');
    tableHost.hidden = !tableView;
    const source = make('p', '', 'trend-selected-source');
    const sourceLink = make(
      'a',
      `${media ? 'Publisher update' : 'Official report'}: ${points[batch].sourceReportTime}`,
    );
    sourceLink.href = points[batch].resultSourceUrl;
    source.append(
      sourceLink,
      document.createTextNode(` · Observed ${observedTime(points[batch].observedAt)}`),
    );
    panel.replaceChildren(headline, svg, tableHost);
    evidence.replaceChildren(source, note);
  }
  previous.addEventListener('click', () => {
    if (batch > 0) {
      batch--;
      draw();
    }
  });
  next.addEventListener('click', () => {
    if (batch < points.length - 1) {
      batch++;
      draw();
    }
  });
  range.addEventListener('input', () => {
    batch = Number(range.value);
    draw();
  });
  optionSelect.addEventListener('change', draw);
  metricSelect.addEventListener('change', draw);
  draw();
  return section;
}
