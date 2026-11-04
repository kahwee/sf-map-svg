import { renderElectionChart } from './election-chart.js';
import { attachPointPopover } from './election-chart-interaction.js';
import { mediaReportTime } from './election-media.js';

const make = (tag, text, className) =>
  Object.assign(document.createElement(tag), {
    textContent: text || '',
    className: className || '',
  });
const observedTime = (iso) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'short' });
function createHistoryTable({ points, series, media, unit, share, format }) {
  const tableHost = make('div', '', 'history-table-wrap');
  tableHost.tabIndex = 0;
  tableHost.setAttribute('role', 'region');
  tableHost.setAttribute(
    'aria-label',
    `${unit} data; scroll to see earlier and later observations`,
  );
  const table = document.createElement('table');
  table.append(make('caption', `Exact ${media ? 'newsroom' : 'batch'} observations`));
  const head = document.createElement('thead');
  const header = document.createElement('tr');
  for (const text of [
    media ? 'Publisher page updated (Pacific)' : 'Official report time',
    'First observed (Pacific)',
    ...series.map((s) => `${s.label} ${share ? '(%)' : '(votes)'}`),
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
    const report = document.createElement('td');
    const link = make('a', p.sourceReportTime);
    link.href = p.resultSourceUrl;
    report.append(link);
    row.append(
      report,
      make('td', observedTime(p.observedAt)),
      ...series.map((s) => make('td', format(s.values[i]))),
    );
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
        sourceReportTime: `${p.sourceName} · ${mediaReportTime(p, observedTime)}`,
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
  const compare =
    contest.kind === 'measure' || contest.options.every((o) => ['Yes', 'No'].includes(o.label));
  if (!compare) controls.append(optionLabel);
  controls.append(metricLabel);
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
  section.append(panel, controls, evidence);
  function draw() {
    const selected = contest.options.find((o) => o.id === optionSelect.value);
    const share = metricSelect.value === 'share';
    state.optionId = selected.id;
    state.metric = metricSelect.value;
    const options = compare ? contest.options : [selected];
    const series = options.map((option, index) => ({
      label: option.label,
      color: index === 0 ? 'var(--accent)' : 'var(--comparison)',
      values: points.map((p) => {
        const votes = p.options.find((o) => o.id === option.id).votes;
        return share ? (100 * votes) / p.options.reduce((sum, o) => sum + o.votes, 0) : votes;
      }),
    }));
    const format = (v) => (share ? `${v.toFixed(1)}%` : v.toLocaleString('en-US'));
    const delta =
      points.length === 1
        ? `One ${unit.toLowerCase()}; no trend yet.`
        : `${points.length} ${units}`;
    const headline = make('div', '', 'trend-value trend-legend');
    for (const s of series) {
      const item = make('span', s.label);
      item.style.setProperty('--series-color', s.color);
      headline.append(item);
    }
    headline.append(make('small', delta));
    const svg = new DOMParser().parseFromString(
      renderElectionChart(series, {
        share,
        unit,
        label: `${options.map((o) => o.label).join(' and ')}, ${share ? 'share of reported votes' : 'reported votes'}, ${points.length} ${media ? 'newsroom ' : 'reported '}${points.length === 1 ? unit.toLowerCase() : units}. ${delta}`,
      }),
      'image/svg+xml',
    ).documentElement;
    const note = make(
      'p',
      'Steps connect observed cumulative tallies, including corrections—not newly cast ballots.',
      'result-note',
    );
    const tableHost = createHistoryTable({
      points,
      series,
      media,
      unit,
      share,
      format,
    });
    const tableView = state.view === 'table';
    chartButton.setAttribute('aria-pressed', String(!tableView));
    tableButton.setAttribute('aria-pressed', String(tableView));
    svg.hidden = tableView;
    if (tableView) svg.setAttribute('style', 'display:none');
    tableHost.hidden = !tableView;
    const popover = attachPointPopover(svg, series, points, {
      share,
      media,
      scope: media ? contest.mediaUpdate?.resultGeography?.name || 'SF citywide' : 'SF county only',
    });
    panel.replaceChildren(headline, svg, tableHost, popover);
    evidence.replaceChildren(note);
  }
  optionSelect.addEventListener('change', draw);
  metricSelect.addEventListener('change', draw);
  draw();
  return section;
}
