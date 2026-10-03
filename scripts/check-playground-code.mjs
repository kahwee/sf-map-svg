import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { initialState, playgroundCode, setMode } from '../website/playground-model.ts';

/** Compile the exact copyable examples against the package this build actually uses. */
export async function checkPlaygroundCode(packageRoot, capabilities) {
  const temporary = await mkdtemp(join(tmpdir(), 'sf-playground-code-'));
  try {
    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
    const files = [];
    for (const render of ['interactive', 'static'])
      for (const source of ['realtor', 'sf-find', 'analysis'])
        for (const language of ['javascript', 'typescript']) {
          const state = initialState();
          Object.assign(state, { render, source, pins: true, route: true });
          setMode(state, 'neighborhoods');
          const code = playgroundCode(state, capabilities, language).replace(
            /'(@kahwee\/sf-map-svg(?:\/data(?:\/full|\/static)?)?)'/g,
            (_match, name) => {
              const entry = name.replace('@kahwee/sf-map-svg', '.') || '.';
              return JSON.stringify(join(packageRoot, manifest.exports[entry].import));
            },
          );
          const file = join(
            temporary,
            `${render}-${source}.${language === 'typescript' ? 'mts' : 'mjs'}`,
          );
          await writeFile(file, code);
          files.push(file);
        }
    execFileSync(
      resolve('node_modules/.bin/tsc'),
      [
        '--ignoreConfig',
        '--noEmit',
        '--strict',
        '--allowJs',
        '--checkJs',
        '--exactOptionalPropertyTypes',
        '--noUncheckedIndexedAccess',
        '--module',
        'nodenext',
        '--target',
        'es2023',
        ...files,
      ],
      { stdio: 'inherit' },
    );
    console.log(
      `Playground's ${files.length} generated JavaScript/TypeScript examples compile against ${manifest.version}.`,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
