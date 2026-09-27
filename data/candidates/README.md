# San Francisco candidate results

`catalog.json` lists six certified election snapshots. Each election JSON is
separate so the Pages explorer fetches only the selected year. Local builds
ship these files as optional JSON subpaths; they will be available from npm
after the next package release. For example:

```js
import results from '@kahwee/sf-map-svg/data/candidates/2024-11-05.json' with { type: 'json' };
```

No candidate results are imported by the default map renderer. These are
**San Francisco votes**, not statewide totals or votes by individual people.
The `districtYear` is the supervisorial map vintage, not a congressional
boundary. For House and state legislative contests, an `eligible: false` row
means that the workbook had no voters from that supervisorial district for
the contest. Do not convert it to zero support. Districts can be partly inside
a congressional district; the JSON does not provide congressional polygons.
`partiallyEligible` compares a contest's district registration with the same
election's citywide presidential or gubernatorial registration, so a client
can mark districts that straddle a contest boundary.

`contests` hold an election-scoped ID, official workbook title, source sheet,
candidate names and party labels, a citywide vote vector, and eleven
supervisorial district rows. Candidate positions in every `votes` array match
the `candidates` array. `totalVotes` includes reported write-ins. A candidate
share is `votes[index] / totalVotes` when the total is positive. The
`unassigned` object records rare county cumulative votes that the official
workbook does not assign to a supervisorial district; the 2024 Treasurer
contest has one such vote and two undervotes. These remain in citywide totals.

`scripts/import-candidate-results.py` reads the official final Excel workbooks,
records their SHA-256 digests, and checks candidate and district sums. Download
the six workbook URLs in `SOURCES.md` as `2016.xlsx`, `2018.xlsx`,
`2020.xlsx`, `2022.xlsx`, `2024.xlsx`, and `2026.xlsx` into a local folder, then run:

```sh
uv run --with openpyxl python3 scripts/import-candidate-results.py /path/to/folder
```

This archive includes federal, statewide, and state legislative candidate
contests with SF votes in these six elections. It is not an exhaustive
archive of every local office or election. Sources and limitations are in
`SOURCES.md`.
