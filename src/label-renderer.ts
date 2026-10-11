import type { Bounds } from '../data/types.js';
import { setAttributeIfChanged } from './dom.js';
import { layoutLabels } from './explorer-layout.js';

export interface RenderLabel {
  point: [number, number];
  name: string;
  kind: string;
  fontSize: number;
  fontWeight: number;
  fill: string;
  halo: string;
  offset: number;
}

/** Reuse text nodes and screen-space metrics throughout a camera animation. */
export function createLabelRenderer(layer: SVGGElement) {
  const entries = new Map<string, { node: SVGTextElement; width?: number }>();
  return {
    invalidateMetrics() {
      for (const entry of entries.values()) entry.width = undefined;
    },
    clear() {
      entries.clear();
      layer.replaceChildren();
    },
    draw(labels: RenderLabel[], view: readonly number[], width: number, obstacles: Bounds[]) {
      const unit = view[2] / width;
      const keys = new Set<string>();
      const pending = labels
        .filter((label) => {
          const y = (label.point[1] - view[1]) / unit;
          // Labels are centered horizontally; an anchor outside vertically cannot fit.
          const margin = label.fontSize * 1.25 + label.offset + 3;
          return y >= -margin && y <= width + margin;
        })
        .map((label) => {
          const key = JSON.stringify([
            label.kind,
            label.name,
            label.point,
            label.fontSize,
            label.fontWeight,
          ]);
          keys.add(key);
          let entry = entries.get(key);
          if (!entry) {
            const node = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            node.textContent = label.name;
            node.setAttribute('stroke-linejoin', 'round');
            node.setAttribute('paint-order', 'stroke');
            node.setAttribute('data-label-kind', label.kind);
            entry = { node };
            entries.set(key, entry);
          }
          const { node } = entry;
          setAttributeIfChanged(node, 'font-size', label.fontSize * unit);
          setAttributeIfChanged(node, 'font-weight', label.fontWeight);
          setAttributeIfChanged(node, 'fill', label.fill);
          setAttributeIfChanged(node, 'stroke', label.halo);
          setAttributeIfChanged(node, 'stroke-width', 3 * unit);
          // Batch writes before measuring new labels. Hidden candidates stay detached.
          if (entry.width === undefined && !node.parentNode) layer.append(node);
          return { label, entry };
        });
      for (const [key, entry] of entries) {
        if (!keys.has(key)) {
          entry.node.remove();
          entries.delete(key);
        }
      }
      const measured = pending.map(({ label, entry }) => {
        entry.width ??= entry.node.getComputedTextLength() / unit;
        return {
          ...label,
          node: entry.node,
          x: (label.point[0] - view[0]) / unit,
          y: (label.point[1] - view[1]) / unit,
          textWidth: entry.width,
          textHeight: label.fontSize * 1.25,
        };
      });
      const placed = layoutLabels(measured, width, width, obstacles);
      const visible = new Set(placed.map(({ node }) => node));
      for (const { node } of measured) if (!visible.has(node)) node.remove();
      let previous: SVGTextElement | null = null;
      for (const item of placed) {
        setAttributeIfChanged(item.node, 'x', view[0] + item.left * unit);
        setAttributeIfChanged(item.node, 'y', view[1] + (item.top + item.fontSize) * unit);
        const next: ChildNode | null = previous ? previous.nextSibling : layer.firstChild;
        if (next !== item.node) layer.insertBefore(item.node, next);
        previous = item.node;
      }
      return placed.length;
    },
  };
}
