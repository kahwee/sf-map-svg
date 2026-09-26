# Geographic data API

The JSON files here are the geographic source of truth, not generated copies of renderer JavaScript. Each map file is a GeoJSON `FeatureCollection` with WGS84 `[longitude, latitude]` coordinates, a schema version, source URLs, retrieval dates, and a definition explaining its scope.

The renderer, `neighborhoods` convenience export, and `getNeighborhood` default to the **92 SFAR realtor areas**. Import `neighborhoods-realtor.json` directly for that same geometry. The filename `neighborhoods.json` continues to identify the separate SF Find collection.

## Available files

| File                          | Contents                                                            |
| ----------------------------- | ------------------------------------------------------------------- |
| `districts-2002.json`         | 11 supervisorial districts for 2002                                 |
| `districts-2012.json`         | 11 supervisorial districts for 2012                                 |
| `districts-2022.json`         | 11 supervisorial districts for 2022                                 |
| `neighborhoods.json`          | All 117 SF Find neighborhoods (2006 definitions)                    |
| `neighborhoods-analysis.json` | All 41 city analysis neighborhoods                                  |
| `neighborhoods-realtor.json`  | All 92 SFAR areas in the August 2010 dataset                        |
| `coast.json`                  | The renderer's common display coastline                             |
| `highways.json`               | The original map's highway geometry                                 |
| `key-roads.json` | Nine selected road corridors with source segment IDs and label anchors |
| `landmarks.json`              | Six selected park/landmark property areas                           |
| `bart-stations.json`          | Eight San Francisco station points                                  |
| `catalog.json`                | Dataset index and searchable neighborhood metadata without geometry |

The three neighborhood collections contain **250 source-specific definitions**, not 250 distinct neighborhoods. They cover the full inventories of these sources; they do not establish an exhaustive list of every informal or recently coined name. Residents, reporting agencies, and real-estate maps use different boundaries. Compare definitions without merging them merely because their names match.

## Import a JSON file

```js
import neighborhoods from '@kahwee/sf-map-svg/data/neighborhoods-realtor.json' with { type: 'json' };
import districts from '@kahwee/sf-map-svg/data/districts-2022.json' with { type: 'json' };

const mission = neighborhoods.features.find((f) => f.id === 'inner-mission');
console.log(mission.properties.canonicalName, mission.geometry);
```

Node 22.12+ supports this syntax. Bundlers may also support JSON imports without the import attribute. Files are included in the package archive; non-JavaScript consumers can parse the same JSON files directly. These are package entry points, not a hosted API. The public repository and GitHub Pages explorer also provide access to the source data. Consumers who need only one dataset should import its JSON subpath rather than the convenience module, which loads all collections.

## Names and definitions

Every neighborhood feature contains:

- `id`: a stable slug within its source. Use `(definitionSource, id)` as the identity across datasets.
- `canonicalName` and `name`: the package's display name. This is not a claim of legal or universal authority.
- `sourceName`: the exact original dataset name, preserved even when display punctuation is normalized.
- `aliases`: evidence-backed alternative names for lookup; empty when none are recorded. Case and punctuation differences do not require separate aliases.
- `definitionSource`: `sf-find`, `analysis`, or `realtor`.
- `nameSources`: references supporting curated aliases or spelling changes.
- `geometry` and `bbox`: the complete polygon and its geographic extent, not a pin or estimated rectangle.

The collection's `definition` describes how its boundaries were chosen. Mission and Outer Mission are distinct records in each source that defines them. The default realtor collection names the area “Inner Mission” and keeps “Mission Dolores” separate. Use those source names; “Mission” alone is not silently substituted. With `{ source: 'sf-find' }`, “Mission District” and “The Mission” resolve to Mission, never Outer Mission. “NoPa” resolves to the realtor source's North Panhandle feature; that does not claim everyone agrees with the realtor polygon. Composite source areas such as “Laurel Heights / Jordan Park” remain composite; neither name alone is silently equated with the combined polygon.

