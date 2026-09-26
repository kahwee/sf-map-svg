import type { Geometry, Position } from '../data/index.js';
export declare function rawProject(coordinates: Position): [number, number];
export declare function positions(geometry: Geometry | null | undefined): Position[];
/** SVG paths for polygon/line geometry. Points must be projected and drawn as markers. */
export declare function geometryPath(
  geometry: Geometry | null | undefined,
  project: (position: Position) => [number, number],
): string;
