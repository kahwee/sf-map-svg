export const escape = (value) =>
  String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(
      /[&<>"']/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
    );
export const number = (value) => Number(value.toFixed(2));
export const stroke = (color, weight) =>
  `fill="none" stroke="${escape(color)}" stroke-width="${weight}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"`;
export const overlayLabel =
  'font-family="system-ui,sans-serif" font-size="12" font-weight="600" stroke="#f8faf4" stroke-width="3" stroke-linejoin="round" paint-order="stroke"';
