# Guide bundle size report

Generated 2026-09-28 by `pnpm report:guide` with Vite production minification and gzip compression. Each emitted JS chunk is compressed independently. The report measures the explicit-data v3 root and the optional `@kahwee/sf-map-svg/guide` preset.

| Entry | Initial JS, raw | Initial JS, gzip | Explicit detail JS, gzip |
| --- | ---: | ---: | ---: |
| v3 root (explicit data) | 87.4 KB | 25.5 KB | — |
| v3 static renderer | 15.3 KB | 5.0 KB | — |
| Guide preset | 477.1 KB | 114.1 KB | 473.7 KB |

**500 KB target:** met.

The initial guide chunk graph includes only the overview coast, SFAR realtor neighborhoods, major parks, selected highways, six selected streets, and BART points. It excludes historical districts, SF Find neighborhoods, analysis neighborhoods, and the full catalog. Detailed coast, selected SFAR boundaries, parks, selected highway routes, streets, and BART data are in dynamic chunks and load only when `loadGuideDetailedData()` is called. The data inclusion assertions run as part of this report command.

## Emitted entry chunks

- `guide.js`
