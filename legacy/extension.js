/*
 * Legacy GNOME Shell extension entry point for GNOME 40–44.
 * Uses the legacy init/enable/disable API and supports both Aggregate Menu (40–42)
 * and Quick Settings (43–44) via runtime detection.
 */

/* globals imports */

const { Gio, GLib } = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

/**
 * Helper to safely hide/show depending on whether we have a Clutter actor or a
 * JS object with hide()/show() methods (QS indicators).
 */
function doHide(target) {
  if (!target) return;
  try {
    if (typeof target.hide === 'function') {
      target.hide();
    } else if (target.actor && typeof target.actor.hide === 'function') {
      target.actor.hide();
    }
  } catch (e) {
    log(`[hide-system-icons] hide failed: ${e}`);
  }
}

function doShow(target) {
  if (!target) return;
  try {
    if (typeof target.show === 'function') {
      target.show();
    } else if (target.actor && typeof target.actor.show === 'function') {
      target.actor.show();
    }
  } catch (e) {
    log(`[hide-system-icons] show failed: ${e}`);
  }
}

function connectVisibleNotify(target, callback) {
  // On QS indicators, connect on the object; on aggregate items, connect on actor
  try {
    if (target && typeof target.connect === 'function') {
      return target.connect('notify::visible', callback);
    }
    if (target && target.actor && typeof target.actor.connect === 'function') {
      return target.actor.connect('notify::visible', callback);
    }
  } catch (e) {
    log(`[hide-system-icons] connect failed: ${e}`);
  }
  return 0;
}

function disconnectSignal(target, id) {
  if (!id) return;
  try {
    if (target && typeof target.disconnect === 'function') {
      target.disconnect(id);
      return;
    }
    if (target && target.actor && typeof target.actor.disconnect === 'function') {
      target.actor.disconnect(id);
    }
  } catch (e) {
    log(`[hide-system-icons] disconnect failed: ${e}`);
  }
}

let settings = null;
let idleSource = 0;
let settingsSignalIds = [];

// Indicators (either QS items or AggregateMenu children)
let volumeIndicator = null;
let networkIndicator = null;
let powerIndicator = null;
let bluetoothIndicator = null;

// Signal IDs for re-hiding when external code toggles visibility
let sigVolume = 0;
let sigNetwork = 0;
let sigPower = 0;
let sigBluetooth = 0;

// Rebuild watchers (QS containers only)
let container = null;
let addedHandler = 0;
let removedHandler = 0;

function init() {}

function enable() {
  settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.hide-system-icons');
  settingsSignalIds = [];

  // React to settings changes
  settingsSignalIds.push(settings.connect('changed::hide-volume', updateVolume));
  settingsSignalIds.push(settings.connect('changed::hide-network', updateNetwork));
  settingsSignalIds.push(settings.connect('changed::hide-power', updatePower));
  settingsSignalIds.push(settings.connect('changed::hide-bluetooth', updateBluetooth));

  // Defer initial binding until the panel finishes building
  idleSource = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
    refreshIndicators();
    if (!volumeIndicator || !networkIndicator || !powerIndicator) {
      return GLib.SOURCE_CONTINUE;
    }

    // Apply initial state
    reapplyAll();

    // Watch for QS rebuilds on 43–44
    attachRebuildWatch();

    idleSource = 0;
    return GLib.SOURCE_REMOVE;
  });
}

function disable() {
  if (idleSource) {
    GLib.Source.remove(idleSource);
    idleSource = 0;
  }

  // Detach rebuild watchers if any
  detachRebuildWatch();

  // Show indicators back and disconnect signals
  cleanupIndicator('volume');
  cleanupIndicator('network');
  cleanupIndicator('power');
  cleanupIndicator('bluetooth');

  if (settings) {
    for (const id of settingsSignalIds) {
      try {
        settings.disconnect(id);
      } catch (e) {}
    }
  }
  settingsSignalIds = [];
  settings = null;
}

function isQuickSettingsAvailable() {
  return Main.panel && Main.panel.statusArea && Main.panel.statusArea.quickSettings;
}

