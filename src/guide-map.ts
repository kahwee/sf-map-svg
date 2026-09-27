import { createNeighborhoodExplorerCore } from './explorer-core.js';
import { guideMapData } from './guide-data.js';
import { guideOptions } from './presets.js';
import type {
  NeighborhoodExplorerElement as InteractiveSFMapElement,
  NeighborhoodExplorerOptions as InteractiveSFMapOptions,
} from './types.js';
import { validateExplorerOptions } from './validation.js';

/** Guide map preset: SFAR neighborhoods, major parks, BART, and curated roads. */
export function createGuideMap(options: InteractiveSFMapOptions = {}): InteractiveSFMapElement {
  validateExplorerOptions(options);
  return createNeighborhoodExplorerCore(
    {
      mode: 'neighborhoods',
      ...options,
      layers: {
        ...guideOptions.layers,
        ...options.layers,
      },
      interface: 'map',
    },
    guideMapData,
  );
}

/** Enhance createGuideShell() in place with a fixed compact chrome layout.
 * Keep an accessible external place list when hiding the native pickers.
 */
export function mountGuideMap(
  shell: HTMLElement,
  options: InteractiveSFMapOptions = {},
): InteractiveSFMapElement {
  validateExplorerOptions(options);
  if (options.attribution === 'full')
    throw new TypeError(
      'The guide shell requires compact attribution; use createGuideMap for full attribution.',
    );
  if (!shell.classList.contains('sf-guide-shell'))
    throw new TypeError('Expected a createGuideShell container.');
  const frame = shell.querySelector(':scope > .sf-guide-frame');
  if (!frame || frame.classList.contains('sf-explorer'))
    throw new Error('Shell is missing its static frame or already mounted.');
  const map = createGuideMap({
    ...options,
    attribution: 'compact',
    controls: {
      pan: false,
      labels: false,
      neighborhoodPicker: false,
      markerPicker: false,
      help: false,
      status: false,
      legend: true,
      ...options.controls,
    },
  });
  map.classList.add('sf-guide-frame');
  map.querySelector('.sf-explorer-map-column > details')?.classList.add('sf-guide-sources');
  frame.replaceWith(map);
  return map;
}
