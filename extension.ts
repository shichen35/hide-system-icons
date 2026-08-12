import GLib from "gi://GLib";
import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { HiddenIndicator, Hideable } from "./hiddenIndicator.js";

interface QuickSettingsPanel {
  _volumeInput?: Hideable | null;
  _volumeOutput?: Hideable | null;
  _bluetooth?: Hideable | null;
  _network?: Hideable | null;
  _system?: Hideable | null;
  _powerProfiles?: Hideable | null;
  _indicators?: any | null;
  _grid?: any | null;
}

type IndicatorKind = 'microphone' | 'volume' | 'bluetooth' | 'network' | 'power' | 'powerProfiles';

const SETTING_KEYS: Record<IndicatorKind, string> = {
  microphone: 'hide-microphone',
  volume: 'hide-volume',
  bluetooth: 'hide-bluetooth',
  network: 'hide-network',
  power: 'hide-power',
  powerProfiles: 'hide-power-profiles',
};

const QS_FIELDS: Record<IndicatorKind, keyof QuickSettingsPanel> = {
  microphone: '_volumeInput',
  volume: '_volumeOutput',
  bluetooth: '_bluetooth',
  network: '_network',
  power: '_system',
  powerProfiles: '_powerProfiles',
};

const KINDS: IndicatorKind[] = ['microphone', 'volume', 'bluetooth', 'network', 'power', 'powerProfiles'];

class PanelState {
  qs: QuickSettingsPanel;
  indicators: Record<IndicatorKind, HiddenIndicator | null> = {
    microphone: null, volume: null, bluetooth: null, network: null, power: null, powerProfiles: null,
  };
  rawIndicators: Record<IndicatorKind, Hideable | null> = {
    microphone: null, volume: null, bluetooth: null, network: null, power: null, powerProfiles: null,
  };
  container: any | null = null;
  containerWatched: boolean = false;

  constructor(qs: QuickSettingsPanel) {
    this.qs = qs;
  }
}

export default class HideSystemIcons extends Extension {
  private sourceId: number | null = null;
  private settings: Gio.Settings | null = null;
  private panelStates: PanelState[] = [];

  enable(): void {
    this.settings = this.getSettings();

    for (const kind of KINDS) {
      (this.settings as any).connectObject(
        `changed::${SETTING_KEYS[kind]}`, () => this.updateAll(),
        this,
      );
    }

    this.scheduleApply();
  }

