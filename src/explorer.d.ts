import type { NeighborhoodSource } from '../data/index.js';
export interface NeighborhoodExplorerOptions {
  source?: NeighborhoodSource;
  /** Canonical name, source name, alias, or stable ID in the selected source. */
  neighborhood?: string;
  year?: 2002 | 2012 | 2022;
}
export interface NeighborhoodExplorerElement extends HTMLElement {
  /** Select and fit a neighborhood; returns false when no exact name or alias matches. */
  selectNeighborhood(name: string): boolean;
  /** Switch definitions, clear selection, and reset to city view. */
  setSource(source: NeighborhoodSource): void;
  resetView(): void;
  /** Multiply zoom, clamped to 1–12×. */
  zoomBy(factor: number): void;
  /** Release listeners, animation frames, resize observer, and download URLs. */
  destroy(): void;
}
/** Browser-only interactive map; append the returned element to the document. */
export declare function createNeighborhoodExplorer(
  options?: NeighborhoodExplorerOptions,
): NeighborhoodExplorerElement;
