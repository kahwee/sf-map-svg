import type { NeighborhoodSource } from '../data/types.js';
import { element } from './dom.js';
import { sourceNames } from './neighborhood-layer.js';
import type { NeighborhoodExplorerOptions } from './types.js';

let explorerCount = 0;

/** Construct shared map chrome; optional explorer content has its own factory below. */
export function createMapShell({
  chrome,
  styleOptions,
  strings,
  legendOptions,
  colors,
  attributionMode,
}: {
  source: NeighborhoodSource;
  sources: readonly NeighborhoodSource[];
  hasDistricts: boolean;
  chrome: 'map' | 'explorer';
  styleOptions: NonNullable<NeighborhoodExplorerOptions['style']>;
  strings: NonNullable<NeighborhoodExplorerOptions['strings']>;
  legendOptions: NonNullable<NeighborhoodExplorerOptions['legend']>;
  colors: NonNullable<NeighborhoodExplorerOptions['colors']>;
  attributionMode: 'full' | 'compact';
}) {
  const root = element('section', '', 'sf-explorer');
  root.setAttribute('aria-label', 'San Francisco neighborhood explorer');
  const style = element('style');
  style.textContent = `
.sf-explorer{container:sf-neighborhood-explorer / inline-size;font:14px/1.5 var(--sf-map-font);color:var(--sf-map-ink);background:var(--sf-map-surface);border:1px solid var(--sf-map-border);border-radius:14px;overflow:hidden;max-width:1120px;margin:auto;box-shadow:0 8px 32px #18364f08}
.sf-explorer *{box-sizing:border-box}
.sf-explorer [hidden]{display:none!important}
.sf-explorer h2,.sf-explorer p{margin:0}
.sf-explorer button,.sf-explorer input,.sf-explorer select,.sf-explorer a{font:inherit}
.sf-explorer button,.sf-explorer select,.sf-explorer input{color:inherit;border:1px solid #c7d5df;border-radius:7px;background:var(--sf-map-surface);min-height:44px;padding:9px 12px}
.sf-explorer button{cursor:pointer;transition:background .12s,border-color .12s}
.sf-explorer button:hover{background:#f0f6fa;border-color:#8ba9c0}
.sf-explorer button[aria-pressed=true]{color:#123d63;background:#e6f1f9;border-color:#5689b0;font-weight:650}
.sf-explorer :focus-visible{outline:3px solid var(--sf-map-focus);outline-offset:2px}
.sf-explorer-map-column{grid-area:map;min-width:0;background:#e4f2f8}
.sf-explorer-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:var(--sf-map-control-gap);padding:12px;background:var(--sf-map-surface);border-bottom:1px solid var(--sf-map-border)}
.sf-explorer-control-group{display:flex;align-items:center;flex-wrap:wrap;gap:6px;max-width:100%}
.sf-explorer-pan-controls{margin-left:auto}
.sf-explorer-toolbar button{min-width:44px;padding:6px 10px}
.sf-explorer-zoom{font-size:12px;min-width:42px;text-align:center;font-variant-numeric:tabular-nums;color:#496578}
.sf-explorer-canvas{position:relative;aspect-ratio:1;overflow:hidden;touch-action:pan-y pinch-zoom}
.sf-marker-chooser{position:absolute;z-index:2;top:12px;right:12px;display:flex;flex-direction:column;gap:6px;box-sizing:border-box;width:280px;max-width:calc(100% - 24px);max-height:calc(100% - 24px);overflow:auto;padding:12px;border:1px solid var(--sf-map-border);border-radius:8px;background:var(--sf-map-surface);color:var(--sf-map-ink);box-shadow:0 6px 20px #0003}
.sf-marker-chooser button{min-height:44px;text-align:left;overflow-wrap:anywhere}
.sf-explorer-canvas>svg{display:block;width:100%;height:100%;max-width:none;cursor:grab;user-select:none}
.sf-explorer-canvas>svg:active{cursor:grabbing}
.sf-explorer-canvas path[data-neighborhood-id]{cursor:pointer}
.sf-explorer-legend{display:flex;flex-wrap:wrap;gap:8px 20px;padding:14px 16px 8px;background:var(--sf-map-surface);border-top:1px solid #dce5eb;color:#496578;font-size:12px}
.sf-explorer-legend-item{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.sf-explorer-legend-symbol{display:inline-block;flex:none;width:15px;height:11px;border-radius:2px}
.sf-explorer-legend-bart{width:10px;height:10px;margin:0 2px;border:2px solid #0073ae;border-radius:50%;background:#fff}
.sf-explorer-legend-park{background:#c6dfbd;border:1px solid #a8c69d}
.sf-explorer-legend-road{height:2px;border-radius:2px;background:#bcc3c5}
.sf-explorer-legend-highway{height:3px;border-radius:2px;background:#b9a18a}
.sf-explorer-hint{padding:6px 16px 10px;font-size:12px;color:#586f80;background:#fff}
.sf-explorer text{pointer-events:none}
.sf-explorer-status{padding:0 16px 14px;font-size:12px;background:var(--sf-map-surface);color:#496578}
.sf-explorer-visually-hidden{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.sf-explorer[data-interface=map] .sf-explorer-body{display:block}
.sf-explorer[data-interface=map] .sf-explorer-header,.sf-explorer[data-interface=map] .sf-explorer-panel,.sf-explorer[data-interface=map] .sf-explorer-detail{display:none}
.sf-explorer-feature-controls{display:flex;flex-wrap:wrap;gap:8px;padding:10px;background:#fff}
.sf-explorer-feature-controls label{display:flex;flex:1;flex-direction:column;min-width:0}
.sf-explorer-feature-controls select{width:100%;min-width:0}
.sf-explorer svg [role=button]:focus-visible{outline:none;stroke:#102f72;stroke-width:3;fill-opacity:.3}
@media(prefers-reduced-motion:reduce){.sf-explorer button{transition:none}}
.sf-explorer button:disabled{opacity:.45;cursor:default}
@container sf-neighborhood-explorer (max-width:650px){
.sf-explorer-feature-controls{flex-direction:column}
.sf-explorer-toolbar{padding:8px;gap:6px}
.sf-explorer-control-group{gap:4px}
.sf-explorer-pan-controls{flex-basis:100%;margin-left:0}
.sf-explorer-toolbar button{padding:5px 8px}
.sf-explorer-legend{gap:8px 16px;padding:12px 14px 8px}
}`;
  root.dataset.interface = chrome;
  root.style.setProperty('--sf-map-ink', styleOptions.ink ?? '#18364f');
  root.style.setProperty('--sf-map-surface', styleOptions.surface ?? '#fff');
  root.style.setProperty('--sf-map-accent', styleOptions.accent ?? '#163d61');
  root.style.setProperty('--sf-map-border', styleOptions.border ?? '#cedae3');
  root.style.setProperty('--sf-map-focus', styleOptions.focus ?? '#1676b8');
  root.style.setProperty('--sf-map-control-gap', styleOptions.controlGap ?? '6px');
  root.style.setProperty('--sf-map-font', styleOptions.font ?? 'system-ui,sans-serif');
  root.append(style);
  const header = element('header', '', 'sf-explorer-header');
  root.append(header);
  const body = element('div', '', 'sf-explorer-body');
  const panel = element('div', '', 'sf-explorer-panel');
  const modeSelect = element('select');
  const sourceLabel = element('label');
  const sourceSelect = element('select');
  const searchLabel = element('label');
  const search = element('input');
  const count = element('p', '', 'sf-explorer-count');
  const results = element('div', '', 'sf-explorer-results');
  const detail = element('div', '', 'sf-explorer-detail');
  const column = element('div', '', 'sf-explorer-map-column');
  const toolbar = element('div', '', 'sf-explorer-toolbar');
  toolbar.setAttribute('aria-label', 'Map controls');
  const canvas = element('div', '', 'sf-explorer-canvas');
  const hint = element(
    'p',
    strings.gestureHelp ??
      'Drag to pan · Ctrl/⌘ + scroll to zoom · Focus map: arrows pan, +/− zoom, Home resets. Touch: scroll the page, or enable Touch navigation to pan and pinch the map. Escape exits.',
    'sf-explorer-hint',
  );
  hint.id = `sf-explorer-help-${++explorerCount}`;
  const status = element('p', '', 'sf-explorer-status');
  status.setAttribute('aria-live', 'polite');
  const legend = element('div', '', 'sf-explorer-legend');
  legend.setAttribute('aria-label', 'Map legend');
  for (const [kind, label] of [
    ['bart', 'BART station'],
    ['park', 'Park'],
    ['highway', 'Highway'],
    ['road', 'Roads'],
  ] as const) {
    if (legendOptions.builtins === false || legendOptions.hidden?.includes(kind)) continue;
    const entry = element('span', '', 'sf-explorer-legend-item');
    const symbol = element('span', '', `sf-explorer-legend-symbol sf-explorer-legend-${kind}`);
    symbol.setAttribute('aria-hidden', 'true');
    if (colors[kind]) {
      if (kind === 'bart') symbol.style.borderColor = colors[kind];
      else symbol.style.backgroundColor = colors[kind];
    }
    entry.append(symbol, document.createTextNode(label));
    legend.append(entry);
  }
  for (const item of legendOptions.items ?? []) {
    const entry = element('span', '', 'sf-explorer-legend-item');
    const symbol = element('span', '', 'sf-explorer-legend-symbol');
    symbol.style.backgroundColor = item.color;
    symbol.setAttribute('aria-hidden', 'true');
    entry.append(symbol, document.createTextNode(item.label));
    legend.append(entry);
  }
  const featureControls = element('div', '', 'sf-explorer-feature-controls');
  const neighborhoodLabel = element('label', strings.chooseNeighborhood ?? 'Select neighborhood');
  const neighborhoodSelect = element('select');
  neighborhoodLabel.append(neighborhoodSelect);
  const markerLabel = element('label', strings.chooseMarker ?? 'Choose marker');
  const markerSelect = element('select');
  markerLabel.append(markerSelect);
  featureControls.append(neighborhoodLabel, markerLabel);
  const attribution = element('p', '', 'sf-explorer-hint');
  const attributionDisclosure = element('details', '', 'sf-explorer-hint');
  attributionDisclosure.append(element('summary', 'Map data · DataSF / BART'), attribution);
  column.append(
    toolbar,
    featureControls,
    canvas,
    legend,
    hint,
    status,
    attributionMode === 'compact' ? attributionDisclosure : attribution,
  );
  body.append(panel, column, detail);
  root.append(body);
  return {
    root,
    header,
    panel,

    modeSelect,
    sourceLabel,
    sourceSelect,
    searchLabel,
    search,
    count,
    results,
    detail,
    toolbar,
    canvas,
    hint,
    status,
    legend,
    featureControls,
    neighborhoodLabel,
    neighborhoodSelect,
    markerLabel,
    markerSelect,
    attribution,
  };
}

