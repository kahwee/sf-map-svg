#!/usr/bin/env node
// Reduces an official Election Summary Report XML to per-contest option totals, a few kilobytes
// that the precinct reconciliation test uses instead of the full report.
//
//   node scripts/data/extract-summary-totals.mjs "summary (4).xml" test/fixtures/sfelections/summary-report-4.json
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: extract-summary-totals.mjs <report.xml> <out.json>');
const xml = fs.readFileSync(input, 'utf8');
const name = (text) => text.replaceAll('&quot;', '"').trim();
const contests = {};
for (const block of xml.split('<ContestIdGroup contestId="').slice(1)) {
  const id = name(block.slice(0, block.indexOf('"')));
  contests[id] = Object.fromEntries(
    [
      ...block.matchAll(
        /candidateNameTextBox4="([^"]*)"[^>]*>(?:(?!<candidateNameTextBox4).)*?vot8="(\d+)"/gs,
      ),
    ].map((m) => [name(m[1]).toUpperCase(), Number(m[2])]),
  );
}
const reported = /Precincts Reported: (\d+) of (\d+)/.exec(xml);
const report = /Summary Report - (\d+)/.exec(xml);
fs.writeFileSync(
  output,
  `${JSON.stringify({
    source: 'San Francisco Department of Elections Election Summary Report',
    report: Number(report[1]),
    fileName: path.basename(input),
    sha256: createHash('sha256').update(xml).digest('hex'),
    precinctsReported: Number(reported[1]),
    precincts: Number(reported[2]),
    contests,
  })}\n`,
);
console.log(`${output}: ${Object.keys(contests).length} contests`);
