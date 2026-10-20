import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect } from 'storybook/test';
import { createGuideSVG } from '../src/guide-static.js';
import { mapPalettes } from '../src/presets.js';

const meta = {
  title: 'Static/Field guide previews',
  args: { palette: 'nightForest' },
  parameters: { layout: 'padded' },
} satisfies Meta<{ palette: string }>;
export default meta;
type Story = StoryObj<{ palette: string }>;

export const ResponsiveNightAtlas: Story = {
  render: (args) => {
    const palette = args.palette === 'warmPaper' ? mapPalettes.warmPaper : mapPalettes.nightForest;
    const host = document.createElement('div');
    host.style.cssText = 'max-width:800px;margin:auto';
    const { svg } = createGuideSVG({
      labelLayout: {
        width: 800,
        haloColor: palette.haloColor,
        compact: { width: 480, maxLabels: 4 },
      },
      colors: palette.colors,
      districtLabels: false,
      roadLabels: false,
      bartStations: false,
      markers: [
        {
          id: 'park',
          label: 'Golden Gate Park',
          position: [-122.4687, 37.7704] as const,
          color: palette.markerColor,
        },
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
    expect(svg).toContain('data-layer="overview-labels"');
  },
};
export const Phone: Story = {
  ...ResponsiveNightAtlas,
  globals: { viewport: { value: 'mobile390', isRotated: false } },
};

export const WarmPaper: Story = { ...ResponsiveNightAtlas, args: { palette: 'warmPaper' } };
