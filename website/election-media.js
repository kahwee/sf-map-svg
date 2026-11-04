// Secondary published reporting is separate from official counts, calls and batch history.
export function validateMediaUpdate(contest) {
  const media = contest.mediaUpdate;
  if (media === undefined) return;
  const projection = media?.projection;
  const regional = contest.id === 'RTM';
  const projectionTime = regional ? projection?.observedAt : projection?.publishedAt;
  const issue = media?.sourceTimestampIssue;
  const governmental =
    regional &&
    media?.sourceName === 'Metropolitan Transportation Commission' &&
    media.sourceKind === 'agency-compilation' &&
    media.sourceUrl ===
      'https://mtc.ca.gov/about-mtc/authorities/public-transit-revenue-measure-district';
  const unspecifiedTimezone =
    governmental &&
    media.sourceUpdatedAt === null &&
    issue === undefined &&
    /^Last updated (?:[1-9]|1[0-2]):[0-5][0-9] [ap]\.m\., November (?:[4-9]|[12][0-9]|30)$/.test(
      media.sourceUpdatedAtText,
    ) &&
    typeof media.sourceUpdatedAtText === 'string' &&
    media.sourceUpdatedAtText.length <= 64;
  const unknownTime =
    unspecifiedTimezone ||
    (regional &&
      media?.sourceName === 'KQED' &&
      media.sourceUpdatedAt === null &&
      issue?.type === 'future-dated' &&
      issue.rawText === 'Updated at 11:27 PM PT on November 4, 2026' &&
      Object.keys(issue).length === 2);
  const times = [
    media?.observedAt,
    ...(unknownTime ? [] : [media?.sourceUpdatedAt]),
    ...(projection ? [projectionTime] : []),
  ];
  if (
    (!/^local-[A-J]$/.test(contest.id) && !regional) ||
    (issue !== undefined && !unknownTime) ||
    (media?.sourceKind !== undefined && !governmental) ||
    (media?.sourceUpdatedAtText !== undefined && !governmental) ||
    (governmental && !unspecifiedTimezone) ||
    !(
      governmental ||
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
        !(
          governmental
            ? /^2026-11-(?:0[4-9]|[12][0-9]|30)T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
            : /^2026-11-04T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
        ).test(value) ||
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
  return Date.parse(current.observedAt) >= Date.parse(previous.observedAt) ? current : previous;
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

// A publisher's invalid date is retained verbatim, never inferred from fetch time.
export function mediaReportTime(media, format) {
  if (media.sourceKind === 'agency-compilation')
    return `${media.sourceUpdatedAtText} · timezone unspecified`;
  return media.sourceUpdatedAt === null
    ? `Report time unverified · Source says “${media.sourceTimestampIssue.rawText}”`
    : `Updated ${format(media.sourceUpdatedAt)}`;
}
