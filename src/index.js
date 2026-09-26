import data from './data.js';
import { landmarks as landmarkData, bartStations as stationData } from './overlays.js';
import { rawProject, positions, geometryPath } from './geometry.js';
import { escape, stroke } from './svg.js';
import * as layers from './layers.js';

// The common coast is immutable: compute its Mercator bounds once per module.
const coastPoints = positions(data.coast).map(rawProject);
const bounds = coastPoints.reduce(
  (b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)],
  [Infinity, Infinity, -Infinity, -Infinity],
);

export const districtYears = Object.freeze([2002, 2012, 2022]);
export const neighborhoodNames = Object.freeze(data.neighborhoods.map((item) => item.name));
export const districtColors = Object.freeze([
  '#c8dce5',
  '#d5e4d6',
  '#d1d6e8',
  '#d0dfd7',
  '#e4dcca',
  '#d3dced',
  '#d9d8e7',
  '#c8dfdf',
  '#e2d6ca',
  '#cbdcd1',
  '#dfddc9',
]);
const defaults = {
  water: '#e7f0f3',
  land: '#f1f3ee',
  district: '#71838a',
  neighborhood: '#8c9195',
  highway: '#bd8b73',
  park: '#b2cfaa',
  landmark: '#3e6346',
  bart: '#24789a',
  label: '#304958',
  marker: '#245b61',
  selected: '#f04f32',
};
let sequence = 0;

/** Make an offline SVG and the matching longitude/latitude projection. */
export function createSFMap(options = {}) {
  const {
    width = 800,
    height = 800,
    padding = 28,
    year = 2022,
    districtLines = true,
    neighborhoodLines = false,
    districtFills = true,
    districtLabels = true,
    highways = false,
    landmarks = false,
    bartStations = false,
    markers = [],
    title = 'San Francisco map',
    idPrefix = `sf-map-${++sequence}`,
  } = options;
  if (
    ![width, height, padding].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    padding < 0 ||
    padding * 2 >= Math.min(width, height)
  )
    throw new RangeError('Use positive dimensions and padding smaller than half the map.');
  if (!districtYears.includes(year))
    throw new RangeError('District year must be 2002, 2012, or 2022.');
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(idPrefix))
    throw new TypeError(
      'idPrefix must start with a letter and contain only letters, numbers, underscores, or hyphens.',
    );
  const colors = { ...defaults, ...options.colors };
  const [minX, minY, maxX, maxY] = bounds;
  const scale = Math.min(
    (width - padding * 2) / (maxX - minX),
    (height - padding * 2) / (maxY - minY),
  );
  const project = (coordinates) => {
    const [x, y] = rawProject(coordinates);
    const point = [
      (x - (minX + maxX) / 2) * scale + width / 2,
      (y - (minY + maxY) / 2) * scale + height / 2,
    ];
    if (!point.every(Number.isFinite))
      throw new RangeError('Projected coordinates must be finite; use smaller map dimensions.');
    return point;
  };
  const path = (geometry) => geometryPath(geometry, project);
  const coastPath = path(data.coast);
  const districts = data.districts[year];
  const context = { project, path, colors, idPrefix };
  const districtPaths =
    districtFills || districtLines
      ? districts.map((d) => ({
          id: d.id,
          path: path(d.geometry) + path(d.extras),
          color: districtColors[d.id - 1],
        }))
      : [];
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${idPrefix}-title" data-sf-map="" data-year="${year}" style="max-width:100%;height:auto"><title id="${idPrefix}-title">${escape(title)}</title><desc>San Francisco supervisorial district boundaries (${year}).${neighborhoodLines ? ' Dashed lines show SFAR realtor neighborhood areas, defined in August 2010.' : ''}${landmarks ? ' Highlighted areas show six parks and landmarks.' : ''}${bartStations ? ' Rings mark the eight San Francisco BART stations.' : ''} Geometry from DataSF${bartStations ? ' and BART' : ''}. See package SOURCES.md.</desc><defs><clipPath id="${idPrefix}-coast"><path d="${coastPath}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath></defs><rect width="${width}" height="${height}" fill="${escape(colors.water)}"/><g data-layer="geography"><path data-layer="coast" d="${coastPath}" fill="${escape(colors.land)}" fill-rule="evenodd"/>`,
  ];
  // Explicit drawing order keeps optional overlays and user markers predictable.
  if (districtFills) parts.push(layers.districtFills(districtPaths, context));
  if (landmarks) parts.push(layers.landmarks(landmarkData, context));
  if (highways) parts.push(layers.highways(data.highways, context));
  if (neighborhoodLines) parts.push(layers.neighborhoods(data.neighborhoods, context));
  if (districtLines) parts.push(layers.districtLines(districtPaths, context));
  parts.push(`<path data-layer="coastline" d="${coastPath}" ${stroke(colors.district, 0.65)}/>`);
  if (districtLabels) parts.push(layers.districtLabels(districts, context));
  if (landmarks) parts.push(layers.landmarkLabels(landmarkData, context));
  if (bartStations) parts.push(layers.bartStations(stationData, context));
  parts.push(layers.markers(markers, context), '</g></svg>');
  return { svg: parts.join(''), project, viewBox: [0, 0, width, height] };
}
export function renderSFMap(options = {}) {
  return createSFMap(options).svg;
}
