# Official California SOS zero-report fixtures

Downloaded November 4, 2026 UTC from https://media.sos.ca.gov/media/ .
The official `json-endpoints.csv` is retained verbatim and explicitly identifies
California's November 3, 2026 general election. Each JSON fixture is an exact
row subset of `https://media.sos.ca.gov/media/<filename>`: all rows whose
`raceTitle` includes `San Francisco County Results` (candidate files) or `San Francisco`
(proposition/judicial files), plus the Governor statewide
row as a test against accidentally selecting aggregate totals. Formatting only
was normalized. The actual source report text is November 2, 2026, 6:28 p.m.
All source counts are zero. No synthetic counts are stored in fixtures.

Synthetic mutations exist only inside tests and must never be published.
Assembly 12 is present in the source fixture but deliberately not mapped: the
verified SF ballot roster covers Assembly 17/19, and source presence alone is
not used to invent ballot eligibility.
