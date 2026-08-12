import GLib from "gi://GLib";
import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { QuickSettingsPanel } from "./hiddenIndicator.js";
import { INDICATORS } from "./indicators.js";
import { PanelBinding } from "./panelBinding.js";

export default class HideSystemIcons extends Extension {
  private sourceId: number | null = null;
  private settings: Gio.Settings | null = null;
  private bindings: PanelBinding[] = [];

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

      const allQs = this.getAllQuickSettings();
      const allReady = allQs.length > 0 &&
        allQs.every(qs => INDICATORS.every(row => (qs[row.qsField] ?? null) !== null));

      if (!allReady && ++retries < 50) return GLib.SOURCE_CONTINUE;

      this.updateAll();
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

    for (const binding of this.bindings) binding.dispose();
    this.bindings = [];
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
    for (const qs of allQs) {
      if (this.bindings.some(binding => binding.matches(qs))) continue;
      this.bindings.push(new PanelBinding(qs));
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
    const currentQs = this.getAllQuickSettings();
    const stale = this.bindings.filter(binding => !currentQs.some(qs => binding.matches(qs)));
    for (const binding of stale) binding.dispose();
    this.bindings = this.bindings.filter(binding => currentQs.some(qs => binding.matches(qs)));

    this.scheduleApply();
  }

  private updateAll(): void {
    if (!this.settings) return;
    for (const binding of this.bindings) binding.sync(this.settings);
  }
}
