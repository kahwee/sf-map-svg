import assert from 'node:assert/strict';
import test from 'node:test';
import results from '../data/propositions/2024-11-05.json' with { type: 'json' };
import { yesShare } from '../website/measures-model.js';

test('certified California proposition districts reconcile to San Francisco totals', () => {
  assert.equal(results.electionDate, '2024-11-05');
  assert.equal(results.districtYear, 2022);
  assert.deepEqual(
    results.propositions.map((item) => item.number),
    [2, 3, 4, 5, 6, 32, 33, 34, 35, 36],
  );
  for (const proposition of results.propositions) {
    assert.deepEqual(
      proposition.districts.map((row) => row.district),
      Array.from({ length: 11 }, (_, index) => index + 1),
    );
    for (const vote of ['yes', 'no']) {
      assert(
        proposition.districts.every((row) => Number.isSafeInteger(row[vote]) && row[vote] >= 0),
      );
      assert.equal(
        proposition.districts.reduce((total, row) => total + row[vote], 0),
        proposition.citywide[vote],
        `Proposition ${proposition.number} ${vote} total`,
      );
    }
    assert(yesShare(proposition.citywide) > 0 && yesShare(proposition.citywide) < 1);
  }
});
