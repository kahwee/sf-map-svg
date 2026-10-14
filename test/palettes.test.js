import assert from 'node:assert/strict';
import test from 'node:test';
import { createGuideSVG } from '../dist/src/guide-static.js';
import { mapPalettes } from '../dist/src/presets.js';

function luminance(hex) {
  const channels = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return channels.reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
for (const [name, palette] of Object.entries(mapPalettes)) {
  test(`${name} shares immutable, legible tokens across static and interactive maps`, () => {
    assert.ok(Object.isFrozen(palette.colors));
    assert.ok(Object.isFrozen(palette));
    for (const surface of ['land', 'park', 'water']) {
      assert.ok(
        contrast(palette.colors.label, palette.colors[surface]) >= 4.5,
        `${surface} labels`,
      );
      assert.ok(contrast(palette.markerColor, palette.colors[surface]) >= 3, `${surface} markers`);
      assert.ok(
        contrast(palette.selectedMarkerRingColor, palette.colors[surface]) >= 3,
        `${surface} ring`,
      );
    }
    const svg = createGuideSVG({
      colors: palette.colors,
      labelLayout: { width: 800, haloColor: palette.haloColor },
    }).svg;
    assert.ok(svg.includes(`stroke="${palette.haloColor}"`));
    assert.ok(svg.includes(`fill="${palette.colors.water}"`));
  });
}
