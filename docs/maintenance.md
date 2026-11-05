# Validation and release runbook

This is the maintained workflow for the library, its documentation, and GitHub Pages. Start with [CONTRIBUTING.md](../CONTRIBUTING.md) for architecture and [SOURCES.md](../SOURCES.md) for geographic constraints. Use Node 24+, the pnpm 12 version declared in `package.json`, and Bun from `.bun-version` for builds and development checks.

## Choose the scope

| Request | Deliverable |
| --- | --- |
| Clean up docs or the site | Edit authored sources, validate, and deploy Pages when requested. Keep the current package version. |
| Change the library | Align types, API docs, examples and stories; record user-visible changes under Unreleased. |
| Bump a version and push | Prepare the dated changelog and matching package metadata, validate, commit and push. Publication remains a separate action. |
| Publish or release a package | Complete the release procedure below, including npm and live Pages verification. |

A site deployment does not publish npm. A version bump does not publish npm. Publish a GitHub release only when the user requests publication. Preserve unrelated checkout work; use an isolated worktree when necessary.

## Validation by change

Install with `pnpm install --frozen-lockfile`. Read `AGENTS.md` for requirements that apply to the changed files.

| Changed surface | Required evidence |
| --- | --- |
| Markdown | `pnpm docs:llms`, `pnpm check:docs`; check copyable examples with `pnpm test:package`. |
| Site HTML, CSS, or browser code | `pnpm check`, `pnpm demo`, `pnpm build-storybook`, `pnpm build:pages`, `pnpm test:pages`, `pnpm test:studio`; inspect with Agent Browser below. |
| Library source, public types, or dependencies | `pnpm check`, `pnpm demo`, `pnpm build-storybook`, `pnpm test:stories:coverage`, `pnpm test:package`; build Pages and run its gates for affected examples. |
| Visual rendering or shared site styling | Build Storybook and Pages, then `pnpm test:visual`; review actual screenshots before updating any baselines. |
| Geography or metadata | Read [data/README.md](../data/README.md); record source URLs and download dates, regenerate `pnpm data:catalog`, and run `pnpm data:check` plus renderer checks. |
| Browser interaction harness or benchmark | `pnpm test:browsers`, `pnpm benchmark:markers`; run sequentially because they share the production fixture and port. Regenerate assistant docs when recording results in the README. |

`pnpm test:package` installs the actual packed archive in a clean consumer, checks exports and zero runtime dependencies, and compiles documented browser recipes with strict types, exact optional properties, and checked indexed access. Storybook browser checks require `pnpm exec playwright install chromium` once. A passing static build alone does not verify browser behavior.

## Inspect with Agent Browser

Load `agent-browser skills get core --full` before using the CLI. Use a unique named session and restrict it to the local preview and the live site. Serve `pages-dist` on localhost; keep temporary screenshots outside Git. Close the session after inspection.

Inspect desktop (1440 × 900) and phone (390 × 844). For sticky controls, also use a short phone (390 × 600). Check light and dark themes, keyboard navigation, and reduced motion for affected interactions.

| Surface | What to verify |
| --- | --- |
| All changed pages | Long titles and artwork do not collide; text stays legible; no sideways scrolling, clipped focus, missing assets, browser errors or failed requests. |
| Navigation and docs | Masthead, contents, anchors and cross-page links work; Copy buttons copy usable code; guide, API reference and Markdown links describe the same selected package. |
| Dropdowns | Labels remain associated; chevrons have breathing room; long values fit; focus and native keyboard/mobile behavior survive enhancement. Reuse `website/dropdown.css` and `dropdown.js`. |
| Playground | Change mode, source, year, labels, layers and appearance; inspect the live preview and generated JS/TS. Explicit layer choices survive mode switches. Static mode works independently. Share links restore the design; undo/redo and export work. |
| Interactive maps | Check selection, camera, keyboard focus and retained markers after appearance changes. Exercise rapid updates and disposal when their ownership changes. |
| Data loading | Use the automated Pages/studio gates for delayed and failed geography, retries and downloads. Verify the affected recovery state manually if loading code changed. |

Inspect the generated example page and SVGs when rendering changes. Preserve the soft palette, precise coast, label collision rules, and the site's 12px minimum for micro-labels. Verify exported SVGs retain canonical precision even when site display geometry is simplified.

## Package and Pages alignment

`pnpm build:pages` uses the compiled working tree and labels its documentation as a local preview. `pnpm build:pages --released` uses npm's stable package. To check a specific published version, set `PAGES_VERSION` to that version for the released build. Run Pages browser gates against the build you intend to deploy.

Released Markdown, declarations, snippets and maps must come from that installed package. Do not fill missing release docs with working-tree docs or expose unsupported options as usable. Site-only edits can deploy independently of npm; package-owned documentation changes reach the released Markdown exports with the next package publication. `pages-dist/release.json` records the selected version and source.

## Deployment scheduling

Pages builds run on main updates, successful npm publication, or manual dispatch.
Automatic runs skip a commit/package pair already recorded in live `release.json`;
manual dispatch forces validation and deployment. Failed publication does not start a build.

