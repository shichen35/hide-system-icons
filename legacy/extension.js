/*
 * Legacy GNOME Shell extension entry point for GNOME 40–44.
 * Uses the legacy init/enable/disable API and supports both Aggregate Menu (40–42)
 * and Quick Settings (43–44) via runtime detection.
 * Supports Dash to Panel multi-monitor setups via per-panel state tracking.
 */

/* globals imports */

const { Gio, GLib, GObject } = imports.gi;
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

function isVisible(target) {
  if (!target) return false;
  if (typeof target.visible === 'boolean') return target.visible;
  return target.actor && typeof target.actor.visible === 'boolean' ? target.actor.visible : false;
}

function resolveField(menu, path) {
  if (!path) return null;
  let obj = menu;
  for (const part of path.split('.')) {
    if (!obj) return null;
    obj = obj[part];
  }
  return obj || null;
}

const INDICATOR_ROWS = [
  { kind: 'microphone',     key: 'hide-microphone',       agg: '_volume._inputIndicator', qs: '_volume._inputIndicator' },
  { kind: 'volume',         key: 'hide-volume',           agg: '_volume',        qs: '_volume' },
  { kind: 'bluetooth',      key: 'hide-bluetooth',        agg: '_bluetooth',     qs: '_bluetooth' },
  { kind: 'network',        key: 'hide-network',          agg: '_network',       qs: '_network' },
  { kind: 'power',          key: 'hide-power',            agg: '_power',         qs: '_system' },
  { kind: 'brightness',     key: 'hide-brightness',       agg: '_brightness',    qs: '_brightness' },
  { kind: 'location',       key: 'hide-location',         agg: '_location',      qs: '_location' },
  { kind: 'nightLight',     key: 'hide-night-light',      agg: '_nightLight',    qs: '_nightLight' },
  { kind: 'remoteAccess',   key: 'hide-remote-access',    agg: '_remoteAccess',  qs: '_remoteAccess' },
  { kind: 'rfkill',         key: 'hide-rfkill',           agg: '_rfkill',        qs: '_rfkill' },
  { kind: 'thunderbolt',    key: 'hide-thunderbolt',      agg: '_thunderbolt',   qs: '_thunderbolt' },
  { kind: 'powerProfiles',  key: 'hide-power-profiles',   agg: '_powerProfiles', qs: '_powerProfiles' },
  { kind: 'darkMode',       key: 'hide-dark-mode',        agg: null,             qs: '_darkMode' },
  { kind: 'autoRotate',     key: 'hide-auto-rotate',      agg: null,             qs: '_autoRotate' },
  { kind: 'backgroundApps', key: 'hide-background-apps',  agg: null,             qs: '_backgroundApps' },
];

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
  const indicators = {};
  const signals = {};
  const wanted = {};
  for (const row of INDICATOR_ROWS) {
    indicators[row.kind] = null;
    signals[row.kind] = 0;
    wanted[row.kind] = null;
  }
  return {
    menu,
    isQs,
    indicators,
    signals,
    wanted,
    container: null,
    addedHandler: 0,
    removedHandler: 0,
  };
}

function init() {}

