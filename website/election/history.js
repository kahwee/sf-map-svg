export function sourceTimeOrder(text) {
  const match = /^(November|December) (\d{1,2}), 2026, (\d{1,2}):(\d{2}) (a|p)\.m\.$/.exec(text);
  if (!match) throw new Error('Unrecognized SOS report time');
  const [, month, day, hour, minute, half] = match;
  if (
    +day < 1 ||
    +day > (month === 'November' ? 30 : 31) ||
    +hour < 1 ||
    +hour > 12 ||
    +minute > 59
  )
    throw new Error('Invalid SOS report time');
  // Compare local clock values only; never publish this as a UTC report timestamp.
  return Date.UTC(
    2026,
    month === 'November' ? 10 : 11,
    +day,
    (+hour % 12) + (half === 'p' ? 12 : 0),
    +minute,
  );
}

const countySource = /^https:\/\/media\.sos\.ca\.gov\/media\/[a-z-]+\.json$/;
const isoTime = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));
const signature = (point) =>
  JSON.stringify([point.sourceReportTime, point.options.map(({ id, votes }) => [id, votes])]);
function pointFrom(contest) {
  return {
    sourceReportTime: contest.sourceReportTime,
    observedAt: contest.resultsFetchedAt,
    resultSourceUrl: contest.resultSourceUrl,
    reporting: contest.reporting,
    resultGeography: structuredClone(contest.resultGeography),
    options: contest.options.map(({ id, label, votes }) => ({ id, label, votes })),
  };
}
export function validateResultHistory(contest) {
  if (contest.resultHistory === undefined) return;
  if (!Array.isArray(contest.resultHistory)) throw new Error('Invalid result history');
  let previous;
  for (const point of contest.resultHistory) {
    const reportOrder = sourceTimeOrder(point.sourceReportTime);
    const observed = Date.parse(point.observedAt);
    if (
      contest.resultStatus !== 'unofficial' ||
      !isoTime(point.observedAt) ||
      observed < Date.parse('2026-11-04T04:00:00Z') ||
      reportOrder < Date.UTC(2026, 10, 3, 20) ||
      // Every supported November/December report is in California standard time.
      reportOrder + 8 * 60 * 60_000 > observed ||
      !countySource.test(point.resultSourceUrl) ||
      point.resultSourceUrl !== contest.resultSourceUrl ||
      point.resultGeography?.type !== 'county' ||
      point.resultGeography.id !== '06075' ||
      point.resultGeography.name !== 'San Francisco' ||
      point.resultGeography.scope !== 'county-portion-of-contest' ||
      typeof point.reporting !== 'string' ||
      !/^\d+(?:\.\d+)?% \([\d,]+ of [\d,]+\) precincts reporting$/.test(point.reporting) ||
      !Array.isArray(point.options) ||
      point.options.length !== contest.options.length ||
      !point.options.every(
        (o, i) =>
          o.id === contest.options[i].id &&
          o.label === contest.options[i].label &&
          Number.isSafeInteger(o.votes) &&
          o.votes >= 0,
      )
    )
      throw new Error('Invalid history point provenance');
    const reporting = /^(\d+(?:\.\d+)?)% \(([\d,]+) of ([\d,]+)\) precincts reporting$/.exec(
      point.reporting,
    );
    const reported = Number(reporting[2].replaceAll(',', ''));
    const precincts = Number(reporting[3].replaceAll(',', ''));
    if (
      +reporting[1] > 100 ||
      !Number.isSafeInteger(reported) ||
      !Number.isSafeInteger(precincts) ||
      reported > precincts
    )
      throw new Error('Invalid history reporting metadata');
    const total = point.options.reduce((sum, o) => sum + o.votes, 0);
    if (!Number.isSafeInteger(total) || total <= 0)
      throw new Error('Zero or invalid history total');
    if (
      previous &&
      (observed < Date.parse(previous.observedAt) ||
        reportOrder < sourceTimeOrder(previous.sourceReportTime) ||
        signature(point) === signature(previous))
    )
      throw new Error('History is out of order or duplicated');
    previous = point;
  }
  if (
    previous &&
    (signature(previous) !== signature(pointFrom(contest)) ||
      Date.parse(previous.observedAt) > Date.parse(contest.resultsFetchedAt))
  )
    throw new Error('History does not match latest preserved result');
}
export function appendResultHistory(current, incoming) {
  const history = structuredClone(current.resultHistory || []);
  // Recover a known prior observation when upgrading a live snapshot without history.
  if (!history.length && current.resultStatus === 'unofficial') history.push(pointFrom(current));
  if (incoming.resultStatus !== 'unofficial') return { ...incoming, resultHistory: history };
  const point = pointFrom(incoming);
  if (!history.length || signature(history.at(-1)) !== signature(point)) history.push(point);
  const result = { ...incoming, resultHistory: history };
  validateResultHistory(result);
  return result;
}
