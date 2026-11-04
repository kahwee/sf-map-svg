const base = 'https://media.sos.ca.gov/media/';
export const sosIndexUrl = `${base}json-endpoints.csv`;
export const sosMappings = [
  ...[
    'governor',
    'lieutenant-governor',
    'secretary-of-state',
    'controller',
    'treasurer',
    'attorney-general',
    'insurance-commissioner',
    'superintendent-of-public-instruction',
  ].map((file, i) => ({ file, id: `state-office-${i}` })),
  {
    file: 'board-of-equalization',
    id: 'state-office-8',
    title: 'Board of Equalization Member District 2',
  },
  { file: 'us-rep', id: 'office-25', title: 'United States Representative District 11' },
  { file: 'us-rep', id: 'office-26', title: 'United States Representative District 15' },
  { file: 'state-assembly', id: 'office-27', title: 'State Assembly Member District 17' },
  { file: 'state-assembly', id: 'office-28', title: 'State Assembly Member District 19' },
];
export const sosUrl = (mapping) => `${base}${mapping.file}.json`;
const normalized = (name) => name.normalize('NFKC').trim().toLocaleLowerCase('en-US');
function count(value) {
  if (typeof value !== 'string' || !/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value))
    throw new Error('Invalid SOS vote count');
  const n = Number(value.replaceAll(',', ''));
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Unsafe SOS count');
  return n;
}
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
  return (
    (month === 'November' ? 11 : 12) * 1_000_000 +
    +day * 10_000 +
    ((+hour % 12) + (half === 'p' ? 12 : 0)) * 100 +
    +minute
  );
}
export function parseSosCounty(rows, mapping, contest, index, now = Date.now()) {
  if (
    !index.includes('California November 3, 2026 Statewide General Election') ||
    !index.includes(sosUrl(mapping))
  )
    throw new Error('SOS election identity or endpoint not verified');
  if (!Array.isArray(rows) || !contest || contest.id !== mapping.id)
    throw new Error('Invalid SOS report');
  const title = `${mapping.title || contest.title} - San Francisco County Results`;
  const matches = rows.filter((row) => row.raceTitle === title);
  if (matches.length !== 1) throw new Error(`Expected exactly one ${title}`);
  const row = matches[0];
  const reportOrder = sourceTimeOrder(row.ReportingTime);
  const reporting = /^(\d+(?:\.\d+)?)% \(([\d,]+) of ([\d,]+)\) precincts reporting$/.exec(
    row.Reporting,
  );
  if (!reporting || +reporting[1] > 100 || count(reporting[2]) > count(reporting[3]))
    throw new Error('Invalid SOS reporting metadata');
  if (!Array.isArray(row.candidates) || row.candidates.length !== contest.options.length)
    throw new Error('SOS candidate roster changed');
  const names = new Set(row.candidates.map((c) => normalized(c.Name)));
  if (names.size !== contest.options.length) throw new Error('Duplicate SOS candidates');
  const options = contest.options.map((option) => {
    const candidate = row.candidates.find((c) => normalized(c.Name) === normalized(option.label));
    if (!candidate) throw new Error('SOS candidate does not match certified ballot');
    return { ...option, votes: count(candidate.Votes) };
  });
  const total = options.reduce((sum, option) => sum + option.votes, 0);
  if (!Number.isSafeInteger(total)) throw new Error('Unsafe SOS total');
  const beforeElectionReport = reportOrder < 11_032_000;
  if (beforeElectionReport && total > 0) throw new Error('Nonzero pre-election SOS report');
  const pending = beforeElectionReport || total === 0 || now < Date.parse('2026-11-04T04:00:00Z');
  return {
    ...contest,
    options: options.map((option) => ({ ...option, votes: pending ? null : option.votes })),
    resultStatus: pending ? 'pending' : 'unofficial',
    resultSourceUrl: sosUrl(mapping),
    sourceReportTime: row.ReportingTime,
    resultsFetchedAt: new Date(now).toISOString(),
    resultGeography: {
      type: 'county',
      id: '06075',
      name: 'San Francisco',
      scope: 'county-portion-of-contest',
    },
    reporting: row.Reporting,
    call: 'uncalled',
    regions: [],
  };
}
export function retainLastGood(current, incoming) {
  if (
    current.resultStatus === 'unofficial' &&
    (incoming.resultStatus !== 'unofficial' ||
      sourceTimeOrder(incoming.sourceReportTime) < sourceTimeOrder(current.sourceReportTime))
  )
    return current;
  return incoming;
}