`election-refresh.yml` checks official sources every ten minutes using Node only.
It requests Pages deployment when validated results or source status change, or after
24 hours to refresh the published check time. Fetch timestamps alone do not trigger
builds. The probe preserves the same verified-deployment recovery checks as publication;
Pages fetches and validates again during its build, so it never publishes an unchecked
probe artifact. An unchanged feed's displayed check time remains its last published check.

## Publish a stable release

1. Review compatibility. Use a patch for compatible fixes, a minor for additive API, and a major for breaks, including runtime requirements. Move the complete Unreleased notes into a dated `## <version> — YYYY-MM-DD` section. Align `package.json` and any version-bearing lock metadata.
2. Run the library, package, Storybook coverage, Pages, and visual checks above. Review `git diff --check`, packed contents, and the final diff. Keep credentials, temporary reports, screenshots, and unrelated application code out of the archive.
3. Generate the release body with `node scripts/release-notes.mjs > /tmp/sf-map-release-notes.md`. Review it: the publish workflow requires every item from the matching changelog section.
4. Push the reviewed commit to `main`. Create `v<version>` at that commit and publish the matching stable GitHub release using the reviewed body. Never replace an existing tag or force-push. Prereleases are rejected by the publisher.
5. Inspect `.github/workflows/publish.yml`. It checks out the tag, verifies the package version, validates and tests the exact archive, then publishes publicly through npm trusted publishing. Normal pushes do not publish npm; do not substitute a local `npm publish`.
6. Verify npm exposes the exact version and that a clean consumer can install it. Compare its tarball integrity to the archive recorded by the publishing job. A fresh registry 404 can be propagation delay: retry with bounded backoff before diagnosing failure.
7. Confirm `.github/workflows/pages.yml` succeeds, then inspect the live site with Agent Browser. Verify the visible version, install command, release link, API/guide and `release.json` match npm. Release-triggered Pages builds wait up to five minutes for the exact package; rerun a failed deployment if registry propagation exceeded that window.

If publishing fails, inspect the cause before retrying the existing tag through workflow dispatch. First check whether npm already has that version: an existing version cannot be republished. If trust configuration is missing, use [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) with GitHub owner `kahwee`, repository `sf-map-svg`, workflow `publish.yml`, no environment, and direct publishing enabled. The workflow's `id-token: write` replaces stored npm tokens.

## Completion evidence

Report the commit and remote state, checks, package version, publishing workflow, registry state, Pages deployment and live browser result as applicable. Distinguish prepared, pushed, published and deployed. A green package check or successful push is not publication evidence. Later site-only commits may legitimately put `main` ahead of the latest release tag; compare a release tag to its reviewed release commit, not to every subsequent site update.


The development package manager and Actions use pnpm 12.16.1. Biome 2.6.4 retains
the existing JavaScript/TypeScript/JSON checks; its newly supported Markdown and
YAML formatters are disabled to preserve the established documentation and
workflow formatting. Historical benchmark tool versions remain unchanged.

The measures card retains its browser-validated three-column grid. A declaration-
scoped suppression handles Biome's false positive for repeated grid area
names; other grid declarations remain checked. Revisit this workaround when the
upstream rule accepts the valid layout.

The election explorer bundles TanStack Charts 1.2.1 from its published vanilla SVG API.
Its JS/CSS budget is 40 KB gzip (37.78 KB measured with the chart/table view); other
page budgets are unchanged. Charts use discrete cumulative steps and exact source
observations. TanStack is a development dependency for the website bundle, not a
runtime dependency of the published map package. Release API reference:
https://github.com/TanStack/charts/tree/v1.2.1/docs .

Election code responsibilities:

- `website/election.js` owns page state, filtering, refresh events and map selection.
- `website/election-view.js` builds contest presentation, labels, tallies and source text.
- `website/election-trend.js` owns observation controls and the exact-value table;
  `website/election-chart.js` renders the TanStack SVG without owning feed state.
  `website/election-chart-interaction.js` adds keyboard/touch point popovers with
  exact observation provenance and native dismissal.
- `website/election-model.js` and `election-history.js` validate and reconcile snapshots and
  official history.
- `scripts/update-election.mjs` orchestrates checks; `scripts/lib/sos-county-results.mjs`
  parses official county reports, and `previous-election.mjs` guards deployed recovery.

Keep presentation-only adapters out of persisted history. Browser regressions in
`scripts/pages-checks/` cover contest switching, chart/table selection, keyboard
controls, failed/stale refreshes and phone layout; `test/election-*.test.mjs` covers
validation, history recovery, refresh coordination and chart geometry.

The Pages gate entry point, `scripts/check-pages.mjs`, runs named scenarios from
`scripts/pages-checks/`: artifact budgets/docs, page layouts, studio loading,
playground behavior, election navigation, refresh lifecycle, and popover bounds.
Browser contexts use 10-second action and 20-second navigation timeouts; each
scenario reports its name and retains its original assertions.
