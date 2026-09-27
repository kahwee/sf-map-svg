# Guide bundle size report

Generated 2026-09-27 by `pnpm report:guide` with Vite production minification and gzip compression. Each emitted JS chunk is compressed independently. The before measurement uses the compatibility `@kahwee/sf-map-svg/interactive` entry; the after measurement uses `@kahwee/sf-map-svg/guide` initial static imports.

| Entry | Initial JS, raw | Initial JS, gzip | Explicit detail JS, gzip |
| --- | ---: | ---: | ---: |
| v2 root (explicit data) | 76.0 KB | 22.8 KB | — |
| v2 static renderer | 13.0 KB | 4.5 KB | — |
| Compatibility interactive (before) | 6309.8 KB | 1813.6 KB | — |
| Data-free interactive renderer | 72.5 KB | 21.8 KB | — |
| Guide preset (after) | 461.7 KB | 110.2 KB | 473.7 KB |

**Change in initial gzip:** 93.9% smaller. **500 KB target:** met.

The initial guide chunk graph includes only the overview coast, SFAR realtor neighborhoods, major parks, selected highways, six selected streets, and BART points. It excludes historical districts, SF Find neighborhoods, analysis neighborhoods, and the full catalog. Detailed coast, selected SFAR boundaries, parks, selected highway routes, streets, and BART data are in dynamic chunks and load only when `loadGuideDetailedData()` is called. The data inclusion assertions run as part of this report command.

## Emitted entry chunks

- `guide.js`
