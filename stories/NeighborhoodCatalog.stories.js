import { neighborhoodSources, searchNeighborhoods } from '../data/index.ts';

export default {
  title: 'Data/Neighborhood catalog',
  args: { query: '', source: 'realtor' },
  argTypes: {
    query: {
      control: 'text',
      description: 'Search canonical names, source names, IDs, and documented aliases.',
    },
    source: { control: 'select', options: ['all', ...neighborhoodSources] },
  },
  render: ({ query, source }) => {
    const entries = searchNeighborhoods(query, source === 'all' ? {} : { source });
    const section = document.createElement('section');
    section.style.cssText =
      'font:14px/1.5 system-ui;color:#304958;max-width:1100px;width:100%;overflow:auto';
    const heading = document.createElement('h2');
    heading.textContent = `${entries.length} neighborhood definitions`;
    const note = document.createElement('p');
    note.textContent =
      'Same-name areas can have different boundaries. Each row keeps its definition source; these are not all distinct neighborhoods.';
    section.append(heading, note);
    const download = document.createElement('a');
    download.href = new URL('./data/catalog.json', window.location.href).href;
    download.download = 'catalog.json';
    download.textContent = 'Download complete name catalog (JSON)';
    section.append(download);
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;text-align:left;width:100%;margin-top:16px';
    const head = table.createTHead().insertRow();
    for (const text of ['Canonical name', 'Definition source', 'Aliases', 'ID']) {
      const th = document.createElement('th');
      th.textContent = text;
      th.style.cssText = 'padding:8px;border-bottom:2px solid #cad6d9';
      head.append(th);
    }
    const body = table.createTBody();
    for (const entry of entries) {
      const row = body.insertRow();
      for (const text of [
        entry.canonicalName,
        entry.source,
        entry.aliases.join(', ') || '—',
        entry.id,
      ]) {
        const cell = row.insertCell();
        cell.textContent = text;
        cell.style.cssText = 'padding:8px;border-bottom:1px solid #e2e8e9';
      }
    }
    section.append(table);
    return section;
  },
};
export const RealtorNeighborhoods = {};
export const AllDefinitions = { args: { source: 'all' } };
export const MissionNames = { args: { query: 'mission' } };
export const SFFind = { args: { source: 'sf-find' } };
