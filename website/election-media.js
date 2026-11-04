// Newsroom reporting is separate from official counts, calls and batch history.
export function validateMediaUpdate(contest) {
  const media = contest.mediaUpdate;
  if (media === undefined) return;
  const projection = media?.projection;
  const times = [
    media?.observedAt,
    media?.sourceUpdatedAt,
    ...(projection ? [projection.publishedAt] : []),
  ];
  if (
    !/^local-[A-J]$/.test(contest.id) ||
    media?.sourceName !== 'KQED' ||
    ![
      'https://www.kqed.org/elections/results/sanfrancisco',
      ...(contest.id === 'local-G'
        ? ['https://www.kqed.org/elections/results/sanfrancisco/proposition-g']
        : []),
    ].includes(media.sourceUrl) ||
    times.some(
      (value) =>
        typeof value !== 'string' ||
        !/^2026-11-04T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) ||
        !Number.isFinite(Date.parse(value)),
    ) ||
    Date.parse(media.observedAt) < Date.parse(media.sourceUpdatedAt) ||
    (projection && Date.parse(media.observedAt) < Date.parse(projection.publishedAt)) ||
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
  if (
    projection &&
    (contest.id !== 'local-G' ||
      projection.outcome !== 'rejected' ||
      projection.sourceName !== 'San Francisco Chronicle' ||
      projection.sourceUrl !==
        'https://www.sfchronicle.com/election/article/california-polls-prop-40-governor-live-updates-22499351.php#a-victory-for-sunset-dunes-park-as-upper-great-highway-ballot-measure-is-voted-down-045404')
  )
    throw new Error('Invalid media projection provenance');
}
export function latestMediaUpdate(current, previous) {
  if (!current) return previous;
  if (!previous) return current;
  return Date.parse(current.sourceUpdatedAt) >= Date.parse(previous.sourceUpdatedAt)
    ? current
    : previous;
}
