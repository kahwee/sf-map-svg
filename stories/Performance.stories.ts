import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, waitFor } from 'storybook/test';
import { guideMapData } from '../src/guide-data.js';
import { createMap, type MapController, type MapMarker } from '../src/map.js';
import { createStoryLifecycle } from './lifecycle.js';

const markers: readonly MapMarker[] = Array.from({ length: 2000 }, (_, index) => ({
  id: `pin-${index}`,
  label: `Place ${index}`,
  lng: -122.505 + (index % 50) * 0.0024,
  lat: 37.715 + Math.floor(index / 50) * 0.002,
}));
const controllers = new WeakMap<HTMLElement, MapController>();
const lifecycle = createStoryLifecycle();
const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

const meta = {
  title: 'Checks/2000 markers',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A deterministic 2,000-place catalog. Zoom and pan to inspect the mounted viewport subset; all places remain in the picker. Counts reflect SVG nodes, not an FPS promise.',
      },
    },
  },
  beforeEach: lifecycle.beforeEach,
  render: (_args, { globals, id }) => {
    let revision = 0;
    const host = document.createElement('section');
    host.style.maxWidth = globals.viewport?.value === 'mobile390' ? '366px' : '800px';
    const title = document.createElement('h2');
    title.textContent = '2,000 places';
    const summary = document.createElement('p');
    summary.dataset.markerSummary = '';
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px';
    const map = createMap(guideMapData, { markers, features: { clustering: true } });
    controllers.set(host, map);
    lifecycle.track(id, () => map.destroy());
    const update = () => {
      if (map.destroyed) return;
      summary.textContent = `2,000 places in the catalog · ${map.element.querySelectorAll('[data-marker-id]').length} pins · ${map.element.querySelectorAll('[data-cluster-ids]').length} clusters in this view`;
    };
    const actions: readonly [string, () => void][] = [
      ['City view', () => map.camera.reset()],
      ['Zoom in', () => map.camera.zoom(2)],
      ['Zoom out', () => map.camera.zoom(0.5)],
      ['Pan east', () => map.camera.pan(map.camera.get()[2] / 2, 0)],
      [
        'Toggle clustering',
        () =>
          map.configure({ features: { clustering: !map.getConfiguration().features.clustering } }),
      ],
      [
        'Update labels',
        () => {
          revision++;
          map.setMarkers(
            markers.map((marker) => ({ ...marker, label: `${marker.label} update ${revision}` })),
          );
        },
      ],
    ];
    for (const [label, action] of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.style.minHeight = '44px';
      button.addEventListener('click', async () => {
        action();
        await settle();
        update();
      });
      controls.append(button);
    }
    map.on('viewportchange', () => {
      void settle().then(update);
    });
    host.append(title, summary, controls, map.element);
    void settle().then(update);
    return host;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const exercise: Story['play'] = async ({ canvasElement, userEvent }) => {
  const host = canvasElement.querySelector('section');
  const map = host ? controllers.get(host) : undefined;
  if (!map) throw new Error('Missing map controller');
  const button = (name: string) => {
    const found = [...canvasElement.querySelectorAll('button')].find(
      (node) => node.textContent === name,
    );
    if (!found) throw new Error(`Missing ${name} button`);
    return found;
  };
  const pins = () => [...map.element.querySelectorAll<SVGGElement>('[data-marker-id]')];
  const count = () => pins().length + map.element.querySelectorAll('[data-cluster-ids]').length;
  await waitFor(() => expect(count()).toBeGreaterThan(0));
  expect(count()).toBeLessThan(2000);
  const picker = map.element.querySelectorAll<HTMLSelectElement>(
    '.sf-explorer-feature-controls select',
  )[1];
  if (!picker) throw new Error('Missing full marker picker');
  expect(picker.options).toHaveLength(2001);
  await userEvent.click(button('Toggle clustering'));
  await settle();
  const overview = pins().length;
  expect(overview).toBeGreaterThan(1500);
  await userEvent.click(button('Zoom in'));
  await userEvent.click(button('Zoom in'));
  await settle();
  expect(pins().length).toBeGreaterThan(0);
  expect(pins().length).toBeLessThan(overview / 2);
  const before = new Set(pins().map((node) => node.dataset.markerId));
  await userEvent.click(button('Pan east'));
  await settle();
  expect(pins().some((node) => !before.has(node.dataset.markerId))).toBe(true);
  const retained = pins()[0];
  if (!retained?.dataset.markerId) throw new Error('Missing visible place');
  retained.focus();
  await userEvent.click(button('Update labels'));
  expect(map.element.querySelector(`[data-marker-id="${retained.dataset.markerId}"]`)).toBe(
    retained,
  );
  expect(retained.getAttribute('aria-label')).toContain('update 1');
  expect(picker.options).toHaveLength(2001);
  // A place culled from the viewport is still selectable and fitted by the public API.
  const offscreen = markers.find(
    (marker) => !pins().some((node) => node.dataset.markerId === marker.id),
  );
  if (!offscreen) throw new Error('Expected an offscreen place');
  expect(map.selectMarker(offscreen.id)).toBe(true);
  await settle();
  expect(map.element.querySelector(`[data-marker-id="${offscreen.id}"]`)).toBeTruthy();
  expect(map.getSelectedMarker()?.id).toBe(offscreen.id);
  expect(map.projectToScreen(offscreen.lng, offscreen.lat).visible).toBe(true);
  map.selectMarker(null, { fit: false });
  await userEvent.click(button('City view'));
  await settle();
  expect(pins()).toHaveLength(overview);
  await userEvent.click(button('Toggle clustering'));
  await settle();
  expect(count()).toBeLessThan(overview);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(innerWidth);
};

export const Desktop: Story = { play: exercise };
export const Phone: Story = {
  globals: { viewport: { value: 'mobile390', isRotated: false } },
  play: exercise,
};
