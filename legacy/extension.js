/*
 * Legacy GNOME Shell extension entry point for GNOME 40–44.
 * Uses the legacy init/enable/disable API and supports both Aggregate Menu (40–42)
 * and Quick Settings (43–44) via runtime detection.
 * Supports Dash to Panel multi-monitor setups via per-panel state tracking.
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
  if (typeof target.hide === 'function') {
    target.hide();
  } else if (target.actor && typeof target.actor.hide === 'function') {
    target.actor.hide();
  }
}

function doShow(target) {
  if (!target) return;
  if (typeof target.show === 'function') {
    target.show();
  } else if (target.actor && typeof target.actor.show === 'function') {
    target.actor.show();
  }
}

function connectVisibleNotify(target, callback) {
  if (target && typeof target.connect === 'function') {
    return target.connect('notify::visible', callback);
  }
  if (target && target.actor && typeof target.actor.connect === 'function') {
    return target.actor.connect('notify::visible', callback);
  }
  return 0;
}

function disconnectSignal(target, id) {
  if (!id) return;
  if (target && typeof target.disconnect === 'function') {
    target.disconnect(id);
    return;
  }
  if (target && target.actor && typeof target.actor.disconnect === 'function') {
    target.actor.disconnect(id);
  }
}

const KINDS = ['microphone', 'volume', 'bluetooth', 'network', 'power'];
const SETTING_KEYS = {
  microphone: 'hide-microphone',
  volume:     'hide-volume',
  bluetooth:  'hide-bluetooth',
  network:    'hide-network',
  power:      'hide-power',
};

let settings = null;
let idleSource = 0;
let settingsSignalIds = [];
let panelStates = [];
let dtpSignal = 0;

/**
 * Per-panel state object. `menu` is either an aggregateMenu or quickSettings
 * instance; `isQs` distinguishes which indicator layout to use.
 */
function makePanelState(menu, isQs) {
  return {
    menu,
    isQs,
    indicators: { microphone: null, volume: null, bluetooth: null, network: null, power: null },
    signals:    { microphone: 0,    volume: 0,    bluetooth: 0,    network: 0,    power: 0    },
    container: null,
    addedHandler: 0,
    removedHandler: 0,
  };
}

function init() {}

function enable() {
  settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.hide-system-icons');
  settingsSignalIds = [];

  for (const kind of KINDS) {
    settingsSignalIds.push(settings.connect(`changed::${SETTING_KEYS[kind]}`, updateAll));
  }

  scheduleApply();
}

function disable() {
  if (idleSource) {
    GLib.Source.remove(idleSource);
    idleSource = 0;
  }

  if (settings) {
    for (const id of settingsSignalIds) settings.disconnect(id);
    settingsSignalIds = [];
    settings = null;
  }

  unwatchDtpPanels();

  for (const ps of panelStates) cleanupPanelState(ps);
  panelStates = [];
}

function isQuickSettingsAvailable() {
  return !!(Main.panel && Main.panel.statusArea && Main.panel.statusArea.quickSettings);
}

/**
 * Returns all menus (aggregateMenu on GNOME 40-42, quickSettings on 43-44)
 * across Main.panel and any Dash to Panel secondary panels.
 */
function getAllMenus() {
  const result = [];
  const isQs = isQuickSettingsAvailable();
  const menuName = isQs ? 'quickSettings' : 'aggregateMenu';

  const mainMenu = Main.panel.statusArea && Main.panel.statusArea[menuName];
  if (mainMenu) result.push({ menu: mainMenu, isQs });

  // Dash to Panel exposes per-monitor panels via global.dashToPanel.panels.
  // On GNOME 40-42 each standalone panel has its own statusArea.aggregateMenu;
  // on GNOME 43-44 it has statusArea.quickSettings.
  try {
    const dtpPanels = global.dashToPanel && global.dashToPanel.panels;
    if (dtpPanels) {
      for (const p of dtpPanels) {
        const menu = p.statusArea && p.statusArea[menuName];
        if (menu && menu !== mainMenu) result.push({ menu, isQs });
      }
    }
  } catch (e) {
    log(`hide-system-icons: error reading DtP panels: ${e}`);
  }

  return result;
}

