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

The Mayor’s Office of Neighborhood Services defined these areas in **2006** for SF Find. They convey approximate neighborhood locations, not hard demarcations. Neighborhood lines are bundled independently of district year and are clipped to the Site’s display coastline.

## Rights

Source geometry is provided by the City and County of San Francisco through DataSF, subject to the source datasets’ terms: https://datasf.org/opendata/terms-of-use/

Private package licensing does not change rights in the underlying public data. Retain source attribution when redistributing maps or data.

## Parks and landmark areas

Downloaded September 25, 2026:

- Recreation and Parks Properties: https://data.sf.gov/resource/gtr9-ntp6.geojson?$limit=1000
- Presidio boundary: https://data.sf.gov/resource/jt6f-vx2z.geojson

`src/overlays.js` retains full source coordinates for six selected landmark areas. Golden Gate Park combines property sections 1–7 into one MultiPolygon; section boundaries are not stroked. Lincoln Park, John McLaren Park, Mission Dolores Park, and Twin Peaks use their named RPD properties. The Presidio uses its separate boundary dataset. Label anchors and offsets are hand-positioned for city-scale legibility. These are property areas, not neighborhood approximations, and do not vary with the district year.

## BART stations

Downloaded September 25, 2026 from BART's [geospatial data page](https://www.bart.gov/schedules/developers/geo):

- Official station-centroid KML archive: https://www.bart.gov/sites/default/files/2025-12/BART-Stations-tracks-entrances-121025.kmz_.zip

The `BART Station` folder supplies names and unrounded longitude/latitude for the eight San Francisco stations: Embarcadero, Montgomery St, Powell St, Civic Center/UN Plaza, 16th St/Mission, 24th St/Mission, Glen Park, and Balboa Park. Entrances, tracks, and stations outside city limits are excluded. Station locations are a current overlay, not historical station inventories matched to each district year. BART data retains its source rights independently of the package license.