/** Explorer-only content stays out of map/controller bundles. */
export function createExplorerShell(options: Parameters<typeof createMapShell>[0]) {
  const shell = createMapShell(options);
  const {
    root,
    header,
    panel,
    modeSelect,
    sourceLabel,
    sourceSelect,
    searchLabel,
    search,
    count,
    results,
  } = shell;
  const { source, sources, hasDistricts, strings } = options;
  const style = element('style');
  style.textContent = `.sf-explorer-header{padding:24px;border-top:4px solid var(--sf-map-accent);border-bottom:1px solid var(--sf-map-border)}
.sf-explorer-header h2{font-size:25px;line-height:1.25;font-weight:700;letter-spacing:-.7px}
.sf-explorer-header p{color:#586f80;margin-top:8px;max-width:58ch}
.sf-explorer-body{display:grid;grid-template-columns:280px minmax(0,1fr);grid-template-areas:"panel map" "detail map";grid-template-rows:auto 1fr}
.sf-explorer-panel{grid-area:panel;padding:18px;display:flex;flex-direction:column;gap:14px;border-right:1px solid #dce5eb;min-width:0}
.sf-explorer-panel label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:650}
.sf-explorer-panel input,.sf-explorer-panel select{width:100%;font-weight:400;font-size:14px}
.sf-explorer-panel input::placeholder{color:#6a7f8e}
.sf-explorer-results{display:flex;flex-direction:column;gap:5px;max-height:255px;overflow:auto;padding:3px;margin:-3px;overscroll-behavior:contain}
.sf-explorer-results button{text-align:left;flex-shrink:0}
.sf-explorer-count,.sf-explorer-note{font-size:12px;color:#586f80}
.sf-explorer-detail{grid-area:detail;border-top:1px solid #dce5eb;border-right:1px solid #dce5eb;padding:18px;overflow-wrap:anywhere;align-self:stretch;background:#fafcfd}
.sf-explorer-detail details{font-size:12px;margin-top:12px}
.sf-explorer-detail summary{cursor:pointer;color:#496578;min-height:32px}
.sf-explorer-detail details p{margin-top:8px}
.sf-explorer-detail h3{margin:0 0 7px;font-size:18px;line-height:1.3;letter-spacing:-.2px}
.sf-explorer-detail p{font-size:12px;margin-bottom:10px}
.sf-explorer-download{display:block;margin:8px 0;color:#12649c;text-underline-offset:3px}
@container sf-neighborhood-explorer (max-width:650px){
.sf-explorer-body{grid-template-columns:1fr;grid-template-areas:"panel" "map" "detail";grid-template-rows:auto auto auto}
.sf-explorer-header{padding:18px}
.sf-explorer-header h2{font-size:23px}
.sf-explorer-header p{font-size:13px}
.sf-explorer-panel{border-right:0;border-bottom:1px solid #dce5eb;padding:14px;gap:10px}
.sf-explorer-results{max-height:140px}
.sf-explorer-detail{padding:14px;border-right:0}
.sf-explorer-download{display:inline-block;margin:4px 14px 4px 0}
}`;
  root.append(style);
  header.append(
    element('h2', strings.title ?? 'Explore San Francisco'),
    element('p', 'Explore the city, from familiar names to the places in between.'),
  );
  const modeLabel = element('label', strings.mode ?? 'Map mode');
  for (const [value, title] of [
    ['neighborhoods', 'Neighborhoods'],
    ['districts', 'Districts'],
    ['basemap', 'Basemap'],
  ] as const) {
    if (value === 'districts' && !hasDistricts) continue;
    if (value === 'neighborhoods' && !sources.length) continue;
    const option = element('option', title);
    option.value = value;
    modeSelect.append(option);
  }
  modeLabel.append(modeSelect);
  sourceLabel.textContent = strings.source ?? 'Neighborhood definitions';
  for (const value of sources) {
    const title = sourceNames[value];
    const option = element('option', title);
    option.value = value;
    sourceSelect.append(option);
  }
  sourceSelect.value = source;
  sourceLabel.append(sourceSelect);
  searchLabel.textContent = strings.search ?? 'Find a neighborhood';
  search.type = 'search';
  search.placeholder = 'Try Mission, Outer Mission, or NoPa';
  search.autocomplete = 'off';
  searchLabel.append(search);
  count.setAttribute('aria-live', 'polite');
  results.setAttribute('aria-label', 'Matching neighborhoods');
  results.setAttribute('role', 'group');
  panel.append(modeLabel, sourceLabel, searchLabel, count, results);
  return shell;
}
