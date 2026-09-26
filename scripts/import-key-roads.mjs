import { writeFile } from 'node:fs/promises';

// Label targets only choose an existing source vertex; road geometry is never drawn by hand.
const roads = [
  ['market', 'Market St', ['MARKET ST'], [-122.42, 37.776], 'primary'],
  ['geary', 'Geary Blvd', ['GEARY BLVD', 'GEARY ST'], [-122.47, 37.78], 'primary'],
  ['van-ness', 'Van Ness Ave', ['VAN NESS AVE'], [-122.424, 37.797], 'primary'],
  ['lombard', 'Lombard St', ['LOMBARD ST'], [-122.423, 37.801], 'secondary'],
  ['19th-avenue', '19th Ave', ['19TH AVE'], [-122.475, 37.746], 'primary'],
  ['embarcadero', 'The Embarcadero', ['THE EMBARCADERO'], [-122.404, 37.806], 'primary'],
];
const url = new URL('https://data.sf.gov/resource/3psu-pn9h.geojson');
url.searchParams.set(
  '$where',
  `active = true AND streetname in (${roads
    .flatMap((r) => r[2])
    .map((name) => `'${name}'`)
    .join(',')})`,
);
url.searchParams.set('$limit', '5000');
url.searchParams.set('$order', 'cnn');
const response = await fetch(url);
if (!response.ok) throw new Error(`Source request failed: ${response.status}`);
const source = await response.json();
if (source.features.length >= 5000) throw new Error('Source pagination required');
const features = roads.map(([id, name, names, target, level]) => {
  const segments = source.features.filter((f) => names.includes(f.properties.streetname));
  if (!segments.length) throw new Error(`Missing road: ${name}`);
  const coordinates = segments.flatMap(({ geometry: g }) => {
    if (g.type === 'LineString') return [g.coordinates];
    if (g.type === 'MultiLineString') return g.coordinates;
    throw new Error(`Unexpected geometry: ${g.type}`);
  });
  const points = coordinates.flat();
  const distance = (p) => (p[0] - target[0]) ** 2 + (p[1] - target[1]) ** 2;
  const label = points.reduce((best, p) => (distance(p) < distance(best) ? p : best));
  return {
    type: 'Feature',
    id,
    bbox: [
      Math.min(...points.map((p) => p[0])),
      Math.min(...points.map((p) => p[1])),
      Math.max(...points.map((p) => p[0])),
      Math.max(...points.map((p) => p[1])),
    ],
    properties: {
      name,
      level,
      sourceNames: names,
      label,
      segmentIds: segments.map((f) => f.properties.cnn),
    },
    geometry: { type: 'MultiLineString', coordinates },
  };
});
const data = {
  type: 'FeatureCollection',
  schemaVersion: 1,
  id: 'key-roads',
  title: 'Selected San Francisco road landmarks',
  coordinateSystem: 'WGS84 longitude, latitude (EPSG:4326)',
  definition: {
    kind: 'selected-road-centerlines',
    description:
      'Six selected road corridors for orientation, using active DataSF street segments. Geary St and Geary Blvd form one corridor. Not a complete road network or a claim of vehicle access.',
  },
  sources: [
    {
      id: 'datasf-streets',
      title: 'DataSF Streets – Active and Retired',
      url: url.href,
      retrievedAt: new Date().toISOString().slice(0, 10),
      licenseUrl: 'https://datasf.org/opendata/terms-of-use/',
    },
  ],
  features,
};
await writeFile(
  new URL('../data/key-roads.json', import.meta.url),
  `${JSON.stringify(data, null, 2)}\n`,
);
console.log(`${features.length} roads from ${source.features.length} active street segments`);
