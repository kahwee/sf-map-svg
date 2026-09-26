# Consumer bundle composition

Measured September 26, 2026 with Vite 8.3.1 in minified ES-library mode. Each
entry is a separate consumer file that imports one named function and uses it;
the table sums gzip sizes of its entry chunk and static imports. Lazy chunks
are excluded from the initial size. The comparison uses the published 1.3.8
package and the 1.4.0 source build with the same bundler settings. These are
representative bundle sizes, not package tarball sizes.

| Consumer import | 1.3.8 initial | 1.4.0 initial | Geography in the 1.4.0 initial bundle |
| --- | ---: | ---: | --- |
| `searchNeighborhoods` from `/data` | 1,808.5 KiB | 17.7 KiB | None; catalog metadata only |
| `getNeighborhood` from `/data` | 1,808.4 KiB | 854.8 KiB | Three neighborhood definitions for synchronous source switching |
| `getRealtorNeighborhood` from `/data/realtor` | — | 184.5 KiB | SFAR realtor polygons only |
| `loadGuideDetailedData` from `/guide` | 88.3 KiB | 0.6 KiB | None until called |
| `createTransitAnimation` from `/transit` | 1,127.0 KiB | 472.9 KiB | Coast, 2022 districts, parks, BART stations |

The existing `/custom-map` and `/interactive-data` entries import no geographic
JSON. The full root renderer still bundles its built-in district years and
optional layers so `renderSFMap(options)` retains its synchronous behavior. The
`/guide` map preset still includes its six selected overview datasets; its
detailed geography loads only after `loadGuideDetailedData()` is called.

Use `/data/catalog` for metadata search, `/data/realtor` for default SFAR
lookup, and direct JSON subpaths when only one district year or one geographic
collection is needed. Layer visibility flags control drawing; they cannot
remove a statically imported dataset from a consumer bundle.
