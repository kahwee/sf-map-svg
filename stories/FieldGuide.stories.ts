import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect } from 'storybook/test';
import { createGuideSVG } from '../src/guide-static.js';

const meta = {
  title: 'Static/Field guide previews',
  parameters: { layout: 'padded' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ResponsiveNightAtlas: Story = {
  render: () => {
    const host = document.createElement('div');
    host.style.cssText = 'max-width:800px;margin:auto';
    const { svg } = createGuideSVG({
      labelLayout: { width: 800, haloColor: '#1b2c28', compact: { width: 480, maxLabels: 4 } },
      colors: {
        water: '#0a1412',
        land: '#1b2c28',
        park: '#1f3d33',
        road: '#2f4943',
        highway: '#5a4d40',
        label: '#d5e3e8',
        neighborhood: '#3b554e',
      },
      districtLabels: false,
      roadLabels: false,
      bartStations: false,
      markers: [
        { id: 'park', label: 'Golden Gate Park', lng: -122.4687, lat: 37.7704, color: '#ff905f' },
      ],
    });
    const image = document.createElement('img');
    image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    image.alt = 'San Francisco overview with a Golden Gate Park marker';
    image.width = 800;
    image.height = 800;
    image.style.cssText = 'display:block;width:100%;height:auto;border-radius:16px';
    host.append(image);
    return host;
  },
  play: async ({ canvasElement }) => {
    const image = canvasElement.querySelector('img');
    if (!image) throw new Error('Missing preview');
    await image.decode();
    expect(image.naturalWidth).toBe(800);
    const svg = decodeURIComponent(image.src.split(',')[1]);
    expect(svg).toContain('data-label-layout="compact-480"');
    expect(svg).toContain('stroke="#1b2c28"');
  },
};
export const Phone: Story = {
  ...ResponsiveNightAtlas,
  globals: { viewport: { value: 'mobile390', isRotated: false } },
};
