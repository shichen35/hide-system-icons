import GLib from "gi://GLib";
import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { HiddenIndicator, Hideable } from "./hiddenIndicator.js";
import { IndicatorKind, INDICATORS } from "./indicators.js";

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

class PanelState {
  qs: QuickSettingsPanel;
  indicators: Record<IndicatorKind, HiddenIndicator | null>;
  rawIndicators: Record<IndicatorKind, Hideable | null>;
  container: any | null = null;
  containerWatched: boolean = false;

  constructor(qs: QuickSettingsPanel) {
    this.qs = qs;
    this.indicators = {} as Record<IndicatorKind, HiddenIndicator | null>;
    this.rawIndicators = {} as Record<IndicatorKind, Hideable | null>;
    for (const row of INDICATORS) {
      this.indicators[row.kind] = null;
      this.rawIndicators[row.kind] = null;
    }
  }
}

export default class HideSystemIcons extends Extension {
  private sourceId: number | null = null;
  private settings: Gio.Settings | null = null;
  private panelStates: PanelState[] = [];

  enable(): void {
    this.settings = this.getSettings();

    for (const row of INDICATORS) {
      (this.settings as any).connectObject(
        `changed::${row.settingKey}`, () => this.updateAll(),
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
        this.panelStates.every(ps => INDICATORS.every(row => ps.indicators[row.kind] !== null));

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
      for (const row of INDICATORS) {
        const raw = (qs[row.qsField as keyof QuickSettingsPanel] ?? null) as Hideable | null;
        ps.rawIndicators[row.kind] = raw;
        ps.indicators[row.kind] = raw ? new HiddenIndicator(raw) : null;
      }
      this.panelStates.push(ps);
    }
  }

  private cleanupPanelState(ps: PanelState): void {
    this.detachRebuildWatch(ps);
    for (const row of INDICATORS) {
      ps.indicators[row.kind]?.dispose();
      ps.indicators[row.kind] = null;
      ps.rawIndicators[row.kind] = null;
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
    for (const row of INDICATORS) {
      const newRaw = (ps.qs[row.qsField as keyof QuickSettingsPanel] ?? null) as Hideable | null;
      const oldRaw = ps.rawIndicators[row.kind];
      if (newRaw !== oldRaw) {
        ps.indicators[row.kind]?.dispose();
        ps.indicators[row.kind] = newRaw ? new HiddenIndicator(newRaw) : null;
        ps.rawIndicators[row.kind] = newRaw;
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
    for (const row of INDICATORS) {
      const hide = this.settings?.get_boolean(row.settingKey) ?? false;
      this.applyHide(ps, row.kind, hide);
    }
  }

  private updateAll(): void {
    for (const ps of this.panelStates) {
      this.refreshIndicators(ps);
      for (const row of INDICATORS) {
        const hide = this.settings?.get_boolean(row.settingKey) ?? false;
        this.applyHide(ps, row.kind, hide);
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
