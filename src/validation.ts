import { rawProject } from './geometry.js';
import type { MapMarker, MapOverlay, NeighborhoodExplorerOptions } from './types.js';

/** JSON-like configuration records only; reject typo keys instead of silently defaulting. */
export function assertOptions(
  value: unknown,
  name: string,
  keys?: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new TypeError(`${name} must be a plain options object.`);
  if (keys)
    for (const key of Object.keys(value))
      if (!keys.includes(key)) throw new TypeError(`Unknown ${name} option: ${key}`);
  return value as Record<string, unknown>;
}
export function validatePadding(value: unknown) {
  if (typeof value === 'number') {
    if (Number.isFinite(value) && value >= 0) return;
    throw new RangeError('Fit requires finite nonnegative padding.');
  }
  const record = assertOptions(value, 'padding', ['top', 'right', 'bottom', 'left']);
  for (const side of Object.values(record))
    if (side !== undefined && (typeof side !== 'number' || !Number.isFinite(side) || side < 0))
      throw new RangeError('Fit requires finite nonnegative padding.');
}
const optionKeys = [
  'source',
  'mode',
  'labels',
  'neighborhood',
  'year',
  'theme',
  'colors',
  'labelStyle',
  'areaStyle',
  'districtStyle',
  'motion',
  'markerEntrance',
  'selectedMarkerRing',
  'clustering',
  'legend',
  'attribution',
  'northArrow',
  'scaleBar',
  'layerTransitions',
  'districtMorph',
  'interface',
  'layers',
  'selectableNeighborhoods',
  'labelSize',
  'fitPadding',
  'markers',
  'markerRadius',
  'markerHitSize',
  'markerColor',
  'selectedMarkerColor',
  'onMarkerActivate',
  'overlays',
  'onOverlayActivate',
  'style',
  'strings',
  'controls',
];
export function validateExplorerOptions(options: NeighborhoodExplorerOptions) {
  assertOptions(options, 'map', optionKeys);
  if (options.districtStyle !== undefined && typeof options.districtStyle !== 'function')
    throw new TypeError('districtStyle must be a function.');
  for (const key of ['labels', 'selectableNeighborhoods'] as const)
    if (options[key] !== undefined && typeof options[key] !== 'boolean')
      throw new TypeError(`${key} must be boolean.`);
  for (const key of ['onMarkerActivate', 'onOverlayActivate'] as const)
    if (options[key] !== undefined && typeof options[key] !== 'function')
      throw new TypeError(`${key} must be a function.`);
  for (const key of ['markerColor', 'selectedMarkerColor', 'neighborhood'] as const)
    if (options[key] !== undefined && typeof options[key] !== 'string')
      throw new TypeError(`${key} must be a string.`);
  if (options.attribution !== undefined && !['full', 'compact'].includes(options.attribution))
    throw new TypeError('Attribution must be full or compact.');
  for (const [key, keys] of [
    ['labelStyle', ['fontFamily', 'fontWeight', 'haloColor']],
    ['areaStyle', ['selectedFill', 'selectedStroke', 'hoverFill', 'hoverStroke']],
    ['labelSize', ['min', 'max']],
    ['legend', ['builtins', 'hidden', 'items']],
    [
      'colors',
      [
        'water',
        'land',
        'district',
        'neighborhood',
        'highway',
        'road',
        'park',
        'landmark',
        'bart',
        'label',
        'marker',
        'selected',
      ],
    ],
    ['style', ['ink', 'surface', 'accent', 'border', 'focus', 'controlGap', 'font']],
    [
      'strings',
      [
        'title',
        'mode',
        'source',
        'search',
        'chooseNeighborhood',
        'chooseMarker',
        'touchNavigation',
        'touchNavigationLabel',
        'touchNavigationExitLabel',
        'touchNavigationDone',
        'reset',
        'emptyResults',
        'gestureHelp',
      ],
    ],
  ] as const) {
    const value = options[key];
    if (value === undefined) continue;
    assertOptions(value, key, keys);
    if (['colors', 'style', 'strings', 'areaStyle'].includes(key))
      for (const token of Object.values(value))
        if (token !== undefined && typeof token !== 'string')
          throw new TypeError(`${key} tokens must be strings.`);
  }
  if (options.labelStyle)
    for (const key of ['fontFamily', 'haloColor'] as const)
      if (options.labelStyle[key] !== undefined && typeof options.labelStyle[key] !== 'string')
        throw new TypeError(`${key} must be a string.`);
  const legend = options.legend;
  if (legend?.builtins !== undefined && typeof legend.builtins !== 'boolean')
    throw new TypeError('legend.builtins must be boolean.');
  if (
    legend?.hidden !== undefined &&
    (!Array.isArray(legend.hidden) ||
      Array.from(legend.hidden).some((key) => !['bart', 'park', 'road', 'highway'].includes(key)))
  )
    throw new TypeError('Unknown legend entry.');
  if (legend?.items !== undefined) {
    if (!Array.isArray(legend.items)) throw new TypeError('Legend items must be an array.');
    for (const item of legend.items) {
      assertOptions(item, 'legend item', ['label', 'color']);
      if (typeof item.label !== 'string' || typeof item.color !== 'string')
        throw new TypeError('Legend items require string labels and colors.');
    }
  }
  if (options.fitPadding !== undefined) validatePadding(options.fitPadding);
}

