import type { Geometry, Position } from '../data/types.js';
import type { DistrictYear, SFMapOptions } from './types.js';

export type { DistrictYear, MapMarker, MapOverlay, SFMapOptions } from './types.js';

import { geometryPath, positions, rawProject } from './geometry.js';
import * as layers from './layers.js';
import { escapeXml, stroke } from './svg.js';

export interface SFMapData {
  coast: Geometry;
  districts?: Readonly<Partial<Record<DistrictYear, readonly DistrictRowData[]>>>;
  neighborhoods?: readonly { name: string; geometry: Geometry }[];
  highways?: readonly { route: string; geometry: Geometry }[];
  landmarks?: readonly LandmarkData[];
  keyRoads?: readonly KeyRoadData[];
  bartStations?: readonly BartStationData[];
}
export interface DistrictRowData {
  id: number;
  label: Position;
  labelPoints: readonly Position[];
  geometry: Geometry;
  extras: Geometry | null;
}
export interface LandmarkData {
  id: string;
  name: string;
  label: Position;
  offset: readonly [number, number];
  anchor: 'middle' | 'start' | 'end';
  geometry: Geometry;
}
export interface KeyRoadData {
  id: string;
  name: string;
  level?: 'primary' | 'secondary';
  sourceNames: readonly string[];
  label: Position;
  segmentIds: readonly string[];
  geometry: Geometry;
}
export interface BartStationData {
  id: string;
  name: string;
  coordinates: Position;
}

export const districtYears = Object.freeze<DistrictYear[]>([2002, 2012, 2022]);
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
  road: '#bcc3c5',
  park: '#b2cfaa',
  landmark: '#3e6346',
  bart: '#24789a',
  label: '#304958',
  marker: '#245b61',
  selected: '#f04f32',
};
const transitColors = {
  water: '#e4f2f8',
  land: '#fcfcf8',
  district: '#a7b8c0',
  neighborhood: '#b2c0c7',
  highway: '#b9a18a',
  park: '#c6dfbd',
  landmark: '#426641',
  bart: '#0073ae',
  label: '#183e58',
  marker: '#0073ae',
  selected: '#0073ae',
};
let sequence = 0;

