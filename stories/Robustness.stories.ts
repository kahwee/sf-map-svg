import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, waitFor } from 'storybook/test';
import { guideMapData } from '../src/guide-data.js';
import { createGuideMap } from '../src/guide-map.js';
import { createMap } from '../src/map.js';
import type {
  NeighborhoodExplorerElement as InteractiveSFMapElement,
  MapFeatures,
} from '../src/types.js';

const pins = [
  { id: 'a', lng: -122.4269, lat: 37.7596, label: 'First place' },
  { id: 'b', lng: -122.4269, lat: 37.7596, label: 'Second place' },
];
let map: InteractiveSFMapElement;
const meta = {
  title: 'Checks/Adversarial configuration',
  parameters: { layout: 'padded' },
  beforeEach: () => () => map?.destroy(),
  render: () => {
    map = createGuideMap({
      markers: pins,
      layers: {
        landmarks: false,
        highways: false,
        keyRoads: false,
        roadLabels: false,
        bartStations: false,
      },
    });
    return map;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const settled = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

export const ReversibleSwitches: Story = {
  play: async () => {
    map.selectMarker('a', { fit: false });
    map.setViewport([100, 100, 500]);
    const view = map.getViewport();
    const all = {
      landmarks: true,
      highways: true,
      keyRoads: true,
      roadLabels: true,
      bartStations: true,
    };
    for (let i = 0; i < 4; i++) {
      map.setLayers(all);
      map.setFeatures({
        clustering: true,
        selectedMarkerRing: true,
        northArrow: true,
        scaleBar: true,
      });
      await settled();
      expect(map.querySelector<SVGElement>('[data-layer="landmarks"]')?.style.display).toBe('');
      expect(map.querySelector<SVGElement>('[data-layer="explorer-bart"]')?.style.display).toBe('');
      expect(map.querySelectorAll('.sf-map-north')).toHaveLength(1);
      expect(map.querySelector<HTMLElement>('.sf-map-north')?.hidden).toBe(false);
      map.setLayers({
        landmarks: false,
        highways: false,
        keyRoads: false,
        roadLabels: false,
        bartStations: false,
      });
      map.setFeatures({
        clustering: false,
        selectedMarkerRing: false,
        northArrow: false,
        scaleBar: false,
      });
      await settled();
      expect(map.querySelector<SVGElement>('[data-layer="landmarks"]')?.style.display).toBe('none');
      expect(
        map.querySelectorAll(
          '[data-label-kind="park"], [data-label-kind="road"], [data-label-kind="bart"]',
        ),
      ).toHaveLength(0);
      expect(map.querySelector<HTMLElement>('.sf-map-north')?.hidden).toBe(true);
      expect(map.getViewport()).toEqual(view);
      expect(map.getSelectedMarker()?.id).toBe('a');
    }
    map.setControls({ zoom: false });
    expect(map.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')?.hidden).toBe(true);
    expect(
      map.querySelector<HTMLButtonElement>('[aria-label="Reset map to city view"]')?.hidden,
    ).toBe(false);
    expect(
      map.querySelector<HTMLButtonElement>('[aria-label="Enable touch navigation"]')?.hidden,
    ).toBe(false);
    map.setTouchNavigation(true);
    map.setControls({ touch: false });
    expect(map.dataset.touchNavigation).toBe('false');
    map.setControls({ zoom: true, touch: true });
  },
};

export const FailedUpdatesAreAtomic: Story = {
  play: async () => {
    map.selectMarker('a', { fit: false });
    const before = map.getViewport(),
      config = map.getFeatures();
    expect(() => map.setFeatures({ northArrow: true, clustering: { radius: NaN } })).toThrow();
    expect(map.getFeatures()).toEqual(config);
    expect(() => map.setLayers({ landmarks: true, highways: 'yes' } as never)).toThrow();
    expect(map.querySelector<SVGElement>('[data-layer="landmarks"]')?.style.display).toBe('none');
    expect(() => map.selectMarker('b', { duration: -1 })).toThrow();
    expect(map.getSelectedMarker()?.id).toBe('a');
    expect(() => map.setMarkers([pins[0], { ...pins[1], lat: NaN }])).toThrow();
    expect(map.querySelectorAll('[data-marker-id]')).toHaveLength(2);
    expect(map.getViewport()).toEqual(before);
    const input: MapFeatures = { motion: { duration: 40 } };
    map.setFeatures(input);
    (input.motion as { duration: number }).duration = 9000;
    const snapshot = map.getFeatures();
    (snapshot.motion as { duration: number }).duration = 8000;
    expect(map.getFeatures().motion).toEqual({ duration: 40 });
  },
};

export const OverlayReplacementAndDisposal: Story = {
  play: async () => {
    let activations = 0;
    const other = createGuideMap({ onOverlayActivate: () => activations++ });
    map.after(other);
    try {
      const overlay = {
        id: 'route',
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [-122.43, 37.75],
            [-122.4, 37.79],
          ] as [number, number][],
        },
        label: 'Route',
      };
      other.setOverlays([overlay]);
      const old = other.querySelector('[data-overlay-id="route"]');
      other.setOverlays([{ ...overlay, label: 'Replacement' }]);
      old?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(activations).toBe(0);
      expect(() => other.setOverlays([{ ...overlay, strokeWidth: NaN }])).toThrow();
      other
        .querySelector('[data-overlay-id="route"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(activations).toBe(1);
      other.setTouchNavigation(true);
      other.destroy();
      other.destroy();
      const html = other.innerHTML;
      other.setOverlays([]);
      other.setFeatures({ northArrow: true });
      other.setLayers({ landmarks: false });
      other
        .querySelector('[data-overlay-id="route"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(activations).toBe(1);
      expect(other.innerHTML).toBe(html);
      expect(other.querySelector<HTMLElement>('.sf-explorer-canvas')?.style.touchAction).toBe(
        'pan-y pinch-zoom',
      );
    } finally {
      other.destroy();
      other.remove();
    }
  },
};

export const KeyboardFocusSurvivesUpdates: Story = {
  play: async () => {
    map.querySelector<SVGElement>('[data-marker-id="b"]')?.focus();
    map.setMarkers([...pins].reverse());
    expect((document.activeElement as SVGElement).dataset.markerId).toBe('b');
    map.setFeatures({ clustering: true });
    await settled();
    expect(map.querySelector<SVGElement>('[data-marker-id="b"]')?.style.display).toBe('');
    map.setMarkers([pins[0]]);
    await waitFor(() => expect(document.activeElement).toBe(map.querySelector('svg')));
  },
};

export const ReentrantSelection: Story = {
  play: async () => {
    const seen: string[] = [];
    map.addEventListener('markerchange', (event) => {
      const id = (event as CustomEvent).detail.id;
      seen.push(id);
      if (id === 'a') map.selectMarker('b', { fit: false });
    });
    map.selectMarker('a');
    expect(seen).toEqual(['a', 'b']);
    expect(map.getSelectedMarker()?.id).toBe('b');
    expect(map.getViewport()).toEqual([0, 0, 800]);
    map.addEventListener('viewportchange', () => map.selectMarker('a', { fit: false }), {
      once: true,
    });
    map.selectMarker('b');
    expect(map.getSelectedMarker()?.id).toBe('b'); // the a listener selects b again
    const options = map.querySelectorAll<HTMLSelectElement>('.sf-explorer-feature-controls select');
    expect(options[1].value).toBe('b');
  },
};

export const SelectionSnapshots: Story = {
  play: async () => {
    map.selectNeighborhood('Inner Mission', { fit: false });
    const before = map.getSelection();
    if (!before) throw new Error('Missing neighborhood');
    const copy = before.feature as unknown as { properties: { canonicalName: string } };
    copy.properties.canonicalName = 'Changed by caller';
    expect(map.getSelection()?.name).toBe(before.name);
    map.addEventListener('neighborhoodchange', (event) => {
      const feature = (event as CustomEvent).detail.feature;
      if (feature) feature.properties.canonicalName = 'Changed by listener';
    });
    map.selectNeighborhood('North Panhandle', { fit: false });
    expect(map.getSelection()?.name).toBe('North Panhandle');
  },
};

export const ConflictingLayersAndFailedSource: Story = {
  play: async () => {
    const source = guideMapData.neighborhoods.realtor;
    if (!source) throw new Error('Missing realtor collection');
    const collection = structuredClone(source);
    const bad = structuredClone(collection.features[0]);
    (bad as unknown as { geometry: unknown }).geometry = { type: 'Polygon', coordinates: [] };
    const otherController = createMap(
      {
        ...guideMapData,
        neighborhoods: { realtor: collection, analysis: { ...collection, features: [bad] } },
      },
      { mode: 'basemap' },
    );
    const other = otherController.element as InteractiveSFMapElement;
    map.after(other);
    try {
      other.setViewport([100, 100, 400]);
      expect(other.selectNeighborhood('Inner Mission', { fit: false })).toBe(true);
      expect(other.getViewport()).toEqual([100, 100, 400]);
      const selection = other.getSelection();
      expect(() => other.setSource('analysis')).toThrow();
      expect(other.getSelection()).toEqual(selection);
      expect(other.dataset.source).toBe('realtor');
      other.setLayers({ neighborhoodLines: false, neighborhoodLabels: false });
      expect(other.selectNeighborhood('North Panhandle', { fit: false })).toBe(true);
      expect(
        other.querySelector<SVGElement>('[data-layer="explorer-neighborhoods"]')?.style.display,
      ).toBe('none');
      expect(other.getViewport()).toEqual([100, 100, 400]);
    } finally {
      otherController.destroy();
      other.remove();
    }
  },
};

export const FailedObserverConstruction: Story = {
  play: async () => {
    const Original = window.ResizeObserver;
    let disconnected = 0;
    class FailingObserver {
      observe() {
        throw new Error('Observer setup failed');
      }
      unobserve() {}
      disconnect() {
        disconnected++;
      }
    }
    try {
      window.ResizeObserver = FailingObserver;
      expect(() => createGuideMap()).toThrow('Observer setup failed');
      expect(disconnected).toBe(1);
    } finally {
      window.ResizeObserver = Original;
    }
    const recovered = createGuideMap();
    recovered.destroy();
    recovered.destroy();
  },
};

export const StaleClusterActivation: Story = {
  play: async () => {
    map.setFeatures({ clustering: true });
    await settled();
    const old = map.querySelector<SVGGElement>('[data-layer="marker-clusters"] [role="button"]');
    if (!old) throw new Error('Expected cluster');
    let calls = 0;
    map.addEventListener('clusteractivate', () => calls++);
    const before = map.getViewport();
    map.setMarkers([]);
    old.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls).toBe(0);
    expect(map.getViewport()).toEqual(before);
  },
};

export const ReentrantOverlayReplacement: Story = {
  play: async () => {
    const other = createGuideMap({ onOverlayActivate: () => other.setOverlays([]) });
    map.after(other);
    try {
      let events = 0;
      other.addEventListener('overlayactivate', () => events++);
      other.setOverlays([
        {
          id: 'route',
          geometry: {
            type: 'LineString',
            coordinates: [
              [-122.43, 37.75],
              [-122.4, 37.79],
            ],
          },
        },
      ]);
      other
        .querySelector('[data-overlay-id="route"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(events).toBe(0);
      expect(other.querySelector('[data-overlay-id="route"]')).toBeNull();
    } finally {
      other.destroy();
      other.remove();
    }
  },
};
