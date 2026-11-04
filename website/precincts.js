const $ = (id) => document.getElementById(id);
const status = $('precinct-status');
const SVG = 'http://www.w3.org/2000/svg';
// Yes/No (and the first of two candidates) read green; the other reads red. Everything else uses one hue.
const colors = {
  high: [44, 104, 81],
  low: [179, 38, 30],
  mid: [245, 241, 230],
  one: [31, 90, 140],
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c) => `rgb(${c.join(',')})`;
const label = (name) =>
  name === name.toUpperCase() && /[A-Z]{2}/.test(name)
    ? name
        .toLowerCase()
        .replace(/\b[a-z]/g, (c) => c.toUpperCase())
        .replace(/\bMc([a-z])/g, (_, c) => `Mc${c.toUpperCase()}`)
    : name;
const fetchJson = async (path) => {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
};

// Alcatraz (9904) and a small Bay Bridge precinct (9903) lie outside the city outline and would shrink the map, so they are not drawn.
const offshore = (feature) => feature.bbox[3] > 37.84 || feature.bbox[2] > -122.35;
function project(boundaries) {
  const points = [];
  const walk = (c) => (typeof c[0] === 'number' ? points.push(c) : c.forEach(walk));
  for (const f of boundaries.features) if (!offshore(f)) walk(f.geometry.coordinates);
  const lats = points.map((p) => p[1]);
  const k = Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180);
  const minX = Math.min(...points.map((p) => p[0]));
  const maxY = Math.max(...lats);
  const scale = 100000;
  const x = (lon) => (lon - minX) * k * scale;
  const y = (lat) => (maxY - lat) * scale;
  const width = (Math.max(...points.map((p) => p[0])) - minX) * k * scale;
  const height = (maxY - Math.min(...lats)) * scale;
  return { x, y, width, height };
}
const pathFor = (geometry, { x, y }) =>
  (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates)
    .flatMap((polygon) =>
      polygon.map(
        (ring) => `M${ring.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('L')}Z`,
      ),
    )
    .join('');

