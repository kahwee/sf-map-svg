import { type MapData, renderMap } from '@kahwee/sf-map-svg';
import { designHash, type PlaygroundState, staticData, staticOptions } from './playground-model.ts';
import { element } from './ui.js';

export function designUrl(state: PlaygroundState, base: string): string {
  const url = new URL(base);
  url.hash = designHash(state);
  return url.href;
}

/** Cache full-precision geography, retry failed loads and export the design captured at click time. */
export function createPlaygroundExport(
  exportButton: HTMLButtonElement,
  onError: (message: string) => void,
) {
  let pending = false;
  let exportData: Promise<MapData> | undefined;
  async function loadExportData() {
    exportData ??= fetch('./data/export-map.json')
      .then((response) => {
        if (!response.ok) throw new Error('Export geography could not load.');
        return response.json();
      })
      .catch((error) => {
        exportData = undefined;
        throw error;
      });
    return exportData;
  }
  async function download(state: PlaygroundState) {
    if (pending) return;
    pending = true;
    const design = structuredClone(state);
    const original = [...exportButton.childNodes];
    exportButton.disabled = true;
    exportButton.textContent = 'Preparing SVG…';
    try {
      const fullData = await loadExportData();
      const { svg } = renderMap(staticData(fullData, design.source), staticOptions(design));
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const link = element('a');
      link.href = url;
      link.download = `sf-${design.palette}-${design.year}.svg`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      onError('Export could not load its geography. Try exporting again.');
    } finally {
      pending = false;
      exportButton.disabled = false;
      exportButton.replaceChildren(...original);
    }
  }
  return { download };
}
