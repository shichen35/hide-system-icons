import { QuickSettingsPanel } from "./hiddenIndicator.js";
import { PanelBinding, SettingsReader } from "./panelBinding.js";

export interface ShellPort {
  panels(): QuickSettingsPanel[];
  settings(): SettingsReader;
  idle(tick: () => boolean): void;
  cancelIdle(): void;
  watchSettings(onChanged: () => void): void;
  watchPanels(onChanged: () => void): void;
  unwatch(): void;
}

export class HidePolicy {
  private readonly port: ShellPort;
  private bindings: PanelBinding[] = [];
  private idlePending: boolean = false;

  constructor(port: ShellPort) {
    this.port = port;
  }

  start(): void {
    this.port.watchSettings(() => this.onSettingsChanged());

    this.scheduleApply();
  }

  stop(): void {
    this.port.cancelIdle();
    this.idlePending = false;

    this.port.unwatch();

    for (const binding of this.bindings) binding.dispose();
    this.bindings = [];
  }

  private scheduleApply(): void {
    if (this.idlePending) return;
    this.idlePending = true;
    let retries = 0;
    this.port.idle(() => {
      this.setupAllPanels();

      for (const binding of this.bindings) binding.refresh();
      const allReady = this.bindings.length > 0 && this.bindings.every(binding => binding.isReady());

      if (!allReady && ++retries < 50) return true;

      this.updateAll();
      this.port.watchPanels(() => this.onPanelsChanged());

      this.idlePending = false;
      return false;
    });
  }

  private setupAllPanels(): void {
    const allQs = this.port.panels();
    for (const qs of allQs) {
      if (this.bindings.some(binding => binding.matches(qs))) continue;
      this.bindings.push(new PanelBinding(qs));
    }
  }

  private onPanelsChanged(): void {
    const currentQs = this.port.panels();
    const stale = this.bindings.filter(binding => !currentQs.some(qs => binding.matches(qs)));
    for (const binding of stale) binding.dispose();
    this.bindings = this.bindings.filter(binding => currentQs.some(qs => binding.matches(qs)));

    this.scheduleApply();
  }

  private updateAll(): void {
    const settings = this.port.settings();
    for (const binding of this.bindings) binding.sync(settings);
  }

  private onSettingsChanged(): void {
    this.updateAll();
    this.port.watchPanels(() => this.onPanelsChanged());
  }
}
