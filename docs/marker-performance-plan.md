# Viewport marker rendering plan

The October 10–11 benchmark at renderer commit `1d523d9` measured 2,000-marker pan frame p95 of 166.7 ms in Chromium, 200.3 ms in Firefox, and 302 ms in WebKit at 800 px. Disabling labels reduced Chromium to 50 ms. The synchronous camera calls were much cheaper than the rendered frames, and replacing all marker IDs was expensive, especially in WebKit.

## Implementation

1. Keep every supplied record and native picker option. Detach clustered pins and pins outside the padded viewport from the SVG; reuse their nodes when they return. Keep selected and focused pins reachable, including during callbacks and updates.
2. Compute deterministic clusters against the complete catalog so counts and membership do not fluctuate at viewport edges. Cache groups until marker data, zoom/width, selection, focus, or clustering changes. Cull cluster symbols by their centers and screen-sized extent when panning.
3. Update only mounted marker sizes, and skip identical SVG attributes. Compute cluster label obstacles from cached projected centers instead of measuring each cluster DOM node. Avoid unnecessary text-node writes and measurements for labels that cannot intersect the viewport.
4. Add interactive Storybook stories with 2,000 typed markers at desktop and phone sizes. Exercise overview → zoom → pan → zoom out, clustering toggles, record updates, offscreen selection, keyboard focus, and disposal. Assert the rendered subset and full picker catalog, rather than a machine-specific FPS threshold.
5. Compare the same production-bundle benchmark across Chromium, Firefox, and WebKit. Report API-call and frame timings separately, along with mounted pin/cluster counts. Preserve the dated baseline in the README.
6. Keep generated public declarations aligned and compile clean packed-package consumers with current stable TypeScript. Install and pin the latest stable Bun as an additional static-rendering compatibility check; retain pnpm and the existing Node build/test workflows.

## Storyboard

Open **Checks / 2000 markers / Desktop** or **Phone** in Storybook. The phone canvas is 390 px; controls wrap without horizontal scrolling. Both stories run the same interaction assertions and remain usable after the checks finish. Each story owns its controller and destroys it on teardown.

| Scene | Action | What the check observes |
| --- | --- | --- |
| City overview | Start with clustering on | Fewer than 2,000 mounted symbols; all 2,000 picker records. |
| Individual pins | Toggle clustering off | Most city pins mount at overview scale. |
| Close view | Zoom in twice | Less than half the overview pins remain mounted. |
| Move through the city | Pan east | New IDs enter the viewport as old pins detach. |
| Refresh the catalog | Update labels | Retained pin identity and updated accessible name; picker still contains every record. |
| Find a distant place | Select a currently offscreen ID through the API | Selection mounts the pin and fits it inside the viewport. |
| Return to overview | Clear selection, reset, restore clustering | Overview counts return, then clustering reduces mounted symbols again. |

The production-bundle browser suite separately pans a keyboard-focused pin outside the viewport, verifies focus remains on the mounted pin, blurs it, and checks it detaches. Panning back must reuse the node with its updated radius. A small pan at fixed zoom must preserve overlapping cluster membership and node identity. These checks run in Chromium, Firefox, and WebKit at 1440 px and 390 px.

## Boundaries

This change optimizes rendering, not geographic data or source definitions. It does not discard offscreen records, reset selection, cap the supplied catalog, or introduce runtime dependencies. A small screen-space overscan preserves pins crossing the viewport edge. Culling must not move keyboard focus silently or change coincident-place selection. Static SVG exports continue to render the supplied data independently of interactive viewport culling.

Check clustering-disabled views as well as clustered views. Verify retained nodes, current marker values in cluster events, selected/focused pins, radius and style updates after reattachment, resize, reduced motion, and cancellation during disposal. Run required package, browser, Storybook, Pages and visual gates; inspect the 2,000-marker stories at desktop and 390 px before pushing.

## Results and verification — October 11, 2026

