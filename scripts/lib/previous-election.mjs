import { chooseSnapshotSeed, validateSnapshot } from '../../website/election-model.js';
export async function loadPreviousSnapshot(seed, fetcher = fetch) {
  try {
    const response = await fetcher(
      `https://kahwee.github.io/sf-map-svg/elections/2026-11-03.json?recovery=${Date.now()}`,
      { signal: AbortSignal.timeout(20_000), cache: 'no-store' },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return chooseSnapshotSeed(seed, validateSnapshot(await response.json()));
  } catch (cause) {
    // The public deployment is the only last-good/history store. Never reset it
    // from the null seed when recovery fails, even if a current source is reachable.
    throw new Error(
      'Cannot safely recover deployed election results/history; refusing publication',
      { cause },
    );
  }
}
