import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const documents = [
  'README.md',
  'CONTRIBUTING.md',
  'website/README.md',
  'data/README.md',
  ...(await readdir(new URL('../docs/', import.meta.url)))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `docs/${name}`),
];
const headingIds = (markdown) =>
  new Set(
    [...markdown.matchAll(/^#{1,6} (.+)$/gm)].map(([, heading]) =>
      heading
        .replace(/<[^>]+>/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[`*_~]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replace(/\s+/g, '-'),
    ),
  );

const failures = [];
let checked = 0;
for (const document of documents) {
  const markdown = await readFile(join(root, document), 'utf8');
  for (const [, href] of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue;
    const [path, fragment] = href.split('#', 2);
    const target = resolve(dirname(join(root, document)), decodeURIComponent(path || '.'));
    const relative = `${document} → ${href}`;
    let info;
    try {
      info = await stat(target);
    } catch {
      failures.push(`${relative}: missing file`);
      continue;
    }
    if (fragment && info.isFile() && target.endsWith('.md')) {
      const targetMarkdown = await readFile(target, 'utf8');
      if (!headingIds(targetMarkdown).has(decodeURIComponent(fragment)))
        failures.push(`${relative}: missing heading`);
    }
    checked++;
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log(`Checked ${checked} local documentation links.`);
