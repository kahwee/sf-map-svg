export const escapeXml = (value: unknown) =>
  String(value)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: XML 1.0 forbids these control characters.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(
      /[&<>"']/g,
      (char) =>
        (
          ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as Record<
            string,
            string
          >
        )[char] ?? char,
    );
export const number = (value: number) => Number(value.toFixed(2));
export const stroke = (color: string, weight: number) =>
  `fill="none" stroke="${escapeXml(color)}" stroke-width="${weight}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"`;
export const overlayLabel =
  'font-family="system-ui,sans-serif" font-size="12" font-weight="600" stroke="#f8faf4" stroke-width="3" stroke-linejoin="round" paint-order="stroke"';