async function main() {
  const [index, boundaries] = await Promise.all([
    fetchJson('./data/elections/precincts-index.json'),
    fetchJson('./data/precincts-2022.json'),
  ]);
  const snapshots = new Map();
  const load = async (file) => {
    if (!snapshots.has(file)) snapshots.set(file, await fetchJson(`./data/elections/${file}`));
    return snapshots.get(file);
  };
  let data = await load(index.latest);
  const projection = project(boundaries);
  const map = $('precinct-map');
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${projection.width.toFixed(0)} ${projection.height.toFixed(0)}`);
  svg.setAttribute('role', 'group');
  const paths = new Map();
  for (const f of boundaries.features) {
    if (offshore(f)) continue;
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', pathFor(f.geometry, projection));
    path.setAttribute('tabindex', '0');
    path.dataset.precinct = f.properties.precinct;
    paths.set(f.properties.precinct, path);
    svg.append(path);
  }
  map.replaceChildren(svg);

  const contestSelect = $('precinct-contest');
  const optionSelect = $('precinct-option');
  const reportSelect = $('precinct-report');
  let selected = null;
  const cell = (id) => data.precincts[id]?.contests[contest().id];
  const contest = () => data.contests[Number(contestSelect.value)];

  function show(id) {
    selected = id;
    for (const [key, path] of paths) path.toggleAttribute('aria-current', key === id);
    paths.get(id)?.setAttribute('aria-current', 'true');
    $('precinct-title').textContent = `Precinct ${id}`;
    const c = contest();
    const values = cell(id);
    const body = $('precinct-body');
    if (!values) {
      body.textContent = 'No ballots reported for this precinct in this export.';
      return;
    }
    const table = document.createElement('table');
    const total = values.votes.reduce((n, v) => n + v, 0);
    for (const [i, name] of c.options.entries()) {
      const row = table.insertRow();
      row.insertCell().textContent = label(name);
      row.cells[0].setAttribute('scope', 'row');
      row.insertCell().textContent = `${values.votes[i].toLocaleString('en-US')}${total ? ` · ${((values.votes[i] / total) * 100).toFixed(1)}%` : ''}`;
    }
    const note = document.createElement('p');
    note.textContent = `${total.toLocaleString('en-US')} votes · ${values.under} undervotes · ${values.over} overvotes`;
    body.replaceChildren(table, note);
  }

  function paint() {
    const c = contest();
    const option = Number(optionSelect.value);
    const twoWay = c.options.filter((o) => o !== 'Write-in').length === 2;
    for (const [id, path] of paths) {
      const values = cell(id);
      const total = values ? values.votes.reduce((n, v) => n + v, 0) : 0;
      if (!values || total < 10) {
        path.style.fill = 'color-mix(in srgb, var(--rule) 55%, transparent)';
        path.removeAttribute('aria-label');
        continue;
      }
      const share = values.votes[option] / total;
      let fill;
      if (twoWay) {
        const t = Math.min(1, Math.abs(share - 0.5) / 0.35);
        fill = rgb(mix(colors.mid, share >= 0.5 ? colors.high : colors.low, t));
      } else fill = rgb(mix(colors.mid, colors.one, Math.min(1, share / 0.7)));
      path.style.fill = fill;
      path.setAttribute(
        'aria-label',
        `Precinct ${id}: ${label(c.options[option])} ${(share * 100).toFixed(1)}%`,
      );
    }
    const name = label(c.options[option]);
    const ramp = twoWay
      ? `linear-gradient(90deg, ${rgb(colors.low)}, ${rgb(colors.mid)}, ${rgb(colors.high)})`
      : `linear-gradient(90deg, ${rgb(colors.mid)}, ${rgb(colors.one)})`;
    $('precinct-legend').innerHTML =
      `<span>${twoWay ? '0%' : '0%'}</span><span class="precinct-ramp" style="background:${ramp}"></span><span>${twoWay ? '100%' : '70%+'}</span><span>${twoWay ? `${name} share` : `${name} share of votes`}</span>`;
    if (selected) show(selected);
  }

  function fillOptions() {
    const c = contest();
    optionSelect.replaceChildren(...c.options.map((o, i) => new Option(label(o), String(i))));
    optionSelect.value = '0';
  }
  function fillContests() {
    contestSelect.replaceChildren(
      ...data.contests.map((c, i) => new Option(c.id.length > 60 ? c.id : label(c.id), String(i))),
    );
  }
  function describe() {
    const reported = data.geography.precinctsWithBallots;
    status.textContent = `Report ${data.source.sourceReportTime} (department time) · ${reported} of ${data.geography.precinctsInManifest} precincts have ballots · ${data.ballotCards.toLocaleString('en-US')} ballot cards`;
    $('precinct-source').textContent =
      `Aggregated from the San Francisco Department of Elections cast vote record export (${data.source.electionName}); every contest total matches its summary report.`;
  }

  if (index.snapshots.length > 1) {
    $('precinct-report-label').hidden = false;
    reportSelect.replaceChildren(
      ...[...index.snapshots].reverse().map((s) => new Option(s.sourceReportTime, s.file)),
    );
    reportSelect.value = index.latest;
    reportSelect.addEventListener('change', async () => {
      data = await load(reportSelect.value);
      describe();
      paint();
    });
  }
  contestSelect.addEventListener('change', () => {
    fillOptions();
    paint();
  });
  optionSelect.addEventListener('change', paint);
  map.addEventListener('click', (event) => {
    const id = event.target.closest?.('path')?.dataset.precinct;
    if (id) show(id);
  });
  map.addEventListener('keydown', (event) => {
    const id = event.target.dataset?.precinct;
    if (id && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      show(id);
    }
  });
  fillContests();
  const first = data.contests.findIndex((c) => c.id === 'Measure A');
  contestSelect.value = String(Math.max(0, first));
  fillOptions();
  describe();
  paint();
}
main().catch((error) => {
  status.textContent = `Precinct results could not load: ${error.message}`;
});
