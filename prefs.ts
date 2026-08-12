import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Config from 'resource:///org/gnome/Shell/Extensions/js/misc/config.js';
import { INDICATORS } from './indicators.js';

export default class HideSystemIconsPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    const settings = this.getSettings();

    const page = new Adw.PreferencesPage({
      title: _('General'),
      iconName: 'dialog-information-symbolic',
    });

    const iconsGroup = new Adw.PreferencesGroup({
      title: _('Quick Settings icons'),
      description: _('Hide icons in the Quick Settings panel.'),
    });
    page.add(iconsGroup);

    const shellVersion = parseInt(Config.PACKAGE_VERSION.split('.')[0], 10);

    for (const row of INDICATORS) {
      if (row.since > shellVersion) continue;

      const switchRow = new Adw.SwitchRow({
        title: _(row.title),
        subtitle: _(row.subtitle),
      });
      iconsGroup.add(switchRow);
      settings.bind(row.settingKey, switchRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

    window.add(page);

    return Promise.resolve();
  }
}

