export const ELECTION_DATE = '2026-11-03';
export function validateSnapshot(data) {
  if (data?.schemaVersion !== 1 || data.electionDate !== ELECTION_DATE)
    throw new Error('Wrong election or schema');
  if (!['not-checked', 'ok', 'error'].includes(data.checkStatus))
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
    // No geographic result adapter has been verified for the November source yet.
    if (contest.regions.length) throw new Error('Unverified geographic results');
  }
  if (data.geography?.type !== 'none' || data.geography.boundaryYear !== null)
    throw new Error('Unverified geography');
  if (data.status === 'unofficial' && (!data.sourceReportTimestamp || !data.lastSuccessfulFetchAt))
    throw new Error('Missing result provenance');
  return data;
}
export function freshness(data, now = Date.now()) {
  if (!data.checkedAt || now - Date.parse(data.checkedAt) > 30 * 60_000) return 'stale';
  return data.checkStatus === 'ok' ? 'current' : 'source-error';
}
// Refuse to infer a live schema from historical reports or from a challenge/error page.
export function parseOfficialReport(html) {
  if (!/November\s+3,?\s+2026/i.test(html)) throw new Error('Election identity not verified');
  throw new Error(
    'Official November report format requires verification before importing vote totals',
  );
}
