import { Hideable } from "../../hiddenIndicator.js";

interface Handler {
  signal: string;
  handler: () => void;
  owner: object;
}

export class FakeHideable implements Hideable {
  connectCallCount = 0;
  disconnectCallCount = 0;
  hideCallCount = 0;
  showCallCount = 0;

  private _visible: boolean;
  private handlers: Handler[] = [];

  constructor(initialVisible: boolean) {
    this._visible = initialVisible;
  }

  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    if (value === this._visible) return;
    this._visible = value;
    for (const { signal, handler } of this.handlers.slice()) {
      if (signal === 'notify::visible') handler();
    }
  }

  hide(): void {
    this.hideCallCount++;
    this.visible = false;
  }

  show(): void {
    this.showCallCount++;
    this.visible = true;
  }

  connectObject(...args: unknown[]): void {
    this.connectCallCount++;
    const owner = args[args.length - 1] as object;
    for (let i = 0; i + 1 < args.length; i += 2) {
      this.handlers.push({
        signal: args[i] as string,
        handler: args[i + 1] as () => void,
        owner,
      });
    }
  }

  disconnectObject(owner: object): void {
    this.disconnectCallCount++;
    this.handlers = this.handlers.filter(h => h.owner !== owner);
  }
}
