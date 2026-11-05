import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

export async function servePages(root, base) {
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.webm': 'video/webm',
    '.vtt': 'text/vtt',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
  };

  // ---------- Static server under the production base path ----------
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    let path = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : null;
    if (path === '') path = 'index.html';
    const file = path === null ? null : normalize(join(root, decodeURIComponent(path)));
    const found = file?.startsWith(root) && (await stat(file).catch(() => null))?.isFile();
    if (!found) {
      response.writeHead(404, { 'content-type': 'text/html' });
      createReadStream(join(root, '404.html')).pipe(response);
      return;
    }
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
