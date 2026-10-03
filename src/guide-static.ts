import { guideMapData } from './guide-data.js';
import { guideShellCSS } from './guide-shell.js';
import { renderMap } from './static.js';
import type { SFMapOptions } from './types.js';

/** Server-safe overview using exactly the guide browser geography. */
export function createGuideSVG(options: SFMapOptions = {}) {
  return renderMap(guideMapData.map, {
    theme: 'transit',
    districtFills: false,
    districtLines: false,
    districtLabels: false,
    neighborhoodLines: true,
    landmarks: true,
    highways: true,
    keyRoads: true,
    bartStations: true,
    ...options,
  });
}

/** Stable compact frame, progressively enhanced with mountGuideMap(). No browser globals. */
export function createGuideShell(options: SFMapOptions = {}): string {
  if (
    (options.width !== undefined && options.width !== 800) ||
    (options.height !== undefined && options.height !== 800) ||
    (options.padding !== undefined && options.padding !== 28)
  )
    throw new RangeError(
      'Guide shells use the interactive 800 by 800 projection with 28 units of padding. Use createGuideSVG for custom dimensions.',
    );
  return `<div class="sf-guide-shell"><style>${guideShellCSS}</style><div class="sf-guide-frame"><div class="sf-guide-placeholder" aria-hidden="true">Map controls</div><div class="sf-explorer-canvas">${createGuideSVG(options).svg}</div><div class="sf-guide-placeholder" aria-hidden="true">Map legend</div><div class="sf-guide-sources">Map data · DataSF / BART</div></div></div>`;
}