function setupAllPanels() {
  const allMenus = getAllMenus();
  const existingMenus = new Set(panelStates.map(ps => ps.menu));

  for (const { menu, isQs } of allMenus) {
    if (existingMenus.has(menu)) continue;
    panelStates.push(makePanelState(menu, isQs));
  }
}

function cleanupPanelState(ps) {
  detachRebuildWatch(ps);
  for (const kind of KINDS) {
    const indicator = ps.indicators[kind];
    const signalId = ps.signals[kind];
    if (indicator && signalId) disconnectSignal(indicator, signalId);
    ps.signals[kind] = 0;
    doShow(indicator);
    ps.indicators[kind] = null;
  }
}

function watchDtpPanels() {
  try {
    const dtp = global.dashToPanel;
    if (dtp && !dtpSignal) {
      dtpSignal = dtp.connect('panels-created', onDtpPanelsChanged);
    }
  } catch (e) {
    log(`hide-system-icons: error connecting to DtP panels-created signal: ${e}`);
  }
}

function unwatchDtpPanels() {
  try {
    if (dtpSignal && global.dashToPanel) {
      global.dashToPanel.disconnect(dtpSignal);
    }
  } catch (e) {
    log(`hide-system-icons: error disconnecting DtP signal: ${e}`);
  }
  dtpSignal = 0;
}

function onDtpPanelsChanged() {
  const currentMenus = new Set(getAllMenus().map(({ menu }) => menu));
  const stale = panelStates.filter(ps => !currentMenus.has(ps.menu));
  for (const ps of stale) cleanupPanelState(ps);
  panelStates = panelStates.filter(ps => currentMenus.has(ps.menu));

  scheduleApply();
}

/**
 * Defers setup until the panel is ready, then applies all settings.
 * Caps retries at 50 to avoid an infinite loop on systems where some
 * indicators (e.g. bluetooth) are permanently absent.
 * Safe to call from onDtpPanelsChanged: the guard prevents a duplicate
 * source since panels-created cannot fire before watchDtpPanels() is
 * called, which only happens after the initial idle loop completes.
 */
function scheduleApply() {
  if (idleSource) {
    GLib.Source.remove(idleSource);
    idleSource = 0;
  }
  let retries = 0;
  idleSource = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
    setupAllPanels();
    for (const ps of panelStates) refreshIndicatorsForPanel(ps);

    // Only require indicators that are guaranteed present on all supported
    // versions. Microphone may be absent on GNOME 40-42 aggregate menu;
    // bluetooth may be absent on systems without hardware.
    const allReady = panelStates.length > 0 &&
      panelStates.every(ps => ps.indicators.volume && ps.indicators.network && ps.indicators.power);

    if (!allReady && ++retries < 50) return GLib.SOURCE_CONTINUE;

    updateAll();
    for (const ps of panelStates) attachRebuildWatch(ps);
    watchDtpPanels();

    idleSource = 0;
    return GLib.SOURCE_REMOVE;
  });
}

function refreshIndicatorsForPanel(ps) {
  if (ps.isQs) {
    refreshQsIndicators(ps);
    // QS containers emit child-added/child-removed on panel rebuilds
    const newContainer = ps.menu._indicators || ps.menu._grid || ps.menu._box || null;
    if (newContainer !== ps.container) {
      detachRebuildWatch(ps);
      ps.container = newContainer;
      attachRebuildWatch(ps);
    }
  } else {
    refreshAggIndicators(ps);
    // Aggregate menu does not have a rebuild-watchable container
  }
}

function refreshQsIndicators(ps) {
  const qs = ps.menu;

  let micCandidate = qs._volumeInput || null;
  let volCandidate = qs._volumeOutput || qs._volume || qs._volumeItem || null;
  let btCandidate  = qs._bluetooth   || qs._bluetoothItem || null;
  let netCandidate = qs._network     || qs._networkItem   || null;
  let powCandidate = qs._system      || qs._power         || qs._powerItem || null;

  const findByName = (obj, names) => {
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
    return null;
  };

  if (!micCandidate) micCandidate = findByName(qs, ['volumeinput', 'microphone', 'mic', 'input']);
  if (!volCandidate) volCandidate = findByName(qs, ['volume', 'audio', 'sound']);
  if (!btCandidate)  btCandidate  = findByName(qs, ['bluetooth', 'bt']);
  if (!netCandidate) netCandidate = findByName(qs, ['network', 'net', 'wifi', 'wireless']);
  if (!powCandidate) powCandidate = findByName(qs, ['power', 'system', 'battery']);

  replaceIndicator(ps, 'microphone', micCandidate);
  replaceIndicator(ps, 'volume',     volCandidate);
  replaceIndicator(ps, 'bluetooth',  btCandidate);
  replaceIndicator(ps, 'network',    netCandidate);
  replaceIndicator(ps, 'power',      powCandidate);
}

