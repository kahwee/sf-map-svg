// Fetch timestamps describe a check, not a change in published results.
const checkFields = new Set([
  'checkedAt',
  'generatedAt',
  'lastSuccessfulFetchAt',
  'resultCheckedAt',
  'resultsFetchedAt',
  'buildCommit',
]);
function resultContent(value) {
  if (Array.isArray(value)) return value.map(resultContent);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => !checkFields.has(key))
        .map((key) => [key, resultContent(value[key])]),
    );
  return value;
}
export function needsElectionDeployment(previous, next, now = Date.now()) {
  const checked = Date.parse(previous.checkedAt);
  return (
    !Number.isFinite(checked) ||
    now - checked >= 24 * 60 * 60 * 1000 ||
    JSON.stringify(resultContent(previous)) !== JSON.stringify(resultContent(next))
  );
}
