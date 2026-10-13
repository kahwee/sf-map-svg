import type { NeighborhoodFeature, NeighborhoodSource } from '../data/types.js';
import { element } from './dom.js';
import type { InteractiveSFMapData } from './explorer-data.js';
import type { createExplorerShell } from './explorer-shell.js';
import type { DistrictYear, ExplorerMode } from './types.js';

interface SidebarState {
  mode: ExplorerMode;
  year: DistrictYear;
  source: NeighborhoodSource;
  selected: NeighborhoodFeature | undefined;
}

/** Render sidebar snapshots and own every download URL until replacement or disposal. */
export function createExplorerSidebar(
  {
    detail,
    results,
    search,
    count,
  }: Pick<ReturnType<typeof createExplorerShell>, 'detail' | 'results' | 'search' | 'count'>,
  data: InteractiveSFMapData,
  chrome: 'map' | 'explorer',
  emptyResults: string | undefined,
  searchNeighborhoods: (
    query: string,
    source: NeighborhoodSource,
  ) => { id: string; canonicalName: string }[],
) {
  const downloads = new Set<string>();
  function releaseDownloads() {
    for (const url of downloads) URL.revokeObjectURL(url);
    downloads.clear();
  }
  function downloadLink(text: string, value: unknown, filename: string) {
    const link = element('a', text, 'sf-explorer-download');
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/geo+json' }),
    );
    downloads.add(url);
    link.href = url;
    link.download = filename;
    return link;
  }
  function updateDetail({ mode, year, source, selected }: SidebarState) {
    releaseDownloads();
    if (chrome === 'map') return;
    detail.replaceChildren();
    if (mode === 'districts') {
      const collection = data.districts?.[year];
      if (!collection) {
        detail.append(element('h3', `${year} supervisorial districts`));
        return;
      }
      detail.append(
        element('h3', `${year} supervisorial districts`),
        element(
          'p',
          'Eleven districts, identified by number. Switch to Neighborhoods to explore familiar place names.',
        ),
        downloadLink('Download district GeoJSON', collection, `districts-${year}.geojson`),
        element('p', collection.definition.description),
      );
      return;
    }
    if (mode === 'basemap') {
      detail.append(element('h3', 'San Francisco basemap'));
      return;
    }
    const collection = data.neighborhoods[source];
    if (!collection) return;
    detail.append(
      element('h3', selected ? selected.properties.canonicalName : 'Explore all neighborhoods'),
    );
    const description = selected
      ? `Source name: ${selected.properties.sourceName}${selected.properties.aliases.length ? `. Also known as: ${selected.properties.aliases.join(', ')}` : ''}.`
      : 'Choose a name or click an area to highlight its full boundary.';
    const sourceSummary = {
      realtor: 'SFAR realtor boundaries · August 2010 · 92 distinct areas.',
      'sf-find': 'SF Find neighborhoods · 2006 · 117 approximate areas.',
      analysis: 'City analysis neighborhoods · 41 census-tract-based areas.',
    };
    detail.append(element('p', description), element('p', sourceSummary[source]));
    if (selected)
      detail.append(
        downloadLink(
          'Download neighborhood GeoJSON',
          { ...collection, selection: selected.id, features: [selected] },
          `${source}-${selected.id}.geojson`,
        ),
      );
    detail.append(
      downloadLink(
        `Download all ${collection.features.length} areas`,
        collection,
        `neighborhoods-${source}.geojson`,
      ),
    );
    const provenance = element('details');
    provenance.append(
      element('summary', 'About these boundaries'),
      element('p', collection.definition.description),
    );
    detail.append(provenance);
  }
  function updateResults({ source, selected }: SidebarState) {
    if (chrome === 'map') return;
    const activeElement = document.activeElement;
    const focusedId =
      activeElement instanceof HTMLElement && results.contains(activeElement)
        ? activeElement.dataset.neighborhoodResult
        : undefined;
    const matches = searchNeighborhoods(search.value, source).sort((a, b) =>
      a.canonicalName.localeCompare(b.canonicalName),
    );
    count.textContent = `${matches.length} ${matches.length === 1 ? 'neighborhood' : 'neighborhoods'}${search.value ? ' found' : ' in this collection'}`;
    results.replaceChildren();
    for (const match of matches) {
      const node = element('button', match.canonicalName);
      node.type = 'button';
      node.dataset.neighborhoodResult = match.id;
      node.setAttribute('aria-pressed', String(selected?.id === match.id));
      results.append(node);
      if (focusedId === match.id) node.focus({ preventScroll: true });
    }
    if (!matches.length)
      results.append(
        element(
          'p',
          emptyResults ?? 'No matches. Try another name or definition source.',
          'sf-explorer-note',
        ),
      );
  }
  return { updateDetail, updateResults, destroy: releaseDownloads };
}
