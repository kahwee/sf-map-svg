// @ts-check
export const REFRESH_INTERVAL = 10 * 60_000;

/** Manual, timer and visibility refreshes share one in-flight request.
 * @template T
 * @param {() => T | PromiseLike<T>} work
 * @param {{ now?: () => number, interval?: number }} [options]
 */
export function createRefreshController(
  work,
  { now = Date.now, interval = REFRESH_INTERVAL } = {},
) {
  /** @type {Promise<T> | null} */
  let pending = null;
  /** @type {number | null} */
  let lastAttempt = null;
  const run = () => {
    if (pending) return pending;
    lastAttempt = now();
    pending = Promise.resolve()
      .then(work)
      .finally(() => {
        pending = null;
      });
    return pending;
  };
  const ifDue = (visible = true) => {
    if (visible && (lastAttempt === null || now() - lastAttempt >= interval)) return run();
    return Promise.resolve();
  };
  return { run, ifDue };
}

/**
 * @param {{checkedAt?: string} | null | undefined} current
 * @param {{checkedAt: string}} incoming
 */
export function isOlderSnapshot(current, incoming) {
  const before = Date.parse(current?.checkedAt ?? '');
  const after = Date.parse(incoming.checkedAt);
  return Number.isFinite(before) && (!Number.isFinite(after) || after < before);
}
