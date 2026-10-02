import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** Ask the type checker about supported keys, independent of declaration formatting. */
export async function getMapCapabilities(packageRoot) {
  const temporary = await mkdtemp(join(tmpdir(), 'sf-map-capabilities-'));
  const probes = {
    runtimeAppearance: "'appearance' extends keyof MapConfiguration",
    staticPresentation: "'layers' extends keyof SFMapOptions",
    animation: "'animation' extends keyof SFMapOptions",
    layerTransitions: "'layerTransitions' extends keyof MapFeatures",
    districtMorph: "'districtMorph' extends keyof MapFeatures",
  };
  try {
    const imports = `import type { MapConfiguration } from ${JSON.stringify(join(packageRoot, 'dist/src/controller-types.js'))};\nimport type { SFMapOptions, MapFeatures } from ${JSON.stringify(join(packageRoot, 'dist/src/types.js'))};\n`;
    const file = join(temporary, 'capabilities.mts');
    const names = Object.keys(probes);
    await writeFile(
      file,
      imports +
        names.map((name) => `const ${name}: ${probes[name]} ? true : false = true;`).join('\n'),
    );
    const result = spawnSync(
      resolve('node_modules/.bin/tsc'),
      [
        '--ignoreConfig',
        '--noEmit',
        '--strict',
        '--module',
        'nodenext',
        '--target',
        'es2023',
        file,
      ],
      { encoding: 'utf8' },
    );
    if (result.error) throw result.error;
    const unsupported = new Set();
    for (const line of result.stdout.trim().split('\n').filter(Boolean)) {
      const match = line.match(
        /capabilities\.mts\((\d+),\d+\): error TS2322: Type 'true' is not assignable to type 'false'\./,
      );
      if (!match) throw new Error(`Could not inspect package capabilities: ${line}`);
      const name = names[Number(match[1]) - 3];
      if (!name) throw new Error('Unexpected capability diagnostic.');
      unsupported.add(name);
    }
    if (result.status !== 0 && !unsupported.size)
      throw new Error(result.stderr || 'Capability check failed.');
    return Object.fromEntries(names.map((name) => [name, !unsupported.has(name)]));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
