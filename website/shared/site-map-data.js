// @ts-check
// The Pages build writes data/site-map.json: the library's fullMapData with every geometry
// simplified for display (see scripts/build/site-data.mjs). It has the exact MapData shape, so it
// goes straight into createMap and renderMap.
import { createAsyncCache } from './async-cache.js';

/** @returns {Promise<import('../../dist/src/map.js').MapData>} */
async function fetchSiteMap() {
  const response = await fetch('./data/site-map.json');
  if (!response.ok) throw new Error('Could not load the map data.');
  return response.json();
}
const load = createAsyncCache(fetchSiteMap);

/** Fetch once per page, allowing a later call to retry a failed request. */
export function loadSiteMapData() {
  return load(undefined);
}

export const neighborhoodSources = [
  {
    id: 'realtor',
    label: 'SFAR realtor',
    short: 'SFAR',
    count: 92,
    detail:
      'Market areas from the San Francisco Association of Realtors, August 2010. The library default.',
  },
  {
    id: 'sf-find',
    label: 'SF Find',
    short: 'SF Find',
    count: 117,
    detail:
      'General neighborhood locations from the Mayor’s Office of Neighborhood Services, 2006.',
  },
  {
    id: 'analysis',
    label: 'Analysis',
    short: 'Analysis',
    count: 41,
    detail: 'Reporting areas built from census tracts; they can combine several named places.',
  },
];
