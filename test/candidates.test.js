import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../data/candidates/', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));

test('certified candidate snapshots reconcile city, district, and unassigned votes', async () => {
  const catalog = await read('catalog.json');
  assert.equal(catalog.elections.length, 6);
  let count = 0;
  for (const choice of catalog.elections) {
    const election = await read(choice.file);
    assert.equal(election.electionDate, choice.date);
    assert.equal(election.contests.length, choice.contestCount);
    assert.equal(election.districtYear, Number(choice.date.slice(0, 4)) <= 2020 ? 2012 : 2022);
    assert.match(election.sourceSha256, /^[a-f0-9]{64}$/);
    for (const contest of election.contests) {
      count++;
      assert.equal(contest.districts.length, 11);
      assert.deepEqual(
        contest.districts.map((row) => row.district),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      );
      assert.equal(contest.candidates.length, contest.citywide.votes.length);
      assert.equal(
        contest.citywide.votes.reduce((sum, value) => sum + value, 0),
        contest.citywide.totalVotes,
      );
      for (const row of contest.districts) {
        if (!row.eligible) continue;
        assert.equal(row.votes.length, contest.candidates.length);
        assert.equal(
          row.votes.reduce((sum, value) => sum + value, 0),
          row.totalVotes,
        );
      }
      for (const key of ['totalVotes', 'undervotes', 'overvotes'])
        assert.equal(
          contest.districts.reduce((sum, row) => sum + (row[key] ?? 0), 0) +
            contest.unassigned[key],
          contest.citywide[key],
        );
      for (let index = 0; index < contest.candidates.length; index++)
        assert.equal(
          contest.districts.reduce((sum, row) => sum + (row.votes?.[index] ?? 0), 0) +
            contest.unassigned.votes[index],
          contest.citywide.votes[index],
        );
    }
  }
  assert.equal(count, 56);
});
