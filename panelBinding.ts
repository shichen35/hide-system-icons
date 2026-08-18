import { HiddenIndicator, Hideable, QuickSettingsPanel } from "./hiddenIndicator.js";
import { IndicatorKind, IndicatorRow, INDICATORS } from "./indicators.js";

export interface SettingsReader {
  get_boolean(key: string): boolean;
}

export class PanelBinding {
  private readonly panel: QuickSettingsPanel;
  private readonly indicators: Record<IndicatorKind, HiddenIndicator | null>;
  private container: any | null = null;
  private settings: SettingsReader | null = null;

  constructor(panel: QuickSettingsPanel) {
    this.panel = panel;
    this.indicators = {} as Record<IndicatorKind, HiddenIndicator | null>;
    for (const row of INDICATORS) this.indicators[row.kind] = null;
  }

  refresh(): void {
    for (const row of INDICATORS) this.resolveIndicator(row);
    this.resolveContainer();
  }

  sync(settings: SettingsReader): void {
    this.settings = settings;

    this.refresh();

    for (const row of INDICATORS) this.applyHide(row.kind, settings.get_boolean(row.settingKey));
  }

  isReady(): boolean {
    return INDICATORS.every(row => !row.required || this.indicators[row.kind] !== null);
  }

  matches(panel: QuickSettingsPanel): boolean {
    return this.panel === panel;
  }

  dispose(): void {
    this.detachRebuildWatch();
    for (const row of INDICATORS) {
      this.indicators[row.kind]?.dispose();
      this.indicators[row.kind] = null;
    }
    this.settings = null;
  }

  private resolveIndicator(row: IndicatorRow): void {
    const raw = (this.panel[row.qsField] ?? null) as Hideable | null;
    const existing = this.indicators[row.kind];
    if (raw && existing?.wraps(raw)) return;
    existing?.dispose();
    this.indicators[row.kind] = raw ? new HiddenIndicator(raw) : null;
  }

  private resolveContainer(): void {
    const container = this.panel._indicators ?? this.panel._grid ?? null;
    if (container !== this.container) {
      this.detachRebuildWatch();
      this.attachRebuildWatch(container);
    }
  }

  private attachRebuildWatch(container: any): void {
    if (!container) return;
    container.connectObject(
      'child-added', () => this.reapply(),
      'child-removed', () => this.reapply(),
      this,
    );
    this.container = container;
  }

  private detachRebuildWatch(): void {
    if (!this.container) return;
    this.container.disconnectObject(this);
    this.container = null;
  }

  private reapply(): void {
    if (this.settings) this.sync(this.settings);
  }

  private applyHide(kind: IndicatorKind, hide: boolean): void {
    const indicator = this.indicators[kind];
    if (!indicator) return;

    if (hide) indicator.hide();
    else indicator.restore();
  }
}
