# Geometry and provenance

## Map extraction

District geometry, coast, label anchors, highway geometry, and the pastel district palette were extracted from the San Francisco District Map on September 25, 2026. Only map rendering and public geographic data are distributed. Site account identifiers, original application code, and ballot overlays are excluded.

## Districts and coastline

DataSF datasets used by the original Site:

| Layer                        | Source                                         |
| ---------------------------- | ---------------------------------------------- |
| 2002 supervisorial districts | https://data.sf.gov/resource/qdm2-fi8r.geojson |
| 2012 supervisorial districts | https://data.sf.gov/resource/keex-zmn4.geojson |
| 2022 supervisorial districts | https://data.sf.gov/resource/f2zs-jevy.geojson |
| Display land mask            | https://data.sf.gov/resource/hcgx-vtsb.geojson |
| Highways                     | https://data.sf.gov/resource/3psu-pn9h.geojson |

The Site prepared a common coastline using polygon intersections. It excludes the 2002 district-zero water area and tiny survey/reclamation differences between years; internal district boundaries remain unchanged. It represents about 99.631% of the current trimmed land mask. This package preserves that display geometry and includes Treasure Island; it is not a cadastral or navigational map and does not include the Farallon Islands.

## Optional neighborhoods

117 SF Find Neighborhoods downloaded September 25, 2026:

- GeoJSON: https://data.sf.gov/resource/gfpk-269f.geojson?$limit=500
- Catalog: https://data.sf.gov/Geographic-Locations-and-Boundaries/SF-Find-Neighborhoods/pty2-tcw4

The Mayor’s Office of Neighborhood Services defined these areas in **2006** for SF Find. They convey approximate neighborhood locations, not hard demarcations. SF Find remains available as an alternative JSON collection. The default renderer now uses the August 2010 SFAR realtor collection, independently of district year, clipped to the Site’s display coastline.

## Rights

Source geometry is provided by the City and County of San Francisco through DataSF, subject to the source datasets’ terms: https://datasf.org/opendata/terms-of-use/

Package licensing does not change rights in the underlying public data. Retain source attribution when redistributing maps or data.

## Parks and landmark areas

Downloaded September 25, 2026:

- Recreation and Parks Properties: https://data.sf.gov/resource/gtr9-ntp6.geojson?$limit=1000
- Presidio boundary: https://data.sf.gov/resource/jt6f-vx2z.geojson

`data/landmarks.json` retains full source coordinates for six selected landmark areas. Golden Gate Park combines property sections 1–7 into one MultiPolygon; section boundaries are not stroked. Lincoln Park, John McLaren Park, Mission Dolores Park, and Twin Peaks use their named RPD properties. The Presidio uses its separate boundary dataset. Label anchors and offsets are hand-positioned for city-scale legibility. These are property areas, not neighborhood approximations, and do not vary with the district year.

## BART stations

Downloaded September 25, 2026 from BART's [geospatial data page](https://www.bart.gov/schedules/developers/geo):

- Official station-centroid KML archive: https://www.bart.gov/sites/default/files/2025-12/BART-Stations-tracks-entrances-121025.kmz_.zip

The `BART Station` folder supplies names and unrounded longitude/latitude for the eight San Francisco stations: Embarcadero, Montgomery St, Powell St, Civic Center/UN Plaza, 16th St/Mission, 24th St/Mission, Glen Park, and Balboa Park. Entrances, tracks, and stations outside city limits are excluded. Station locations are a current overlay, not historical station inventories matched to each district year. BART data retains its source rights independently of the package license.

## Public JSON collections and neighborhood naming

On September 25, 2026, the previously bundled district, coast, highway, park, and station geometry was moved unchanged to `data/*.json`. District `properties.displayExtras` and label points retain the original map's presentation geometry and island badges. The district JSON files describe processed display maps, not untouched source downloads. Regression digests preserve the original district and SF Find coordinate sequences.

The SF Find source was fetched again and its 117 geometries matched the bundled geometry exactly. Two additional complete collections were downloaded on September 25, 2026:

- Analysis Neighborhoods (41): https://data.sf.gov/resource/j2bu-swwd.geojson?$limit=100
- Realtor Neighborhoods (92; August 2010 SFAR definitions): https://data.sf.gov/resource/2kjj-ysvr.geojson?$limit=500

The [Analysis Neighborhoods metadata](https://catalog.data.gov/dataset/analysis-neighborhoods) explains the census-tract aggregation and explicitly states that these are not official neighborhood boundaries. The [Realtor Neighborhoods dataset](https://data.sf.gov/d/2kjj-ysvr) identifies SFAR as the source of those alternative definitions. Collection counts mean 250 source-specific definitions, not 250 unique neighborhoods or an exhaustive inventory of every locally used name. Same-name polygons are not merged across sources.

Canonical names default to original source labels. The package normalizes Haight-Ashbury and Fisherman's Wharf punctuation where the SF Find source differs, preserving the exact labels in `sourceName`. Curated lookup aliases use these naming references; the references support names, not agreement with the GeoJSON boundary:

- Mission / Mission District / The Mission: https://www.sftravel.com/neighborhoods/mission-district and https://www.sftravel.com/neighborhoods
- South of Market / SoMa: https://www.sftravel.com/neighborhoods/soma-yerba-buena
- North Panhandle / NoPa / North of the Panhandle: https://www.sftravel.com/article/where-to-eat-drink-san-franciscos-nopa
- Haight-Ashbury and Fisherman's Wharf display spellings: https://www.sftravel.com/neighborhoods

No survey of resident consensus is claimed. Composite areas are not converted to aliases of their component neighborhoods. Mission and Outer Mission remain separate identities. Detailed schema and access examples are in `data/README.md`.

## Non-overlapping realtor topology

On September 25, 2026, pairwise polygon intersection checks found 64 overlapping pairs in the original 92-area realtor dataset. These were boundary slivers totaling approximately 1.05 square meters (local planar estimate). `pnpm data:normalize-realtor` removes shared interior area by assigning it to the lexicographically first stable neighborhood ID and subtracting it from the other feature. This is a deterministic geometric tie-break for source slivers, not a new claim about legal boundaries.

The cleanup retains all 92 identities, names, and source codes. It uses no rounding or buffers, recalculates affected bounding boxes, and verifies that the union of all neighborhood areas is unchanged. Shared edges and vertices remain valid. `data/neighborhoods-realtor.json` records the transformation in `topology`; its polygons are normalized derivatives of the cited source. Regression tests require empty pairwise polygon intersections, non-overlapping component polygons, the original union digest, and an idempotent cleanup. Polygon clipping is a development dependency only; rendering remains dependency-free.

## Key road landmarks

Downloaded September 26, 2026 (UTC; September 25 in San Francisco) from [DataSF Streets – Active and Retired](https://data.sf.gov/resource/3psu-pn9h.geojson), filtering `active = true` and exact source street names. `data/key-roads.json` groups 724 source segments into nine named corridors, preserving every source coordinate and CNN segment ID. Geary St and Geary Blvd are grouped under the Geary Blvd display label. These are geographic orientation features, not a complete network or vehicle-access guidance. Label anchors select existing source vertices near editorial targets. Regenerate with `node scripts/import-key-roads.mjs` then `pnpm data:catalog`. The full query and retrieval date are embedded in the JSON. DataSF terms apply.
