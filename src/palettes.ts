import { deepFreeze } from './immutable.js';
import type { SFMapOptions } from './types.js';

/** Shared tokens for static SVGs, interactive maps, and consumer-owned place cards. */
export interface MapPalette {
  readonly colors: NonNullable<SFMapOptions['colors']>;
  readonly haloColor: string;
  readonly markerColor: string;
  readonly selectedMarkerColor: string;
  readonly selectedMarkerRingColor: string;
}

/** Opt-in editorial palettes inspired by YorkSF. Existing renderer themes stay unchanged. */
export const mapPalettes = /* @__PURE__ */ deepFreeze({
  nightForest: {
    colors: {
      water: '#0a1412',
      land: '#1b2c28',
      park: '#1f3d33',
      neighborhood: '#3b554e',
      district: '#3b554e',
      road: '#2f4943',
      highway: '#5a4d40',
      landmark: '#8fcbb4',
      bart: '#8ea4ae',
      label: '#d5e3e8',
    },
    haloColor: '#1b2c28',
    markerColor: '#f2845f',
    selectedMarkerColor: '#fff9e9',
    selectedMarkerRingColor: '#ff957d',
  },
  warmPaper: {
    colors: {
      water: '#dce8ea',
      land: '#f4efe4',
      park: '#dcebe2',
      neighborhood: '#88998e',
      district: '#566b60',
      road: '#c6bca9',
      highway: '#987859',
      landmark: '#315d48',
      bart: '#365b68',
      label: '#243d32',
    },
    haloColor: '#f4efe4',
    markerColor: '#b23b10',
    selectedMarkerColor: '#183a2f',
    selectedMarkerRingColor: '#b23b10',
  },
} satisfies Record<string, MapPalette>);
