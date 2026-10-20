# Migrating to v5

Version 5.0.0 makes coordinate inputs, controller updates, and reset behavior
consistent. It requires Node 24+ and retains offline rendering, explicit data
imports, zero runtime dependencies, and the existing default map appearance.
The version bump prepares the next release; it does not publish the package.

## Coordinates use GeoJSON positions

Markers now require `position: [longitude, latitude]`. The old `lng` and `lat`
properties are rejected. `projectToScreen` takes one readonly position; its
old two-number form is removed. Altitude is accepted and ignored by projection.

```ts
// v4
const oldMarker = { id: 'ferry', lng: -122.3937, lat: 37.7955 };
// v5
const marker = { id: 'ferry', position: [-122.3937, 37.7955] as const };
map.setMarkers([marker]);
const point = map.projectToScreen(marker.position);
```

Use `Position` from `/geometry` for reusable positions and `ScreenPoint` or
`ProjectToScreen` from the root or `/map` for screen-projection contracts.
`x` and `y` remain canvas-relative CSS pixels; `visible` means inside the
viewport, not unobscured. Mount the map in a nonzero-width container first.
Camera viewports still use projected `[x, y, size]`; camera pan deltas are CSS
pixels. Geographic bounds are not camera viewports.

## Controller updates preserve the camera

`configure`, `setMode`, and `setSource` preserve the camera. The second
`{ resetView }` argument to the controller convenience setters is removed.
To reproduce an old automatic reset, request it explicitly:

```ts
map.setMode('neighborhoods');
map.camera.reset({ animate: false });
```

Selection still fits by default. Use `{ fit: false }` to change selection
without moving the camera, or `camera.fit(geometry)` for an explicit fit.

## Reset presentation explicitly

In controller `configure` patches, omitted and `undefined` values are no-ops at
every record depth. Nested token and feature records merge; an explicit boolean
replaces a feature record and `false` disables a boolean switch.

```ts
map.configure({ appearance: { colors: { water: '#142d45' } } });
map.configure({ appearance: undefined }); // keeps the current appearance
map.resetConfiguration(['appearance']); // restores built-in appearance defaults
map.resetConfiguration(['layers', 'controls']); // removes explicit overrides
map.resetConfiguration(); // resets all four presentation groups
```

The reset groups are `features`, `layers`, `controls`, and `appearance`.
Resetting a group does not restore initial constructor overrides, change the
camera, or change mode/source/year/labels. It restores built-in defaults and
mode-derived layer choices. Supply geographic choices explicitly through
`configure`. To remove a single token while retaining other overrides, build
the desired group, reset that group, then configure the retained values.
Each call commits atomically; the two calls are separate updates.

These rules describe `MapController` from `createMap`, `createGuideController`,
and `mountGuideController`. Low-level element factories retain their separate
`setFeatures` / `setLayers` APIs; use controllers for the grouped update contract.

## Select neighborhoods by exact identity

Controller `selectNeighborhood(id)` accepts an exact ID in the current source,
rather than a display name or alias. Unknown IDs return `false` without changing
selection. Resolve a human-entered name using the source-specific lookup first.
For integrations, prefer the source-qualified identity:

```ts
import { getRealtorNeighborhood } from '@kahwee/sf-map-svg/data/realtor';

const feature = getRealtorNeighborhood('Inner Mission');
if (feature) {
  map.selectFeature({ kind: 'neighborhood', source: 'realtor', id: feature.id }, { fit: false });
}
```

`selectFeature` requires the current supplied source/year and never switches
geography implicitly. Marker IDs and numeric district IDs remain unchanged.
The construction-time `neighborhood` option and low-level element lookup APIs
continue to resolve names; the stricter ID contract applies to controller
selection methods. Existing selection event names remain available alongside
`selectionchange`.

## Offline geometry queries

`geometryBounds(geometry)` and `geometryContainsPoint(geometry, position)` are
new in v5. They accept readonly GeoJSON without a DOM or geographic imports.
Bounds are `[west, south, east, north]` or `null` for empty geometry. Containment
respects holes, includes polygon boundaries, and supports islands and nested
collections. Shared edges can match more than one feature. See the
[query contract](API.md#geographic-queries) for validation and planar limitations.
