export const layerNames = {
  districtFills: 'District colors',
  districtLines: 'District boundaries',
  districtLabels: 'District numbers',
  neighborhoodLines: 'Neighborhood boundaries',
  neighborhoodLabels: 'Neighborhood names',
  landmarks: 'Parks & landmarks',
  highways: 'Highways',
  keyRoads: 'Selected streets',
  roadLabels: 'Street names',
  bartStations: 'BART stations',
};
export const featureNames = {
  motion: 'Smooth camera',
  layerTransitions: 'Layer fades',
  districtMorph: 'Boundary morphs',
  northArrow: 'North arrow',
  scaleBar: 'Scale bar',
  markerEntrance: 'Pin entrances',
  selectedMarkerRing: 'Selected pin ring',
  clustering: 'Cluster nearby pins',
};
export const colorNames = {
  water: 'Water',
  land: 'Land',
  park: 'Parks',
  district: 'District lines',
  neighborhood: 'Neighborhood lines',
  highway: 'Highways',
  road: 'Streets',
  bart: 'BART',
  label: 'Text',
  marker: 'Pins',
  selected: 'Selection',
};
export const palettes = [
  {
    id: 'atlas',
    name: 'Original atlas',
    mood: 'Soft districts, familiar city.',
    colors: {
      water: '#e7f0f3',
      land: '#f1f3ee',
      park: '#b2cfaa',
      district: '#71838a',
      neighborhood: '#8c9195',
      highway: '#bd8b73',
      road: '#bcc3c5',
      bart: '#24789a',
      label: '#304958',
      marker: '#245b61',
      selected: '#f04f32',
    },
    theme: 'districts',
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    mood: 'A city drawn in midnight ink.',
    colors: {
      water: '#142d45',
      land: '#234660',
      park: '#3f6a70',
      district: '#86b9d3',
      neighborhood: '#769eb6',
      highway: '#e4bf80',
      road: '#69899e',
      bart: '#7dd4e7',
      label: '#f0f3ed',
      marker: '#f5c56f',
      selected: '#ffd4a0',
    },
    theme: 'transit',
  },
  {
    id: 'risograph',
    name: 'Risograph',
    mood: 'Paper, vermilion, a little mischief.',
    colors: {
      water: '#f4e6cb',
      land: '#fff5e3',
      park: '#b7c5a3',
      district: '#b34236',
      neighborhood: '#ae9a80',
      highway: '#d16442',
      road: '#bcad98',
      bart: '#2a6269',
      label: '#663e31',
      marker: '#d64932',
      selected: '#244f5b',
    },
    theme: 'transit',
  },
  {
    id: 'garden',
    name: 'Garden city',
    mood: 'Every park gets its moment.',
    colors: {
      water: '#dce9e1',
      land: '#f4f2dc',
      park: '#7eaa79',
      district: '#698775',
      neighborhood: '#95a994',
      highway: '#b89c7c',
      road: '#c4c5ad',
      bart: '#397868',
      label: '#294f3c',
      marker: '#8a5035',
      selected: '#b44c39',
    },
    theme: 'transit',
  },
  {
    id: 'lilac',
    name: 'After hours',
    mood: 'Fog, lilac, and electric blue.',
    colors: {
      water: '#ece7f2',
      land: '#fbf8fc',
      park: '#c3d0ca',
      district: '#9386a7',
      neighborhood: '#b3a8bc',
      highway: '#c594b0',
      road: '#c9c2ce',
      bart: '#606bb6',
      label: '#514563',
      marker: '#8b58a3',
      selected: '#cc587d',
    },
    theme: 'districts',
  },
  {
    id: 'mono',
    name: 'Field notes',
    mood: 'Quiet lines. Nothing extra.',
    colors: {
      water: '#e8e5dd',
      land: '#f8f6ef',
      park: '#d2d2c3',
      district: '#77786b',
      neighborhood: '#a5a598',
      highway: '#9e9282',
      road: '#bab8ab',
      bart: '#585e55',
      label: '#363f36',
      marker: '#535d4d',
      selected: '#936c43',
    },
    theme: 'transit',
  },
];
export const sampleMarkers = [
  { id: 'ferry', label: 'Ferry Building', lng: -122.3937, lat: 37.7955 },
  { id: 'dolores', label: 'Dolores Park', lng: -122.4269, lat: 37.7596 },
  { id: 'conservatory', label: 'Conservatory of Flowers', lng: -122.4601, lat: 37.7726 },
  { id: 'twin-peaks', label: 'Twin Peaks', lng: -122.4476, lat: 37.7544 },
  { id: 'coit', label: 'Coit Tower', lng: -122.4058, lat: 37.8024 },
];
export const sampleOverlays = [
  {
    id: 'city-sketch',
    label: 'Illustrative route, not directions',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-122.4601, 37.7726],
        [-122.438, 37.771],
        [-122.4269, 37.7596],
        [-122.418, 37.775],
        [-122.3937, 37.7955],
      ],
    },
    stroke: '#db6646',
    strokeWidth: 3,
    visible: true,
  },
];
export function initialState() {
  return {
    palette: 'atlas',
    render: 'interactive',
    mode: 'districts',
    source: 'realtor',
    year: 2022,
    labels: true,
    layers: Object.fromEntries(
      Object.keys(layerNames).map((key) => [
        key,
        key.startsWith('district') || ['landmarks', 'bartStations'].includes(key),
      ]),
    ),
    features: Object.fromEntries(
      Object.keys(featureNames).map((key) => [
        key,
        ['motion', 'layerTransitions', 'districtMorph', 'selectedMarkerRing'].includes(key),
      ]),
    ),
    colors: { ...palettes[0].colors },
    theme: 'districts',
    font: 'system-ui,sans-serif',
    weight: 550,
    size: 12,
    radius: 6,
    pins: false,
    route: false,
    title: 'San Francisco, in your own style',
    chrome: true,
    animation: false,
  };
}
export function interactiveOptions(state, capabilities) {
  const features = Object.fromEntries(
    Object.entries(state.features).filter(
      ([key]) => !['layerTransitions', 'districtMorph'].includes(key) || capabilities[key],
    ),
  );
  return {
    mode: state.mode,
    source: state.source,
    year: state.year,
    labels: state.labels,
    layers: { ...state.layers },
    features,
    appearance: {
      theme: state.theme,
      colors: { ...state.colors },
      labelStyle: {
        fontFamily: state.font,
        fontWeight: state.weight,
        haloColor: state.colors.land,
      },
      labelSize: { min: Math.min(11, state.size), max: state.size },
      markerRadius: state.radius,
    },
    markers: state.pins ? sampleMarkers : [],
    overlays: state.route ? sampleOverlays : [],
    attribution: 'compact',
    controls: {
      zoom: state.chrome,
      pan: false,
      reset: state.chrome,
      touch: state.chrome,
      labels: false,
      legend: false,
      neighborhoodPicker: state.mode === 'neighborhoods',
      markerPicker: state.pins,
      help: false,
      status: false,
    },
  };
}
export function staticOptions(state, capabilities) {
  const { neighborhoodLabels: _unsupported, ...layers } = state.layers;
  const appearance = { theme: state.theme, colors: { ...state.colors } };
  return {
    year: state.year,
    labels: state.labels,
    title: state.title,
    markers: state.pins ? sampleMarkers : [],
    overlays: state.route ? sampleOverlays : [],
    ...(capabilities.animation ? { animation: state.animation } : {}),
    ...(capabilities.staticPresentation ? { layers, appearance } : { ...layers, ...appearance }),
  };
}
export function staticData(data, source) {
  if (source === 'realtor') return data.map;
  return {
    ...data.map,
    neighborhoods: data.neighborhoods[source].features.map((feature) => ({
      name: feature.properties.canonicalName,
      geometry: feature.geometry,
    })),
  };
}
export function playgroundCode(state, capabilities) {
  const interactive = state.render === 'interactive';
  const options = interactive
    ? interactiveOptions(state, capabilities)
    : staticOptions(state, capabilities);
  let imports = `import { ${interactive ? 'createMap' : 'renderMap'} } from '@kahwee/sf-map-svg';\nimport { ${interactive ? 'fullMapData' : 'staticMapData'} } from '@kahwee/sf-map-svg/data/${interactive ? 'full' : 'static'}';`;
  let data = interactive ? 'fullMapData' : 'staticMapData';
  if (!interactive && state.source !== 'realtor' && state.layers.neighborhoodLines) {
    imports += `\nimport { neighborhoodCollections } from '@kahwee/sf-map-svg/data';\n\nconst neighborhoods = neighborhoodCollections[${JSON.stringify(state.source)}].features\n  .map(({ properties, geometry }) => ({ name: properties.canonicalName, geometry }));`;
    data = '{ ...staticMapData, neighborhoods }';
  }
  return `${imports}\n\nconst options = ${JSON.stringify(options, null, 2)};\n\n${interactive ? `const map = createMap(${data}, options);\ndocument.querySelector('#map').append(map.element);\n\n// In your view's cleanup hook:\n// map.destroy();\n// map.element.remove();` : `const { svg } = renderMap(${data}, options);\n// Save svg as a file, or insert it into your page.`}`;
}
/** Share links carry only bounded, validated playground settings; no code is evaluated. */
export function readState(hash) {
  const state = initialState();
  if (!hash) return state;
  if (hash.length > 12000) throw new Error('This design link is too large.');
  const value = JSON.parse(decodeURIComponent(hash.replace(/^#design=/, '')));
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid design link.');
  for (const [key, allowed] of Object.entries({
    palette: palettes.map((p) => p.id),
    render: ['interactive', 'static'],
    mode: ['districts', 'neighborhoods', 'basemap'],
    source: ['realtor', 'sf-find', 'analysis'],
    theme: ['districts', 'transit'],
    font: ['system-ui,sans-serif', 'Georgia,serif', 'ui-monospace,monospace'],
    year: [2002, 2012, 2022],
  })) {
    if (value[key] !== undefined) {
      if (!allowed.includes(value[key])) throw new Error(`Invalid ${key}.`);
      state[key] = value[key];
    }
  }
  for (const key of ['labels', 'pins', 'route', 'chrome', 'animation'])
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'boolean') throw new Error(`Invalid ${key}.`);
      state[key] = value[key];
    }
  for (const [key, names] of [
    ['layers', layerNames],
    ['features', featureNames],
  ])
    if (value[key] !== undefined) {
      if (!value[key] || typeof value[key] !== 'object' || Array.isArray(value[key]))
        throw new Error(`Invalid ${key}.`);
      for (const name of Object.keys(names))
        if (value[key][name] !== undefined) {
          if (typeof value[key][name] !== 'boolean') throw new Error(`Invalid ${name}.`);
          state[key][name] = value[key][name];
        }
    }
  if (value.colors !== undefined) {
    if (!value.colors || typeof value.colors !== 'object') throw new Error('Invalid palette.');
    for (const key of Object.keys(colorNames))
      if (value.colors[key] !== undefined) {
        if (typeof value.colors[key] !== 'string' || !/^#[\da-f]{6}$/i.test(value.colors[key]))
          throw new Error('Invalid color.');
        state.colors[key] = value.colors[key];
      }
  }
  for (const [key, min, max] of [
    ['weight', 100, 900],
    ['size', 11, 24],
    ['radius', 3, 16],
  ])
    if (value[key] !== undefined) {
      if (!Number.isFinite(value[key]) || value[key] < min || value[key] > max)
        throw new Error(`Invalid ${key}.`);
      state[key] = value[key];
    }
  if (value.title !== undefined) {
    if (typeof value.title !== 'string' || value.title.length > 120)
      throw new Error('Invalid title.');
    state.title = value.title;
  }
  return state;
}
