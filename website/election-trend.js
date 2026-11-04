const ns = 'http://www.w3.org/2000/svg';
const make = (tag, text, className) =>
  Object.assign(document.createElement(tag), {
    textContent: text || '',
    className: className || '',
  });
const svgElement = (tag, attrs, text) => {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text) node.textContent = text;
  return node;
};
const observedTime = (iso) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'short' });
export function createTrend(contest) {
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
  optionLabel.append(optionSelect);
  const metricLabel = make('label', 'Measure');
  const metricSelect = document.createElement('select');
  metricSelect.setAttribute('aria-label', 'Measure');
  metricSelect.add(new Option('Reported votes', 'votes'));
  metricSelect.add(new Option('Reported vote share', 'share'));
  metricLabel.append(metricSelect);
  controls.append(optionLabel, metricLabel);
  let batch = points.length - 1;
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
  section.append(controls, navigation, rangeLabel, panel);
  function draw() {
    const selected = contest.options.find((o) => o.id === optionSelect.value);
    const share = metricSelect.value === 'share';
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
        : `Change from prior observation: ${change > 0 ? '+' : ''}${share ? `${change.toFixed(1)} percentage points` : `${change.toLocaleString('en-US')} votes`}.`;
    const headline = make(
      'p',
      `${unit} ${batch + 1} · ${selected.label}: ${format(last)} · ${delta}`,
      'trend-value',
    );
    const svg = svgElement('svg', {
      viewBox: '0 0 360 160',
      role: 'img',
      'aria-label': `${selected.label}, ${share ? 'share of reported votes' : 'reported votes'}, ${points.length} observed ${points.length === 1 ? unit.toLowerCase() : units}. ${delta} Exact report and observation times in the table below.`,
    });
    const max = share ? 100 : Math.max(1, ...values);
    const x = (i) => (points.length === 1 ? 191 : 44 + (i * 294) / (points.length - 1));
    const y = (v) => 130 - (108 * v) / max;
    for (const value of [0, max]) {
      svg.append(
        svgElement('line', {
          x1: 44,
          x2: 338,
          y1: y(value),
          y2: y(value),
          stroke: 'currentColor',
          opacity: '.15',
        }),
      );
      svg.append(
        svgElement(
          'text',
          { x: 38, y: y(value) + 4, 'text-anchor': 'end', 'font-size': 13, fill: 'currentColor' },
          share
            ? format(value)
            : new Intl.NumberFormat('en-US', {
                notation: 'compact',
                maximumFractionDigits: 1,
              }).format(value),
        ),
      );
    }
    if (points.length > 1) {
      let path = `M ${x(0)} ${y(values[0])}`;
      for (let i = 1; i < values.length; i++) path += ` H ${x(i)} V ${y(values[i])}`;
      svg.append(
        svgElement('path', { d: path, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
      );
    }
    svg.append(
      svgElement('line', {
        x1: x(batch),
        x2: x(batch),
        y1: 15,
        y2: 130,
        stroke: 'currentColor',
        opacity: '.25',
        'stroke-dasharray': '3 4',
      }),
    );
    values.forEach((value, i) => {
      const dot = svgElement('circle', {
        cx: x(i),
        cy: y(value),
        r: i === batch ? 6 : 3,
        fill: 'currentColor',
        opacity: i === batch ? 1 : 0.5,
      });
      dot.append(
        svgElement(
          'title',
          {},
          `${points[i].sourceReportTime}: ${format(value)}; observed ${observedTime(points[i].observedAt)}`,
        ),
      );
      svg.append(dot);
    });
    svg.append(
      svgElement(
        'text',
        {
          x: points.length === 1 ? 191 : 44,
          y: 153,
          'text-anchor': points.length === 1 ? 'middle' : 'start',
          'font-size': 13,
          fill: 'currentColor',
        },
        `${unit} 1`,
      ),
    );
    if (points.length > 1)
      svg.append(
        svgElement(
          'text',
          { x: 338, y: 153, 'text-anchor': 'end', 'font-size': 13, fill: 'currentColor' },
          `${unit} ${points.length}`,
        ),
      );
    const note = make(
      'p',
      media
        ? 'SF citywide · newsroom observations from the linked publishers. Steps compare cumulative published tallies, not newly cast ballots. Publisher update times are not official report times.'
        : 'SF county only · equally spaced reports and revisions. Changes are cumulative tally updates, not newly cast ballots. Share is of reported votes, not turnout.',
      'result-note',
    );
    const tableHost = make('div', '', 'history-table-wrap');
    tableHost.tabIndex = 0;
    tableHost.setAttribute('role', 'region');
    tableHost.setAttribute(
      'aria-label',
      `${unit} data; scroll to see earlier and later observations`,
    );
    const table = document.createElement('table');
    table.append(
      make('caption', `${selected.label} — exact ${media ? 'newsroom' : 'batch'} observations`),
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
    const report = make(
      'p',
      `${media ? 'Publisher update' : 'Selected report'}: ${points[batch].sourceReportTime} · First observed: ${observedTime(points[batch].observedAt)}`,
      'result-note',
    );
    panel.replaceChildren(headline, report, svg, note, tableHost);
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
