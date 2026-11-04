# November 2026 shared feed

Public endpoint: https://kahwee.github.io/sf-map-svg/elections/2026-11-03.json
Explorer: https://kahwee.github.io/sf-map-svg/election.html

Schema version 1. This feed is owned by sf-map-svg; YorkSF can fetch it without a second official-source pipeline. Treat null counts as unknown, never zero. Do not call winners from this feed.

- `electionDate`: exactly `2026-11-03`; `status`: `pending` or `unofficial`.
- `sourceUrl`: official SF results page. `sourceReportTimestamp`: the local SF Department report time, nullable; never synthesized from a fetch.
- `checkedAt`: latest attempt; `lastSuccessfulFetchAt`: last successful verified source import, including a zero report; `generatedAt`: feed generation; `buildCommit`: GitHub SHA.
- `checkStatus`: `not-checked`, `ok`, `partial`, or `error`; `message`: diagnostic. Consumers should flag checks older than 30 minutes as stale and retain a prior validated snapshot on fetch failure.
- `ballotSource`: official pamphlet URL, SHA-256, verification time and printed page numbers. All 25 measure titles are included. Candidate options cover 24 contests: 15 checked against the SF roster and nine against the California certified list. `candidateRosterComplete: true` refers to printed certified candidates, as qualified by `candidateRosterScope`; later statewide write-ins are not independently verified. Thirteen judicial retention contests are included (`kind: judicial-retention`) for the Supreme Court and First Appellate District only. `stateCandidateSource` records the certified-list URL, checksum, certification date and pages.
- `contests[]`: stable election-scoped ID, title, kind, scope, source URL, options (`id`, `label`, nullable nonnegative integer `votes`), `call: uncalled`, and `regions`.
- `rosterStatus: verified-official-roster` identifies the verified displayed candidate rosters. `supervisorialDistrict`, when present, identifies supervisor ballot eligibility only. It does not allocate citywide votes to districts. `countingMethod` distinguishes ranked-choice first-choice totals from ordinary votes.
- `geography: {type: "none", boundaryYear: null}` and empty `regions` mean no geographic results have been imported. Districts, precincts, neighborhoods and BART districts are not interchangeable.

## Current limitation

The official November report endpoint returned CloudFront HTTP 403 on November 3 at about 6:10 p.m. Pacific. The local SF result format could not be inspected. Its parser deliberately rejects reports until an adapter is verified against an actual November report. **Local contests and within-city geographic results remain blocked.** A separately verified California SOS adapter checks 40 state/federal candidate, proposition and judicial contests and can import their SF county counts after polls close when nonzero official reports appear. HTTP errors, wrong-election pages and unknown formats preserve the last validated data. Describe this as partial state/federal county coverage, not a complete local or district results feed. No historical June/2024 counts are used as November results.

The existing Pages workflow runs at minutes 7, 17, 27, 37, 47 and 57. GitHub scheduling is best effort; runs may be delayed or dropped and inactive public repositories may have schedules disabled. Builds preserve existing validation/deployment gates and do not commit polling data or publish npm. The deployed JSON is retrieved as the prior snapshot on each build. A failed deployment leaves the previous public site intact.

To finish ingestion: inspect a successful official November report, capture a dated fixture and source report timestamp, implement its citywide/RCV parsing, then independently verify geographic report units and boundary vintage before enabling region validation and colors. Reconcile geographic totals against the corresponding citywide contest and report; reject incomplete or mismatched reports. Keep all calls uncalled.

## California SOS partial county adapter

The independent official index https://media.sos.ca.gov/media/json-endpoints.csv explicitly identifies the November 3, 2026 election and publishes the JSON endpoints. Each run verifies that identity and uses only exact `San Francisco County Results` rows. Supported contests are Governor, Lieutenant Governor, Secretary of State, Controller, Treasurer, Attorney General, Insurance Commissioner, Superintendent of Public Instruction, Board of Equalization District 2, U.S. House Districts 11/15 and Assembly Districts 17/19, all 14 state propositions, and the 13 SF-eligible Supreme Court/First Appellate District judicial retention contests. The 22 local candidate, local measure and regional RTM contests remain unavailable.