function refreshAggIndicators(ps) {
  const agg = ps.menu;

  let volCandidate = agg._volume    || agg._volumeItem    || null;
  let btCandidate  = agg._bluetooth || agg._bluetoothItem || null;
  let netCandidate = agg._network   || agg._networkItem   || null;
  let powCandidate = agg._power     || agg._powerItem     || null;

  const findByName = (names) => {
    const keys = Object.keys(agg || {});
    const lowerNames = names.map(n => String(n).toLowerCase());
    for (const k of keys) {
      const kl = k.toLowerCase();
      if (lowerNames.some(n => kl.includes(n))) {
        const val = agg[k];
        if (val && (typeof val.hide === 'function' || (val.actor && typeof val.actor.hide === 'function')))
          return val;
      }
    }
    return null;
  };

  // Note: microphone indicator is absent in GNOME 40–42 Aggregate Menu
  const micCandidate = findByName(['volumeinput', 'microphone', 'mic', 'input']);
  if (!volCandidate) volCandidate = findByName(['volume', 'audio', 'sound']);
  if (!btCandidate)  btCandidate  = findByName(['bluetooth', 'bt']);
  if (!netCandidate) netCandidate = findByName(['network', 'net', 'wifi', 'wireless']);
  if (!powCandidate) powCandidate = findByName(['power', 'battery']);

  replaceIndicator(ps, 'microphone', micCandidate);
  replaceIndicator(ps, 'volume',     volCandidate);
  replaceIndicator(ps, 'bluetooth',  btCandidate);
  replaceIndicator(ps, 'network',    netCandidate);
  replaceIndicator(ps, 'power',      powCandidate);
}

function replaceIndicator(ps, kind, newIndicator) {
  const oldIndicator = ps.indicators[kind];
  const signalId = ps.signals[kind];
  if (oldIndicator === newIndicator) return;
  if (oldIndicator && signalId) {
    disconnectSignal(oldIndicator, signalId);
    ps.signals[kind] = 0;
  }
  ps.indicators[kind] = newIndicator;
}

function attachRebuildWatch(ps) {
  if (!ps.container) return;
  if (!ps.addedHandler)
    ps.addedHandler = ps.container.connect('child-added', () => reapplyAll(ps));
  if (!ps.removedHandler)
    ps.removedHandler = ps.container.connect('child-removed', () => reapplyAll(ps));
}

function detachRebuildWatch(ps) {
  if (!ps.container) return;
  if (ps.addedHandler)   { ps.container.disconnect(ps.addedHandler);   ps.addedHandler = 0; }
  if (ps.removedHandler) { ps.container.disconnect(ps.removedHandler); ps.removedHandler = 0; }
  ps.container = null;
}

function reapplyAll(ps) {
  refreshIndicatorsForPanel(ps);
  for (const kind of KINDS) {
    applyHide(ps, kind, settings && settings.get_boolean(SETTING_KEYS[kind]));
  }
}

function updateAll() {
  for (const ps of panelStates) {
    refreshIndicatorsForPanel(ps);
    for (const kind of KINDS) {
      applyHide(ps, kind, settings && settings.get_boolean(SETTING_KEYS[kind]));
    }
  }
}

function applyHide(ps, kind, hide) {
  const indicator = ps.indicators[kind];
  if (!indicator) return;
  const signalId = ps.signals[kind];
  if (hide) {
    doHide(indicator);
    if (!signalId)
      ps.signals[kind] = connectVisibleNotify(indicator, () => doHide(indicator));
  } else {
    if (signalId) {
      disconnectSignal(indicator, signalId);
      ps.signals[kind] = 0;
    }
    doShow(indicator);
  }
}

var exports = { init, enable, disable };
