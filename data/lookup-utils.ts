import type { Feature, FeatureCollection, NeighborhoodProperties } from './types.js';

export const normalizeNeighborhoodName = (value: string) =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f'’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function findNeighborhood(
  name: string,
  collection: FeatureCollection<NeighborhoodProperties>,
): Feature<NeighborhoodProperties> | undefined {
  if (typeof name !== 'string') throw new TypeError('Neighborhood name must be a string.');
  const query = normalizeNeighborhoodName(name);
  if (!query) return undefined;
  return collection.features.find(({ id, properties }) =>
    [id, properties.canonicalName, properties.sourceName, ...properties.aliases].some(
      (value) => normalizeNeighborhoodName(value) === query,
    ),
  );
}
