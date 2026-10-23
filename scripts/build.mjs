import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync('bun', ['--check', '--tsconfig-override=tsconfig.build.json'], {
  cwd: root,
  stdio: 'inherit',
});
rmSync(new URL('../dist/', import.meta.url), { recursive: true, force: true });
execFileSync(
  'bun',
  [
    '--bun',
    fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)),
    '--noCheck',
    '-p',
    'tsconfig.build.json',
  ],
  { cwd: root, stdio: 'inherit' },
);
copyFileSync(
  new URL('../data/README.md', import.meta.url),
  new URL('../dist/data/README.md', import.meta.url),
);
cpSync(
  new URL('../data/candidates/', import.meta.url),
  new URL('../dist/data/candidates/', import.meta.url),
  { recursive: true },
);