/** Make an offline SVG and the matching longitude/latitude projection. */
export function createSFMapWithData(options: SFMapOptions, data: SFMapData) {
  const {
    theme = 'districts',
    width = 800,
    height = 800,
    padding = 28,
    year = 2022,
    districtLines = true,
    neighborhoodLines = false,
    districtFills = true,
    districtLabels = true,
    labels = true,
    highways = false,
    keyRoads = false,
    landmarks = false,
    bartStations = false,
    markers = [],
    title = 'San Francisco map',
    idPrefix = `sf-map-${++sequence}`,
  } = options;
  const roadLabels = options.roadLabels ?? keyRoads;
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
  if (theme !== 'districts' && theme !== 'transit')
    throw new TypeError('Theme must be districts or transit.');
  const colors = { ...defaults, ...(theme === 'transit' ? transitColors : {}), ...options.colors };
  const coastPoints = positions(data.coast).map(rawProject);
  const [minX, minY, maxX, maxY] = coastPoints.reduce<[number, number, number, number]>(
    (b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  const scale = Math.min(
    (width - padding * 2) / (maxX - minX),
    (height - padding * 2) / (maxY - minY),
  );
  const project = (coordinates: Position): [number, number] => {
    const [x, y] = rawProject(coordinates);
    const point: [number, number] = [
      (x - (minX + maxX) / 2) * scale + width / 2,
      (y - (minY + maxY) / 2) * scale + height / 2,
    ];
    if (!point.every(Number.isFinite))
      throw new RangeError('Projected coordinates must be finite; use smaller map dimensions.');
    return point;
  };
  const path = (geometry: Geometry | null | undefined) => geometryPath(geometry, project);
  const coastPath = path(data.coast);
  const districts = data.districts?.[year] ?? [];
  const landmarkData = data.landmarks ?? [];
  const roadData = data.keyRoads ?? [];
  const stationData = data.bartStations ?? [];
  const context = { project, path, colors, idPrefix, theme, labels };
  const districtPaths =
    districtFills || districtLines
      ? districts.map((d) => ({
          id: d.id,
          path: path(d.geometry) + path(d.extras),
          color: theme === 'transit' ? colors.land : districtColors[d.id - 1],
        }))
      : [];
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${idPrefix}-title" data-sf-map="" data-year="${year}" style="max-width:100%;height:auto"><title id="${idPrefix}-title">${escapeXml(title)}</title><desc>San Francisco supervisorial district boundaries (${year}).${neighborhoodLines ? ' Dashed lines show SFAR realtor neighborhood areas, defined in August 2010.' : ''}${landmarks ? ' Highlighted areas show six parks and landmarks.' : ''}${keyRoads ? ' Thin gray lines show selected road corridors.' : ''}${bartStations ? ' Rings mark the eight San Francisco BART stations.' : ''} Geometry from DataSF${bartStations ? ' and BART' : ''}. See package SOURCES.md.</desc><defs><clipPath id="${idPrefix}-coast"><path d="${coastPath}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath></defs><rect width="${width}" height="${height}" fill="${escapeXml(colors.water)}"/><g data-layer="geography"><path data-layer="coast" d="${coastPath}" fill="${escapeXml(colors.land)}" fill-rule="evenodd"/>`,
  ];
  // Explicit drawing order keeps optional overlays and user markers predictable.
  if (districtFills) parts.push(layers.districtFills(districtPaths, context));
  if (landmarks) parts.push(layers.landmarks(landmarkData, context));
  if (keyRoads) parts.push(layers.keyRoads(roadData, context));
  if (highways) parts.push(layers.highways(data.highways ?? [], context));
  if (neighborhoodLines) parts.push(layers.neighborhoods(data.neighborhoods ?? [], context));
  if (districtLines) parts.push(layers.districtLines(districtPaths, context));
  parts.push(`<path data-layer="coastline" d="${coastPath}" ${stroke(colors.district, 0.65)}/>`);
  if (labels && districtLabels) parts.push(layers.districtLabels(districts, context));
  if (labels && landmarks) parts.push(layers.landmarkLabels(landmarkData, context));
  if (labels && roadLabels) parts.push(layers.keyRoadLabels(roadData, context));
  if (bartStations) parts.push(layers.bartStations(stationData, context));
  for (const overlay of options.overlays ?? []) {
    if (!overlay.id || !/^[A-Za-z0-9_-]+$/.test(overlay.id))
      throw new TypeError(
        'Overlay IDs must contain only letters, numbers, underscores, or hyphens.',
      );
    if (
      overlay.strokeWidth !== undefined &&
      (!Number.isFinite(overlay.strokeWidth) || overlay.strokeWidth < 0)
    )
      throw new RangeError('Overlay strokeWidth must be a finite nonnegative number.');
    if (
      overlay.fillOpacity !== undefined &&
      (!Number.isFinite(overlay.fillOpacity) || overlay.fillOpacity < 0 || overlay.fillOpacity > 1)
    )
      throw new RangeError('Overlay fillOpacity must be a finite number from 0 to 1.');
    parts.push(
      `<path data-overlay-id="${escapeXml(overlay.id)}"${overlay.label ? ` aria-label="${escapeXml(overlay.label)}"` : ''} d="${path(overlay.geometry)}" fill="${escapeXml(overlay.fill ?? 'none')}" fill-opacity="${overlay.fillOpacity ?? 1}" stroke="${escapeXml(overlay.stroke ?? colors.road)}" stroke-width="${overlay.strokeWidth ?? 2}" vector-effect="non-scaling-stroke"${overlay.visible === false ? ' display="none"' : ''}/>`,
    );
  }
  parts.push(layers.markers(markers, context), '</g></svg>');
  return {
    svg: parts.join(''),
    project,
    viewBox: [0, 0, width, height] as [number, number, number, number],
  };
}
