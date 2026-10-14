import type { MapController } from './controller-types.js';
import type { MapMarker } from './types.js';
import { validateMarkers } from './validation.js';

export interface MapCardsOptions {
  markers: readonly MapMarker[];
  highlightColor?: string;
  /** Reveal selected cards with native scrolling, without moving keyboard focus. Default true. */
  scrollOnSelect?: boolean;
}

/** Connect consumer-owned [data-map-marker] cards and [data-map-select] buttons to a map. */
export function bindMapCards(map: MapController, root: HTMLElement, options: MapCardsOptions) {
  if (map.destroyed) throw new Error('Cannot bind cards to a destroyed map.');
  validateMarkers(options.markers);
  let markers = new Map(options.markers.map((marker) => [marker.id, { ...marker }]));
  let disposed = false;
  let hovered: HTMLElement | null = null;
  let focused: HTMLElement | null = null;
  let selecting = false;
  const document = root.ownerDocument;
  const ring = document.createElement('span');
  ring.dataset.mapCardHighlight = '';
  ring.setAttribute('aria-hidden', 'true');
  ring.style.cssText =
    'position:absolute;width:26px;height:26px;box-sizing:border-box;border:3px solid;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none';
  ring.style.borderColor = options.highlightColor ?? '#e4531b';
  ring.hidden = true;
  map.overlayElement.append(ring);
  const originals = new Map<Element, Map<string, string | null>>();
  function attribute(node: Element, key: string, value: string | null) {
    let saved = originals.get(node);
    if (!saved) {
      saved = new Map();
      originals.set(node, saved);
    }
    if (!saved.has(key)) saved.set(key, node.getAttribute(key));
    if (value === null) node.removeAttribute(key);
    else node.setAttribute(key, value);
  }
  const cardAt = (target: EventTarget | null) => {
    const card =
      target instanceof Element ? target.closest<HTMLElement>('[data-map-marker]') : null;
    return card && root.contains(card) ? card : null;
  };
  function highlight() {
    ring.hidden = true;
    if (disposed || map.destroyed || !map.overlayElement.getBoundingClientRect().width) return;
    const card = focused ?? hovered;
    const marker =
      card && root.contains(card) ? markers.get(card.dataset.mapMarker ?? '') : undefined;
    if (!marker) return;
    const point = map.projectToScreen(marker.lng, marker.lat);
    if (!point.visible) return;
    ring.style.left = `${point.x}px`;
    ring.style.top = `${point.y}px`;
    ring.hidden = false;
  }
  function selection(id: string | null, reveal: boolean) {
    for (const card of root.querySelectorAll<HTMLElement>('[data-map-marker]')) {
      const selected = id !== null && card.dataset.mapMarker === id;
      attribute(card, 'data-map-selected', selected ? '' : null);
      for (const button of card.querySelectorAll<HTMLButtonElement>('button[data-map-select]'))
        attribute(button, 'aria-pressed', String(selected));
      if (selected && reveal && !selecting && options.scrollOnSelect !== false)
        card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
  }
  const handlers: Record<string, EventListener> = {
    pointerover: (event) => {
      if ((event as PointerEvent).pointerType !== 'touch') {
        hovered = cardAt(event.target);
        highlight();
      }
    },
    pointerout: (event) => {
      hovered = cardAt((event as PointerEvent).relatedTarget);
      highlight();
    },
    focusin: (event) => {
      focused = cardAt(event.target);
      highlight();
    },
    focusout: (event) => {
      focused = cardAt((event as FocusEvent).relatedTarget);
      highlight();
    },
    click: (event) => {
      if (disposed || map.destroyed) return;
      const target =
        event.target instanceof Element ? event.target.closest('button[data-map-select]') : null;
      const card = cardAt(target);
      const id = card?.dataset.mapMarker;
      if (!target || !card || !id || !markers.has(id) || (target as HTMLButtonElement).disabled)
        return;
      selecting = true;
      try {
        map.selectMarker(id, { fit: false });
      } finally {
        selecting = false;
      }
    },
  };
  for (const [type, listener] of Object.entries(handlers)) root.addEventListener(type, listener);
  const unsubscribers = [
    map.on('markerchange', ({ id }) => selection(id, true)),
    map.on('viewportchange', highlight),
    map.on('mapresize', highlight),
  ];
  selection(map.getSelectedMarker()?.id ?? null, false);
  return {
    /** Call after map.setMarkers() when your place catalog changes. */
    setMarkers(next: readonly MapMarker[]) {
      if (disposed) return;
      validateMarkers(next);
      markers = new Map(next.map((marker) => [marker.id, { ...marker }]));
      if (!map.destroyed) selection(map.getSelectedMarker()?.id ?? null, false);
      highlight();
    },
    /** Remove owned listeners/decoration and restore card attributes. Call before map.destroy(). */
    destroy() {
      if (disposed) return;
      disposed = true;
      for (const [type, listener] of Object.entries(handlers))
        root.removeEventListener(type, listener);
      for (const unsubscribe of unsubscribers) unsubscribe();
      ring.remove();
      for (const [node, saved] of originals)
        for (const [key, value] of saved)
          if (value === null) node.removeAttribute(key);
          else node.setAttribute(key, value);
      originals.clear();
    },
  };
}
