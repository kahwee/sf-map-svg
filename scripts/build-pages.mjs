import { cp, mkdir } from 'node:fs/promises';
import { build } from 'vite';

await build({
  configFile: false,
  root: 'website',
  base: './',
  build: {
    outDir: '../pages-dist',
    emptyOutDir: true,
    rollupOptions: { input: ['website/index.html', 'website/transit.html'] },
  },
});
await mkdir('pages-dist/maps', { recursive: true });
for (const name of ['districts', 'transit', 'neighborhoods']) {
  await cp(`examples/generated/${name}.svg`, `pages-dist/maps/${name}.svg`);
}
