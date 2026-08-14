import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, INDICATORS, IndicatorKind } from '../indicators.js';

const ALL_KINDS: IndicatorKind[] = [
  'microphone',
  'volume',
  'bluetooth',
  'network',
  'power',
  'powerProfiles',
  'camera',
  'location',
  'remoteAccess',
  'rfkill',
  'thunderbolt',
  'brightness',
  'backlight',
  'nightLight',
  'darkMode',
  'autoRotate',
  'doNotDisturb',
  'backgroundApps',
];

describe('INDICATORS', () => {
  test('has exactly one row per catalog entry', () => {
    assert.equal(INDICATORS.length, 18);
  });

  test('kind values are exactly the eighteen IndicatorKind variants with no duplicates', () => {
    const kinds = INDICATORS.map(row => row.kind);
    assert.equal(new Set(kinds).size, kinds.length);
    assert.deepEqual([...kinds].sort(), [...ALL_KINDS].sort());
  });

  test('required is true for exactly volume and power', () => {
    const requiredKinds = INDICATORS.filter(row => row.required).map(row => row.kind).sort();
    assert.deepEqual(requiredKinds, ['power', 'volume']);
  });

  test('since is 49 for doNotDisturb and 45 for every other row', () => {
    for (const row of INDICATORS) {
      assert.equal(row.since, row.kind === 'doNotDisturb' ? 49 : 45);
    }
  });

  test('every settingKey is unique', () => {
    const settingKeys = INDICATORS.map(row => row.settingKey);
    assert.equal(new Set(settingKeys).size, settingKeys.length);
  });

  test('every qsField is unique', () => {
    const qsFields = INDICATORS.map(row => row.qsField);
    assert.equal(new Set(qsFields).size, qsFields.length);
  });

  test('every row group is one of the GROUPS ids', () => {
    const groupIds = GROUPS.map(group => group.id);
    for (const row of INDICATORS) {
      assert.ok(groupIds.includes(row.group));
    }
  });

  test('GROUPS ids are unique', () => {
    const groupIds = GROUPS.map(group => group.id);
    assert.equal(new Set(groupIds).size, groupIds.length);
  });

  test('every group id is used by at least one row', () => {
    for (const group of GROUPS) {
      assert.ok(INDICATORS.some(row => row.group === group.id));
    }
  });

  test('rows are contiguous by group and groups appear in GROUPS order', () => {
    const seen = new Set<string>();
    const appearanceOrder: string[] = [];
    for (const row of INDICATORS) {
      if (appearanceOrder[appearanceOrder.length - 1] !== row.group) {
        assert.ok(!seen.has(row.group), `group ${row.group} is not contiguous`);
        seen.add(row.group);
        appearanceOrder.push(row.group);
      }
    }
    assert.deepEqual(appearanceOrder, GROUPS.map(group => group.id));
  });
});