function refreshIndicators() {
  if (isQuickSettingsAvailable()) {
    const qs = Main.panel.statusArea.quickSettings;
    // Private fields vary by release; guard all lookups and provide fallbacks
    let volumeCandidate = qs._volumeOutput ?? qs._volume ?? qs._volumeItem ?? null;
    let networkCandidate = qs._network ?? qs._networkItem ?? null;
    let powerCandidate = qs._system ?? qs._power ?? qs._powerItem ?? null;
    let bluetoothCandidate = qs._bluetooth ?? qs._bluetoothItem ?? null;

    // Fallback: scan properties by name if still missing
    const findByName = (obj, names) => {
      try {
        const keys = Object.keys(obj || {});
        const lowerNames = names.map(n => String(n).toLowerCase());
        for (const k of keys) {
          const kl = k.toLowerCase();
          if (lowerNames.some(n => kl.includes(n))) {
            const val = obj[k];
            if (val && (typeof val.hide === 'function' || (val.actor && typeof val.actor.hide === 'function')))
              return val;
          }
        }
      } catch (e) {}
      return null;
    };

    if (!volumeCandidate)
      volumeCandidate = findByName(qs, ['volume', 'audio', 'sound']);
    if (!networkCandidate)
      networkCandidate = findByName(qs, ['network', 'net', 'wifi', 'wireless']);
    if (!powerCandidate)
      powerCandidate = findByName(qs, ['power', 'system', 'battery']);
    if (!bluetoothCandidate)
      bluetoothCandidate = findByName(qs, ['bluetooth', 'bt']);

    replaceIndicator('volume', volumeCandidate);
    replaceIndicator('network', networkCandidate);
    replaceIndicator('power', powerCandidate);
    replaceIndicator('bluetooth', bluetoothCandidate);

    // Track container for rebuilds (43–44 have _indicators; sometimes _grid)
    const newContainer = qs._indicators ?? qs._grid ?? qs._box ?? null;
    if (container !== newContainer) {
      detachRebuildWatch();
      container = newContainer;
      attachRebuildWatch();
    }
  } else {
    // GNOME 42: Aggregate Menu
    const agg = Main.panel.statusArea && Main.panel.statusArea.aggregateMenu;
    detachRebuildWatch();
    if (!agg) return;

    // Try known children; guard all lookups.
    let volumeCandidate = agg._volume ?? agg._volumeItem ?? null;
    let networkCandidate = agg._network ?? agg._networkItem ?? null;
    let powerCandidate = agg._power ?? agg._powerItem ?? null;
    let bluetoothCandidate = agg._bluetooth ?? agg._bluetoothItem ?? null;

    // GNOME 40–41 fallbacks: scan aggregateMenu properties for best match
    const findByName = (names) => {
      try {
        const keys = Object.keys(agg || {});
        const lowerNames = names.map(n => String(n).toLowerCase());
        for (const k of keys) {
          const kl = k.toLowerCase();
          if (lowerNames.some(n => kl.includes(n))) {
            const val = agg[k];
            if (val && (typeof val.hide === 'function' || (val.actor && typeof val.actor.hide === 'function'))) {
              return val;
            }
          }
        }
      } catch (e) {}
      return null;
    };

    if (!volumeCandidate)
      volumeCandidate = findByName(['volume', 'audio', 'sound']);
    if (!networkCandidate)
      networkCandidate = findByName(['network', 'net', 'wifi', 'wireless']);
    if (!powerCandidate)
      powerCandidate = findByName(['power', 'battery']);
    if (!bluetoothCandidate)
      bluetoothCandidate = findByName(['bluetooth', 'bt']);

    replaceIndicator('volume', volumeCandidate);
    replaceIndicator('network', networkCandidate);
    replaceIndicator('power', powerCandidate);
    replaceIndicator('bluetooth', bluetoothCandidate);
  }
}

function attachRebuildWatch() {
  if (!container) return;
  if (!addedHandler) addedHandler = container.connect('child-added', reapplyAll);
  if (!removedHandler) removedHandler = container.connect('child-removed', reapplyAll);
}

function detachRebuildWatch() {
  if (container) {
    if (addedHandler) {
      try { container.disconnect(addedHandler); } catch (e) {}
      addedHandler = 0;
    }
    if (removedHandler) {
      try { container.disconnect(removedHandler); } catch (e) {}
      removedHandler = 0;
    }
  }
  container = null;
}

function cleanupIndicator(kind) {
  const { indicator, signalId } = getIndicatorAndSignal(kind);
  if (indicator && signalId) disconnectSignal(indicator, signalId);
  setSignal(kind, 0);
  doShow(indicator);
  setIndicator(kind, null);
}

function getIndicatorAndSignal(kind) {
  switch (kind) {
    case 'volume':
      return { indicator: volumeIndicator, signalId: sigVolume };
    case 'network':
      return { indicator: networkIndicator, signalId: sigNetwork };
    case 'power':
      return { indicator: powerIndicator, signalId: sigPower };
    case 'bluetooth':
      return { indicator: bluetoothIndicator, signalId: sigBluetooth };
  }
  return { indicator: null, signalId: 0 };
}

function setIndicator(kind, value) {
  switch (kind) {
    case 'volume': volumeIndicator = value; break;
    case 'network': networkIndicator = value; break;
    case 'power': powerIndicator = value; break;
    case 'bluetooth': bluetoothIndicator = value; break;
  }
}

function setSignal(kind, id) {
  switch (kind) {
    case 'volume': sigVolume = id; break;
    case 'network': sigNetwork = id; break;
    case 'power': sigPower = id; break;
    case 'bluetooth': sigBluetooth = id; break;
  }
}

function replaceIndicator(kind, newIndicator) {
  const { indicator: oldIndicator, signalId } = getIndicatorAndSignal(kind);
  if (oldIndicator === newIndicator) return;

  if (oldIndicator && signalId) {
    disconnectSignal(oldIndicator, signalId);
    setSignal(kind, 0);
  }

  setIndicator(kind, newIndicator);
}

function reapplyAll() {
  refreshIndicators();
  applyHide('volume', settings?.get_boolean('hide-volume'));
  applyHide('network', settings?.get_boolean('hide-network'));
  applyHide('power', settings?.get_boolean('hide-power'));
  applyHide('bluetooth', settings?.get_boolean('hide-bluetooth'));
}

function updateVolume() { refreshIndicators(); applyHide('volume', settings?.get_boolean('hide-volume')); }
function updateNetwork() { refreshIndicators(); applyHide('network', settings?.get_boolean('hide-network')); }
function updatePower() { refreshIndicators(); applyHide('power', settings?.get_boolean('hide-power')); }
function updateBluetooth() { refreshIndicators(); applyHide('bluetooth', settings?.get_boolean('hide-bluetooth')); }

function applyHide(kind, hide) {
  const { indicator, signalId } = getIndicatorAndSignal(kind);
  if (!indicator) return;
  if (hide) {
    doHide(indicator);
    if (!signalId) setSignal(kind, connectVisibleNotify(indicator, () => doHide(indicator)));
  } else {
    if (signalId) disconnectSignal(indicator, signalId);
    setSignal(kind, 0);
    doShow(indicator);
  }
}

var exports = { init, enable, disable };
