# Examples

[Live example gallery](https://kahwee.github.io/sf-map-svg/examples.html) · [California propositions](https://kahwee.github.io/sf-map-svg/propositions.html) · [Local measures](https://kahwee.github.io/sf-map-svg/measures.html) · [Source data](../SOURCES.md)

Choose by task. All snippets use the public package API; browser examples need a DOM and a bundler that supports JSON imports.

| I want to… | Start here |
| --- | --- |
| Render an SVG on a server | [Static map](#static-svg) |
| Add a small map to a browser | [Lightweight guide](#lightweight-interactive-guide) |
| Bundle only selected geography | [Selected data](#selected-geography) |
| Draw a route over the city | [Route overlay](#route-overlay) |
| Explore real election votes | [California propositions](#california-propositions-by-sf-district) |

## Static SVG

```ts
import { writeFile } from 'node:fs/promises';
import { renderMap } from '@kahwee/sf-map-svg';
import { staticMapData } from '@kahwee/sf-map-svg/data/static';

const svg = renderMap(staticMapData, {
  year: 2022,
  landmarks: true,
  bartStations: true,
  idPrefix: 'example',
}).svg;
await writeFile('districts.svg', svg);
```

The static preset includes the packaged map layers without interactive lookup collections. For smaller bundles, pass selected data to the root or `/static` renderer. See the [static recipe](../README.md#static-svg).

For an election choropleth, use `renderMap(data, { year, districtStyle })` or
`createMap({ map: data, districts: districtMaps, neighborhoods: {} }, options)`.
The controller exposes `setDistrictYear`, `setDistrictStyle`, `selectDistrict`, and typed
district events; `getLayerPaths(data, { year })` returns fitted paths without SVG markup.
See the [Storybook election choropleth](../stories/ElectionMap.stories.ts) for a working example.

## Lightweight interactive guide

```ts
import { createGuideMap } from '@kahwee/sf-map-svg/guide';

const map = createGuideMap({ layers: { roadLabels: false } });
document.querySelector('#map')?.append(map);
```

The guide includes selected coast, SFAR neighborhoods, parks, roads, and stations. Detailed geography loads only when explicitly requested; see the [consumer guide recipe](consumer-integration.md).

## Selected geography

```ts
import { createMap } from '@kahwee/sf-map-svg';
import coast from '@kahwee/sf-map-svg/data/coast.json' with { type: 'json' };
import realtor from '@kahwee/sf-map-svg/data/neighborhoods-realtor.json' with { type: 'json' };

const map = createMap(
  {
    map: { coast: coast.features[0].geometry },
    neighborhoods: { realtor },
  },
  { mode: 'neighborhoods', layers: { highways: false, keyRoads: false } },
);
document.querySelector('#map')?.append(map.element);
// On unmount: map.destroy();
```

This imports one neighborhood definition source. To omit its geometry too, import catalog metadata alone from `/data/catalog`.

## Route overlay

```ts
import { createGuideMap } from '@kahwee/sf-map-svg/guide';

const map = createGuideMap();
document.querySelector('#map')?.append(map);
map.setOverlays([{
  id: 'trip',
  label: 'Example route',
  geometry: {
    type: 'LineString',
    coordinates: [[-122.4194, 37.7749], [-122.3981, 37.7936]],
  },
  stroke: '#a85036',
  strokeWidth: 3,
}]);
```

Coordinates are WGS84 `[longitude, latitude]`. The overlay follows pan and zoom. The [BART journey](https://kahwee.github.io/sf-map-svg/transit.html) is a separate schematic motion example.

## California propositions by SF district

[Open the interactive explorer](https://kahwee.github.io/sf-map-svg/propositions.html). It uses the public static renderer with only the 2022 district and coast datasets and colors each district from the [certified results JSON](../data/propositions/2024-11-05.json). The JSON includes all ten statewide propositions on the November 2024 ballot, with Yes and No counts for each of San Francisco's eleven supervisorial districts. Its scope is SF votes, not statewide totals or voter demographics.

The [import script](../scripts/import-2024-propositions.py) checks each district sum against the official citywide count. [Geographic and election sources](../SOURCES.md) explain the provenance.

## Motion and compact guide embeds

The runnable `examples/generated/interactive.html` now demonstrates camera motion,
staggered marker entrances, clustering, selected marker rings, a custom legend,
compact sources, a north arrow, and a metric scale. Storybook's **Checks / Consumer
API** includes executable motion, reduced-motion, and progressive-shell checks.
See [consumer integration](consumer-integration.md) for server and browser recipes.

For the controller and explicit data imports, see [the v3 migration guide](migration-v3.md).
