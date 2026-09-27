import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Keep GitHub release notes identical to the complete versioned changelog section. */
export function releaseNotes(changelog, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable release version');
  const sections = changelog.split(/(?=^## )/m);
  const matches = sections.filter((section) => section.startsWith(`## ${version} — `));
  if (matches.length !== 1)
    throw new Error(`Expected exactly one dated changelog section for ${version}`);
  const notes = matches[0].trim();
  if (!/^## \d+\.\d+\.\d+ — \d{4}-\d{2}-\d{2}\n/.test(notes) || !notes.includes('\n- '))
    throw new Error('Release changelog requires a date and substantive bullet entries');
  return `${notes}\n`;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  const notes = releaseNotes(readFileSync(new URL('CHANGELOG.md', root), 'utf8'), pkg.version);
  const [flag, file, ...extra] = process.argv.slice(2);
  if (flag === '--verify' && file && !extra.length) {
    if (!readFileSync(file, 'utf8').replaceAll('\r\n', '\n').includes(notes.trim()))
      throw new Error(
        'GitHub release notes must include the complete versioned changelog section. Generate them with pnpm release:notes.',
      );
  } else if (!flag) process.stdout.write(notes);
  else throw new Error('Usage: node scripts/release-notes.mjs [--verify notes.md]');
}
