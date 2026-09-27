import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, waitFor } from 'storybook/test';
import { guideMapData } from '../src/guide-data.js';
import { createMap, type MapController } from '../src/map.js';

let map: MapController;
const meta = {
  title: 'Checks/V2 controller',
  beforeEach: () => () => map?.destroy(),
  render: () => {
    map = createMap(guideMapData, {
      mode: 'neighborhoods',
      features: { motion: { duration: 200 }, clustering: true },
      markers: [{ id: 'one', lng: -122.42, lat: 37.76 }],
      attribution: 'compact',
    });
    return map.element;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const ConfigurationAndCamera: Story = {
  play: async () => {
    const before = map.getConfiguration();
    expect(() =>
      map.configure({ features: { motion: false }, controls: { zoom: 'no' } } as never),
    ).toThrow();
    expect(map.getConfiguration()).toEqual(before);
    map.camera.set([100, 100, 400]);
    map.configure({ controls: { pan: false } });
    map.configure({ features: { northArrow: true } });
    await waitFor(() => expect(map.camera.get()).toEqual([100, 100, 400]));
    map.camera.zoom(2, { animate: false });
    expect(map.camera.get()[2]).toBe(200);
    map.camera.pan(10, 10, { animate: false });
    map.camera.reset({ animate: false });
    expect(map.camera.get()).toEqual([0, 0, 800]);
    map.configure({ features: undefined, controls: undefined });
    expect(map.getConfiguration().features.motion).toBe(false);
    map.camera.set([100, 100, 400], { animate: false });
    map.element
      .querySelector<HTMLButtonElement>('button[aria-label="Reset map to city view"]')
      ?.click();
    expect(map.camera.get()).toEqual([0, 0, 800]);
  },
};
export const SubscriptionOwnership: Story = {
  play: async () => {
    let calls = 0;
    const off = map.on('markerchange', (detail) => {
      calls++;
      if (detail.marker) detail.marker.label = 'Listener mutation';
    });
    map.selectMarker('one', { fit: false });
    expect(map.getSelectedMarker()?.label).toBeUndefined();
    off();
    off();
    map.selectMarker(null, { fit: false });
    expect(calls).toBe(1);
    map.on('markerchange', () => calls++);
    map.destroy();
    map.destroy();
    map.element.dispatchEvent(
      new CustomEvent('markerchange', { detail: { id: null, marker: null } }),
    );
    expect(calls).toBe(1);
    expect(map.destroyed).toBe(true);
    expect(() => map.camera.reset()).toThrow('destroyed');
    expect(() => map.configure({})).toThrow('destroyed');
  },
};

export const CoastOnly: Story = {
  render: () => {
    map = createMap(
      { map: { coast: guideMapData.map.coast }, neighborhoods: {} },
      {
        markers: [{ id: 'pin', lng: -122.42, lat: 37.76 }],
      },
    );
    return map.element;
  },
  play: async () => {
    expect(map.element.dataset.mode).toBe('basemap');
    expect(map.selectMarker('pin', { fit: false })).toBe(true);
    expect(() => map.setMode('neighborhoods')).toThrow('No neighborhood dataset');
    expect(map.element.dataset.mode).toBe('basemap');
    expect(() => map.setSource('realtor')).toThrow();
    expect(map.getSelectedMarker()?.id).toBe('pin');
  },
};

export const OverlayEvents: Story = {
  play: async () => {
    map.setOverlays([
      {
        id: 'route',
        label: 'Route',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-122.43, 37.75],
            [-122.4, 37.79],
          ],
        },
      },
    ]);
    let calls = 0;
    map.on('overlayactivate', ({ overlay }) => {
      expect(overlay.id).toBe('route');
      calls++;
    });
    const overlay = map.element.querySelector<SVGPathElement>('[data-overlay-id="route"]');
    expect(overlay?.getAttribute('role')).toBe('button');
    overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls).toBe(1);
    overlay?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(calls).toBe(2);
    map.setOverlays([]);
    overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls).toBe(2);
  },
};
