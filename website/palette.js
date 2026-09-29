// Shared color scales for the site's maps. Pure functions: used in the browser and by
// scripts/build-pages.mjs when it pre-renders plates.

const hex = (value) => {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) =>
  `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
export const mix = (a, b, t) => {
  const [from, to] = [hex(a), hex(b)];
  return toHex(from.map((channel, i) => channel + (to[i] - channel) * Math.max(0, Math.min(1, t))));
};

/** Low to high on a paper-to-teal ramp. */
const ramp = ['#f3efe2', '#cfe0d6', '#8fbcb2', '#4d8f89', '#2d6a68', '#1c4847'];
export function sequential(t) {
  if (t === null || t === undefined || Number.isNaN(t)) return '#d8d3c6';
  const x = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  const index = Math.min(ramp.length - 2, Math.floor(x));
  return mix(ramp[index], ramp[index + 1], x - index);
}

/** Share of Yes, centered on a majority: vermilion for No, teal for Yes. */
const no = ['#f3efe2', '#e8c3b2', '#d18a6d', '#b4432a', '#7e2c1a'];
const yes = ['#f3efe2', '#c6ddd3', '#86b8ad', '#3f807b', '#1c4847'];
export function diverging(share, spread = 0.42) {
  if (share === null || share === undefined || Number.isNaN(share)) return '#d8d3c6';
  const t = Math.max(-1, Math.min(1, (share - 0.5) / spread));
  const scale = t < 0 ? no : yes;
  const x = Math.abs(t) * (scale.length - 1);
  const index = Math.min(scale.length - 2, Math.floor(x));
  return mix(scale[index], scale[index + 1], x - index);
}

/** Readable text color over a diverging fill. */
export const divergingInk = (share) =>
  share !== null && Math.abs(share - 0.5) > 0.2 ? '#f7f3e9' : '#1f2a28';

/** Distinct, muted inks for candidates, in ballot order of first appearance. */
export const candidateInks = [
  '#2d6a68',
  '#b4432a',
  '#5b5a9c',
  '#b7872b',
  '#4f7a3a',
  '#8f4d6b',
  '#4d7899',
  '#7a6a55',
];
