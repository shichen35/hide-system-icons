import GLib from "gi://GLib";
import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
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
  private bluetooth: Hideable | null = null;
  private microphone: Hideable | null = null;

  private showSignalVolume: number | null = null;
  private showSignalNetwork: number | null = null;
  private showSignalPower: number | null = null;
  private showSignalBluetooth: number | null = null;
  private showSignalMicrophone: number | null = null;

  private settingsSignalIds: number[] = [];
  private indicatorsContainer: any | null = null;
  private indicatorsAddedHandler: number | null = null;
  private indicatorsRemovedHandler: number | null = null;

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
    this.settingsSignalIds.push(
      this.settings.connect("changed::hide-bluetooth", () => this.updateBluetooth()),
    );
    this.settingsSignalIds.push(
      this.settings.connect("changed::hide-microphone", () => this.updateMicrophone()),
    );

    this.sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      const qs = Main.panel.statusArea.quickSettings as unknown as {
        _volumeOutput?: Hideable | null;
        _network?: Hideable | null;
        _system?: Hideable | null;
        _bluetooth?: Hideable | null;
      };

      this.volumeOutput = (qs._volumeOutput ?? null) as Hideable | null;
      this.network = (qs._network ?? null) as Hideable | null;
      this.power = (qs._system ?? null) as Hideable | null;
      this.bluetooth = (qs._bluetooth ?? null) as Hideable | null;
      // @ts-ignore
      this.microphone = (qs._volumeInput ?? null) as Hideable | null;

      if (!this.volumeOutput || !this.network || !this.power)
        return GLib.SOURCE_CONTINUE;

      // Apply initial states according to settings
      this.updateVolume();
      this.updateNetwork();
      this.updatePower();
      this.updateBluetooth();
      this.updateMicrophone();

      // Watch for Quick Settings rebuilds and re-apply settings when needed
      this.attachRebuildWatch();

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

    // Detach rebuild watchers if any
    this.detachRebuildWatch();

    // Restore and cleanup indicators
    this.cleanupIndicator(this.volumeOutput, 'volume');
    this.cleanupIndicator(this.network, 'network');
    this.cleanupIndicator(this.power, 'power');
    this.cleanupIndicator(this.bluetooth, 'bluetooth');
    this.cleanupIndicator(this.microphone, 'microphone');
  }

  private cleanupIndicator(indicator: Hideable | null, kind: 'volume' | 'network' | 'power' | 'bluetooth' | 'microphone'): void {
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
    if (kind === 'bluetooth') this.bluetooth = null;
    if (kind === 'microphone') this.microphone = null;
  }

  private getSignalId(kind: 'volume' | 'network' | 'power' | 'bluetooth' | 'microphone'): number | null {
    if (kind === 'volume') return this.showSignalVolume;
    if (kind === 'network') return this.showSignalNetwork;
    if (kind === 'power') return this.showSignalPower;
    if (kind === 'bluetooth') return this.showSignalBluetooth;
    return this.showSignalMicrophone;
  }

  private setSignalId(kind: 'volume' | 'network' | 'power' | 'bluetooth' | 'microphone', id: number | null): void {
    if (kind === 'volume') this.showSignalVolume = id;
    else if (kind === 'network') this.showSignalNetwork = id;
    else if (kind === 'power') this.showSignalPower = id;
    else if (kind === 'bluetooth') this.showSignalBluetooth = id;
    else this.showSignalMicrophone = id;
  }

  private refreshIndicators(): void {
    const qs = Main.panel.statusArea.quickSettings as unknown as {
      _volumeOutput?: Hideable | null;
      _network?: Hideable | null;
      _system?: Hideable | null;
      _indicators?: any | null;
      _grid?: any | null;
      _bluetooth?: Hideable | null;
      _volumeInput?: Hideable | null;
    };

    const newVolume = (qs._volumeOutput ?? null) as Hideable | null;
    const newNetwork = (qs._network ?? null) as Hideable | null;
    const newPower = (qs._system ?? null) as Hideable | null;
    const newBluetooth = (qs._bluetooth ?? null) as Hideable | null;
    const newMicrophone = (qs._volumeInput ?? null) as Hideable | null;

    if (newVolume !== this.volumeOutput) {
      if (this.volumeOutput && this.showSignalVolume !== null) {
        this.volumeOutput.disconnect(this.showSignalVolume);
        this.showSignalVolume = null;
      }
      this.volumeOutput = newVolume;
    }

    if (newNetwork !== this.network) {
      if (this.network && this.showSignalNetwork !== null) {
        this.network.disconnect(this.showSignalNetwork);
        this.showSignalNetwork = null;
      }
      this.network = newNetwork;
    }

    if (newPower !== this.power) {
      if (this.power && this.showSignalPower !== null) {
        this.power.disconnect(this.showSignalPower);
        this.showSignalPower = null;
      }
      this.power = newPower;
    }

    if (newBluetooth !== this.bluetooth) {
      if (this.bluetooth && this.showSignalBluetooth !== null) {
        this.bluetooth.disconnect(this.showSignalBluetooth);
        this.showSignalBluetooth = null;
      }
      this.bluetooth = newBluetooth;
    }

    if (newMicrophone !== this.microphone) {
      if (this.microphone && this.showSignalMicrophone !== null) {
        this.microphone.disconnect(this.showSignalMicrophone);
        this.showSignalMicrophone = null;
      }
      this.microphone = newMicrophone;
    }

    // Track the container used by Quick Settings to detect rebuilds
    const container = (qs as any)._indicators ?? (qs as any)._grid ?? null;
    if (container !== this.indicatorsContainer) {
      this.detachRebuildWatch();
      this.indicatorsContainer = container;
      this.attachRebuildWatch();
    }
  }

  private attachRebuildWatch(): void {
    const qs = Main.panel.statusArea.quickSettings as unknown as { _indicators?: any | null; _grid?: any | null };
    const container = this.indicatorsContainer ?? (qs._indicators ?? qs._grid ?? null);
    if (!container) return;
    this.indicatorsContainer = container;
    if (this.indicatorsAddedHandler === null) {
      this.indicatorsAddedHandler = container.connect('child-added', () => this.reapplyAll());
    }
    if (this.indicatorsRemovedHandler === null) {
      this.indicatorsRemovedHandler = container.connect('child-removed', () => this.reapplyAll());
    }
  }

  private detachRebuildWatch(): void {
    if (!this.indicatorsContainer) return;
    if (this.indicatorsAddedHandler !== null) {
      this.indicatorsContainer.disconnect(this.indicatorsAddedHandler);
      this.indicatorsAddedHandler = null;
    }
    if (this.indicatorsRemovedHandler !== null) {
      this.indicatorsContainer.disconnect(this.indicatorsRemovedHandler);
      this.indicatorsRemovedHandler = null;
    }
    this.indicatorsContainer = null;
  }

  private reapplyAll(): void {
    this.refreshIndicators();
    const hideVol = this.settings?.get_boolean('hide-volume') ?? false;
    const hideNet = this.settings?.get_boolean('hide-network') ?? false;
    const hidePow = this.settings?.get_boolean('hide-power') ?? false;
    const hideBt = this.settings?.get_boolean('hide-bluetooth') ?? false;
    const hideMic = this.settings?.get_boolean('hide-microphone') ?? false;
    this.applyHide(this.volumeOutput, hideVol, 'volume');
    this.applyHide(this.network, hideNet, 'network');
    this.applyHide(this.power, hidePow, 'power');
    this.applyHide(this.bluetooth, hideBt, 'bluetooth');
    this.applyHide(this.microphone, hideMic, 'microphone');
  }

  private updateVolume(): void {
    this.refreshIndicators();
    const hide = this.settings?.get_boolean('hide-volume') ?? false;
    this.applyHide(this.volumeOutput, hide, 'volume');
  }

  private updateNetwork(): void {
    this.refreshIndicators();
    const hide = this.settings?.get_boolean('hide-network') ?? false;
    this.applyHide(this.network, hide, 'network');
  }

  private updatePower(): void {
    this.refreshIndicators();
    const hide = this.settings?.get_boolean('hide-power') ?? false;
    this.applyHide(this.power, hide, 'power');
  }

  private updateBluetooth(): void {
    this.refreshIndicators();
    const hide = this.settings?.get_boolean('hide-bluetooth') ?? false;
    this.applyHide(this.bluetooth, hide, 'bluetooth');
  }

  private updateMicrophone(): void {
    this.refreshIndicators();
    const hide = this.settings?.get_boolean('hide-microphone') ?? false;
    this.applyHide(this.microphone, hide, 'microphone');
  }

  private applyHide(indicator: Hideable | null, hide: boolean, kind: 'volume' | 'network' | 'power' | 'bluetooth' | 'microphone'): void {
    if (!indicator) return;
    const existing = this.getSignalId(kind);
    if (hide) {
      indicator.hide();
      if (existing === null) {
        const id = indicator.connect('notify::visible', () => indicator.hide());
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
