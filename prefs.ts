import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Config from 'resource:///org/gnome/Shell/Extensions/js/misc/config.js';
import { GROUPS, INDICATORS } from './indicators.js';

export default class HideSystemIconsPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    const settings = this.getSettings();

    const page = new Adw.PreferencesPage({
      title: _('General'),
      iconName: 'dialog-information-symbolic',
    });

    const shellVersion = parseInt(Config.PACKAGE_VERSION.split('.')[0], 10);

    for (const group of GROUPS) {
      const rows = INDICATORS.filter(row => row.group === group.id && !(row.since > shellVersion));
      if (rows.length === 0) continue;

      const groupWidget = new Adw.PreferencesGroup({
        title: _(group.title),
      });
      page.add(groupWidget);

      for (const row of rows) {
        const switchRow = new Adw.SwitchRow({
          title: _(row.title),
          subtitle: _(row.subtitle),
        });
        groupWidget.add(switchRow);
        settings.bind(row.settingKey, switchRow, 'active', Gio.SettingsBindFlags.DEFAULT);
      }
    }

    window.add(page);

    return Promise.resolve();
  }
}

