import GLib from "gi://GLib";
import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as Config from "resource:///org/gnome/shell/misc/config.js";
import { QuickSettingsPanel } from "./hiddenIndicator.js";
import { SettingsReader } from "./panelBinding.js";
import { ShellPort } from "./hidePolicy.js";
import { INDICATORS } from "./indicators.js";

export class GnomeShellPort implements ShellPort {
  private readonly gsettings: Gio.Settings;
  private sourceId: number | null = null;
  private settingsWatched: boolean = false;
  private panelsWatched: boolean = false;
  private selfChecked: boolean = false;

  constructor(gsettings: Gio.Settings) {
    this.gsettings = gsettings;
  }

  panels(): QuickSettingsPanel[] {
    const result: QuickSettingsPanel[] = [];

    const mainQs = Main.panel.statusArea?.quickSettings as unknown as QuickSettingsPanel | undefined;
    if (mainQs) result.push(mainQs);

    const dtpPanels = (global as any).dashToPanel?.panels;
    if (dtpPanels) {
      for (const p of dtpPanels) {
        const qs = p.statusArea?.quickSettings as unknown as QuickSettingsPanel | undefined;
        if (qs && qs !== mainQs) result.push(qs);
      }
    }

    return result;
  }

  settings(): SettingsReader {
    return this.gsettings;
  }

  idle(tick: () => boolean): void {
    this.cancelIdle();
    this.sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      if (tick()) return GLib.SOURCE_CONTINUE;
      this.sourceId = null;
      this.selfCheck();
      return GLib.SOURCE_REMOVE;
    });
  }

  cancelIdle(): void {
    if (this.sourceId !== null) {
      GLib.Source.remove(this.sourceId);
      this.sourceId = null;
    }
  }

  watchSettings(onChanged: () => void): void {
    if (this.settingsWatched) return;
    this.settingsWatched = true;

    (this.gsettings as any).connectObject('changed', () => onChanged(), this);
  }

  watchPanels(onChanged: () => void): void {
    if (this.panelsWatched) return;

    const dtp = (global as any).dashToPanel;
    if (!dtp) return;

    dtp.connectObject('panels-created', () => onChanged(), this);
    this.panelsWatched = true;
  }

  unwatch(): void {
    const dtp = (global as any).dashToPanel;
    if (dtp) dtp.disconnectObject(this);
    this.panelsWatched = false;

    (this.gsettings as any).disconnectObject(this);
    this.settingsWatched = false;
  }

  private selfCheck(): void {
    if (this.selfChecked) return;
    this.selfChecked = true;

    const panel = this.panels()[0];
    if (!panel) return;

    const runningMajor = parseInt(Config.PACKAGE_VERSION.split('.')[0], 10);

    if (!isNaN(runningMajor)) {
      const missingFields = INDICATORS.filter(row => row.since <= runningMajor && !(row.qsField in panel));
      if (missingFields.length > 0) {
        const details = missingFields.map(row => `${row.kind} (${row.qsField})`).join(', ');
        console.warn(`hide-system-icons: catalog names fields this Shell does not have: ${details}`);
      }
    }

    const missingRequired = INDICATORS.filter(row => row.required && (panel[row.qsField] ?? null) === null);
    if (missingRequired.length > 0) {
      const details = missingRequired.map(row => `${row.kind} (${row.qsField})`).join(', ');
      console.warn(`hide-system-icons: required indicator never appeared: ${details}`);
    }
  }
}
