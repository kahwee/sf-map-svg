import { expandMapOptions, prepareConfiguration } from './configuration.js';
import type { MapController, MapOptions } from './controller-types.js';
import { guideMapData } from './guide-data.js';
import { createMap } from './map.js';
import { guideOptions } from './presets.js';

function controllerOptions(options: MapOptions): MapOptions {
  expandMapOptions(options);
  const config = prepareConfiguration(
    { features: {}, layers: guideOptions.layers ?? {}, controls: {}, appearance: {} },
    {
      features: options.features,
      layers: options.layers === undefined ? {} : options.layers,
      controls: options.controls,
    },
  );
  return {
    ...guideOptions,
    ...options,
    mode: options.mode === undefined ? guideOptions.mode : options.mode,
    layers: config.layers,
  };
}

/** Preferred guide API: the same grouped options, events, camera and lifecycle as createMap. */
export function createGuideController(options: MapOptions = {}): MapController {
  return createMap(guideMapData, controllerOptions(options));
}

/** Enhance a static guide shell and return its owning controller. */
export function mountGuideController(shell: HTMLElement, options: MapOptions = {}): MapController {
  const prepared = controllerOptions(options);
  const frame = shellFrame(shell, prepared.attribution);
  const map = createMap(guideMapData, {
    ...prepared,
    attribution: 'compact',
    controls: { ...shellControls, ...prepared.controls },
  });
  mountFrame(frame, map.element);
  return map;
}

const shellControls = {
  pan: false,
  labels: false,
  neighborhoodPicker: false,
  markerPicker: false,
  help: false,
  status: false,
  legend: true,
};

function shellFrame(shell: HTMLElement, attribution: MapOptions['attribution']) {
  if (attribution === 'full')
    throw new TypeError(
      'The guide shell requires compact attribution; use createGuideController for full attribution.',
    );
  if (!shell.classList.contains('sf-guide-shell'))
    throw new TypeError('Expected a createGuideShell container.');
  const frame = shell.querySelector(':scope > .sf-guide-frame');
  if (!frame || frame.classList.contains('sf-explorer'))
    throw new Error('Shell is missing its static frame or already mounted.');
  return frame;
}

function mountFrame(frame: Element, map: HTMLElement) {
  map.classList.add('sf-guide-frame');
  map.querySelector('.sf-explorer-map-column > details')?.classList.add('sf-guide-sources');
  frame.replaceWith(map);
}
