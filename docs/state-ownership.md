# Interactive state ownership

The public controller (`src/map.ts`) owns subscriptions and capabilities.
`configuration-controller.ts` owns configuration snapshots and revisions. The engine (`src/explorer-core.ts`)
coordinates presentation commits across layers. Preparing a patch may invoke
consumer callbacks. The engine returns a single-use prepared presentation; commit
checks both configuration and engine revisions before and after the configuration
commit callback. A newer update, selection change or disposal invalidates stale work.

| Owner | State and lifetime |
| --- | --- |
| `configuration-controller.ts` | Configuration snapshot, update revision and prepare/commit coordination. |
| `district-controller.ts` | Selected and hovered district, style callback and prepared styles, district revision, fill transitions and outline morphs. Selection and year callbacks check the revision before continuing. |
| `explorer-core.ts` | Active year, mode, appearance, feature switches and overall initialization/disposal. Supplies district camera, composition and label hooks. |
| `neighborhood-layer.ts` | Source-scoped lookup, prepared geometry, selection revisions and hover lifecycle. |
| `marker-controller.ts` | Marker selection and revisions, activation, replacement and focus recovery. |
| `label-coordinator.ts` | Label candidate cache, collision obstacles, zoom-dependent detail, metrics invalidation and redraw requests. |
| `marker-catalog.ts`, `marker-layer.ts` | Catalog reconciliation and materialized marker visuals/entrances. |
| `cluster-layer.ts`, `overlay-layer.ts` | Layer nodes and replaceable event scopes. |
| `camera.ts`, `frame-scheduler.ts` | Camera animation and shared render scheduling. |
| `label-renderer.ts` | Label nodes and cached screen-space metrics; font loading invalidates metrics. |
| `explorer-controls.ts`, `explorer-sidebar.ts` | Controls/navigation and sidebar/download behavior. |

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
