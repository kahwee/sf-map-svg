# Maintainer adversarial API audit

This audit covers configuration, runtime updates, rendering input, lifecycle,
selection, motion, progressive enhancement, and package boundaries. It is a
regression contract, not a claim that arbitrary host CSS, hostile JavaScript, or
unbounded geographic data can never fail.

## Conflicts and precedence

| Combination | Contract |
| --- | --- |
| Theme and explicit colors | Explicit tokens override theme defaults; default soft palette stays stable. |
| Mode and layer overrides | Explicit layer choices win. Selecting a neighborhood does not re-enable two explicitly disabled neighborhood layers. |
| `labels:false` and individual label layers | The master switch hides text; map symbols and accessible titles remain. |
| Motion disabled and per-call animation | The default is immediate; per-call `animate:true` opts in. `animate:false` jumps. Explicit duration can override the default. Reduced motion always wins. |
| A new camera request during animation | The new request cancels the prior generation. A callback cannot revive it after cancellation/disposal. |
| Selection callback selecting another item | Newer selection wins. The old selection cannot subsequently move the camera or send a stale activation callback. |
| `selectNeighborhood(..., {fit:false})` in basemap mode | Selection can change presentation, but preserves the camera. Explicit layer overrides remain authoritative. |
| Clustering and selected/focused markers | Selected/focused pins remain individually reachable. Coincident alternatives remain available through the chooser. |
| Marker entrance and reduced motion | Entrances are optional, independent of camera motion, and cancel on preference changes or disposal. Stable IDs avoid repeated entrances on filtering. |
| Hiding touch control while gestures are enabled | Returns touch scrolling to the page. Other toolbar controls remain independent. |
| Runtime patch omitted/false/undefined | Omitted retains; false disables; undefined resets to the default. Nested feature objects replace, rather than deep-merge. |
| Compact shell and full attribution | Rejected before replacement. Use `createGuideMap` for full explorer chrome. Control overrides are honored and may deliberately alter layout. |
| Layer hidden and bundle cost | Visibility never unloads imported geography. Use narrow entrypoints or data injection to save bytes. |

## Failure boundaries and regression evidence

| Surface | Adversarial checks and behavior |
| --- | --- |
| Configuration | Interactive constructors and runtime feature/control/layer patches reject unknown keys, non-records, wrong boolean types, and invalid numeric ranges. Nested typo keys fail instead of silently defaulting. |
| Camera | Sparse arrays, NaN/infinity, malformed bounds and invalid padding are rejected before replacing pending movement. Valid extents are clamped to the supported city viewport. |
| Marker/overlay replacement | Validate and build the replacement before committing. Duplicate IDs and malformed values preserve the prior list. Overlay geometry accepts lines and polygons, with finite longitude/latitude pairs and nonempty sequences; polygon paths close rings automatically. This is shape validation, not a general polygon topology repair service. |
| Source replacement | Unavailable/malformed sources fail before replacing the chooser, selection, geometry, or source state. SFAR, SF Find and analysis identities remain separate. |
| Shared state | Overview and detailed preset data are deeply frozen. Selection/configuration reads and emitted feature snapshots are detached from renderer state. Injected collections are borrowed: callers must treat them as immutable for the map lifetime. |
| Lifecycle | Idempotent destruction cancels camera/entrance/label work, observers, global listeners, and replaceable overlay listeners. Observer initialization failure cleans up acquired resources. Application-owned listeners and callout DOM remain the application's responsibility. |
| Accessibility | Feature round trips, keyboard activation, focus recovery after removal/clustering, independent controls, touch names, and reduced motion have browser regressions. Hiding every alternative chooser is a consumer accessibility decision. |
| Output safety | SVG text and attributes are escaped. This is not a security sandbox for CSS tokens or caller-provided DOM. Keep untrusted callout content in `textContent`; the consumer controls CSS/resource policy. |
| Packaging | Clean tarball install exercises entrypoints and emitted declarations, including `LineString` overlays. No runtime dependencies or embedded geographic coordinate blobs were added. |
| Performance | Production bundle checks enforce the guide and renderer ceilings and inspect dataset inclusion. Grouping has a 2,000-marker regression; millions of markers are outside this guide-oriented design. |

Regression sources: `test/api-contract.test.js`, `test/camera.test.js`,
`test/viewport.test.js`, `stories/Robustness.stories.ts`,
`stories/Enhancements.stories.ts`, and `scripts/smoke-package.mjs`.

Callbacks run after their corresponding state is committed. Consumer callback
exceptions are not transactional validation errors and do not roll back an already
committed change. Direct mutation of the returned DOM can invalidate invariants;
use the public methods and `overlayElement` extension point.

The generic static renderer retains its existing broader option surface; strict
interactive option-key validation is not a claim that all static options share the
same schema. Host layout, delayed images, fonts, and application cards need their
own CLS tests. The scale bar is an approximate local Mercator scale, not survey
instrumentation. Clustering does not spiderfy coincident locations. Geographic
source correctness remains governed by SOURCES.md and existing topology tests.

## Extending the contract

For every new option, define its default, disable/reset semantics, precedence,
validation boundary, cleanup owner, and effect on keyboard focus and selection.
Test invalid updates against an existing live map, not only clean construction.
Exercise enable/disable round trips and callbacks that synchronously request a
second update. Add published-type and bundle regressions when the import graph or
public types change. Update this matrix when introducing a new interaction.

## Verification for this change

- `pnpm check`: 59 Node tests, types, lint, source catalog and bundle budgets passed.
- `pnpm test:stories:coverage`: 60 Chromium stories passed.
- `pnpm demo`, `pnpm build-storybook`, and clean-install `pnpm test:package` passed.
- Production guide: 110.2 KB gzip; data-free compatibility renderer: 21.8 KB gzip, as reported by
  `pnpm report:guide` (the report script uses 1024-byte units).
- Isolated agent-browser inspection of generated static SVG examples and the
  interactive example at desktop and 390px found no page overflow or browser
  errors. Interactive labels remained collision-filtered at both widths. Browser
  screenshots were kept outside the repository and the session was closed.

The independent pre-release review reproduced and closed stale cluster activation
and checked the v2 overlay event bridge. See the controller and robustness stories
for pointer/keyboard activation, reentrant replacement, and revoked old nodes.
