import { DOMParser } from '@xmldom/xmldom';
import { validateMediaUpdate } from '../../website/election-media.js';

export const mtcUrl =
  'https://mtc.ca.gov/about-mtc/authorities/public-transit-revenue-measure-district';
const counties = ['Alameda', 'Contra Costa', 'San Francisco', 'San Mateo', 'Santa Clara'];
const plain = (node) => node.textContent.replace(/\s+/g, ' ').trim();
export function parseMtcResults(html, contest, observedAt) {
  if (
    typeof html !== 'string' ||
    html.length > 2_000_000 ||
    contest?.id !== 'RTM' ||
    !html.includes('November 3, 2026, statewide general election') ||
    !html.includes('Preliminary Results (Unofficial)') ||
    !html.includes(
      'The District does not conduct the election, count ballots, or certify county election results.',
    )
  )
    throw new Error('MTC election identity or preliminary status changed');
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)]
    .map((m) => m[0])
    .filter((table) => table.includes('Preliminary Results of the 2026 Regional Transit Measure'));
  if (tables.length !== 1) throw new Error('MTC results table missing or ambiguous');
  const doc = new DOMParser({
    onError: () => {
      throw new Error('Invalid MTC table markup');
    },
  }).parseFromString(tables[0], 'text/xml');
  const rows = Array.from(doc.getElementsByTagName('tr'));
  const cells = (row) =>
    Array.from(row.childNodes)
      .filter((n) => ['td', 'th'].includes(n.nodeName))
      .map(plain);
  if (
    JSON.stringify(cells(rows[0])) !== JSON.stringify(['County', 'Yes', 'No', 'Total', '% Yes']) ||
    rows.length !== 7
  )
    throw new Error('MTC results table shape changed');
  const parsed = new Map();
  for (const row of rows.slice(1)) {
    const [name, ...values] = cells(row);
    if (parsed.has(name) || ![...counties, 'Regional Total'].includes(name) || values.length !== 4)
      throw new Error('Invalid or duplicate MTC county');
    const counts = values.slice(0, 3).map((value) => {
      if (!/^(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)$/.test(value))
        throw new Error('Invalid MTC count');
      const count = Number(value.replaceAll(',', ''));
      if (!Number.isSafeInteger(count)) throw new Error('Unsafe MTC count');
      return count;
    });
    if (counts[0] + counts[1] !== counts[2]) throw new Error('MTC row total mismatch');
    parsed.set(name, counts);
  }
  const total = parsed.get('Regional Total');
  for (let column = 0; column < 3; column++)
    if (counties.reduce((sum, name) => sum + parsed.get(name)[column], 0) !== total[column])
      throw new Error('MTC county-to-region totals mismatch');
  const clocks = [...html.matchAll(/<p>\s*(Last updated[^<]+)<\/p>/g)];
  if (clocks.length !== 1) throw new Error('MTC publisher time missing or ambiguous');
  const point = {
    sourceName: 'Metropolitan Transportation Commission',
    sourceKind: 'agency-compilation',
    sourceUrl: mtcUrl,
    sourceUpdatedAt: null,
    sourceUpdatedAtText: clocks[0][1].trim(),
    observedAt,
    options: contest.options.map((option, i) => ({
      id: option.id,
      label: option.label,
      votes: total[i],
    })),
    resultGeography: {
      type: 'regional',
      scope: 'full-contest',
      name: 'Five-county RTM region',
      counties,
    },
    ...(contest.mediaUpdate?.projection
      ? { projection: structuredClone(contest.mediaUpdate.projection) }
      : {}),
  };
  if (
    contest.options.length !== 2 ||
    contest.options[0].label !== 'Yes' ||
    contest.options[1].label !== 'No'
  )
    throw new Error('MTC option roster mismatch');
  validateMediaUpdate({ ...contest, mediaUpdate: point });
  return point;
}

export function appendMtcObservation(contest, point) {
  validateMediaUpdate({ ...contest, mediaUpdate: point });
  if (point.sourceKind !== 'agency-compilation') throw new Error('Expected MTC compilation');
  const last = contest.mediaHistory?.at(-1) || contest.mediaUpdate;
  const previousMtc = contest.mediaHistory?.findLast((p) => p.sourceKind === 'agency-compilation');
  // Compare this publisher's literal wall clocks only; never assign a timezone.
  const wallClock = (text) => {
    const [, hour, minute, period, day] = text.match(
      /^Last updated (\d{1,2}):(\d{2}) ([ap])\.m\., November (\d{1,2})$/,
    );
    return (
      Number(day) * 1440 + ((Number(hour) % 12) + (period === 'p' ? 12 : 0)) * 60 + Number(minute)
    );
  };
  if (
    previousMtc &&
    wallClock(point.sourceUpdatedAtText) < wallClock(previousMtc.sourceUpdatedAtText)
  )
    throw new Error('Older MTC publisher clock; retain previous observation');
  if (previousMtc && point.sourceUpdatedAtText === previousMtc.sourceUpdatedAtText) {
    const signature = (entry) =>
      JSON.stringify(entry.options.map(({ id, label, votes }) => ({ id, label, votes })));
    const incoming = signature(point);
    if (
      incoming !== signature(previousMtc) &&
      contest.mediaHistory?.some(
        (entry) =>
          entry.sourceKind === 'agency-compilation' &&
          entry.sourceUpdatedAtText === point.sourceUpdatedAtText &&
          signature(entry) === incoming,
      )
    )
      throw new Error('Same-clock MTC reversion requires review');
    if (point.options.some((option, index) => option.votes < previousMtc.options[index].votes))
      throw new Error('Same-clock MTC decrease requires review');
  }
  if (last && Date.parse(point.observedAt) <= Date.parse(last.observedAt))
    throw new Error('MTC observation is not newer');
  // Repeated checks are not new observations or new ballots. A source switch is
  // retained once, even if another publisher reported the same cumulative counts.
  if (
    last?.sourceKind === 'agency-compilation' &&
    JSON.stringify(last.options) === JSON.stringify(point.options)
  )
    return contest;
  return { ...contest, mediaUpdate: point, mediaHistory: [...(contest.mediaHistory || []), point] };
}

// Offline-tested candidate only. Not imported or invoked by the production updater.
// Its feed marker is not durable if a subsequent deployment fails.
export async function refreshMtc(
  contest,
  previousCheck,
  fetcher = fetch,
  clock = () => new Date().toISOString(),
) {
  if (previousCheck?.status === 'blocked') return { contest, check: previousCheck };
  let httpStatus;
  try {
    const response = await fetcher(mtcUrl, {
      signal: AbortSignal.timeout(20_000),
      redirect: 'error',
    });
    httpStatus = response.status;
    if (!response.ok) throw new Error(`MTC HTTP ${httpStatus}`);
    const html = await response.text();
    const observedAt = clock();
    return {
      contest: appendMtcObservation(contest, parseMtcResults(html, contest, observedAt)),
      check: { id: 'mtc-rtm', sourceUrl: mtcUrl, status: 'ok', checkedAt: observedAt },
    };
  } catch {
    return {
      contest,
      check: {
        id: 'mtc-rtm',
        sourceUrl: mtcUrl,
        status: [401, 403].includes(httpStatus) ? 'blocked' : 'error',
        checkedAt: clock(),
        message:
          httpStatus && httpStatus !== 200
            ? `MTC HTTP ${httpStatus}`
            : 'MTC compilation unavailable or invalid; previous observation retained.',
      },
    };
  }
}
