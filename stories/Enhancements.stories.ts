import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, waitFor } from 'storybook/test';
import { createGuideMap, mountGuideMap } from '../src/guide-map.js';
import { createGuideShell } from '../src/guide-static.js';
import type { NeighborhoodExplorerElement as InteractiveSFMapElement } from '../src/types.js';

let map: InteractiveSFMapElement;
const markers = [
  { id: 'one', label: 'First Mission place', lng: -122.4269, lat: 37.7596, radius: 9 },
  { id: 'two', label: 'Second Mission place', lng: -122.4269, lat: 37.7596 },
  { id: 'park', label: 'Park', lng: -122.4687, lat: 37.7704 },
];
const meta = {
  title: 'Checks/Consumer API',
  parameters: { layout: 'padded' },
  beforeEach: () => () => map?.destroy(),
  render: () => {
    map = createGuideMap({
      markers,
      motion: { duration: 180 },
      markerEntrance: true,
      clustering: true,
      selectedMarkerRing: { color: '#102f72' },
      attribution: 'compact',
      colors: { water: '#dae8eb', land: '#f5f4e9', label: '#233e49', neighborhood: '#879b9b' },
      labelStyle: { fontFamily: 'Georgia,serif', fontWeight: 600, haloColor: '#f5f4e9' },
      areaStyle: { selectedFill: '#b76a35', selectedStroke: '#814622' },
      legend: { items: [{ label: 'Places', color: '#245b61' }] },
      northArrow: true,
      scaleBar: true,
      strings: {
        touchNavigation: 'Touch pan',
        touchNavigationLabel: 'Enable map gestures',
        touchNavigationDone: 'Done',
        touchNavigationExitLabel: 'Restore page scrolling',
      },
    });
    return map;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const StyledGuide: Story = { parameters: { a11y: { test: 'error' } } };

export const MotionAndClusters: Story = {
  play: async ({ userEvent }) => {
    await waitFor(() =>
      expect(map.querySelector('[data-layer="marker-clusters"] [role="button"]')).toBeTruthy(),
    );
    expect(map.querySelectorAll('.sf-explorer-feature-controls select')[1].children).toHaveLength(
      4,
    );
    let activatedCount = 0;
    map.addEventListener(
      'clusteractivate',
      (event) => {
        activatedCount = (event as CustomEvent).detail.markers.length;
      },
      { once: true },
    );
    map.querySelector<SVGElement>('[data-layer="marker-clusters"] [role="button"]')?.focus();
    await userEvent.keyboard('{Enter}');
    expect(activatedCount).toBe(2);
    await waitFor(() => expect(map.getViewport()[2]).toBeLessThan(800));
    map.setViewport([0, 0, 800], { animate: false });
    map.selectMarker('one', { fit: false });
    await waitFor(() =>
      expect(map.querySelector<SVGElement>('[data-marker-id="one"]')?.style.display).toBe(''),
    );
    expect(map.getSelectedMarker()?.radius).toBe(9);
    const start = map.getViewport();
    map.setViewport([200, 200, 300]);
    expect(map.getViewport()).toEqual(start);
    await waitFor(() => expect(map.getViewport()).toEqual([200, 200, 300]));
    const point = map.projectToScreen(markers[0].lng, markers[0].lat);
    expect(Number.isFinite(point.x)).toBe(true);
    const pin = map.querySelector<SVGGElement>('[data-marker-id="one"]');
    const canvasBox = map.overlayElement.getBoundingClientRect();
    const matrix = pin?.getScreenCTM();
    if (!matrix) throw new Error('Missing marker transform');
    expect(Math.abs(point.x - (matrix.e - canvasBox.left))).toBeLessThan(1);
    expect(Math.abs(point.y - (matrix.f - canvasBox.top))).toBeLessThan(1);
    expect(map.querySelector('[data-layer="coast"]')).toHaveAttribute('fill', '#f5f4e9');
    expect(map.querySelector('[data-layer="explorer-labels"]')).toHaveAttribute(
      'font-family',
      'Georgia,serif',
    );
    expect(map.overlayElement.contains(map.querySelector('.sf-map-north'))).toBe(true);
    map.setViewport([100, 100, 400]);
    map.setViewport([0, 0, 800], { animate: false });
    await new Promise((resolve) => setTimeout(resolve, 230));
    expect(map.getViewport()).toEqual([0, 0, 800]);
    const touch = map.querySelector<HTMLButtonElement>('button[aria-label="Enable map gestures"]');
    if (!touch) throw new Error('Missing touch control');
    await userEvent.click(touch);
    expect(touch.textContent).toBe('Done');
    expect(touch.getAttribute('aria-label')).toBe('Restore page scrolling');
    map.setMarkers(markers.slice(0, 1));
    await waitFor(() =>
      expect(map.querySelectorAll('[data-layer="marker-clusters"] > g')).toHaveLength(0),
    );
    map.setViewport([100, 100, 400]);
    map.destroy();
    const stopped = map.getViewport();
    await new Promise((resolve) => setTimeout(resolve, 230));
    expect(map.getViewport()).toEqual(stopped);
  },
};

export const ProgressiveShell: Story = {
  render: () => {
    const host = document.createElement('div');
    host.style.maxWidth = '390px';
    host.innerHTML = createGuideShell({ markers, labels: false });
    return host;
  },
  play: async ({ canvasElement }) => {
    const shell = canvasElement.querySelector<HTMLElement>('.sf-guide-shell');
    if (!shell) throw new Error('Missing shell');
    const before = shell.getBoundingClientRect().height;
    expect(() => mountGuideMap(shell, { attribution: 'full' })).toThrow('compact attribution');
    expect(shell.querySelector('.sf-guide-frame')?.classList.contains('sf-explorer')).toBe(false);
    map = mountGuideMap(shell, {
      markers,
      labels: false,
      strings: { touchNavigation: 'Touch pan' },
    });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(Math.abs(shell.getBoundingClientRect().height - before)).toBeLessThan(1);
    expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth);
  },
};

export const ReducedMotion: Story = {
  play: async () => {
    // Test the preference contract without depending on the machine's OS setting.
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => {
      const media = original.call(window, query);
      Object.defineProperty(media, 'matches', { value: true });
      return media;
    }) as typeof window.matchMedia;
    try {
      const reduced = createGuideMap({ motion: true, markerEntrance: true, markers });
      map.after(reduced);
      reduced.setViewport([100, 100, 400]);
      expect(reduced.getViewport()).toEqual([100, 100, 400]);
      expect(reduced.getAnimations({ subtree: true })).toHaveLength(0);
      reduced.destroy();
      reduced.remove();
    } finally {
      window.matchMedia = original;
    }
  },
};
