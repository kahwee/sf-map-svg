import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, waitFor } from 'storybook/test';
import { bindMapCards } from '../src/cards.js';
import { createGuideController } from '../src/guide-map.js';
import { mapPalettes } from '../src/presets.js';

let map: ReturnType<typeof createGuideController>;
let binding: ReturnType<typeof bindMapCards>;
function required<T extends Element>(host: Element, selector: string): T {
  const node = host.querySelector<T>(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node;
}
const places = [
  { id: 'park', label: 'Golden Gate Park', lng: -122.482, lat: 37.7694 },
  { id: 'presidio', label: 'Presidio', lng: -122.466, lat: 37.799 },
  { id: 'mclaren', label: 'McLaren Park', lng: -122.419, lat: 37.7181 },
];
const meta = {
  title: 'Maps/Linked place cards',
  parameters: { layout: 'padded' },
  args: { palette: 'nightForest' },
  beforeEach: () => () => {
    binding?.destroy();
    map?.destroy();
  },
} satisfies Meta<{ palette: string }>;
export default meta;
type Story = StoryObj<{ palette: string }>;
export const LinkedCards: Story = {
  render: (args) => {
    const palette = args.palette === 'warmPaper' ? mapPalettes.warmPaper : mapPalettes.nightForest;
    const host = document.createElement('div');
    host.style.cssText =
      'width:min(calc(100vw - 32px),1100px);display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))';
    map = createGuideController({
      mode: 'basemap',
      markers: places,
      layers: { districtLabels: false, roadLabels: false, bartStations: false },
      controls: {
        markerPicker: false,
        neighborhoodPicker: false,
        legend: false,
        help: false,
      },
      appearance: {
        colors: palette.colors,
        labelStyle: { haloColor: palette.haloColor },
        markerColor: palette.markerColor,
        selectedMarkerColor: palette.selectedMarkerColor,
      },
      features: { selectedMarkerRing: { color: palette.selectedMarkerRingColor } },
    });
    const mapFrame = document.createElement('div');
    mapFrame.style.minWidth = '0';
    mapFrame.append(map.element);
    const cards = document.createElement('div');
    cards.setAttribute('aria-label', 'Places');
    for (const place of places) {
      const article = document.createElement('article');
      article.dataset.mapMarker = place.id;
      article.style.cssText =
        'border:2px solid #8b9b91;border-radius:12px;padding:20px;margin-bottom:16px';
      const heading = document.createElement('h2');
      heading.textContent = place.label;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.mapSelect = '';
      button.textContent = `Show ${place.label} on map`;
      button.style.cssText = 'min-height:44px;padding:8px 12px';
      article.append(heading, button);
      cards.append(article);
    }
    host.append(mapFrame, cards);
    binding = bindMapCards(map, cards, {
      markers: places,
      highlightColor: palette.selectedMarkerRingColor,
    });
    return host;
  },
  play: async ({ canvasElement, userEvent }) => {
    const cards = [...canvasElement.querySelectorAll<HTMLElement>('[data-map-marker]')];
    const buttons = cards.map((card) => required<HTMLButtonElement>(card, 'button'));
    const ring = required<HTMLElement>(map.overlayElement, '[data-map-card-highlight]');
    await waitFor(() =>
      expect(map.overlayElement.getBoundingClientRect().width).toBeGreaterThan(0),
    );
    const view = map.camera.get();
    await userEvent.hover(cards[0]);
    expect(ring.hidden).toBe(false);
    expect(map.getSelectedMarker()).toBeNull();
    expect(map.camera.get()).toEqual(view);
    await userEvent.unhover(cards[0]);
    expect(ring.hidden).toBe(true);
    buttons[1].focus();
    await waitFor(() => expect(ring.hidden).toBe(false));
    await userEvent.keyboard('{Enter}');
    expect(map.getSelectedMarker()?.id).toBe('presidio');
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(map.camera.get()).toEqual(view);
    buttons[1].blur();
    const pin = required<SVGElement>(map.element, '[data-marker-id="mclaren"]');
    pin.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(cards[2]).toHaveAttribute('data-map-selected'));
    expect(document.activeElement).toBe(pin);
    map.selectMarker(null, { fit: false });
    expect(buttons.every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true);
    map.camera.reset({ animate: false });
    buttons[0].focus();
    expect(ring.hidden).toBe(false);
    map.setMarkers(places.slice(1));
    binding.setMarkers(places.slice(1));
    expect(ring.hidden).toBe(true);
    await userEvent.click(buttons[0]);
    expect(map.getSelectedMarker()).toBeNull();
    binding.destroy();
    binding.destroy();
    expect(map.overlayElement.querySelector('[data-map-card-highlight]')).toBeNull();
    expect(buttons.every((button) => !button.hasAttribute('aria-pressed'))).toBe(true);
    await userEvent.click(buttons[0]);
    expect(map.getSelectedMarker()).toBeNull();
  },
};
export const Phone: Story = {
  ...LinkedCards,
  globals: { viewport: { value: 'mobile390', isRotated: false } },
};
export const WarmPaper: Story = { ...LinkedCards, args: { palette: 'warmPaper' } };