function enable() {
  settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.hide-system-icons');
  settingsSignalIds = [];

  for (const row of INDICATOR_ROWS) {
    settingsSignalIds.push(settings.connect(`changed::${row.key}`, onSettingsChanged));
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
  const dtpPanels = global.dashToPanel && global.dashToPanel.panels;
  if (dtpPanels) {
    for (const p of dtpPanels) {
      const menu = p.statusArea && p.statusArea[menuName];
      if (menu && menu !== mainMenu) result.push({ menu, isQs });
    }
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

function restoreIndicator(ps, kind) {
  const indicator = ps.indicators[kind];
  const signalId = ps.signals[kind];
  if (indicator && signalId) disconnectSignal(indicator, signalId);
  ps.signals[kind] = 0;
  if (indicator && ps.wanted[kind] !== null) {
    if (ps.wanted[kind]) doShow(indicator);
    else doHide(indicator);
  }
}

function cleanupPanelState(ps) {
  detachRebuildWatch(ps);
  for (const row of INDICATOR_ROWS) {
    restoreIndicator(ps, row.kind);
    ps.wanted[row.kind] = null;
    ps.indicators[row.kind] = null;
  }
}

function watchDtpPanels() {
  const dtp = global.dashToPanel;
  if (dtp && !dtpSignal)
    dtpSignal = dtp.connect('panels-created', onDtpPanelsChanged);
}

function unwatchDtpPanels() {
  if (dtpSignal && global.dashToPanel)
    global.dashToPanel.disconnect(dtpSignal);
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
    // versions. Bluetooth may be absent on systems without hardware; network
    // may be absent on shells built without NetworkManager.
    const allReady = panelStates.length > 0 &&
      panelStates.every(ps => ps.indicators.volume && ps.indicators.power);

    if (!allReady && ++retries < 50) return GLib.SOURCE_CONTINUE;

    updateAll();
    for (const ps of panelStates) attachRebuildWatch(ps);
    watchDtpPanels();

    idleSource = 0;
    return GLib.SOURCE_REMOVE;
  });
}

function refreshIndicatorsForPanel(ps) {
  refreshIndicators(ps);
  if (ps.isQs) {
    const newContainer = ps.menu._indicators || ps.menu._grid || ps.menu._box || null;
    if (newContainer !== ps.container) {
      detachRebuildWatch(ps);
      ps.container = newContainer;
      attachRebuildWatch(ps);
    }
  }
  // Aggregate menu does not have a rebuild-watchable container
}

function refreshIndicators(ps) {
  const menu = ps.menu;
  for (const row of INDICATOR_ROWS) {
    const field = ps.isQs ? row.qs : row.agg;
    const candidate = resolveField(menu, field);
    replaceIndicator(ps, row.kind, candidate);
  }
}

function replaceIndicator(ps, kind, newIndicator) {
  const oldIndicator = ps.indicators[kind];
  if (oldIndicator === newIndicator) return;
  restoreIndicator(ps, kind);
  ps.wanted[kind] = null;
  ps.indicators[kind] = newIndicator;
}

function attachRebuildWatch(ps) {
  if (!ps.container) return;
  if (ps.addedHandler || ps.removedHandler) return;

  const gtype = ps.container.constructor && ps.container.constructor.$gtype;
  if (!gtype) return;

  const pairs = [['child-added', 'child-removed'], ['actor-added', 'actor-removed']];
  const pair = pairs.find(([added]) => GObject.signal_lookup(added, gtype) !== 0);
  if (!pair) return;

  ps.addedHandler = ps.container.connect(pair[0], () => reapplyAll(ps));
  ps.removedHandler = ps.container.connect(pair[1], () => reapplyAll(ps));
}

function detachRebuildWatch(ps) {
  if (!ps.container) return;
  if (ps.addedHandler)   { ps.container.disconnect(ps.addedHandler);   ps.addedHandler = 0; }
  if (ps.removedHandler) { ps.container.disconnect(ps.removedHandler); ps.removedHandler = 0; }
  ps.container = null;
}

function reapplyAll(ps) {
  refreshIndicatorsForPanel(ps);
  for (const row of INDICATOR_ROWS) {
    applyHide(ps, row.kind, settings && settings.get_boolean(row.key));
  }
}

function updateAll() {
  for (const ps of panelStates) {
    refreshIndicatorsForPanel(ps);
    for (const row of INDICATOR_ROWS) {
      applyHide(ps, row.kind, settings && settings.get_boolean(row.key));
    }
  }
}

function onSettingsChanged() {
  updateAll();
  watchDtpPanels();
}

function applyHide(ps, kind, hide) {
  const indicator = ps.indicators[kind];
  if (!indicator) return;
  const signalId = ps.signals[kind];
  if (hide) {
    if (!signalId) {
      ps.wanted[kind] = isVisible(indicator);
      ps.signals[kind] = connectVisibleNotify(indicator, () => {
        if (isVisible(indicator)) {
          ps.wanted[kind] = true;
          doHide(indicator);
        }
      });
    }
    doHide(indicator);
  } else {
    restoreIndicator(ps, kind);
  }
}

var exports = { init, enable, disable };
