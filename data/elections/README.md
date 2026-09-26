# Pages election snapshots

`catalog.json` is the inventory for the GitHub Pages measure explorer. Each
listed JSON file is a complete snapshot of **local** San Francisco measures
in that election, with one citywide row and eleven supervisorial district
rows per measure. The catalog covers November 2002, November 2012, November
2022, and June 2026. It does not claim coverage of intervening elections or
statewide measures.

Each snapshot defines `districtYear` (the displayed boundary vintage),
`electionDate`, `electionName`, `certifiedDate` (nullable when not separately
verified), `downloadedDate`, source URLs and SHA-256 checksum, `geography`,
`method`, and a `measures` array. Each measure has an election-scoped `id`,
official title, source sheet and URL, passage `threshold`, `citywide` counts,
and eleven `districts` counts with `sourceRow`. Count fields are `yes`, `no`,
`undervotes`, and `overvotes`. A JSON `null` means the source does not report
the count; it never means zero. Yes share uses only Yes and No votes.

The 2002 workbook directly reports supervisorial totals, but not separate
under/overvotes. The 2012 official workbook reports precinct votes; its
district totals are derived by grouping all 596 precincts with the historical
2012 DataSF `supdist` field. Every combined precinct and mail ballot row
resolves to one district. The 2022 and 2026 district workbooks report totals
directly. Import scripts reconcile each district sum with citywide counts;
the 2022 importer additionally checks the final summary workbook. Raw source
files and the 2012 crosswalk are ingestion inputs, not website downloads.

The explorer uses separate JSON files so selecting one election does not
fetch every other election. Data files remain Pages assets, not npm exports.
Source URLs and retrieval details are in `SOURCES.md`.
