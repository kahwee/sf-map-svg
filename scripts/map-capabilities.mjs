import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function getMapCapabilities(packageRoot) {
  const types = await readFile(join(packageRoot, 'dist/src/types.d.ts'), 'utf8');
  return Object.fromEntries(
    ['animation', 'layerTransitions', 'districtMorph'].map((key) => [
      key,
      new RegExp(`\\b${key}\\?\\s*:`).test(types),
    ]),
  );
}
