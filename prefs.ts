import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Config from 'resource:///org/gnome/Shell/Extensions/js/misc/config.js';
import { GROUPS, IndicatorRow, availableIndicators } from './indicators.js';

(Gio as any)._promisify(Adw.MessageDialog.prototype, 'choose', 'choose_finish');

const markup = (text: string): string => GLib.markup_escape_text(text, -1);

function confirmHidePrivacyRow(window: Adw.PreferencesWindow, row: IndicatorRow): Promise<boolean> {
  const dialog = new Adw.MessageDialog({
    transientFor: window,
    heading: `${_(row.title)}?`,
    body: _(row.privacyWarning ?? ''),
  });
  dialog.add_response('cancel', _('Cancel'));
  dialog.add_response('hide', _('Hide anyway'));
  dialog.set_response_appearance('hide', Adw.ResponseAppearance.DESTRUCTIVE);
  dialog.set_default_response('cancel');
  dialog.set_close_response('cancel');

  return dialog.choose(null).then(response => response === 'hide');
}

function buildSwitchRow(settings: Gio.Settings, row: IndicatorRow): Adw.SwitchRow {
  const switchRow = new Adw.SwitchRow({
    title: markup(_(row.title)),
    subtitle: markup(_(row.subtitle)),
  });
  settings.bind(row.settingKey, switchRow, 'active', Gio.SettingsBindFlags.DEFAULT);
  return switchRow;
}

function buildPrivacyRow(window: Adw.PreferencesWindow, settings: Gio.Settings, row: IndicatorRow): Adw.ActionRow {
  const actionRow = new Adw.ActionRow({
    title: markup(_(row.title)),
    subtitle: markup(_(row.subtitle)),
  });

  const toggle = new Gtk.Switch({ valign: Gtk.Align.CENTER });
  actionRow.add_suffix(toggle);
  actionRow.set_activatable_widget(toggle);

  let syncing = false;
  const apply = (hidden: boolean): void => {
    syncing = true;
    toggle.set_active(hidden);
    toggle.set_state(hidden);
    syncing = false;
  };

  apply(settings.get_boolean(row.settingKey));

  toggle.connect('state-set', (_widget: Gtk.Switch, state: boolean) => {
    if (syncing) return true;
    if (!state) {
      settings.set_boolean(row.settingKey, false);
      return false;
    }

    confirmHidePrivacyRow(window, row)
      .then(confirmed => {
        if (confirmed) settings.set_boolean(row.settingKey, true);
        apply(confirmed);
      })
      .catch(() => apply(false));
    return true;
  });

  settings.connect(`changed::${row.settingKey}`, () => {
    apply(settings.get_boolean(row.settingKey));
  });

  return actionRow;
}

type HideAllResponse = 'cancel' | 'keep-privacy' | 'hide-all';

function confirmHideAll(window: Adw.PreferencesWindow): Promise<HideAllResponse> {
  const dialog = new Adw.MessageDialog({
    transientFor: window,
    heading: _('Hide all icons?'),
    body: _(
      'This includes the privacy indicators for the camera, microphone, location and screen sharing — ' +
        'your only on-screen signs that these are in use.',
    ),
  });
  dialog.add_response('cancel', _('Cancel'));
  dialog.add_response('keep-privacy', _('Keep privacy icons'));
  dialog.add_response('hide-all', _('Hide all'));
  dialog.set_response_appearance('hide-all', Adw.ResponseAppearance.DESTRUCTIVE);
  dialog.set_default_response('cancel');
  dialog.set_close_response('cancel');

  return dialog.choose(null) as unknown as Promise<HideAllResponse>;
}

function buildAllIconsGroup(
  window: Adw.PreferencesWindow,
  settings: Gio.Settings,
  available: readonly IndicatorRow[],
): Adw.PreferencesGroup {
  const group = new Adw.PreferencesGroup({ title: markup(_('All icons')) });

  const hideAllButton = new Gtk.Button({ label: _('Hide all') });
  const showAllButton = new Gtk.Button({ label: _('Show all') });

  hideAllButton.connect('clicked', () => {
    const sensitiveRows = available.filter(row => row.privacySensitive);
    const needsConfirm = sensitiveRows.some(row => !settings.get_boolean(row.settingKey));

    if (!needsConfirm) {
      for (const row of available) settings.set_boolean(row.settingKey, true);
      return;
    }

    confirmHideAll(window).then(response => {
      if (response === 'cancel') return;
      for (const row of available) {
        if (response === 'keep-privacy' && row.privacySensitive) continue;
        settings.set_boolean(row.settingKey, true);
      }
    });
  });

  showAllButton.connect('clicked', () => {
    for (const row of available) settings.set_boolean(row.settingKey, false);
  });

  const buttonBox = new Gtk.Box({ cssClasses: ['linked'] });
  buttonBox.append(hideAllButton);
  buttonBox.append(showAllButton);
  group.set_header_suffix(buttonBox);

  return group;
}

export default class HideSystemIconsPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    const settings = this.getSettings();

    const page = new Adw.PreferencesPage({
      title: _('General'),
      iconName: 'dialog-information-symbolic',
    });

    const shellVersion = parseInt(Config.PACKAGE_VERSION.split('.')[0], 10);
    const available = availableIndicators(shellVersion);

    page.add(buildAllIconsGroup(window, settings, available));

    for (const group of GROUPS) {
      const rows = available.filter(row => row.group === group.id);
      if (rows.length === 0) continue;

      const groupWidget = new Adw.PreferencesGroup({
        title: markup(_(group.title)),
      });
      page.add(groupWidget);

      for (const row of rows) {
        const widget = row.privacySensitive
          ? buildPrivacyRow(window, settings, row)
          : buildSwitchRow(settings, row);
        groupWidget.add(widget);
      }
    }

    window.add(page);

    return Promise.resolve();
  }
}