Per-contest additive fields: `resultStatus` (`pending`/`unofficial`), `resultSourceUrl`, `sourceReportTime` (verbatim official report text; no invented timezone/UTC conversion), `resultsFetchedAt` (ISO timestamp), `reporting` (official text), `resultCheckStatus`, `resultCheckedAt`, and `resultGeography: {type:"county",id:"06075",name:"San Francisco",scope:"county-portion-of-contest"}`. `sourceChecks` lists the separate SF and SOS outcomes. The top-level `sourceReportTimestamp` remains the local SF report timestamp; it is not substituted with a SOS check time. Top-level `geography.type:"none"` means no **within-SF breakdown**, not absence of county-level totals.

All zero/pre-election reports remain null/pending, and no vote totals publish before 8 p.m. Pacific November 3. Exact race/county labels, candidate sets, proposition numbers, judicial names and appellate district, duplicate rows, nonnegative integer counts, report dates and reporting metadata are validated. Future report clock values are rejected against the current California clock without converting the published source string into a fabricated UTC report timestamp. A total SOS outage marks every supported contest check as failed while retaining any last-good counts and report provenance. Unknown formats fail closed per contest; failed, older or zero-reset reports preserve last-good counts and their original provenance. A successful check is not proof of a newer official report. Consumers must show per-contest source/report/fetch provenance, interpret all numbers as SF county portions, and never infer a statewide, districtwide or ranked-choice winner.

Actual November 2 zero-report fixtures and extraction provenance are in `test/fixtures/sos/README.md`; synthetic mutations test post-poll counts, county/state confusion, malformed reports, pre-poll gating and last-good preservation. No synthetic votes are deployed.

## Plain-language measure descriptions

Each of the 25 measures includes additive `shortTitle` (string), `summary` (one or two neutral sentences), and `summarySource: {url: string, pages: string}`. `pages` uses **printed** page numbers, not PDF viewer indices. `title` remains the full official title. These are concise explanations, not a substitute for the complete official analysis. State measures cite the November 2026 California voter guide; local and regional measures cite the SF pamphlet. Consumers can fall back to `title` if these optional fields are absent. Verified descriptions merge into prior unofficial snapshots only when stable contest ID, title, kind and option identities match; counts and report provenance remain untouched.

The explorer displays one contest at a time. `?contest=local-G` (or another stable contest ID) opens a specific contest; the selector remains keyboard accessible. Supervisor filtering describes ballot eligibility, not geographic vote allocation.

## Observed report history

Each contest may include `resultHistory` (array; treat absent as `[]`). A point is exactly:

```json
{
  "sourceReportTime": "<verbatim official report time>",
  "observedAt": "<ISO time of the first fetch observing these values>",
  "resultSourceUrl": "<official SOS JSON URL>",
  "reporting": "<official precinct reporting string>",
  "resultGeography": {"type":"county","id":"06075","name":"San Francisco","scope":"county-portion-of-contest"},
  "options": [{"id":"<stable option ID>","label":"<verified label>","votes":123}]
}
```

The sample count above illustrates the schema only; it is not an election result. Only validated unofficial post-poll reports with a positive contest total create points. Zero/pre-election reports create no history. Re-fetching identical report time and counts preserves the original point and `observedAt`; corrected counts at the same report time create an observed revision. Older report times cannot replace newer results. All earlier points are retained. `observedAt` is an observation time, **not** the source’s report timestamp. Never infer ballot completion from precinct-reporting percentages or allocate county totals to districts.

The selected-contest chart uses discrete, equally spaced observations and step changes, with a keyboard-accessible table of exact report and observation times. Measures show Yes and No together across all real observations, with a count/share selector and an accessible Chart/Table toggle. Candidate contests retain an option selector. Each series has one point per actual observation; a single report does not imply a trend. Vote share uses the sum of that contest’s reported option counts, not turnout. County changes may include corrections, not just newly counted ballots.

