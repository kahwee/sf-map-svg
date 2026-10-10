/** One tab stop for visible pins and clusters; bracket keys preserve arrow-key panning. */
export function createMarkerNavigation(svg: SVGSVGElement, signal: AbortSignal) {
  let nodes: SVGElement[] = [];
  let activeKey = '';
  let activeIndex = 0;
  const key = (node: SVGElement) =>
    node.dataset.markerId === undefined
      ? `cluster:${node.dataset.clusterIds}`
      : `marker:${node.dataset.markerId}`;
  function sync(next = nodes) {
    nodes = next.filter((node) => node.style.display !== 'none');
    const focused = nodes.find((node) => node === document.activeElement);
    const active =
      focused ??
      nodes.find((node) => key(node) === activeKey) ??
      nodes[Math.min(activeIndex, nodes.length - 1)];
    if (active) {
      activeKey = key(active);
      activeIndex = nodes.indexOf(active);
    }
    for (const node of next) node.setAttribute('tabindex', node === active ? '0' : '-1');
  }
  svg.addEventListener(
    'focusin',
    (event) => {
      if (nodes.includes(event.target as SVGElement)) sync();
    },
    { signal },
  );
  svg.addEventListener(
    'keydown',
    (event) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !nodes.includes(event.target as SVGElement)
      )
        return;
      if (event.key !== '[' && event.key !== ']') return;
      event.preventDefault();
      const index = nodes.indexOf(event.target as SVGElement);
      nodes[(index + (event.key === ']' ? 1 : nodes.length - 1)) % nodes.length]?.focus({
        preventScroll: true,
      });
    },
    { signal },
  );
  return {
    sync,
    recover() {
      nodes.find((node) => key(node) === activeKey)?.focus({ preventScroll: true });
    },
  };
}