export function validateMarkers(markers: readonly MapMarker[]) {
  if (!Array.isArray(markers)) throw new TypeError('Markers must be an array.');
  const ids = new Set<string>();
  for (const marker of markers) {
    assertOptions(marker, 'marker');
    if (typeof marker.id !== 'string' || !marker.id || ids.has(marker.id))
      throw new RangeError('Markers require unique nonempty IDs.');
    ids.add(marker.id);
    if (
      !Number.isFinite(marker.lng) ||
      Math.abs(marker.lng) > 180 ||
      !Number.isFinite(marker.lat) ||
      Math.abs(marker.lat) >= 90
    )
      throw new RangeError(
        'Marker coordinates require finite longitude from -180 to 180 and latitude strictly between -90 and 90.',
      );
    if (marker.radius !== undefined && (!Number.isFinite(marker.radius) || marker.radius <= 0))
      throw new RangeError('Marker radius must be positive and finite.');
    if (marker.selected !== undefined && typeof marker.selected !== 'boolean')
      throw new TypeError('Marker selected must be boolean.');
    for (const key of ['label', 'color'] as const)
      if (marker[key] !== undefined && typeof marker[key] !== 'string')
        throw new TypeError(`Marker ${key} must be a string.`);
  }
}
export function validateOverlays(overlays: readonly MapOverlay[]) {
  if (!Array.isArray(overlays)) throw new TypeError('Overlays must be an array.');
  const ids = new Set<string>();
  for (const overlay of overlays) {
    assertOptions(overlay, 'overlay');
    if (
      typeof overlay.id !== 'string' ||
      !/^[A-Za-z0-9_-]+$/.test(overlay.id) ||
      ids.has(overlay.id)
    )
      throw new RangeError(
        'Overlays require unique IDs containing only letters, numbers, underscores, or hyphens.',
      );
    ids.add(overlay.id);
    if (
      !overlay.geometry ||
      !['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(overlay.geometry.type)
    )
      throw new TypeError('Overlay geometry must be a line or polygon.');
    const sequence = (value: unknown, min: number): unknown[] => {
      if (!Array.isArray(value) || value.length < min)
        throw new TypeError(
          'Overlay geometry contains an empty or incomplete coordinate sequence.',
        );
      return Array.from(value);
    };
    const line = (value: unknown, min: number) => {
      for (const point of sequence(value, min)) {
        const pair = sequence(point, 2);
        if (pair.length !== 2)
          throw new TypeError('Overlay positions require longitude and latitude.');
        rawProject(pair as [number, number]);
      }
    };
    const polygon = (value: unknown) => {
      for (const ring of sequence(value, 1)) line(ring, 3);
    };
    const geometry = overlay.geometry;
    switch (geometry.type) {
      case 'LineString':
        line(geometry.coordinates, 2);
        break;
      case 'MultiLineString':
        for (const part of sequence(geometry.coordinates, 1)) line(part, 2);
        break;
      case 'Polygon':
        polygon(geometry.coordinates);
        break;
      case 'MultiPolygon':
        for (const part of sequence(geometry.coordinates, 1)) polygon(part);
        break;
    }
    if (overlay.visible !== undefined && typeof overlay.visible !== 'boolean')
      throw new TypeError('Overlay visible must be boolean.');
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
    for (const key of ['label', 'fill', 'stroke'] as const)
      if (overlay[key] !== undefined && typeof overlay[key] !== 'string')
        throw new TypeError(`Overlay ${key} must be a string.`);
  }
}
