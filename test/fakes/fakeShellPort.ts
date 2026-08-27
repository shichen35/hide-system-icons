import { QuickSettingsPanel } from "../../hiddenIndicator.js";
import { SettingsReader } from "../../panelBinding.js";
import { ShellPort } from "../../hidePolicy.js";

export class FakeShellPort implements ShellPort {
  panelsCallCount = 0;
  settingsCallCount = 0;
  idleCallCount = 0;
  cancelIdleCallCount = 0;
  watchSettingsCallCount = 0;
  watchPanelsCallCount = 0;
  unwatchCallCount = 0;

  private panelsList: QuickSettingsPanel[];
  private readonly settingsReader: SettingsReader;
  private tick: (() => boolean) | null = null;
  private panelsChangedHandler: (() => void) | null = null;
  private settingsChangedHandler: (() => void) | null = null;
  private panelsAvailable: boolean = true;

  constructor(settingsReader: SettingsReader, panels: QuickSettingsPanel[] = []) {
    this.settingsReader = settingsReader;
    this.panelsList = panels;
  }

  hasSignal(target: object, signal: string): boolean {
    const declared = (target as { supportedSignals?: string[] })?.supportedSignals;
    return !declared || declared.includes(signal);
  }

  setPanels(panels: QuickSettingsPanel[]): void {
    this.panelsList = panels;
  }

  setPanelsAvailable(available: boolean): void {
    this.panelsAvailable = available;
  }

  panels(): QuickSettingsPanel[] {
    this.panelsCallCount++;
    return this.panelsList;
  }

  settings(): SettingsReader {
    this.settingsCallCount++;
    return this.settingsReader;
  }

  idle(tick: () => boolean): void {
    this.idleCallCount++;
    this.tick = tick;
  }

  cancelIdle(): void {
    this.cancelIdleCallCount++;
    this.tick = null;
  }

  watchSettings(onChanged: () => void): void {
    this.watchSettingsCallCount++;
    this.settingsChangedHandler = onChanged;
  }

  watchPanels(onChanged: () => void): void {
    this.watchPanelsCallCount++;
    if (!this.panelsAvailable) return;
    this.panelsChangedHandler = onChanged;
  }

  unwatch(): void {
    this.unwatchCallCount++;
    this.panelsChangedHandler = null;
    this.settingsChangedHandler = null;
  }

  hasPendingTick(): boolean {
    return this.tick !== null;
  }

  driveTick(): boolean {
    if (!this.tick) throw new Error('FakeShellPort: no tick scheduled');
    const result = this.tick();
    if (!result) this.tick = null;
    return result;
  }

  firePanelsChanged(): void {
    if (!this.panelsChangedHandler) throw new Error('FakeShellPort: panels are not watched');
    this.panelsChangedHandler();
  }

  fireSettingsChanged(): void {
    if (!this.settingsChangedHandler) throw new Error('FakeShellPort: settings are not watched');
    this.settingsChangedHandler();
  }
}
