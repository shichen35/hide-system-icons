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

interface QuickSettingsPanel {
  _volumeInput?: Hideable | null;
  _volumeOutput?: Hideable | null;
  _bluetooth?: Hideable | null;
  _network?: Hideable | null;
  _system?: Hideable | null;
  _indicators?: any | null;
  _grid?: any | null;
}

type IndicatorKind = 'microphone' | 'volume' | 'bluetooth' | 'network' | 'power';

const SETTING_KEYS: Record<IndicatorKind, string> = {
  microphone: 'hide-microphone',
  volume: 'hide-volume',
  bluetooth: 'hide-bluetooth',
  network: 'hide-network',
  power: 'hide-power',
};

const QS_FIELDS: Record<IndicatorKind, keyof QuickSettingsPanel> = {
  microphone: '_volumeInput',
  volume: '_volumeOutput',
  bluetooth: '_bluetooth',
  network: '_network',
  power: '_system',
};

const KINDS: IndicatorKind[] = ['microphone', 'volume', 'bluetooth', 'network', 'power'];

class PanelState {
  qs: QuickSettingsPanel;
  indicators: Record<IndicatorKind, Hideable | null> = {
    microphone: null, volume: null, bluetooth: null, network: null, power: null,
  };
  signalIds: Record<IndicatorKind, number | null> = {
    microphone: null, volume: null, bluetooth: null, network: null, power: null,
  };
  container: any | null = null;
  containerAddedHandler: number | null = null;
  containerRemovedHandler: number | null = null;

  constructor(qs: QuickSettingsPanel) {
    this.qs = qs;
  }
}

export default class HideSystemIcons extends Extension {
  private sourceId: number | null = null;
  private settings: Gio.Settings | null = null;
  private settingsSignalIds: number[] = [];
  private panelStates: PanelState[] = [];
  private dtpPanelsSignal: number | null = null;

  enable(): void {
    this.settings = this.getSettings();

    for (const kind of KINDS) {
      this.settingsSignalIds.push(
        this.settings.connect(`changed::${SETTING_KEYS[kind]}`, () => this.updateAll()),
      );
    }

    this.sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      this.setupAllPanels();

      if (this.panelStates.length === 0)
        return GLib.SOURCE_CONTINUE;

      for (const ps of this.panelStates) {
        for (const kind of KINDS) {
          if (!ps.indicators[kind]) return GLib.SOURCE_CONTINUE;
        }
      }

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
      for (const id of this.settingsSignalIds) this.settings.disconnect(id);
      this.settingsSignalIds = [];
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
    try {
      const dtpPanels = (global as any).dashToPanel?.panels;
      if (dtpPanels) {
        for (const p of dtpPanels) {
          const qs = p.statusArea?.quickSettings as unknown as QuickSettingsPanel | undefined;
          if (qs && qs !== mainQs) result.push(qs);
        }
      }
    } catch (_) {
      // Dash to Panel not installed
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
        ps.indicators[kind] = (qs[QS_FIELDS[kind]] ?? null) as Hideable | null;
      }
      this.panelStates.push(ps);
    }
  }

  private cleanupPanelState(ps: PanelState): void {
    this.detachRebuildWatch(ps);
    for (const kind of KINDS) {
      const indicator = ps.indicators[kind];
      if (!indicator) continue;
      const signalId = ps.signalIds[kind];
      if (signalId !== null) {
        indicator.disconnect(signalId);
        ps.signalIds[kind] = null;
      }
      indicator.show();
      ps.indicators[kind] = null;
    }
  }

  private watchDtpPanels(): void {
    try {
      const dtp = (global as any).dashToPanel;
      if (dtp && this.dtpPanelsSignal === null) {
        this.dtpPanelsSignal = dtp.connect('panels-created', () => this.onDtpPanelsChanged());
      }
    } catch (_) {
      // Dash to Panel not installed
    }
  }

  private unwatchDtpPanels(): void {
    try {
      if (this.dtpPanelsSignal !== null && (global as any).dashToPanel) {
        (global as any).dashToPanel.disconnect(this.dtpPanelsSignal);
      }
    } catch (_) {
      // ignore
    }
    this.dtpPanelsSignal = null;
  }

  private onDtpPanelsChanged(): void {
    const currentQs = new Set(this.getAllQuickSettings());
    const stale = this.panelStates.filter(ps => !currentQs.has(ps.qs));
    for (const ps of stale) this.cleanupPanelState(ps);
    this.panelStates = this.panelStates.filter(ps => currentQs.has(ps.qs));

    this.setupAllPanels();
    for (const ps of this.panelStates) {
      this.refreshIndicators(ps);
      this.attachRebuildWatch(ps);
    }
    this.updateAll();
  }

  private refreshIndicators(ps: PanelState): void {
    for (const kind of KINDS) {
      const newIndicator = (ps.qs[QS_FIELDS[kind]] ?? null) as Hideable | null;
      const oldIndicator = ps.indicators[kind];
      if (newIndicator !== oldIndicator) {
        if (oldIndicator && ps.signalIds[kind] !== null) {
          oldIndicator.disconnect(ps.signalIds[kind]!);
          ps.signalIds[kind] = null;
        }
        ps.indicators[kind] = newIndicator;
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
    if (!container) return;
    ps.container = container;
    if (ps.containerAddedHandler === null) {
      ps.containerAddedHandler = container.connect('child-added', () => this.reapplyAll(ps));
    }
    if (ps.containerRemovedHandler === null) {
      ps.containerRemovedHandler = container.connect('child-removed', () => this.reapplyAll(ps));
    }
  }

  private detachRebuildWatch(ps: PanelState): void {
    if (!ps.container) return;
    if (ps.containerAddedHandler !== null) {
      ps.container.disconnect(ps.containerAddedHandler);
      ps.containerAddedHandler = null;
    }
    if (ps.containerRemovedHandler !== null) {
      ps.container.disconnect(ps.containerRemovedHandler);
      ps.containerRemovedHandler = null;
    }
    ps.container = null;
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

    const existing = ps.signalIds[kind];
    if (hide) {
      indicator.hide();
      if (existing === null) {
        const id = indicator.connect('notify::visible', () => indicator.hide());
        ps.signalIds[kind] = id;
      }
    } else {
      if (existing !== null) {
        indicator.disconnect(existing);
        ps.signalIds[kind] = null;
      }
      indicator.show();
    }
  }
}
