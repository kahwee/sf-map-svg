// Preview and copied examples use explicit options rather than guessing API defaults.
export function interactiveOptions(state) {
  return {
    mode: state.mode,
    source: state.source,
    year: state.year,
    labels: state.labels,
    layers: { ...state.layers },
    features: {
      ...(state.supportedFeatures?.layerTransitions === false
        ? {}
        : { layerTransitions: state.features.layerTransitions && { duration: 480 } }),
      ...(state.supportedFeatures?.districtMorph === false
        ? {}
        : { districtMorph: state.features.districtMorph && { duration: 1300 } }),
      motion: state.features.motion && { duration: 600 },
    },
    attribution: 'compact',
    controls: { labels: false, legend: false, neighborhoodPicker: false, markerPicker: false },
    appearance: { theme: 'districts' },
  };
}

const literal = (value) => (typeof value === 'string' ? `'${value}'` : String(value));
const objectCode = (entries) =>
  `{ ${entries.map(([key, value]) => `${key}: ${typeof value === 'object' ? objectCode(Object.entries(value)) : literal(value)}`).join(', ')} }`;

export function interactiveCode(state) {
  const options = interactiveOptions(state);
  const layers = Object.entries(options.layers);
  const features = Object.entries(options.features).filter(([, value]) => value !== false);
  const lines = [];
  lines.push(`  mode: '${state.mode}',`);
  if (state.source !== 'realtor') lines.push(`  source: '${state.source}',`);
  if (state.year !== 2022) lines.push(`  year: ${state.year},`);
  if (!state.labels) lines.push('  labels: false,');
  if (layers.length) lines.push(`  layers: ${objectCode(layers)},`);
  if (features.length) lines.push(`  features: ${objectCode(features)},`);
  lines.push("  appearance: { theme: 'districts' },");
  lines.push("  attribution: 'compact',");
  lines.push(`  controls: ${objectCode(Object.entries(options.controls))},`);
  return `import { createMap } from '@kahwee/sf-map-svg';
import { fullMapData } from '@kahwee/sf-map-svg/data/full';

const map = createMap(fullMapData${lines.length ? `, {\n${lines.join('\n')}\n}` : ''});
document.querySelector('#map').append(map.element);`;
}

export function staticOptions(state) {
  return {
    year: state.year,
    districtFills: state.layers.districtFills,
    districtLines: state.layers.districtLines,
    districtLabels: state.layers.districtLabels,
    neighborhoodLines: state.layers.neighborhoodLines,
    landmarks: state.layers.landmarks,
    highways: state.layers.highways,
    keyRoads: state.layers.keyRoads,
    roadLabels: state.layers.roadLabels,
    bartStations: state.layers.bartStations,
    labels: state.labels,
  };
}

export function staticCode(state) {
  const options = Object.entries(staticOptions(state));
  const lines = [
    ...options.map(([key, value]) => `  ${key}: ${literal(value)},`),
    ...(state.animation === false ? [] : ['  animation: true,']),
  ];
  const needsSource = state.layers.neighborhoodLines && state.source !== 'realtor';
  const sourceLines = needsSource
    ? `import { neighborhoodCollections } from '@kahwee/sf-map-svg/data';

// Static maps draw one neighborhood list; the default is SFAR realtor.
const neighborhoods = neighborhoodCollections['${state.source}'].features.map((feature) => ({
  name: feature.properties.canonicalName,
  geometry: feature.geometry,
}));
`
    : '';
  return `import { renderMap } from '@kahwee/sf-map-svg/static';
import { staticMapData } from '@kahwee/sf-map-svg/data/static';
${sourceLines}
const { svg } = renderMap(${needsSource ? '{ ...staticMapData, neighborhoods }' : 'staticMapData'}, {
${lines.join('\n')}
});`;
}
