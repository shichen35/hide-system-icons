import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class HideSystemIconsPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    const settings = this.getSettings();

    const page = new Adw.PreferencesPage({
      title: _('General'),
      iconName: 'dialog-information-symbolic',
    });

    // System icons toggles
    const iconsGroup = new Adw.PreferencesGroup({
      title: _('Quick Settings icons'),
      description: _('Hide icons in the Quick Settings panel.'),
    });
    page.add(iconsGroup);

    const hideNetwork = new Adw.SwitchRow({
      title: _('Hide network'),
      subtitle: _('Hide the network indicator.'),
    });
    iconsGroup.add(hideNetwork);

    const hideBluetooth = new Adw.SwitchRow({
      title: _('Hide Bluetooth'),
      subtitle: _('Hide the Bluetooth indicator.'),
    });
    iconsGroup.add(hideBluetooth);

    const hideVolume = new Adw.SwitchRow({
      title: _('Hide volume'),
      subtitle: _('Hide the volume indicator.'),
    });
    iconsGroup.add(hideVolume);

    const hidePower = new Adw.SwitchRow({
      title: _('Hide power'),
      subtitle: _('Hide the power indicator.'),
    });
    iconsGroup.add(hidePower);

    const hideMicrophone = new Adw.SwitchRow({
      title: _('Hide microphone'),
      subtitle: _('Hide the microphone indicator.'),
    });
    iconsGroup.add(hideMicrophone);

    window.add(page);

    settings.bind('hide-network', hideNetwork, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('hide-bluetooth', hideBluetooth, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('hide-volume', hideVolume, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('hide-power', hidePower, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('hide-microphone', hideMicrophone, 'active', Gio.SettingsBindFlags.DEFAULT);

    return Promise.resolve();
  }
}