The [README comparison](../README.md#viewport-renderer-results) and [saved JSON](benchmarks/markers-2026-10-11.json) retain the baseline and new measurements. Desktop pan frame p95 changed from 166.7 to 16.8 ms in Chromium, 200.3 to 49.4 ms in Firefox, and 302.0 to 49.0 ms in WebKit. At the sampled 4× desktop view, 228 individual pins mount from the 2,000-place catalog; the picker retains all records. WebKit full-ID replacement still costs a median 805 ms. Use stable IDs and reuse the catalog; culling improves pan without removing creation costs. Firefox and WebKit frame results still exceed a 60 Hz budget.

Validation passed: 93 Node tests, 87 Storybook checks with coverage, all 42 focused browser cases across three engines and two widths, Bun 1.4.3 smoke checks, strict packed-package TypeScript consumers, generated playground examples, bundle budgets, demo/Storybook/Pages builds, and Pages/studio checks. Manual Agent Browser inspection covered the 2,000-marker stories, generated SVG examples, and interactive example at desktop/phone sizes, with no browser errors or horizontal overflow. The preview server now serves `.mjs` examples with the JavaScript MIME type.

The five screenshot checks retain a pre-existing mismatch against committed expectations in this environment. Each actual screenshot is byte-identical to the unchanged `a065893` baseline checkout; no new screenshot differences were introduced and expectations were not rewritten.


## Follow-up: lazy visuals and broader workloads

Pin records now retain an optional visual that is created on first visibility, selection, or focus recovery. Updates before creation use the latest label, radius, and styles when the pin appears. Once created, the node survives viewport exit and reentry. Pending entrances cancel when motion is disabled; reentry does not restart an entrance. Browser checks cover allocation counts, current styles, focus recovery after removal, and cached node identity; the Motion story covers deferred entrances and cancellation.

The benchmark now covers pan, rapid zoom, and host resize with clustering on and off. Untimed probes distinguish newly allocated groups from mounted groups. The dated lazy/control archive records all six engines/width combinations for the new implementation and a two-width Chromium control against `e41aa2b`. Mount costs improved in that control comparison; frame timings vary, and rapid zoom, resize, and full-ID replacement remain follow-up profiling targets. See the README for measured values and limits.

Follow-up validation passed: 93 Node tests, 88 Storybook checks with coverage, all 48 browser cases (including the six-engine/width rerun after extending focus recovery), strict packed-package consumers, 12 generated JavaScript/TypeScript examples, Bun 1.4.3 compatibility, bundle limits, and demo/Storybook/Pages builds. Pages checks cover 11 pages at desktop/light and phone/dark widths plus 404; studio delayed/failed loading checks pass. Manual Agent Browser inspection covered both 2,000-marker stories, generated SVGs, and the interactive example at desktop/390 px, without errors or horizontal overflow. The added lifecycle code increased the two interactive Pages bundles to 46.6/52.1 KB gzip; their limits are now 46.8/52.3 KB.

All five visual snapshot checks still report the pre-existing mismatch against committed expectations. Every resulting actual image is byte-identical to the unchanged `a065893` baseline; expectations remain unchanged.


## Follow-up: frame preparation and component ownership

Neighborhood label priority is prepared once when a source commits. Styled candidates are cached while source, selection, catalog revision, district labels, mode, layers, appearance, and zoom/width eligibility remain unchanged. Font completion still invalidates text measurements. Secondary-road nodes and scale geometry are prepared once; road visibility and scale text/width skip unchanged writes. Overlay bounds are measured before station, marker, and cluster SVG writes, after applying any required scale-bar width.

`marker-catalog.ts` owns ordered records and native picker reconciliation, validating and projecting the next catalog before its commit. `cluster-renderer.ts` owns grouping caches, viewport mounting, stable nodes, navigation synchronization, and listener cancellation. The explorer retains selection events, chooser/fit decisions, and reentrant callback guards. This reduces the explorer from 2,316 to 2,151 lines without changing public types or adding dependencies.

The benchmark supports `--mode=neighborhoods` to exercise cached neighborhood labels. Before/after Chromium comparisons use 2,000 labeled markers, 20 operation samples, both widths, and all six frame workloads. No timing thresholds or physical-device frame-rate claims are introduced.

Validation passed: 93 Node tests, 88 Storybook checks with coverage (87.2% lines), and all 54 browser cases across Chromium, Firefox, and WebKit at both widths. The new browser check exercises label refresh after catalog, appearance, layer, and source changes. Strict packed-package consumers, all 12 generated JavaScript/TypeScript examples, Bun 1.4.3, bundle checks, demo/Storybook/Pages builds, studio delayed/failed loading, and all 11 Pages screens at desktop/light and phone/dark sizes plus 404 pass. Manual Agent Browser inspection covered both 2,000-marker stories, generated SVGs, and the interactive example at desktop/390 px without errors or horizontal overflow.

The renderer is 34.6 KiB gzip versus 34.2 KiB before; its 35 KiB limit is unchanged. Static rendering remains 7.9 KiB. Initial index/layers/playground JS and CSS measure 45.3/47.0/52.6 KiB gzip; their page-specific limits are 45.5/47.2/52.8 KiB. The before/after benchmark archive records mixed timings and identical viewport/allocation counts. All five screenshot mismatches remain byte-identical to the unchanged `a065893` baseline; expectations were not rewritten.
