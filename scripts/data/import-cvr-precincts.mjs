#!/usr/bin/env node
// Aggregates an official San Francisco Dominion CVR export to per-precinct, per-contest
// first-choice counts. Ballot-level records are ingestion input only and are never written.
//
//   node scripts/data/import-cvr-precincts.mjs --zip CVR_Export_20261103231904.zip \
//     --report-time "11/3/2026 11:04:21 PM" --out-dir data/elections
//
// `--dir <extracted dir>` may replace `--zip`. Counts use the current record of each ballot
// card (`Modified` when adjudicated, otherwise `Original`); ranked-choice contests count a
// single rank-1 mark only (first-round counts).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);
const need = (name) => {
  if (!args[name]) throw new Error(`Missing --${name}`);
  return args[name];
};
const reportTime = need('report-time');
const outDir = need('out-dir');
const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/.exec(reportTime);
if (!match) throw new Error(`Report time must look like "11/3/2026 11:04:21 PM": ${reportTime}`);
const [month, day, year, hour12, minute, second, meridiem] = match.slice(1);
const hour = (Number(hour12) % 12) + (meridiem === 'PM' ? 12 : 0);
const two = (n) => String(n).padStart(2, '0');
// Local department clock, used only to name and order snapshots; never converted to UTC.
const reportStamp = `${year}-${two(month)}-${two(day)}-${two(hour)}${minute}${second}`;
const file = `precincts-${reportStamp}.json`;
const out = path.join(outDir, file);
let dir = args.dir;
let zipSha256 = null;
let cleanup = null;
if (!dir) {
  const zip = need('zip');
  zipSha256 = createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-cvr-'));
  cleanup = dir;
  execFileSync('unzip', ['-q', zip, '-d', dir]);
}

const read = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const contests = read('ContestManifest.json').List;
const candidates = new Map(read('CandidateManifest.json').List.map((c) => [c.Id, c]));
const portions = new Map(read('PrecinctPortionManifest.json').List.map((p) => [p.Id, p]));
const election = read('ElectionEventManifest.json').List[0];
const contestById = new Map(contests.map((c) => [c.Id, c]));
const contestIndex = new Map(contests.map((c, i) => [c.Id, i]));

// Option order per contest is the manifest order, so each precinct stores a plain count array.
const optionsByContest = new Map();
for (const candidate of candidates.values()) {
  if (!optionsByContest.has(candidate.ContestId)) optionsByContest.set(candidate.ContestId, []);
  if (!candidate.Disabled) optionsByContest.get(candidate.ContestId).push(candidate);
}
const optionIndex = new Map();
for (const list of optionsByContest.values())
  for (const [i, candidate] of list.entries()) optionIndex.set(candidate.Id, i);

const precincts = {};
const turnout = {};
let cards = 0;
for (const file of fs.readdirSync(dir).filter((f) => f.startsWith('CvrExport_'))) {
  for (const session of read(file).Sessions) {
    const record = session.Modified?.IsCurrent ? session.Modified : session.Original;
    if (!record?.IsCurrent)
      throw new Error(`No current record for ballot ${session.CastVoteRecordId}`);
    const precinct = portions.get(record.PrecinctPortionId)?.ExternalId;
    if (!precinct) throw new Error(`Unknown precinct portion ${record.PrecinctPortionId}`);
    const id = precinct.split('-')[0];
    cards++;
    turnout[id] = (turnout[id] ?? 0) + 1;
    for (const card of record.Cards)
      for (const contest of card.Contests) {
        const index = contestIndex.get(contest.Id);
        const options = optionsByContest.get(contest.Id) ?? [];
        precincts[id] ??= {};
        // Compact cell: [undervotes, overvotes, ...votes in the contest's option order].
        precincts[id][index] ??= [0, 0, ...options.map(() => 0)];
        const cell = precincts[id][index];
        cell[0] += contest.Undervotes;
        cell[1] += contest.Overvotes;
        const marks = contest.Marks.filter((m) => m.IsVote);
        if (contestById.get(contest.Id).NumOfRanks > 0) {
          // Ranked choice: only a single mark at rank 1 is a first-round vote; an overvote at
          // rank 1 counts for no candidate and a skipped rank 1 is not promoted.
          const top = marks.filter((m) => m.Rank === 1);
          if (top.length === 1) cell[2 + optionIndex.get(top[0].CandidateId)]++;
        } else for (const mark of marks) cell[2 + optionIndex.get(mark.CandidateId)]++;
      }
  }
}

const result = {
  schemaVersion: 2,
  electionDate: '2026-11-03',
  source: {
    name: 'San Francisco Department of Elections cast vote record export',
    exportFile: args.zip ? path.basename(args.zip) : null,
    exportSha256: zipSha256,
    electionName: election.Description,
    sourceReportTime: reportTime,
    reportStamp,
    note: 'Report time as supplied from the department; no timezone conversion applied.',
  },
  geography: {
    type: 'precinct',
    boundaryYear: 2022,
    boundaries: 'data/precincts-2022.json',
    precinctsInManifest: portions.size,
    precinctsWithBallots: Object.keys(turnout).length,
  },
  method:
    'Votes per precinct from the current ballot-card record; ranked-choice contests count a single rank-1 mark only. Ranked-choice contests are not tabulated here and no winners are inferred.',
  ballotCards: cards,
  contests: contests.map((c) => ({
    id: c.Description,
    externalId: c.ExternalId,
    type: c.Type,
    voteFor: c.VoteFor,
    ranks: c.NumOfRanks,
    options: (optionsByContest.get(c.Id) ?? []).map((o) => o.Description.trim()),
  })),
  precincts: Object.fromEntries(
    Object.entries(precincts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, byContest]) => [id, { cards: turnout[id], c: byContest }]),
  ),
};
fs.writeFileSync(out, `${JSON.stringify(result)}\n`);

// The index lists every retained report time; consumers use `latest`, which is the newest stamp.
const indexPath = path.join(outDir, 'precincts-index.json');
const index = fs.existsSync(indexPath)
  ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  : { schemaVersion: 1, electionDate: result.electionDate, latest: null, snapshots: [] };
index.snapshots = [
  ...index.snapshots.filter((s) => s.reportStamp !== reportStamp),
  {
    file,
    reportStamp,
    sourceReportTime: reportTime,
    ballotCards: cards,
    precinctsWithBallots: result.geography.precinctsWithBallots,
    exportSha256: zipSha256,
  },
].sort((a, b) => a.reportStamp.localeCompare(b.reportStamp));
index.latest = index.snapshots.at(-1).file;
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
if (cleanup) fs.rmSync(cleanup, { recursive: true, force: true });
console.log(
  `${out}: ${cards} ballot cards, ${result.geography.precinctsWithBallots} precincts with ballots`,
);
