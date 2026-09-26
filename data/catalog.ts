import { deepFreeze } from '../src/immutable.js';
import catalogData from './catalog.json' with { type: 'json' };
import { normalizeNeighborhoodName } from './lookup-utils.js';
import type { Catalog, NeighborhoodSource } from './types.js';

export const catalog = deepFreeze(catalogData as unknown as Catalog);

/** Search name metadata across sources without importing polygon geometry. */
export function searchNeighborhoods(query = '', { source }: { source?: NeighborhoodSource } = {}) {
  if (source !== undefined && !['sf-find', 'analysis', 'realtor'].includes(source))
    throw new RangeError(`Unknown neighborhood source: ${source}`);
  if (typeof query !== 'string') throw new TypeError('Neighborhood query must be a string.');
  const term = normalizeNeighborhoodName(query);
  return catalog.neighborhoods.filter(
    (entry) =>
      (source === undefined || entry.source === source) &&
      [entry.id, entry.canonicalName, entry.sourceName, ...entry.aliases].some((value) =>
        normalizeNeighborhoodName(value).includes(term),
      ),
  );
}
