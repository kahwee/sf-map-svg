# Interactive state ownership

The public controller (`src/map.ts`) owns configuration snapshots, subscriptions,
capabilities and configuration revisions. The engine (`src/explorer-core.ts`)
coordinates presentation commits across layers. Preparing a patch may invoke
consumer callbacks; revision checks must finish before committing prepared state.

| Owner | State and lifetime |
| --- | --- |
| `district-controller.ts` | Selected and hovered district, style callback and prepared styles, district revision, fill transitions and outline morphs. Selection and year callbacks check the revision before continuing. |
| `explorer-core.ts` | Active year, mode, appearance, feature switches, marker selection/revision, label candidates and overall initialization/disposal. Supplies district camera, composition and label hooks. |
| `neighborhood-layer.ts` | Source-scoped lookup, prepared geometry, selection revisions and hover lifecycle. |
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

Future marker and label extractions should move state and revision guards together.
Do not replace these ownership boundaries with a generic mutable engine context.
