import assert from 'node:assert/strict';
import test from 'node:test';
import { needsElectionDeployment } from '../../scripts/data/election/changes.mjs';

const now = Date.parse('2026-11-05T12:00:00Z');
const previous = {
  checkedAt: '2026-11-05T11:00:00Z',
  status: 'unofficial',
  contests: [{ resultCheckedAt: '2026-11-05T11:00:00Z', votes: 100 }],
};
test('poll timestamps alone do not redeploy; results and source failures do', () => {
  const next = structuredClone(previous);
  next.checkedAt = new Date(now).toISOString();
  next.contests[0].resultCheckedAt = next.checkedAt;
  next.contests[0].resultsFetchedAt = next.checkedAt;
  next.generatedAt = next.checkedAt;
  next.buildCommit = 'new';
  assert.equal(needsElectionDeployment(previous, next, now), false);
  next.contests[0].votes++;
  assert.equal(needsElectionDeployment(previous, next, now), true);
  assert.equal(needsElectionDeployment(previous, { ...previous, checkStatus: 'error' }, now), true);
});
test('publish a daily freshness update and recover missing check timestamps', () => {
  assert.equal(needsElectionDeployment(previous, previous, now + 24 * 60 * 60 * 1000), true);
  assert.equal(needsElectionDeployment({ ...previous, checkedAt: null }, previous, now), true);
});
