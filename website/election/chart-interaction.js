// TanStack renders the marks; native popovers expose only recorded observations.
export function attachPointPopover(svg, series, points, { share, scope }) {
  svg.setAttribute('role', 'group');
  const popover = document.createElement('div');
  popover.className = 'chart-point-popover';
  popover.setAttribute('popover', 'auto');
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Recorded observation');
  const format = (value) => (share ? `${value.toFixed(1)}%` : value.toLocaleString('en-US'));
  const observedTime = (value) =>
    new Date(value).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      timeZoneName: 'short',
    });
  svg.querySelectorAll('circle').forEach((dot, index) => {
    const s = series[Math.floor(index / points.length)];
    const observation = index % points.length;
    const point = points[observation];
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const size = 28;
    for (const [name, value] of Object.entries({
      x: Number(dot.getAttribute('cx')) - size / 2,
      y: Number(dot.getAttribute('cy')) - size / 2,
      width: size,
      height: size,
      rx: size / 2,
      fill: 'transparent',
      tabindex: '0',
      role: 'button',
      'aria-haspopup': 'dialog',
      'aria-label': `${s.label}, ${format(s.values[observation])}, official report ${observation + 1}`,
      class: 'chart-point-target',
    }))
      hit.setAttribute(name, String(value));
    const open = () => {
      if (popover.matches(':popover-open')) popover.hidePopover();
      const title = document.createElement('strong');
      title.textContent = `${s.label}: ${format(s.values[observation])}${share ? ' of reported votes' : ' reported votes'}`;
      const context = document.createElement('p');
      context.textContent = `${scope} · Official report ${observation + 1}`;
      const link = document.createElement('a');
      link.href = point.resultSourceUrl;
      link.textContent = point.sourceReportTime;
      const observed = document.createElement('p');
      observed.textContent = `Observed ${observedTime(point.observedAt)}`;
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = 'Close';
      close.addEventListener('click', () => {
        popover.hidePopover();
        hit.focus();
      });
      popover.replaceChildren(title, context, link, observed, close);
      popover.showPopover();
      const anchor = hit.getBoundingClientRect();
      const box = popover.getBoundingClientRect();
      popover.style.left = `${Math.max(8, Math.min(document.documentElement.clientWidth - box.width - 8, anchor.left))}px`;
      popover.style.top = `${Math.max(8, Math.min(document.documentElement.clientHeight - box.height - 8, anchor.bottom + 6))}px`;
      close.focus({ preventScroll: true });
    };
    hit.addEventListener('click', open);
    hit.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
    // Static TanStack mark groups are hidden from assistive technology.
    // Expose this group now that it contains labeled interactive controls.
    dot.parentNode.removeAttribute('aria-hidden');
    dot.parentNode.append(hit);
  });
  // Native auto-popover supplies outside-click and Escape dismissal without
  // global listeners that could survive a contest switch or feed refresh.
  return popover;
}
