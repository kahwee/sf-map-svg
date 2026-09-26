import { createSFMap } from '../src/index.js';
import { geometryPath } from '../src/geometry.js';
import { catalog, getNeighborhood, neighborhoodSources } from '../data/index.js';

const sourceTitles = Object.fromEntries(catalog.datasets.map((d) => [d.id, d.title]));
export default {
  title: 'Data/Neighborhood explorer',
  args: { source: 'realtor', neighborhood: 'Inner Mission' },
  argTypes: {
    source: { control: 'select', options: neighborhoodSources },
    neighborhood: {
      control: 'text',
      description:
        'An exact ID, canonical name, source name, or alias. Try Inner Mission, Outer Mission, SoMa, or NoPa.',
    },
  },
  render: ({ source, neighborhood }) => {
    const wrapper = document.createElement('section');
    wrapper.style.cssText = 'max-width:800px;width:100%;font:14px/1.5 system-ui;color:#304958';
    const selected = getNeighborhood(neighborhood, { source });
    const heading = document.createElement('h2');
    heading.textContent = selected?.properties.canonicalName ?? `No match for “${neighborhood}”`;
    wrapper.append(heading);
    const description = document.createElement('p');
    const dataset = catalog.datasets.find((d) => d.id === source);
    description.textContent = `${sourceTitles[source]} · ${dataset.featureCount} definitions. ${dataset.definition.description}`;
    wrapper.append(description);
    if (!selected) return wrapper;
    const metadata = document.createElement('p');
    metadata.textContent = `ID: ${selected.id} · Source name: ${selected.properties.sourceName} · Aliases: ${selected.properties.aliases.join(', ') || 'none recorded'}`;
    wrapper.append(metadata);
    const map = createSFMap({
      districtFills: false,
      districtLabels: false,
      title: `${selected.properties.canonicalName} — ${sourceTitles[source]}`,
    });
    const mapContainer = document.createElement('div');
    mapContainer.innerHTML = map.svg;
    const svg = mapContainer.querySelector('svg');
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    highlight.setAttribute('d', geometryPath(selected.geometry, map.project));
    highlight.setAttribute('fill', '#dfa968');
    highlight.setAttribute('fill-opacity', '.75');
    highlight.setAttribute('fill-rule', 'evenodd');
    highlight.setAttribute('stroke', '#8d5936');
    highlight.setAttribute('stroke-width', '1.5');
    highlight.setAttribute('data-neighborhood-id', selected.id);
    svg.append(highlight);
    wrapper.append(mapContainer);
    const link = document.createElement('a');
    link.href = new URL(`./data/${dataset.file}`, window.location.href).href;
    link.textContent = `Download all ${dataset.featureCount} ${sourceTitles[source]} polygons (GeoJSON)`;
    link.download = dataset.file;
    wrapper.append(link);
    return wrapper;
  },
};
export const InnerMission = {};
export const MissionSFFind = { args: { source: 'sf-find', neighborhood: 'Mission' } };
export const OuterMission = { args: { neighborhood: 'Outer Mission' } };
export const MissionAnalysis = { args: { source: 'analysis', neighborhood: 'Mission' } };
export const OuterMissionAnalysis = { args: { source: 'analysis', neighborhood: 'Outer Mission' } };
export const NoPa = { args: { source: 'realtor', neighborhood: 'NoPa' } };
export const SoMa = { args: { neighborhood: 'SoMa' } };
