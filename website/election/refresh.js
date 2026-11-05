export const REFRESH_INTERVAL = 10 * 60_000;

// Manual, timer and visibility refreshes share one in-flight request.
export function createRefreshController(
  work,
  { now = Date.now, interval = REFRESH_INTERVAL } = {},
) {
  let pending = null;
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

export function isOlderSnapshot(current, incoming) {
  const before = Date.parse(current?.checkedAt);
  const after = Date.parse(incoming.checkedAt);
  return Number.isFinite(before) && (!Number.isFinite(after) || after < before);
}
