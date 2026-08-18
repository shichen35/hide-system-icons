import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { HiddenIndicator } from '../hiddenIndicator.js';
import { FakeHideable } from './fakes/fakeHideable.js';

describe('HiddenIndicator', () => {
  test('hide() records the current visibility then hides the indicator', () => {
    const fake = new FakeHideable(true);
    const hi = new HiddenIndicator(fake);

    hi.hide();

    assert.equal(fake.visible, false);
  });

  test('hide() called twice connects the notify handler only once, and an intervening external show is still captured by that one handler', () => {
    const fake = new FakeHideable(true);
    const hi = new HiddenIndicator(fake);

    hi.hide();
    fake.visible = true;
    hi.hide();

    assert.equal(fake.connectCallCount, 1);

    hi.restore();
    assert.equal(fake.visible, true);
  });

  test('the shell re-showing the indicator after hide() re-hides it without infinite recursion', () => {
    const fake = new FakeHideable(true);
    const hi = new HiddenIndicator(fake);

    hi.hide();
    const hideCallsBeforeExternalShow = fake.hideCallCount;

    fake.visible = true;

    assert.equal(fake.hideCallCount, hideCallsBeforeExternalShow + 1);
    assert.equal(fake.visible, false);
  });

  test('restore() after an external show shows the indicator and disconnects the handler', () => {
    const fake = new FakeHideable(true);
    const hi = new HiddenIndicator(fake);

    hi.hide();
    fake.visible = true;

    hi.restore();

    assert.equal(fake.visible, true);
    assert.equal(fake.disconnectCallCount, 1);
  });

  test('restore() without a prior hide() is a genuine no-op', () => {
    const fake = new FakeHideable(true);
    const hi = new HiddenIndicator(fake);

    hi.restore();

    assert.equal(fake.hideCallCount, 0);
    assert.equal(fake.showCallCount, 0);
    assert.equal(fake.disconnectCallCount, 0);
  });

  test('dispose() restores then clears state so a later hide() re-records visibility like a fresh wrapper', () => {
    const fake = new FakeHideable(true);
    const hi = new HiddenIndicator(fake);

    hi.hide();
    hi.dispose();
    assert.equal(fake.visible, true);

    fake.visible = false;
    hi.hide();
    assert.equal(fake.visible, false);

    hi.restore();
    assert.equal(fake.visible, false);
  });

  test('wraps() identifies only the exact object that was wrapped', () => {
    const fake = new FakeHideable(true);
    const other = new FakeHideable(true);
    const hi = new HiddenIndicator(fake);

    assert.equal(hi.wraps(fake), true);
    assert.equal(hi.wraps(other), false);
  });
});
