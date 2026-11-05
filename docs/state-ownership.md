# Interactive state ownership

The public controller (`src/map.ts`) owns subscriptions and capabilities.
`interactive/configuration-controller.ts` owns configuration snapshots and revisions. `interactive/presentation-controller.ts` coordinates presentation commits across layers. Preparing a patch may invoke
consumer callbacks. The presentation controller returns a single-use prepared presentation; commit
checks both configuration and engine revisions before and after the configuration
commit callback. A newer update, selection change or disposal invalidates stale work.

| Owner | State and lifetime |
| --- | --- |
| `interactive/configuration-controller.ts` | Configuration snapshot, update revision and prepare/commit coordination. |
| `interactive/district-controller.ts` | Selected and hovered district, style callback and prepared styles, district revision, fill transitions and outline morphs. Selection and year callbacks check the revision before continuing. |
| `interactive/map-engine.ts` | Active year, mode, appearance, feature switches and overall initialization/disposal. Wires typed camera, presentation, composition and label hooks. |
| `interactive/presentation-controller.ts` | Presentation revision, preflight geometry/styles, single-use commit and reentrant/disposal guards across year, source, mode and labels. |
| `interactive/layer-composition.ts` | Visibility, legend, neighborhood focusability and geographic accessibility descriptions from committed state. |
| `interactive/appearance-renderer.ts` | Palette, typography, controls and retained feature-node styling; owns no selection or transaction state. |
| `interactive/neighborhood-layer.ts` | Source-scoped lookup, prepared geometry, selection revisions and hover lifecycle. |
| `interactive/marker-controller.ts` | Marker selection and revisions, activation, replacement and focus recovery. |
| `interactive/label-coordinator.ts` | Label candidate cache, collision obstacles, zoom-dependent detail, metrics invalidation and redraw requests. |
| `interactive/marker-catalog.ts`, `interactive/marker-renderer.ts` | Catalog reconciliation and materialized marker visuals/entrances. |
| `interactive/cluster-layer.ts`, `interactive/overlay-layer.ts` | Layer nodes and replaceable event scopes. |
| `interactive/camera.ts`, `interactive/frame-scheduler.ts` | Camera animation and shared render scheduling. |
| `interactive/label-renderer.ts` | Label nodes and cached screen-space metrics; font loading invalidates metrics. |
| `interactive/map-controls.ts`, `interactive/explorer-sidebar.ts` | Controls/navigation and sidebar/download behavior. |

The engine owns the root AbortController, ResizeObserver and font/media listeners.
Destroy marks the engine disposed before stopping camera, district motion, layer
fades, marker entrances and frames, aborting listeners and destroying child layers.
Reduced motion cancels active animation without destroying selection state.

District year remains part of shared presentation state. The district controller
updates it through a typed host accessor so geometry, labels and public snapshots
observe the same committed year. It does not own a second copy. The coordinator
retains cross-layer presentation transactions; it commits already prepared district
styles through the district controller without rerunning consumer callbacks.

Marker and label controllers retain their own state and read changing presentation inputs through typed host contracts.
Do not replace these ownership boundaries with a generic mutable engine context.
