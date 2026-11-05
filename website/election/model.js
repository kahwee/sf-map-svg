import { validateResultHistory } from './history.js';
export const ELECTION_DATE = '2026-11-03';
export function validateSnapshot(data) {
  if (data?.schemaVersion !== 1 || data.electionDate !== ELECTION_DATE)
    throw new Error('Wrong election or schema');
  if (!['not-checked', 'ok', 'partial', 'error'].includes(data.checkStatus))
    throw new Error('Invalid check status');
  if (!['pending', 'unofficial'].includes(data.status)) throw new Error('Invalid result status');
  if (data.sourceUrl !== 'https://www.sfelections.org/results/20261103w/index.html')
    throw new Error('Unexpected source');
  for (const key of [
    'sourceReportTimestamp',
    'checkedAt',
    'generatedAt',
    'lastSuccessfulFetchAt',
  ]) {
    if (
      data[key] !== null &&
      (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(data[key]) ||
        !Number.isFinite(Date.parse(data[key])))
    )
      throw new Error(`Invalid ${key}`);
  }
  if (!Array.isArray(data.contests) || !data.contests.length) throw new Error('Missing contests');
  const ids = new Set();
  for (const contest of data.contests) {
    if (
      !contest.id ||
      ids.has(contest.id) ||
      typeof contest.title !== 'string' ||
      !Array.isArray(contest.options) ||
      !Array.isArray(contest.regions) ||
      contest.call !== 'uncalled'
    )
      throw new Error('Invalid contest');
    if (
      contest.shortTitle !== undefined ||
      contest.summary !== undefined ||
      contest.summarySource !== undefined
    ) {
      if (
        typeof contest.shortTitle !== 'string' ||
        !contest.shortTitle.trim() ||
        typeof contest.summary !== 'string' ||
        !contest.summary.trim() ||
        ![
          'https://media.api.sf.gov/documents/N26_EN_VIP.pdf',
          'https://vig.cdn.sos.ca.gov/2026/general/pdf/complete-vig.pdf',
        ].includes(contest.summarySource?.url) ||
        typeof contest.summarySource?.pages !== 'string' ||
        !/^\d+(?:–\d+)?$/.test(contest.summarySource.pages)
      )
        throw new Error('Invalid measure explanation provenance');
    }
    validateResultHistory(contest);
    ids.add(contest.id);
    const optionIds = new Set();
    for (const option of contest.options) {
      if (
        optionIds.has(option.id) ||
        typeof option.label !== 'string' ||
        (option.votes !== null && (!Number.isSafeInteger(option.votes) || option.votes < 0))
      )
        throw new Error('Invalid option');
      optionIds.add(option.id);
      if (data.status === 'pending' && option.votes !== null)
        throw new Error('Pending votes must be null');
    }
    if (contest.resultStatus) {
      if (
        !['pending', 'unofficial'].includes(contest.resultStatus) ||
        !/^https:\/\/media\.sos\.ca\.gov\/media\/[a-z-]+\.json$/.test(contest.resultSourceUrl) ||
        typeof contest.sourceReportTime !== 'string' ||
        !Number.isFinite(Date.parse(contest.resultsFetchedAt)) ||
        contest.resultGeography?.type !== 'county' ||
        contest.resultGeography.id !== '06075' ||
        contest.resultGeography.scope !== 'county-portion-of-contest'
      )
        throw new Error('Invalid county provenance');
      if (contest.resultStatus === 'pending' && contest.options.some((o) => o.votes !== null))
        throw new Error('Pending county report has votes');
    }
    if (
      contest.options.some((o) => o.votes !== null) &&
      !data.sourceReportTimestamp &&
      contest.resultStatus !== 'unofficial'
    )
      throw new Error('Votes lack report provenance');
    // No geographic result adapter has been verified for the November source yet.
    if (contest.regions.length) throw new Error('Unverified geographic results');
  }
  if (data.geography?.type !== 'none' || data.geography.boundaryYear !== null)
    throw new Error('Unverified geography');
  if (
    data.status === 'unofficial' &&
    (!data.lastSuccessfulFetchAt ||
      (!data.sourceReportTimestamp && !data.contests.some((c) => c.resultStatus === 'unofficial')))
  )
    throw new Error('Missing result provenance');
  return data;
}
export function freshness(data, now = Date.now()) {
  if (!data.checkedAt || now - Date.parse(data.checkedAt) > 30 * 60_000) return 'stale';
  return data.checkStatus === 'ok'
    ? 'current'
    : data.checkStatus === 'partial'
      ? 'partial'
      : 'source-error';
}
// Refuse to infer a live schema from historical reports or from a challenge/error page.
export function parseOfficialReport(html) {
  if (!/November\s+3,?\s+2026/i.test(html)) throw new Error('Election identity not verified');
  throw new Error(
    'Official November report format requires verification before importing vote totals',
  );
}

export function chooseSnapshotSeed(seed, deployed) {
  validateSnapshot(seed);
  validateSnapshot(deployed);
  // Pending snapshots carry no results to preserve. New verified ballot corrections win.
  // Preserve actual last-good results wholesale until a verified results adapter can
  // reconcile changed roster IDs; never discard real counts just to refresh metadata.
  if (deployed.status === 'pending') {
    return validateSnapshot(structuredClone(seed));
  }
  const metadata = new Map(seed.contests.map((c) => [c.id, c]));
  const merged = structuredClone(deployed);
  for (const contest of merged.contests) {
    const current = metadata.get(contest.id);
    // Attach descriptions only when the exact contest and option identities agree.
    if (
      !current ||
      current.kind !== contest.kind ||
      current.title !== contest.title ||
      current.options.length !== contest.options.length ||
      !current.options.every((o) =>
        contest.options.some((p) => p.id === o.id && p.label === o.label),
      )
    )
      continue;
    for (const key of ['shortTitle', 'summary', 'summarySource']) {
      if (current[key] !== undefined) contest[key] = structuredClone(current[key]);
    }
  }
  return validateSnapshot(merged);
}
