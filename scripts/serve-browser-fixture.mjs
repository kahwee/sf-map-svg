import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';

/** Tests and benchmarks use the same production bundle; never time the dev server. */
export async function startBrowserFixture(port = 4175) {
  const root = fileURLToPath(new URL('../browser', import.meta.url));
  const options = {
    configFile: false,
    root,
    logLevel: 'error',
    build: { outDir: resolve(root, '../test-results/browser-fixture'), emptyOutDir: true },
  };
  await build(options);
  const server = await preview({
    ...options,
    preview: { host: '127.0.0.1', port, strictPort: true },
  });
  const address = server.httpServer.address();
  return { server, url: `http://127.0.0.1:${address.port}` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server } = await startBrowserFixture();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      await server.close();
      process.exit(0);
    });
  }
}