The public deployed feed is the last-good history store. Every update must load and validate it before fetching new counts; failed recovery aborts the build and leaves the current Pages deployment intact. No polling data is committed, and no second storage service or pipeline is used. Verified description updates merge by exact contest and option identity without touching history or counts.


### CDN rollback guard and durability limits

Recovery checks the public GitHub Actions metadata for the most recent completed Pages run with a successful `deploy` job, including failed overall runs whose deploy succeeded. It requires the public JSON's build SHA and check/generation window to match that deployment (from its build-job start through deploy completion, not the possibly earlier queue time). During a new workflow run, the metadata must also include the preceding workflow run number; metadata lag, incomplete jobs, API failure/rate limits, or an older CDN snapshot abort publication. API reads are public and add no credentials or permission grants.

This protects routine serialized refreshes from silently rolling history back to an older CDN response. The Pages snapshot is **not an immutable archive or independent backup**: durability still depends on retained public data and trustworthy GitHub deployment metadata. Manual rollbacks, deletion/corruption, or another publisher can require recovery outside this feed. The guard favors leaving the current deployment intact over publishing when freshness cannot be proved.

### Separately attributed newsroom updates

Local A–J may carry optional `mediaUpdate: {observedAt, sourceUpdatedAt, sourceName,
sourceUrl, options: [{id,label,votes}], projection?}`. The optional projection is
`{outcome,sourceName,sourceUrl,publishedAt}`. These are KQED preliminary tallies;
G separately records the Chronicle's rejection projection. Neither timestamp is an
official source report time. The UI labels the projection “Not certified.” Official
`options`, `call`, root status and `resultHistory` remain unchanged. Media totals
never enter official batch trends or district coloring. `observedAt` records the
verification observation, not every automated fetch; these news updates are not
an independently polled feed. Newer newsroom metadata survives snapshot recovery.

`mediaHistory` is an optional chronological array of complete `mediaUpdate` objects,
including each observation's publisher, URL, publisher page-update time, observation
time, options and optional attributed projection. `mediaUpdate` mirrors its final
entry. A–J now preserve the first KQED observation and the newer Chronicle observation
verified at 2026-11-04T05:53:30Z (publisher page updated 05:52Z). Recovery unions verified
observations without dropping older entries. A separately labeled newsroom chart is
used only when official history is unavailable. Its steps compare cumulative published
tallies across observations/publishers, not distinct batches of newly cast ballots.

RTM adds one Chronicle newsroom observation covering the **full five-county contest**,
not San Francisco alone. Its `mediaUpdate` and `mediaHistory` point carry
`resultGeography: {type:"regional", scope:"full-contest", name:"Five-county RTM region",
counties:["Alameda","Contra Costa","San Francisco","San Mateo","Santa Clara"]}`.
The Chronicle passage projection uses `observedAt`, with no invented `publishedAt`.
The tally's `sourceUpdatedAt` is the publisher page-update time. The official
`options`, `call`, `resultHistory`, and neutral district map remain separate.

The dedicated KQED RTM source also supports `sourceUpdatedAt: null` only alongside
`sourceTimestampIssue: {type: "future-dated", rawText: "Updated at 11:27 PM PT on November 4, 2026"}`.
This narrow exception preserves the publisher's literal invalid date; it does not
repair or infer a report time. The UI displays “Report time unverified,” the raw
issue and the actual `observedAt`. Newsroom history stays ordered by observation,
including when publisher clocks disagree. Existing dated observations are retained
unchanged. Consumer support does not itself publish a new observation.

RTM source audit: at 2026-11-04T09:05:03Z the dedicated KQED page showed
702,848 Yes / 439,585 No with the future-dated literal clock recorded above.
That observation was held and never published. A normal visible-page reload at
2026-11-04T09:23:52Z showed the same totals with “Updated at 12:59 AM PT on
November 4, 2026” (08:59:00Z). Only this later verified observation is appended;
its corrected source clock is not backdated onto the earlier observation.
