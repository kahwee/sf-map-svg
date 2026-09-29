// The Pages build writes data/site-map.json: the library's fullMapData with every geometry
// simplified for display (see scripts/site-data.mjs). It has the exact MapData shape, so it
// goes straight into createMap and renderMap.
let pending;

/** Fetch the display dataset once per page. */
export function loadSiteMapData() {
  pending ??= fetch('./data/site-map.json').then((response) => {
    if (!response.ok) throw new Error('Could not load the map data.');
    return response.json();
  });
  return pending;
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