## Look up or search

```js
import {
  getNeighborhood,
  searchNeighborhoods,
  neighborhoodCollections,
  districtMaps,
} from '@kahwee/sf-map-svg/data';

const mission = getNeighborhood('Inner Mission'); // SFAR realtor definitions by default
const outerMission = getNeighborhood('Outer Mission');
const analysisMission = getNeighborhood('Mission', { source: 'analysis' });
const nopa = getNeighborhood('NoPa', { source: 'realtor' });
const candidates = searchNeighborhoods('mission'); // names + sources, no geometry
const allSFNames = searchNeighborhoods('', { source: 'sf-find' });
const allAnalysisPolygons = neighborhoodCollections.analysis;
const historicalDistricts = districtMaps[2012];
```

Lookup is exact after case/punctuation normalization, returns `undefined` for an unknown name, and throws for an unknown source. Search matches substrings and preserves every source-specific result. The convenience module's shared data is deeply frozen; use `structuredClone(feature)` if you need an editable copy. Do not mutate imported datasets used by the renderer.

## Draw a neighborhood with the existing projection

```js
import { createSFMap } from '@kahwee/sf-map-svg';
import { getNeighborhood } from '@kahwee/sf-map-svg/data';
import { geometryPath } from '@kahwee/sf-map-svg/geometry';

const map = createSFMap({ districtFills: false });
const mission = getNeighborhood('Inner Mission');
const pathData = geometryPath(mission.geometry, map.project);
// Use pathData as an SVG <path d="..."> over map.svg.
```

`geometryPath` handles Polygon, MultiPolygon, LineString, MultiLineString, and GeometryCollection; points use `map.project` and a marker element. Storybook's **Data / Neighborhood explorer** demonstrates the complete overlay and offers JSON downloads.

## District display metadata

District `geometry` is the primary district geometry retained from the original map. `properties.displayExtras` preserves separate island/coast display additions, which can be polygons, lines, or GeometryCollections. To reproduce the existing SVG, draw both; do not coerce every extra into a polygon or use display extras for area calculations. `label` and `labelPoints` provide badge anchors. Each feature’s `bbox` covers its primary `geometry` only; include `displayExtras` when fitting the full displayed district, especially District 6’s island. These are processed display maps, not newly downloaded raw or legal district boundaries. See `SOURCES.md` for the original extraction.

## Maintaining data

Edit the canonical JSON only. Keep coordinate precision and source labels; record provenance in both dataset metadata and `SOURCES.md`. Add aliases only with supporting references. Run `pnpm data:catalog` after changing names, metadata, inventories, or bounds, then `pnpm check`. CI checks catalog freshness, inventories, coordinate bounds, immutable helper data, lookup behavior, and original geometry digests. Update those digests only for intentional, sourced geography changes.

## Non-overlap guarantee for the default realtor collection

The 92 realtor neighborhoods have disjoint interiors. Shared borders and corner points are allowed. The source contained tiny overlapping boundary slivers; the normalized JSON assigns each such area once using stable-ID order, preserving the combined footprint without rounding or buffering. `topology` records this processing. This guarantee applies within the realtor collection; alternative neighborhood sources and district/park layers describe different concepts and must not be treated as additional mutually exclusive neighborhoods.

Run `pnpm data:normalize-realtor` when updating realtor geometry, then `pnpm data:catalog` and `pnpm check`. Cleanup aborts if it would erase a neighborhood, leave overlapping interiors, or change the combined footprint. Tests reject any nonempty polygon intersection; they do not excuse small slivers with an area threshold.

## Election result snapshots (Pages only)

`elections/2026-06-02.json` holds certified local-measure results for the June 2026 Pages explorer. It contains four measures, citywide counts, and eleven supervisorial district totals per measure, plus source URLs, workbook checksum, and source row references. It is not a GeoJSON collection or a public npm export. It does not change the default SFAR neighborhood dataset. See `SOURCES.md` and `scripts/import-election-results.py` for extraction and validation.
