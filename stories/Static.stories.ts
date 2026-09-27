import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect } from 'storybook/test';
import { renderMap } from '../src/api.ts';
import { guideMapData } from '../src/guide-data.ts';

type DemoArgs = { parks: boolean; stations: boolean; roads: boolean };
let renderCount = 0;
const meta = {
  title: 'Start here/Static SVG',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Import `renderMap` from `@kahwee/sf-map-svg/static` and pass explicit geography, such as `guideMapData.map` from `@kahwee/sf-map-svg/guide/data`. It returns `{ svg, project }` without a DOM or interactive runtime. The SVG stays self-contained and works offline.',
      },
    },
  },
  args: { parks: true, stations: true, roads: true },
  argTypes: {
    parks: { control: 'boolean', description: 'Current park outlines from the guide data.' },
    stations: { control: 'boolean', description: 'Current BART station points.' },
    roads: { control: 'boolean', description: 'Highways and selected streets.' },
  },
  render: ({ parks, stations, roads }: DemoArgs) => {
    const { svg } = renderMap(guideMapData.map, {
      width: 800,
      height: 800,
      districtFills: false,
      districtLines: false,
      districtLabels: false,
      neighborhoodLines: true,
      landmarks: parks,
      bartStations: stations,
      highways: roads,
      keyRoads: roads,
      idPrefix: `storybook-static-${++renderCount}`,
    });
    const frame = document.createElement('div');
    frame.style.cssText = 'width:100%;max-width:800px;margin:auto';
    frame.innerHTML = svg;
    const image = frame.querySelector('svg');
    image?.setAttribute('width', '100%');
    image?.setAttribute('height', 'auto');
    return frame;
  },
} satisfies Meta<DemoArgs>;

export default meta;
type Story = StoryObj<DemoArgs>;

export const GuideOverview: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A standalone SVG assembled from the small guide dataset. Toggle the layers in Controls; no network requests or map tiles are needed.',
      },
      source: {
        code: `import { renderMap } from '@kahwee/sf-map-svg/static';
import { guideMapData } from '@kahwee/sf-map-svg/guide/data';

const { svg, project } = renderMap(guideMapData.map, {
  neighborhoodLines: true,
  landmarks: true,
  bartStations: true,
  highways: true,
});
document.querySelector('#map').innerHTML = svg;`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const image = canvasElement.querySelector('svg');
    expect(image).toBeTruthy();
    expect(image?.querySelectorAll('path').length).toBeGreaterThan(0);
  },
};

export const CoastAndNeighborhoods: Story = {
  args: { parks: false, stations: false, roads: false },
  parameters: {
    docs: {
      description: {
        story:
          'Start with only the coast and neighborhood outlines. Every extra geographic layer is opt-in.',
      },
    },
  },
};

export const Phone390: Story = {
  globals: { viewport: { value: 'mobile390', isRotated: false } },
  parameters: {
    docs: {
      description: {
        story:
          'The SVG scales in a 390 px Storybook viewport while retaining its 800-unit coordinate system.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const image = canvasElement.querySelector('svg');
    expect(image).toBeTruthy();
    if (!image) return;
    expect(image.getBoundingClientRect().width).toBeLessThanOrEqual(window.innerWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    );
  },
};
