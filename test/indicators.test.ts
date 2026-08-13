import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { INDICATORS, IndicatorKind } from '../indicators.js';

const ALL_KINDS: IndicatorKind[] = ['microphone', 'volume', 'bluetooth', 'network', 'power', 'powerProfiles'];

describe('INDICATORS', () => {
  test('has exactly one row per catalog entry', () => {
    assert.equal(INDICATORS.length, 6);
  });

  test('kind values are exactly the six IndicatorKind variants with no duplicates', () => {
    const kinds = INDICATORS.map(row => row.kind);
    assert.equal(new Set(kinds).size, kinds.length);
    assert.deepEqual([...kinds].sort(), [...ALL_KINDS].sort());
  });

  test('required is true for exactly volume and power', () => {
    const requiredKinds = INDICATORS.filter(row => row.required).map(row => row.kind).sort();
    assert.deepEqual(requiredKinds, ['power', 'volume']);
  });

  test('since is 45 for every row', () => {
    for (const row of INDICATORS) {
      assert.equal(row.since, 45);
    }
  });

  test('every settingKey is unique', () => {
    const settingKeys = INDICATORS.map(row => row.settingKey);
    assert.equal(new Set(settingKeys).size, settingKeys.length);
  });
});
