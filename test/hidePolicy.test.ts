import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { HidePolicy } from '../hidePolicy.js';
import { INDICATORS } from '../indicators.js';
import { FakeHideable } from './fakes/fakeHideable.js';
import { FakeSettingsReader } from './fakes/fakeSettingsReader.js';
import { FakeShellPort } from './fakes/fakeShellPort.js';
import { makePanel } from './fakes/panel.js';

const volumeRow = INDICATORS.find(row => row.kind === 'volume')!;
const powerRow = INDICATORS.find(row => row.kind === 'power')!;

function readyPanel(): ReturnType<typeof makePanel> {
  return makePanel({
    [volumeRow.qsField]: new FakeHideable(true),
    [powerRow.qsField]: new FakeHideable(true),
  });
}

describe('HidePolicy', () => {
  test('start() watches settings and begins the retry loop exactly once', () => {
    const settings = new FakeSettingsReader({});
    const port = new FakeShellPort(settings, [makePanel()]);
    const policy = new HidePolicy(port);

    policy.start();

    assert.equal(port.watchSettingsCallCount, 1);
    assert.equal(port.idleCallCount, 1);
  });

  test('progressive readiness: retries while required fields are missing, then syncs and stops on the tick they resolve', () => {
    const panel = makePanel();
    const settings = new FakeSettingsReader({ [volumeRow.settingKey]: true });
    const port = new FakeShellPort(settings, [panel]);
    const policy = new HidePolicy(port);

    policy.start();
    assert.equal(port.idleCallCount, 1);

    assert.equal(port.driveTick(), true);
    assert.equal(port.driveTick(), true);

    const volumeIndicator = new FakeHideable(true);
    panel[volumeRow.qsField] = volumeIndicator;
    assert.equal(port.driveTick(), true);

    const powerIndicator = new FakeHideable(true);
    panel[powerRow.qsField] = powerIndicator;
    assert.equal(port.driveTick(), false);

    assert.equal(port.watchPanelsCallCount, 1);
    assert.equal(volumeIndicator.visible, false);
    assert.equal(powerIndicator.visible, true);
  });

  test('full non-readiness: the retry loop caps at 50 ticks and still syncs whatever resolved', () => {
    const panel = makePanel();
    const settings = new FakeSettingsReader({});
    const port = new FakeShellPort(settings, [panel]);
    const policy = new HidePolicy(port);

    policy.start();

    const results: boolean[] = [];
    for (let i = 0; i < 50; i++) results.push(port.driveTick());

    assert.deepEqual(results.slice(0, 49), new Array(49).fill(true));
    assert.equal(results[49], false);
    assert.equal(port.watchPanelsCallCount, 1);
    assert.equal(port.settingsCallCount, 1);
  });

  test('the idlePending guard prevents scheduling a second retry loop while one is already in flight', () => {
    const panel = readyPanel();
    const settings = new FakeSettingsReader({});
    const port = new FakeShellPort(settings, [panel]);
    const policy = new HidePolicy(port);

    policy.start();
    assert.equal(port.idleCallCount, 1);
    assert.equal(port.driveTick(), false);
    assert.equal(port.watchPanelsCallCount, 1);

    port.firePanelsChanged();
    assert.equal(port.idleCallCount, 2);

    port.firePanelsChanged();
    assert.equal(port.idleCallCount, 2);
  });

  test('a panel disappearing from panels() disposes its binding while retaining the others', () => {
    const panelA = readyPanel();
    const panelB = readyPanel();
    const settings = new FakeSettingsReader({ [volumeRow.settingKey]: true });
    const port = new FakeShellPort(settings, [panelA, panelB]);
    const policy = new HidePolicy(port);

    policy.start();
    assert.equal(port.driveTick(), false);

    const panelAVolume = panelA[volumeRow.qsField] as FakeHideable;
    const panelBVolume = panelB[volumeRow.qsField] as FakeHideable;
    assert.equal(panelAVolume.visible, false);
    assert.equal(panelBVolume.visible, false);

    port.setPanels([panelB]);
    port.firePanelsChanged();

    assert.equal(port.idleCallCount, 2);
    assert.equal(panelAVolume.visible, true);
    assert.equal(panelAVolume.disconnectCallCount, 1);

    assert.equal(port.driveTick(), false);

    assert.equal(panelBVolume.disconnectCallCount, 0);
    assert.equal(panelBVolume.visible, false);
  });

  test('stop() cancels the idle loop, unwatches, and disposes bindings; a fresh start() begins cleanly', () => {
    const panel = readyPanel();
    const settings = new FakeSettingsReader({ [volumeRow.settingKey]: true });
    const port = new FakeShellPort(settings, [panel]);
    const policy = new HidePolicy(port);

    policy.start();
    assert.equal(port.driveTick(), false);
    const volumeIndicator = panel[volumeRow.qsField] as FakeHideable;
    assert.equal(volumeIndicator.visible, false);

    policy.stop();

    assert.equal(port.cancelIdleCallCount, 1);
    assert.equal(port.unwatchCallCount, 1);
    assert.equal(volumeIndicator.visible, true);
    assert.equal(port.hasPendingTick(), false);

    policy.start();

    assert.equal(port.idleCallCount, 2);
    assert.equal(port.watchSettingsCallCount, 2);
    assert.equal(port.driveTick(), false);
    assert.equal(volumeIndicator.visible, false);
  });

  test('a settings change re-applies hide/restore to existing bindings without rediscovering panels', () => {
    const panel = readyPanel();
    const settings = new FakeSettingsReader({ [volumeRow.settingKey]: false });
    const port = new FakeShellPort(settings, [panel]);
    const policy = new HidePolicy(port);

    policy.start();
    assert.equal(port.driveTick(), false);

    const volumeIndicator = panel[volumeRow.qsField] as FakeHideable;
    assert.equal(volumeIndicator.visible, true);

    const panelsCallCountBefore = port.panelsCallCount;

    settings.set(volumeRow.settingKey, true);
    port.fireSettingsChanged();

    assert.equal(port.panelsCallCount, panelsCallCountBefore);
    assert.equal(volumeIndicator.visible, false);
  });

  test('a settings change retries watchPanels() so a Dash to Panel that appears late is not lost for the session', () => {
    const panel = readyPanel();
    const settings = new FakeSettingsReader({});
    const port = new FakeShellPort(settings, [panel]);
    port.setPanelsAvailable(false);
    const policy = new HidePolicy(port);

    policy.start();
    assert.equal(port.driveTick(), false);

    assert.equal(port.watchPanelsCallCount, 1);
    assert.throws(() => port.firePanelsChanged());

    port.setPanelsAvailable(true);
    port.fireSettingsChanged();

    assert.equal(port.watchPanelsCallCount, 2);
    assert.doesNotThrow(() => port.firePanelsChanged());
  });
});
