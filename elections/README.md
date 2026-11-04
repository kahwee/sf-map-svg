# November 2026 shared feed

Public endpoint: https://kahwee.github.io/sf-map-svg/elections/2026-11-03.json
Explorer: https://kahwee.github.io/sf-map-svg/election.html

Schema version 1. This feed is owned by sf-map-svg; YorkSF can fetch it without a second official-source pipeline. Treat null counts as unknown, never zero. Do not call winners from this feed.

- `electionDate`: exactly `2026-11-03`; `status`: `pending` or `unofficial`.
- `sourceUrl`: official SF results page. `sourceReportTimestamp`: the actual report time, nullable; never synthesized from a fetch.
- `checkedAt`: latest attempt; `lastSuccessfulFetchAt`: last verified results import; `generatedAt`: feed generation; `buildCommit`: GitHub SHA.
- `checkStatus`: `not-checked`, `ok`, or `error`; `message`: diagnostic. Consumers should flag checks older than 30 minutes as stale and retain a prior validated snapshot on fetch failure.
- `ballotSource`: official pamphlet URL, SHA-256, verification time and printed page numbers. All 25 measure titles are included. Candidate options for the 15 displayed contests are checked against the official candidate roster (`candidateRosterSourceUrl`, `displayedCandidateContestsComplete: true`). Overall `candidateRosterComplete` remains false: judicial contests and statewide candidate names are not covered.
- `contests[]`: stable election-scoped ID, title, kind, scope, source URL, options (`id`, `label`, nullable nonnegative integer `votes`), `call: uncalled`, and `regions`.
- `rosterStatus: verified-official-roster` identifies the 15 verified displayed candidate rosters. `supervisorialDistrict`, when present, identifies supervisor ballot eligibility only. It does not allocate citywide votes to districts. `countingMethod` distinguishes ranked-choice first-choice totals from ordinary votes.
- `geography: {type: "none", boundaryYear: null}` and empty `regions` mean no geographic results have been imported. Districts, precincts, neighborhoods and BART districts are not interchangeable.

## Current limitation

The official November report endpoint returned CloudFront HTTP 403 on November 3 at about 6:10 p.m. Pacific. The live result format could not be inspected. The parser deliberately rejects reports until an adapter is verified against an actual November report; **scheduled checks do not yet import vote totals**. HTTP errors, wrong-election pages and unknown formats preserve the last validated data. Do not describe this as a functioning live vote-count feed until that adapter and geographic source have been verified and tested. No historical June/2024 counts are used as November results.

The existing Pages workflow runs at minutes 7, 17, 27, 37, 47 and 57. GitHub scheduling is best effort; runs may be delayed or dropped and inactive public repositories may have schedules disabled. Builds preserve existing validation/deployment gates and do not commit polling data or publish npm. The deployed JSON is retrieved as the prior snapshot on each build. A failed deployment leaves the previous public site intact.

To finish ingestion: inspect a successful official November report, capture a dated fixture and source report timestamp, implement its citywide/RCV parsing, then independently verify geographic report units and boundary vintage before enabling region validation and colors. Reconcile geographic totals against the corresponding citywide contest and report; reject incomplete or mismatched reports. Keep all calls uncalled.
