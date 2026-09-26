import type { MapViewport } from './types.js';

/** DOM navigation owns no content, selection, history, or application controls. */
export function attachNavigation(
  svg: SVGSVGElement,
  getView: () => MapViewport,
  setView: (view: MapViewport) => void,
  signal: AbortSignal,
  onExit: () => void,
) {
  let engaged = false;
  let moved = false;
  let skipClick = false;
  const pointers = new Map<number, { x: number; y: number }>();
  let start: { points: { x: number; y: number }[]; view: MapViewport } | undefined;
  const listen = <K extends keyof GlobalEventHandlersEventMap>(
    target: SVGSVGElement | Window,
    type: K,
    handler: (event: GlobalEventHandlersEventMap[K]) => void,
    options: AddEventListenerOptions = {},
  ) => target.addEventListener(type, handler as EventListener, { ...options, signal });
  function rebase() {
    start = pointers.size ? { points: [...pointers.values()], view: getView() } : undefined;
  }
  function cancel() {
    for (const id of pointers.keys()) {
      if (svg.hasPointerCapture(id)) svg.releasePointerCapture(id);
    }
    pointers.clear();
    start = undefined;
    if (moved) skipClick = true;
    moved = false;
  }
  function zoom(factor: number) {
    const [x, y, size] = getView();
    const next = Math.max(800 / 12, Math.min(800, size / factor));
    setView([x + (size - next) / 2, y + (size - next) / 2, next]);
  }
  listen(svg, 'pointerdown', (event) => {
    if (event.button !== 0 || (event.pointerType === 'touch' && !engaged)) return;
    if (!pointers.size) {
      moved = false;
      skipClick = false;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    rebase();
  });
  listen(window, 'pointermove', (event) => {
    if (!pointers.has(event.pointerId) || !start) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.values()];
    const midpoint = (p: typeof points) =>
      p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0];
    const a = midpoint(start.points),
      b = midpoint(points);
    const distance = (p: typeof points) => Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
    const ratio =
      points.length > 1 && start.points.length > 1
        ? distance(points) / Math.max(1, distance(start.points))
        : 1;
    if (Math.hypot(b.x - a.x, b.y - a.y) > 4 || Math.abs(ratio - 1) > 0.02) moved = true;
    if (!moved) return;
    if (!svg.hasPointerCapture(event.pointerId)) svg.setPointerCapture(event.pointerId);
    const box = svg.getBoundingClientRect();
    if (!box.width) return;
    const [x, y, size] = start.view;
    const next = Math.max(800 / 12, Math.min(800, size / Math.max(0.01, ratio)));
    setView([
      x + ((a.x - box.left) * size) / box.width - ((b.x - box.left) * next) / box.width,
      y + ((a.y - box.top) * size) / box.width - ((b.y - box.top) * next) / box.width,
      next,
    ]);
  });
  const release = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (moved) skipClick = true;
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    rebase();
  };
  listen(window, 'pointerup', release);
  listen(window, 'pointercancel', (event) => {
    if (pointers.has(event.pointerId)) cancel();
  });
  listen(svg, 'lostpointercapture', (event) => {
    // Touch starts with implicit capture on the hit path. Its release during
    // transfer to the SVG must not cancel the newly captured gesture.
    if (event.target === svg) release(event);
  });
  listen(window, 'blur', cancel);
  listen(
    svg,
    'click',
    (event) => {
      if (skipClick && event.detail !== 0) {
        skipClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { capture: true },
  );
  listen(svg, 'keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const [x, y, size] = getView();
    const step = size / 8;
    switch (event.key) {
      case 'ArrowLeft':
        setView([x - step, y, size]);
        break;
      case 'ArrowRight':
        setView([x + step, y, size]);
        break;
      case 'ArrowUp':
        setView([x, y - step, size]);
        break;
      case 'ArrowDown':
        setView([x, y + step, size]);
        break;
      case '+':
      case '=':
        zoom(1.5);
        break;
      case '-':
        zoom(1 / 1.5);
        break;
      case 'Home':
        setView([0, 0, 800]);
        break;
      case 'Escape':
        onExit();
        break;
      default:
        return;
    }
    event.preventDefault();
  });
  listen(
    svg,
    'wheel',
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) / 300));
    },
    { passive: false },
  );
  signal.addEventListener('abort', cancel, { once: true });
  return {
    cancel,
    setTouchNavigation(value: boolean) {
      cancel();
      engaged = value;
    },
  };
}
