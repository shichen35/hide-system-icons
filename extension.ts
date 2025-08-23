import GLib from "gi://GLib";
import Gio from "gi://Gio";
import { panel } from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

interface Hideable {
  hide(): void;
  show(): void;
  connect(signal: string, callback: () => void): number;
  disconnect(handlerId: number): void;
}

export default class HideVolume extends Extension {
  private sourceId: number | null = null;
  private settings: Gio.Settings | null = null;

  private volumeOutput: Hideable | null = null;
  private network: Hideable | null = null;
  private power: Hideable | null = null;

  private showSignalVolume: number | null = null;
  private showSignalNetwork: number | null = null;
  private showSignalPower: number | null = null;

  private settingsSignalIds: number[] = [];

  enable(): void {
    this.settings = this.getSettings();

    // React to settings changes
    this.settingsSignalIds.push(
      this.settings.connect("changed::hide-volume", () => this.updateVolume()),
    );
    this.settingsSignalIds.push(
      this.settings.connect("changed::hide-network", () => this.updateNetwork()),
    );
    this.settingsSignalIds.push(
      this.settings.connect("changed::hide-power", () => this.updatePower()),
    );

    this.sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      const qs = panel.statusArea.quickSettings as unknown as {
        _volumeOutput?: Hideable | null;
        _network?: Hideable | null;
        _system?: Hideable | null;
      };

      this.volumeOutput = (qs._volumeOutput ?? null) as Hideable | null;
      this.network = (qs._network ?? null) as Hideable | null;
      this.power = (qs._system ?? null) as Hideable | null;

      if (!this.volumeOutput && !this.network && !this.power)
        return GLib.SOURCE_CONTINUE;

      // Apply initial states according to settings
      this.updateVolume();
      this.updateNetwork();
      this.updatePower();

      this.sourceId = null;
      return GLib.SOURCE_REMOVE;
    });
  }

  disable(): void {
    // The "unlock-dialog" session mode is used to hide the volume indicator on the lockscreen.
    if (this.sourceId !== null) {
      GLib.Source.remove(this.sourceId);
      this.sourceId = null;
    }
    // Disconnect settings handlers
    if (this.settings) {
      for (const id of this.settingsSignalIds) this.settings.disconnect(id);
      this.settingsSignalIds = [];
      this.settings = null;
    }

    // Restore and cleanup indicators
    this.cleanupIndicator(this.volumeOutput, 'volume');
    this.cleanupIndicator(this.network, 'network');
    this.cleanupIndicator(this.power, 'power');
  }

  private cleanupIndicator(indicator: Hideable | null, kind: 'volume' | 'network' | 'power'): void {
    if (!indicator) return;
    const signalId = this.getSignalId(kind);
    if (signalId !== null) {
      indicator.disconnect(signalId);
      this.setSignalId(kind, null);
    }
    indicator.show();
    if (kind === 'volume') this.volumeOutput = null;
    if (kind === 'network') this.network = null;
    if (kind === 'power') this.power = null;
  }

  private getSignalId(kind: 'volume' | 'network' | 'power'): number | null {
    if (kind === 'volume') return this.showSignalVolume;
    if (kind === 'network') return this.showSignalNetwork;
    return this.showSignalPower;
  }

  private setSignalId(kind: 'volume' | 'network' | 'power', id: number | null): void {
    if (kind === 'volume') this.showSignalVolume = id;
    else if (kind === 'network') this.showSignalNetwork = id;
    else this.showSignalPower = id;
  }

  private updateVolume(): void {
    const hide = this.settings?.get_boolean('hide-volume') ?? false;
    this.applyHide(this.volumeOutput, hide, 'volume');
  }

  private updateNetwork(): void {
    const hide = this.settings?.get_boolean('hide-network') ?? false;
    this.applyHide(this.network, hide, 'network');
  }

  private updatePower(): void {
    const hide = this.settings?.get_boolean('hide-power') ?? false;
    this.applyHide(this.power, hide, 'power');
  }

  private applyHide(indicator: Hideable | null, hide: boolean, kind: 'volume' | 'network' | 'power'): void {
    if (!indicator) return;
    const existing = this.getSignalId(kind);
    if (hide) {
      indicator.hide();
      if (existing === null) {
        const id = indicator.connect('show', () => indicator.hide());
        this.setSignalId(kind, id);
      }
    } else {
      if (existing !== null) {
        indicator.disconnect(existing);
        this.setSignalId(kind, null);
      }
      indicator.show();
    }
  }
}
