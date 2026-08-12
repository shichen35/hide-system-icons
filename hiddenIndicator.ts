export interface Hideable {
  hide(): void;
  show(): void;
  visible: boolean;
  connectObject(...args: any[]): void;
  disconnectObject(object: object): void;
}

export class HiddenIndicator {
  private readonly indicator: Hideable;
  private hiding: boolean = false;
  private wantedVisible: boolean | null = null;

  constructor(indicator: Hideable) {
    this.indicator = indicator;
  }

  hide(): void {
    if (!this.hiding) {
      this.wantedVisible = this.indicator.visible;
      this.hiding = true;
      this.indicator.connectObject('notify::visible', () => {
        if (this.indicator.visible) {
          this.wantedVisible = true;
          this.indicator.hide();
        }
      }, this);
    }
    this.indicator.hide();
  }

  restore(): void {
    if (this.hiding) {
      this.indicator.disconnectObject(this);
      this.hiding = false;
    }
    if (this.wantedVisible !== null) {
      if (this.wantedVisible) this.indicator.show();
      else this.indicator.hide();
    }
  }

  dispose(): void {
    this.restore();
    this.wantedVisible = null;
  }
}
