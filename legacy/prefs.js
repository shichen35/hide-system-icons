/* Legacy preferences dialog for GNOME 40–44 using Gtk and buildPrefsWidget(). */

/* globals imports */

const { Gio, Gtk } = imports.gi;
const Gettext = imports.gettext;
let Adw = null;
let Handy = null;

try {
  Adw = imports.gi.Adw;
} catch (e) {
  Adw = null;
}

if (!Adw) {
  try {
    Handy = imports.gi.Handy;
  } catch (e) {
    Handy = null;
  }
}
const ExtensionUtils = imports.misc.extensionUtils;

let _ = (s) => s;

function init() {
  const md = ExtensionUtils.getCurrentExtension().metadata || {};
  const domain = md.uuid;
  try {
    ExtensionUtils.initTranslations(domain);
  } catch (e) {}

  if (typeof ExtensionUtils.gettext === 'function') {
    _ = ExtensionUtils.gettext;
  } else {
    try {
      _ = Gettext.domain(domain).gettext;
    } catch (e) {
      _ = (s) => s;
    }
  }

  // Initialize the available preference toolkit
  if (Adw && typeof Adw.init === 'function') {
    try { Adw.init(); } catch (e) {}
  } else if (Handy && typeof Handy.init === 'function') {
    try { Handy.init(); } catch (e) {}
  }
}

function _createSwitchRow(label, subtitle) {
  // Prefer libadwaita widgets, fall back to libhandy/Gtk when unavailable.
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

  if (Handy) {
    const row = new Handy.ActionRow({
      title: label,
      subtitle: subtitle || '',
    });

    const toggle = new Gtk.Switch({ halign: Gtk.Align.END, valign: Gtk.Align.CENTER });
    if (typeof row.add_suffix === 'function') row.add_suffix(toggle);
    if ('activatable_widget' in row) row.activatable_widget = toggle;
    else if (typeof row.set_activatable_widget === 'function') row.set_activatable_widget(toggle);

    return { row, toggle };
  }

  // Plain Gtk fallback for GNOME 40–41 when neither toolkit is available.
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

  const rows = [
    _createSwitchRow(_('Hide network'), _('Hide the network indicator.')),
    _createSwitchRow(_('Hide Bluetooth'), _('Hide the Bluetooth indicator.')),
    _createSwitchRow(_('Hide volume'), _('Hide the volume indicator.')),
    _createSwitchRow(_('Hide power'), _('Hide the power indicator.')),
  ];

  for (const { row } of rows) {
    group.add(row);
  }

  const [net, bt, vol, pow] = rows.map(r => r.toggle);

  settings.bind('hide-network', net, 'active', Gio.SettingsBindFlags.DEFAULT);
  settings.bind('hide-bluetooth', bt, 'active', Gio.SettingsBindFlags.DEFAULT);
  settings.bind('hide-volume', vol, 'active', Gio.SettingsBindFlags.DEFAULT);
  settings.bind('hide-power', pow, 'active', Gio.SettingsBindFlags.DEFAULT);

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

  if (Handy) {
    const page = new Handy.PreferencesPage();
    const group = new Handy.PreferencesGroup({
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