  private scheduleApply(): void {
    if (this.sourceId !== null) return;
    let retries = 0;
    this.sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      this.setupAllPanels();
      for (const ps of this.panelStates) this.refreshIndicators(ps);

      const allReady = this.panelStates.length > 0 &&
        this.panelStates.every(ps => KINDS.every(kind => ps.indicators[kind] !== null));

      if (!allReady && ++retries < 50) return GLib.SOURCE_CONTINUE;

      this.updateAll();
      for (const ps of this.panelStates) this.attachRebuildWatch(ps);
      this.watchDtpPanels();

      this.sourceId = null;
      return GLib.SOURCE_REMOVE;
    });
  }

  disable(): void {
    if (this.sourceId !== null) {
      GLib.Source.remove(this.sourceId);
      this.sourceId = null;
    }

    if (this.settings) {
      (this.settings as any).disconnectObject(this);
      this.settings = null;
    }

    this.unwatchDtpPanels();

    for (const ps of this.panelStates) this.cleanupPanelState(ps);
    this.panelStates = [];
  }

  private getAllQuickSettings(): QuickSettingsPanel[] {
    const result: QuickSettingsPanel[] = [];

    const mainQs = Main.panel.statusArea?.quickSettings as unknown as QuickSettingsPanel | undefined;
    if (mainQs) result.push(mainQs);

    // Dash to Panel creates separate quickSettings on secondary monitors
    const dtpPanels = (global as any).dashToPanel?.panels;
    if (dtpPanels) {
      for (const p of dtpPanels) {
        const qs = p.statusArea?.quickSettings as unknown as QuickSettingsPanel | undefined;
        if (qs && qs !== mainQs) result.push(qs);
      }
    }

    return result;
  }

  private setupAllPanels(): void {
    const allQs = this.getAllQuickSettings();
    const existingQs = new Set(this.panelStates.map(ps => ps.qs));

    for (const qs of allQs) {
      if (existingQs.has(qs)) continue;
      const ps = new PanelState(qs);
      for (const kind of KINDS) {
        const raw = (qs[QS_FIELDS[kind]] ?? null) as Hideable | null;
        ps.rawIndicators[kind] = raw;
        ps.indicators[kind] = raw ? new HiddenIndicator(raw) : null;
      }
      this.panelStates.push(ps);
    }
  }

  private cleanupPanelState(ps: PanelState): void {
    this.detachRebuildWatch(ps);
    for (const kind of KINDS) {
      ps.indicators[kind]?.dispose();
      ps.indicators[kind] = null;
      ps.rawIndicators[kind] = null;
    }
  }

  private watchDtpPanels(): void {
    const dtp = (global as any).dashToPanel;
    if (dtp)
      dtp.connectObject('panels-created', () => this.onDtpPanelsChanged(), this);
  }

  private unwatchDtpPanels(): void {
    const dtp = (global as any).dashToPanel;
    if (dtp)
      dtp.disconnectObject(this);
  }

  private onDtpPanelsChanged(): void {
    const currentQs = new Set(this.getAllQuickSettings());
    const stale = this.panelStates.filter(ps => !currentQs.has(ps.qs));
    for (const ps of stale) this.cleanupPanelState(ps);
    this.panelStates = this.panelStates.filter(ps => currentQs.has(ps.qs));

    this.scheduleApply();
  }

  private refreshIndicators(ps: PanelState): void {
    for (const kind of KINDS) {
      const newRaw = (ps.qs[QS_FIELDS[kind]] ?? null) as Hideable | null;
      const oldRaw = ps.rawIndicators[kind];
      if (newRaw !== oldRaw) {
        ps.indicators[kind]?.dispose();
        ps.indicators[kind] = newRaw ? new HiddenIndicator(newRaw) : null;
        ps.rawIndicators[kind] = newRaw;
      }
    }

    const container = ps.qs._indicators ?? ps.qs._grid ?? null;
    if (container !== ps.container) {
      this.detachRebuildWatch(ps);
      ps.container = container;
      this.attachRebuildWatch(ps);
    }
  }

  private attachRebuildWatch(ps: PanelState): void {
    const container = ps.container ?? (ps.qs._indicators ?? ps.qs._grid ?? null);
    if (!container || ps.containerWatched) return;
    ps.container = container;
    container.connectObject(
      'child-added', () => this.reapplyAll(ps),
      'child-removed', () => this.reapplyAll(ps),
      ps,
    );
    ps.containerWatched = true;
  }

  private detachRebuildWatch(ps: PanelState): void {
    if (!ps.container || !ps.containerWatched) return;
    ps.container.disconnectObject(ps);
    ps.container = null;
    ps.containerWatched = false;
  }

  private reapplyAll(ps: PanelState): void {
    this.refreshIndicators(ps);
    for (const kind of KINDS) {
      const hide = this.settings?.get_boolean(SETTING_KEYS[kind]) ?? false;
      this.applyHide(ps, kind, hide);
    }
  }

  private updateAll(): void {
    for (const ps of this.panelStates) {
      this.refreshIndicators(ps);
      for (const kind of KINDS) {
        const hide = this.settings?.get_boolean(SETTING_KEYS[kind]) ?? false;
        this.applyHide(ps, kind, hide);
      }
    }
  }

  private applyHide(ps: PanelState, kind: IndicatorKind, hide: boolean): void {
    const indicator = ps.indicators[kind];
    if (!indicator) return;

    if (hide) indicator.hide();
    else indicator.restore();
  }
}
