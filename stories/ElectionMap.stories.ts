import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { districtMaps } from '../data/districts.js';
import election2002 from '../data/elections/2002-11-05.json' with { type: 'json' };
import election2012 from '../data/elections/2012-11-06.json' with { type: 'json' };
import election2022 from '../data/elections/2022-11-08.json' with { type: 'json' };
import { createMap, type DistrictYear, type MapController } from '../src/api.js';
import mapData from '../src/data.js';
import { createStoryLifecycle } from './lifecycle.js';

const elections = { 2002: election2002, 2012: election2012, 2022: election2022 };
const lifecycle = createStoryLifecycle();
const controllers = new WeakMap<HTMLElement, MapController>();
const colors = ['#e8e3d8', '#cfdfd6', '#a9cfbf', '#78b69f', '#498c79', '#245f54'];

function voteShare(year: DistrictYear, id: number) {
  const result = elections[year].measures[0].districts.find((row) => row.district === id);
  return result ? result.yes / (result.yes + result.no) : 0;
}
function shade(share: number) {
  return colors[Math.min(colors.length - 1, Math.floor(share * colors.length))];
}

const meta = {
  title: 'Examples/Election choropleth',
  tags: ['autodocs'],
  beforeEach: lifecycle.beforeEach,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Official San Francisco proposition A Yes share by supervisorial district. Each year uses its matching election and boundary geometry. The data comes from the election statements of vote in data/elections.',
      },
    },
  },
  render: (_, { id }) => {
    let year: DistrictYear = 2022;
    const controller = createMap(
      { map: mapData, districts: districtMaps, neighborhoods: {} },
      {
        mode: 'districts',
        year,
        appearance: {
          theme: 'districts',
          colors: { selected: '#173e36' },
          districtStyle: (district) => ({
            fill: shade(voteShare(year, district.id)),
            stroke: '#49665f',
          }),
        },
        layers: {
          districtFills: true,
          districtLines: true,
          districtLabels: true,
          neighborhoodLines: false,
          neighborhoodLabels: false,
          highways: false,
          landmarks: false,
          keyRoads: false,
          bartStations: false,
        },
        attribution: 'compact',
      },
    );
    lifecycle.track(id, () => controller.destroy());
    controllers.set(controller.element, controller);
    const frame = document.createElement('section');
    frame.style.cssText =
      'box-sizing:border-box;min-height:100vh;padding:clamp(18px,4vw,50px);background:#f5f2eb;color:#183d39;font:16px/1.5 system-ui,sans-serif';
    const inner = document.createElement('div');
    inner.style.cssText = 'max-width:1100px;margin:auto';
    const eyebrow = document.createElement('p');
    eyebrow.textContent = 'SAN FRANCISCO · OFFICIAL ELECTION RETURNS';
    eyebrow.style.cssText = 'font-size:12px;font-weight:800;letter-spacing:.16em;color:#416b5e';
    const title = document.createElement('h1');
    title.textContent = 'How did each district vote?';
    title.style.cssText =
      'font:clamp(32px,5vw,62px)/1.05 Georgia,serif;letter-spacing:-.04em;margin:12px 0';
    const intro = document.createElement('p');
    intro.style.cssText = 'max-width:680px;color:#49665f';
    const picker = document.createElement('select');
    picker.setAttribute('aria-label', 'Election year');
    picker.style.cssText =
      'padding:10px 14px;border:1px solid #aac5b7;border-radius:8px;background:#fff;color:#183d39;font:inherit';
    for (const optionYear of [2002, 2012, 2022] as const) {
      const option = document.createElement('option');
      option.value = String(optionYear);
      option.textContent = `${optionYear} election`;
      picker.append(option);
    }
    picker.value = String(year);
    const readout = document.createElement('p');
    readout.setAttribute('aria-live', 'polite');
    readout.style.cssText = 'min-height:28px;font-weight:700';
    const mapWrap = document.createElement('div');
    mapWrap.style.cssText =
      'margin-top:24px;border:1px solid #dae2d8;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 22px 60px #163e5620';
    mapWrap.append(controller.element);
    const legend = document.createElement('p');
    legend.style.cssText = 'font-size:13px;color:#49665f';
    legend.textContent =
      'Lighter to darker green = lower to higher Yes share. Select a district for its official count.';
    function updateCopy() {
      intro.textContent = `${elections[year].electionName} · Proposition A: ${elections[year].measures[0].title}. Yes share excludes blank and overvotes.`;
      const district = controller.getSelectedDistrict();
      const result = district
        ? elections[year].measures[0].districts.find((row) => row.district === district.id)
        : null;
      readout.textContent =
        result && district
          ? `District ${district.id}: ${(voteShare(year, district.id) * 100).toFixed(1)}% Yes · ${result.yes.toLocaleString()} Yes / ${result.no.toLocaleString()} No`
          : 'Select a district on the map.';
    }
    picker.addEventListener('change', () => {
      year = Number(picker.value) as DistrictYear;
      controller.setDistrictYear(year, { animate: true });
      updateCopy();
    });
    controller.on('districtchange', updateCopy);
    updateCopy();
    inner.append(eyebrow, title, intro, picker, mapWrap, legend, readout);
    frame.append(inner);
    return frame;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Explore: Story = {
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector<HTMLElement>('.sf-explorer');
    const controller = map ? controllers.get(map) : undefined;
    expect(controller).toBeTruthy();
    if (!controller || !map) return;
    const selected: number[] = [];
    const activated: number[] = [];
    controller.on('districtchange', (detail) => {
      if (detail.id !== null) selected.push(detail.id);
    });
    controller.on('districtactivate', (detail) => activated.push(detail.id));
    const first = map.querySelector<SVGPathElement>(
      '[data-layer="district-fills"] [data-district="1"]',
    );
    expect(first?.getAttribute('role')).toBe('button');
    first?.focus();
    await userEvent.keyboard('{Enter}');
    expect(controller.getSelectedDistrict()?.id).toBe(1);
    expect(selected).toEqual([1]);
    expect(activated).toEqual([1]);
    controller.setDistrictStyle((district) => ({
      fill: district.id === 1 ? '#abcdef' : '#fedcba',
    }));
    expect(first?.getAttribute('fill')).toBe('#abcdef');
    controller.setDistrictStyle((district) => ({
      fill: shade(voteShare(Number(map.dataset.year) as DistrictYear, district.id)),
      stroke: '#49665f',
    }));
    const before = controller.camera.get();
    const picker = canvasElement.querySelector<HTMLSelectElement>(
      'select[aria-label="Election year"]',
    );
    expect(picker).toBeTruthy();
    if (!picker) return;
    await userEvent.selectOptions(picker, '2012');
    expect(map.dataset.year).toBe('2012');
    expect(controller.getSelectedDistrict()?.year).toBe(2012);
    expect(controller.camera.get()).toEqual(before);
    await waitFor(() =>
      expect(map.querySelectorAll('[data-layer="district-fills"] [data-district]')).toHaveLength(
        11,
      ),
    );
    expect(controller.selectDistrict(12)).toBe(false);
    const second = map.querySelector<SVGPathElement>(
      '[data-layer="district-fills"] [data-district="2"]',
    );
    second?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(controller.getSelectedDistrict()?.id).toBe(2);
    await userEvent.selectOptions(picker, '2002');
    expect(controller.getSelectedDistrict()).toMatchObject({ id: 2, year: 2002 });
    expect(map.querySelector('[data-layer="district-fills"] [data-district="2"]')).toBeTruthy();
  },
};

export const Phone390: Story = {
  globals: { viewport: { value: 'mobile390', isRotated: false } },
};
