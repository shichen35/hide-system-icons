interface Handler {
  signal: string;
  handler: () => void;
  owner: object;
}

export class FakeContainer {
  connectCallCount = 0;
  disconnectCallCount = 0;

  private handlers: Handler[] = [];

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

  emit(signal: string): void {
    for (const { signal: s, handler } of this.handlers.slice()) {
      if (s === signal) handler();
    }
  }
}
