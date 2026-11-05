import { readFile } from 'node:fs/promises';

/**
 * The committed ballot carries no official counts, so scenarios that need a trend inject a synthetic
 * California Secretary of State county history for one measure. Test data only; never published.
 */
export async function electionWithOfficialHistory(id = 'state-1', reports = 4) {
  const data = JSON.parse(await readFile('elections/2026-11-03.json', 'utf8'));
  data.status = 'unofficial';
  data.checkStatus = 'partial';
  data.checkedAt = '2026-11-04T06:30:00Z';
  data.lastSuccessfulFetchAt = '2026-11-04T06:29:00Z';
  const contest = data.contests.find((c) => c.id === id);
  const geography = {
    type: 'county',
    id: '06075',
    name: 'San Francisco',
    scope: 'county-portion-of-contest',
  };
  const url = 'https://media.sos.ca.gov/media/ballot-measures.json';
  contest.history = undefined;
  contest.resultHistory = Array.from({ length: reports }, (_, i) => ({
    sourceReportTime: `November 3, 2026, 9:${String(i * 10).padStart(2, '0')} p.m.`,
    observedAt: `2026-11-04T05:${String(i * 10 + 10).padStart(2, '0')}:00Z`,
    resultSourceUrl: url,
    reporting: `${(i + 1) * 20}% (${(i + 1) * 100} of 514) precincts reporting`,
    resultGeography: structuredClone(geography),
    options: contest.options.map((o, index) => ({
      id: o.id,
      label: o.label,
      votes: 1000 * (i + 1) + (index === 0 ? 120 * i : 0) + index * 700,
    })),
  }));
  const latest = contest.resultHistory.at(-1);
  Object.assign(contest, {
    resultStatus: 'unofficial',
    resultSourceUrl: url,
    sourceReportTime: latest.sourceReportTime,
    resultsFetchedAt: '2026-11-04T06:29:00Z',
    resultCheckedAt: '2026-11-04T06:29:00Z',
    reporting: latest.reporting,
    resultGeography: structuredClone(geography),
    options: structuredClone(latest.options),
  });
  delete contest.history;
  return data;
}
