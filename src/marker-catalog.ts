import { element } from './dom.js';
import type { createMarkerLayer, MarkerItem } from './marker-layer.js';
import type { MapMarker } from './types.js';
import { validateMarkers } from './validation.js';

/** Own ordered records and picker reconciliation; prepare before committing DOM changes. */
export function createMarkerCatalog(
  renderer: ReturnType<typeof createMarkerLayer>,
  picker: HTMLSelectElement,
  project: (point: [number, number]) => [number, number],
) {
  let items: MarkerItem[] = [];
  return {
    get items() {
      return items;
    },
    prepare(markers: readonly MapMarker[], selected: string | null) {
      validateMarkers(markers);
      const existing = new Map(items.map((item) => [item.marker.id, item]));
      const ids = new Set<string>();
      const next = markers.map((marker) => {
        ids.add(marker.id);
        const previous = existing.get(marker.id);
        const point =
          previous?.marker.lng === marker.lng && previous.marker.lat === marker.lat
            ? previous.point
            : project([marker.lng, marker.lat]);
        return { marker: { ...marker }, point };
      });
      const selection =
        selected && ids.has(selected)
          ? selected
          : (markers.find((marker) => marker.selected)?.id ?? null);
      const keys = ['id', 'lng', 'lat', 'label', 'selected', 'color', 'radius'] as const;
      if (
        picker.options.length > 0 &&
        selection === selected &&
        next.length === items.length &&
        next.every(({ marker }, index) =>
          keys.every((key) => marker[key] === items[index].marker[key]),
        )
      )
        return undefined;
      const focused = items.find((item) => item.visual?.node === document.activeElement)?.marker.id;
      return {
        selection,
        focused,
        commit() {
          const options = new Map([...picker.options].map((option) => [option.value, option]));
          for (const item of items) {
            if (!ids.has(item.marker.id)) {
              renderer.remove(item);
              options.get(item.marker.id)?.remove();
            }
          }
          if (!options.has('')) {
            const empty = element('option', 'No marker selected');
            empty.value = '';
            picker.prepend(empty);
          }
          items = next.map(({ marker, point }, index) => {
            const previous = existing.get(marker.id);
            const item = previous ?? renderer.add(marker, point, index);
            if (previous) renderer.update(item, marker, point, index);
            const option = options.get(marker.id) ?? element('option');
            const label = marker.label ?? marker.id;
            if (option.textContent !== label) option.textContent = label;
            if (option.value !== marker.id) option.value = marker.id;
            if (picker.children[index + 1] !== option)
              picker.insertBefore(option, picker.children[index + 1] ?? null);
            return item;
          });
        },
      };
    },
  };
}
