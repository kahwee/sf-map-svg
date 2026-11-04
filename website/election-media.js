// Newsroom reporting is separate from official counts, calls and batch history.
export function validateMediaUpdate(contest) {
  const media = contest.mediaUpdate;
  if (media === undefined) return;
  const projection = media?.projection;
  const regional = contest.id === 'RTM';
  const projectionTime = regional ? projection?.observedAt : projection?.publishedAt;
  const times = [
    media?.observedAt,
    media?.sourceUpdatedAt,
    ...(projection ? [projectionTime] : []),
  ];
  if (
    (!/^local-[A-J]$/.test(contest.id) && !regional) ||
    !(
      (!regional &&
        media?.sourceName === 'KQED' &&
        [
          'https://www.kqed.org/elections/results/sanfrancisco',
          ...(contest.id === 'local-G'
            ? ['https://www.kqed.org/elections/results/sanfrancisco/proposition-g']
            : []),
        ].includes(media.sourceUrl)) ||
      (regional &&
        media?.sourceName === 'KQED' &&
        media.sourceUrl ===
          'https://www.kqed.org/elections/results/california/regional-measure-rtm') ||
      (media?.sourceName === 'San Francisco Chronicle' &&
        media.sourceUrl ===
          'https://www.sfchronicle.com/projects/2026/election-results/san-francisco/')
    ) ||
    times.some(
      (value) =>
        typeof value !== 'string' ||
        !/^2026-11-04T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) ||
        !Number.isFinite(Date.parse(value)),
    ) ||
    Date.parse(media.observedAt) < Date.parse(media.sourceUpdatedAt) ||
    (projection && Date.parse(media.observedAt) < Date.parse(projectionTime)) ||
    !Array.isArray(media.options) ||
    media.options.length !== contest.options.length ||
    media.options.some(
      (option, index) =>
        option.id !== contest.options[index].id ||
        option.label !== contest.options[index].label ||
        !Number.isSafeInteger(option.votes) ||
        option.votes < 0,
    ) ||
    !media.options.some((option) => option.votes > 0)
  )
    throw new Error('Invalid media update provenance');
  if (regional) {
    const geography = media.resultGeography;
    if (
      geography?.type !== 'regional' ||
      geography.scope !== 'full-contest' ||
      geography.name !== 'Five-county RTM region' ||
      JSON.stringify(geography.counties) !==
        JSON.stringify(['Alameda', 'Contra Costa', 'San Francisco', 'San Mateo', 'Santa Clara'])
    )
      throw new Error('Invalid media regional geography');
  } else if (media.resultGeography !== undefined) throw new Error('Invalid media local geography');
  if (projection) {
    const valid = regional
      ? projection.outcome === 'passed' &&
        projection.publishedAt === undefined &&
        projection.sourceUrl ===
          'https://www.sfchronicle.com/election/article/live-results-bay-area-regional-transit-measure-22487820.php'
      : contest.id === 'local-G' &&
        projection.outcome === 'rejected' &&
        projection.sourceUrl ===
          'https://www.sfchronicle.com/election/article/california-polls-prop-40-governor-live-updates-22499351.php#a-victory-for-sunset-dunes-park-as-upper-great-highway-ballot-measure-is-voted-down-045404';
    if (!valid || projection.sourceName !== 'San Francisco Chronicle')
      throw new Error('Invalid media projection provenance');
  }
}
export function latestMediaUpdate(current, previous) {
  if (!current) return previous;
  if (!previous) return current;
  return Date.parse(current.sourceUpdatedAt) >= Date.parse(previous.sourceUpdatedAt)
    ? current
    : previous;
}

export function validateMediaHistory(contest) {
  if (contest.mediaHistory === undefined) return;
  if (!Array.isArray(contest.mediaHistory) || !contest.mediaHistory.length)
    throw new Error('Invalid media history');
  let previous = -Infinity;
  const seen = new Set();
  for (const point of contest.mediaHistory) {
    validateMediaUpdate({ ...contest, mediaUpdate: point });
    const observed = Date.parse(point.observedAt);
    const key = JSON.stringify(point);
    if (observed < previous || seen.has(key)) throw new Error('Invalid media history order');
    previous = observed;
    seen.add(key);
  }
  if (JSON.stringify(contest.mediaUpdate) !== JSON.stringify(contest.mediaHistory.at(-1)))
    throw new Error('Invalid media history latest observation');
}
export function mergeMediaMetadata(current, previous) {
  if (!current?.mediaHistory && !previous?.mediaHistory) {
    const mediaUpdate = latestMediaUpdate(current?.mediaUpdate, previous?.mediaUpdate);
    return mediaUpdate ? { mediaUpdate: structuredClone(mediaUpdate) } : {};
  }
  const points = new Map();
  for (const contest of [previous, current])
    for (const point of contest?.mediaHistory ||
      (contest?.mediaUpdate ? [contest.mediaUpdate] : []))
      points.set(JSON.stringify(point), point);
  const mediaHistory = [...points.values()].sort(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt),
  );
  return structuredClone({ mediaHistory, mediaUpdate: mediaHistory.at(-1) });
}
