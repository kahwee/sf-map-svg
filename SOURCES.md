# Geometry and provenance

## Candidate votes in San Francisco, 2016–2026

Downloaded September 26, 2026 from the San Francisco Department of Elections'
final district statements of vote. The files under `data/candidates/`
contain 56 candidate contests across six elections, with candidate vote counts
for San Francisco citywide and supervisorial districts. Original workbooks are
ingestion inputs and are not distributed.

| Election | Final official workbook | Supervisorial map vintage |
| --- | --- | --- |
| November 8, 2016 | https://www.sfelections.org/results/20161108/data/20161206/20161206_sov.xlsx | 2012 |
| November 6, 2018 | https://www.sfelections.org/results/20181106/data/20181127/20181127_sov.xlsx | 2012 |
| November 3, 2020 | https://www.sfelections.org/results/20201103/data/20201201/20201201_dsov.xlsx | 2012 |
| November 8, 2022 | https://www.sfelections.org/results/20221108/data/20221201/dsov.xlsx | 2022 |
| November 5, 2024 | https://www.sfelections.org/results/20241105/data/20241203/dsov.xlsx | 2022 |
| June 2, 2026 | https://sfelections.org/results/20260602/data/20260625/dsov.xlsx | 2022 |

The [Department's election data catalog](https://sfelections.org/tools/election_data/datasets.php)
indexes related election materials. `scripts/import-candidate-results.py` records
each input SHA-256 in the corresponding JSON and reconciles candidate totals,
under/overvotes, and all eleven supervisorial areas against the official SF
total. The 2016 and 2018 workbooks contain explicit district and neighborhood
summary sections. Later workbooks supply dedicated district statements. A
missing supervisorial row in a congressional or legislative contest means that
district was outside the eligible contest area; it is not a zero vote share.
The 2024 Treasurer workbook reports one additional cumulative vote and two
undervotes outside the supervisorial rows, retained in `unassigned` and the
citywide total.
All pages use candidate / total valid contest votes, not a two-party share.
The archive excludes ranked-choice local races, primary contests before 2026,
and other election dates; it does not claim to represent all SF elections.
Historical neighborhood labels in election workbooks are not substituted for
the independent neighborhood boundary datasets in this repository.

## California propositions in San Francisco

Downloaded September 26, 2026 from the San Francisco Department of Elections' [final November 5, 2024 results](https://sfelections.org/results/20241105w/detail.html):

- [Certified district statement of vote workbook](https://www.sfelections.org/results/20241105/data/20241203/dsov.xlsx), SHA-256 `9bf9c7d767273e73b3cdf5b98086412cbe354b0928ee6abb0e379deb0353c403`
- [Certification letter](https://www.sfelections.org/results/20241105/data/20241203/CertificationLetterNov52024.pdf)
- [California Secretary of State statewide Statement of Vote](https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/general-election-nov-5-2024/statement-vote) for statewide context

`data/propositions/2024-11-05.json` contains Yes and No counts for all ten state propositions, grouped by San Francisco supervisorial district. The short titles are editorial navigation labels. `scripts/import-2024-propositions.py` reads the final workbook's proposition sheets and checks that all eleven district totals sum exactly to its San Francisco citywide totals. Yes share divides Yes by Yes plus No, excluding undervotes and overvotes. The data describes where ballots were cast within San Francisco, not individual voters or statewide outcomes. Its 2022 district geography matches the election's district vintage.

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

Downloaded September 26, 2026 (UTC; September 25 in San Francisco) from [DataSF Streets – Active and Retired](https://data.sf.gov/resource/3psu-pn9h.geojson), filtering `active = true` and exact source street names. `data/key-roads.json` groups 513 source segments into six explicitly selected streets: Market, Van Ness, Geary, Lombard, 19th Avenue, and the Embarcadero, preserving source coordinates and CNN segment IDs. Geary St and Geary Blvd are grouped under the Geary Blvd display label. These are geographic orientation features, not a complete network or vehicle-access guidance. Label anchors select existing source vertices near editorial targets. Regenerate with `node scripts/import-key-roads.mjs` then `pnpm data:catalog`. The full query and retrieval date are embedded in the JSON. DataSF terms apply.

## Lightweight guide geometry

On September 26, 2026, `pnpm data:guide` generated `data/guide/*.json` from the canonical coastline, SFAR neighborhood, park, highway, selected-street, and BART files above. The overview omits unused properties and simplifies lines at subpixel tolerance for an approximately 800px city map. Realtor boundaries are simplified as shared arcs and reused on adjacent polygons. Coastline and park overview polygons are simplified independently while preserving ring closure. The guide preset keeps US 101, I-280, Highway 1 and the six named orientation streets. Detailed selected geography loads only when requested. Derived files retain source metadata and source dates; no new geographic source is asserted.

## June 2026 ballot measures explorer

Downloaded September 26, 2026 from the San Francisco Department of Elections:

- Final district workbook: https://sfelections.org/results/20260602/data/20260625/dsov.xlsx
- Citywide summary, official measure titles, ballot questions, and thresholds: https://sfelections.org/results/20260602/index.html
- Certification dated June 25, 2026: https://sfelections.org/results/20260602/data/20260625/CertificationLetterJun22026.pdf
- Final report index: https://sfelections.org/results/20260602w/detail.html

`data/elections/2026-06-02.json` contains Measures A–D, their citywide counts, and the 11 `SUP DIST n - Total` rows from workbook sheets 20–23. Each row retains its worksheet row number; metadata retains the workbook SHA-256. `scripts/import-election-results.py` extracts these with openpyxl (ingestion only), checks all district sums including under/overvotes, and cross-checks Yes/No citywide counts against the official HTML summary. Rerun with the downloaded workbook and summary paths. No original Site ballot overlays are reused.

The Pages-only explorer calculates Yes / (Yes + No), excluding under/overvotes. Measure A uses the two-thirds threshold; B–D use a strict majority, as stated in the official summary. These are citywide outcomes, not district-level passage decisions. District counts are reported directly by Elections, not spatially assigned to neighborhoods. The existing 2022 district display map is reused unchanged. Election JSON is a separate website dataset, not a new npm package API; no live service or forthcoming-election coverage is claimed.

## Historical local measures for the Pages explorer

Downloaded September 26, 2026. Each snapshot contains **all local measures in
the listed election**, not every election in the surrounding decade. All
eleven district Yes/No totals reconcile to the citywide official totals.

| Election | Final results source | Titles and thresholds | District method |
| --- | --- | --- | --- |
| November 5, 2002 | https://sfelections.org/results/20021105/SOV021105.xls | https://webbie1.sfpl.org/multimedia/pdf/elections/November5_2002.pdf | Official workbook `PROPOSITIONS` supervisorial rows; under/overvotes unavailable |
| November 6, 2012 | https://sfelections.org/results/20121106/data/SOV_Nov2012.xls | https://sfelections.org/results/20121106/index.html and https://webbie1.sfpl.org/multimedia/pdf/elections/November6_2012.pdf | 596 official precincts grouped by DataSF's 2012 `supdist` field |
| November 8, 2022 | https://www.sfelections.org/results/20221108/data/20221201/dsov.xlsx | https://sfelections.org/results/20221108/index.html | Official final district workbook rows |

The 2012 historical precinct-to-district source is
https://data.sfgov.org/resource/bsfq-aeyw.json?$limit=1000 . Its 605 records
include 596 election precinct identifiers and the `supdist` attribute; joined
mail-ballot and slash-combined precinct rows map to one district each. This
2012 collection is used only to group the 2012 official vote rows. The
crosswalk and workbook checksums are retained in the JSON. The 2002 voter
pamphlet explicitly discusses the bond thresholds; 2012 A and B require
two-thirds, as established by the parcel tax and bond measures.

For 2022, the independent **final** summary workbook is
https://www.sfelections.org/results/20221108/data/20221201/summary.xlsx and
the certification is
https://www.sfelections.org/results/20221108/data/20221201/N2022_CertificationLetter.pdf .
The election summary HTML has older counts for some measures, so it is used
only for titles, ballot questions, and the stated thresholds. The importer
compares every citywide Yes, No, undervote, and overvote count with the final
summary workbook. The 2002 official results index is
https://sfelections.org/results/20021105w/index.html and the 2012 results
index is https://sfelections.org/results/20121106/detail.php .

`scripts/import-historical-measures.py` records input SHA-256 hashes and
reconciles all 2002, 2012, and 2022 district totals. The election JSON files
are Pages datasets; the historical district maps retain their existing
display geometry, and no precinct polygons or raw workbook data are shipped.
