// @ts-check
/** Cache successful loads and share in-flight work; failures remain retryable.
 * @template K, V
 * @param {(key: K) => V | PromiseLike<V>} load
 * @returns {(key: K) => Promise<V>}
 */
export function createAsyncCache(load) {
  /** @type {Map<K, Promise<V>>} */
  const cache = new Map();
  return (key) => {
    const cached = cache.get(key);
    if (cached) return cached;
    const pending = Promise.resolve().then(() => load(key));
    cache.set(key, pending);
    // Register cleanup before callers observe rejection, allowing an immediate retry.
    void pending.catch(() => cache.delete(key));
    return pending;
  };
}
