/* Legacy preferences dialog for GNOME 40–44 using Gtk and buildPrefsWidget(). */

/* globals imports */

const { Gio, Gtk } = imports.gi;
const Gettext = imports.gettext;
const ExtensionUtils = imports.misc.extensionUtils;
const Config = imports.misc.config;

// GNOME Shell version check
const SHELL_MAJOR = parseInt((Config.PACKAGE_VERSION || '0').split('.')[0], 10);
const Adw = SHELL_MAJOR >= 42 ? imports.gi.Adw : null;

const ROW_MAJOR = parseInt((Config.PACKAGE_VERSION || '').split('.')[0], 10);
const shellVersionKnown = Number.isFinite(ROW_MAJOR) && ROW_MAJOR > 0;

const INDICATOR_ROWS = [
  { key: 'hide-volume', title: 'Hide volume', subtitle: 'Hide the volume indicator.', since: 40 },
  { key: 'hide-microphone', title: 'Hide microphone', subtitle: 'Hide the microphone indicator.', since: 40 },
  { key: 'hide-location', title: 'Hide location', subtitle: 'Hide the location indicator.', since: 40 },
  { key: 'hide-remote-access', title: 'Hide screen sharing', subtitle: 'Hide the screen sharing indicator.', since: 40 },
  { key: 'hide-network', title: 'Hide network', subtitle: 'Hide the network indicator.', since: 40 },
  { key: 'hide-bluetooth', title: 'Hide Bluetooth', subtitle: 'Hide the Bluetooth indicator.', since: 40 },
  { key: 'hide-rfkill', title: 'Hide airplane mode', subtitle: 'Hide the airplane mode indicator.', since: 40 },
  { key: 'hide-thunderbolt', title: 'Hide Thunderbolt', subtitle: 'Hide the Thunderbolt indicator.', since: 40 },
  { key: 'hide-brightness', title: 'Hide brightness', subtitle: 'Hide the brightness indicator.', since: 40 },
  { key: 'hide-night-light', title: 'Hide night light', subtitle: 'Hide the night light indicator.', since: 40 },
  { key: 'hide-dark-mode', title: 'Hide dark mode', subtitle: 'Hide the dark mode indicator.', since: 43 },
  { key: 'hide-auto-rotate', title: 'Hide auto rotate', subtitle: 'Hide the auto rotate indicator.', since: 43 },
  { key: 'hide-power', title: 'Hide power', subtitle: 'Hide the power indicator.', since: 40 },
  { key: 'hide-power-profiles', title: 'Hide power profiles', subtitle: 'Hide the power profiles indicator.', since: 41 },
  { key: 'hide-background-apps', title: 'Hide background apps', subtitle: 'Hide the background apps indicator.', since: 44 },
];

let _ = (s) => s;

function init() {
  const md = ExtensionUtils.getCurrentExtension().metadata || {};
  const domain = md.uuid;
  ExtensionUtils.initTranslations(domain);
  if (typeof ExtensionUtils.gettext === 'function') {
    _ = ExtensionUtils.gettext;
  } else {
    const dom = typeof Gettext.domain === 'function' ? Gettext.domain(domain) : null;
    _ = dom && typeof dom.gettext === 'function' ? dom.gettext : ((s) => s);
  }
}

function _createSwitchRow(label, subtitle) {
  // Prefer libadwaita widgets, fall back to Gtk when unavailable.
  if (Adw) {
    const row = new Adw.ActionRow({
      title: label,
      subtitle: subtitle || '',
    });

    const toggle = new Gtk.Switch({ halign: Gtk.Align.END, valign: Gtk.Align.CENTER });
    row.add_suffix(toggle);
    row.activatable_widget = toggle;

    return { row, toggle };
  }

  // Plain Gtk fallback for GNOME 40–41 when Adw is unavailable.
  const row = new Gtk.ListBoxRow();
  const content = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 12,
    margin_top: 6,
    margin_bottom: 6,
    margin_start: 12,
    margin_end: 12,
  });

  const labels = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true });
  const titleLabel = new Gtk.Label({ label, xalign: 0 });
  titleLabel.get_style_context?.().add_class?.('preferences-title');
  labels.append ? labels.append(titleLabel) : labels.pack_start(titleLabel, true, true, 0);

  if (subtitle) {
    const subtitleLabel = new Gtk.Label({ label: subtitle, xalign: 0 });
    subtitleLabel.get_style_context?.().add_class?.('dim-label');
    labels.append ? labels.append(subtitleLabel) : labels.pack_start(subtitleLabel, true, true, 0);
  }

  content.append ? content.append(labels) : content.pack_start(labels, true, true, 0);

  const toggle = new Gtk.Switch({ halign: Gtk.Align.END, valign: Gtk.Align.CENTER });
  content.append ? content.append(toggle) : content.pack_end(toggle, false, false, 0);

  if (row.set_child) row.set_child(content);
  else row.add(content);

  return { row, toggle };
}

function buildPrefsWidget() {
  const settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.hide-system-icons');

  const { page, group } = _createPreferencesContainers();

  for (const indicatorRow of INDICATOR_ROWS) {
    if (shellVersionKnown && indicatorRow.since > ROW_MAJOR) continue;

    const { row, toggle } = _createSwitchRow(_(indicatorRow.title), _(indicatorRow.subtitle));
    group.add(row);
    settings.bind(indicatorRow.key, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
  }

  return page;
}

function _createPreferencesContainers() {
  if (Adw) {
    const page = new Adw.PreferencesPage();
    const group = new Adw.PreferencesGroup({
      title: _('Quick Settings icons'),
      description: _('Hide icons in the Quick Settings panel.'),
    });
    page.add(group);
    return { page, group };
  }

  const page = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12, margin_top: 12, margin_bottom: 12 });
  const frame = new Gtk.Frame({ label: _('Quick Settings icons') });
  const list = new Gtk.ListBox();
  frame.set_child ? frame.set_child(list) : frame.add(list);
  page.append ? page.append(frame) : page.pack_start(frame, true, true, 0);

  return {
    page,
    group: {
      add(row) {
        list.append ? list.append(row) : list.add(row);
      },
    },
  };
}

var exports = { init, buildPrefsWidget };
