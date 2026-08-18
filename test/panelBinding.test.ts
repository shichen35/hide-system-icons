import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PanelBinding } from '../panelBinding.js';
import { INDICATORS } from '../indicators.js';
import { FakeHideable } from './fakes/fakeHideable.js';
import { FakeContainer } from './fakes/fakeContainer.js';
import { FakeSettingsReader } from './fakes/fakeSettingsReader.js';
import { makePanel } from './fakes/panel.js';

const volumeRow = INDICATORS.find(row => row.kind === 'volume')!;
const powerRow = INDICATORS.find(row => row.kind === 'power')!;

describe('PanelBinding', () => {
  test('refresh() wraps a raw indicator present at a catalog field', () => {
    const panel = makePanel({
      [volumeRow.qsField]: new FakeHideable(true),
      [powerRow.qsField]: new FakeHideable(true),
    });
    const binding = new PanelBinding(panel);

    assert.equal(binding.isReady(), false);
    binding.refresh();
    assert.equal(binding.isReady(), true);
  });

  test('refresh() keeps the same wrapper when the raw object reference is unchanged', () => {
    const volume = new FakeHideable(true);
    const power = new FakeHideable(true);
    const panel = makePanel({ [volumeRow.qsField]: volume, [powerRow.qsField]: power });
    const binding = new PanelBinding(panel);
    const settings = new FakeSettingsReader({ [volumeRow.settingKey]: true });

    binding.sync(settings);
    assert.equal(volume.visible, false);
    const connectCountAfterSync = volume.connectCallCount;

    binding.refresh();

    assert.equal(volume.disconnectCallCount, 0);
    assert.equal(volume.connectCallCount, connectCountAfterSync);
    assert.equal(volume.visible, false);
  });

  test('refresh() disposes the old wrapper and creates a new one when the raw object changes', () => {
    const volumeA = new FakeHideable(true);
    const volumeB = new FakeHideable(true);
    const power = new FakeHideable(true);
    const panel = makePanel({ [volumeRow.qsField]: volumeA, [powerRow.qsField]: power });
    const binding = new PanelBinding(panel);
    const settings = new FakeSettingsReader({ [volumeRow.settingKey]: true });

    binding.sync(settings);
    assert.equal(volumeA.visible, false);

    panel[volumeRow.qsField] = volumeB;
    binding.refresh();

    assert.equal(volumeA.visible, true);
    assert.equal(volumeA.disconnectCallCount, 1);
    assert.equal(volumeB.connectCallCount, 0);
  });

  test('refresh() attaches the rebuild watch when the container changes and detaches the old one', () => {
    const containerA = new FakeContainer();
    const containerB = new FakeContainer();
    const panel = makePanel({ _indicators: containerA });
    const binding = new PanelBinding(panel);

    binding.refresh();
    assert.equal(containerA.connectCallCount, 1);

    binding.refresh();
    assert.equal(containerA.connectCallCount, 1);
    assert.equal(containerA.disconnectCallCount, 0);

    panel._indicators = containerB;
    binding.refresh();

    assert.equal(containerA.disconnectCallCount, 1);
    assert.equal(containerB.connectCallCount, 1);
  });

  test('isReady() is true only when every required catalog row is resolved', () => {
    const requiredFields = INDICATORS.filter(row => row.required).map(row => row.qsField);
    const optionalFields = INDICATORS.filter(row => !row.required).map(row => row.qsField);

    const readyPanel = makePanel();
    for (const field of requiredFields) readyPanel[field] = new FakeHideable(true);
    const readyBinding = new PanelBinding(readyPanel);
    readyBinding.refresh();
    assert.equal(readyBinding.isReady(), true);

    const notReadyPanel = makePanel();
    for (const field of optionalFields) notReadyPanel[field] = new FakeHideable(true);
    const notReadyBinding = new PanelBinding(notReadyPanel);
    notReadyBinding.refresh();
    assert.equal(notReadyBinding.isReady(), false);
  });

  test('matches() compares panel identity only', () => {
    const panelA = makePanel();
    const panelB = makePanel();
    const binding = new PanelBinding(panelA);

    assert.equal(binding.matches(panelA), true);
    assert.equal(binding.matches(panelB), false);
  });

  test('sync() applies hide or restore per setting for every catalog row', () => {
    const raws = new Map<string, FakeHideable>();
    const panel = makePanel();
    for (const row of INDICATORS) {
      const fake = new FakeHideable(true);
      raws.set(row.kind, fake);
      panel[row.qsField] = fake;
    }
    const binding = new PanelBinding(panel);

    const values: Record<string, boolean> = {};
    INDICATORS.forEach((row, i) => { values[row.settingKey] = i % 2 === 0; });
    const settings = new FakeSettingsReader(values);

    binding.sync(settings);

    for (const row of INDICATORS) {
      const expectedHidden = values[row.settingKey];
      assert.equal(raws.get(row.kind)!.visible, !expectedHidden);
    }
  });

  test('dispose() detaches the rebuild watch and disposes every indicator; a later sync() does not throw', () => {
    const container = new FakeContainer();
    const volume = new FakeHideable(true);
    const power = new FakeHideable(true);
    const panel = makePanel({
      _indicators: container,
      [volumeRow.qsField]: volume,
      [powerRow.qsField]: power,
    });
    const binding = new PanelBinding(panel);
    const settings = new FakeSettingsReader({ [volumeRow.settingKey]: true });

    binding.sync(settings);
    assert.equal(volume.visible, false);

    binding.dispose();

    assert.equal(container.disconnectCallCount, 1);
    assert.equal(volume.visible, true);

    assert.doesNotThrow(() => binding.sync(settings));
  });
});
